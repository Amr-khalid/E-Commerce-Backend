import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import CouponUsage from '../models/CouponUsage.js';
import DiscountRule from '../models/DiscountRule.js';
import Order from '../models/Order.js';
import config from '../config/index.js';
import ApiError from '../utils/ApiError.js';
import logger from '../config/logger.js';

/**
 * Discount Engine — 8-step pipeline for calculating order totals.
 *
 * Pipeline:
 * 1. Collect cart products
 * 2. Apply product direct discounts (discount_price)
 * 3. Apply eligible automatic discount rules
 * 4. Validate coupon if present
 * 5. Apply coupon discount
 * 6. Calculate shipping (apply free_shipping if applicable)
 * 7. Calculate tax on final amount
 * 8. Produce discount summary
 */
class DiscountEngine {
  /**
   * Calculate the full order totals from cart items.
   *
   * @param {Object} params
   * @param {Array<{product: ObjectId, quantity: number}>} params.items Cart items
   * @param {string|null} params.couponCode Coupon code if any
   * @param {ObjectId} params.userId User ID
   * @param {Object|null} params.shippingAddress Shipping address for shipping calc
   * @returns {Object} Complete order calculation
   */
  static async calculate({ items, couponCode = null, userId, shippingAddress = null }) {
    const result = {
      items: [],
      subtotal: 0,
      productDiscounts: 0,
      automaticDiscounts: 0,
      couponDiscount: 0,
      totalDiscount: 0,
      shippingCost: 0,
      taxAmount: 0,
      grandTotal: 0,
      appliedDiscounts: [],
      couponValidation: null,
    };

    // ─── Step 1: Collect products ─────────────────────
    const productIds = items.map((i) => i.product);
    const products = await Product.find({
      _id: { $in: productIds },
      isActive: true,
      status: 'active',
    }).lean();

    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    for (const item of items) {
      const product = productMap.get(item.product.toString());
      if (!product) {
        throw ApiError.badRequest(`Product ${item.product} not found or inactive`);
      }

      const lineItem = {
        product: product._id,
        name: product.name,
        sku: product.sku,
        image: product.images?.find((img) => img.isMain)?.url || product.images?.[0]?.url,
        unitPrice: product.price,
        effectivePrice: product.price,
        quantity: item.quantity,
        productDiscount: 0,
        automaticDiscount: 0,
        couponDiscount: 0,
        tax: 0,
        total: 0,
        attributes: item.attributes || [],
        categories: product.categories || [],
        flags: product.flags || {},
      };

      // ─── Step 2: Apply product direct discounts ───────
      if (product.discountPrice != null && product.discountPrice < product.price) {
        const discountPerUnit = product.price - product.discountPrice;
        lineItem.effectivePrice = product.discountPrice;
        lineItem.productDiscount = discountPerUnit * item.quantity;
        result.productDiscounts += lineItem.productDiscount;

        result.appliedDiscounts.push({
          type: 'product_discount',
          source: `product:${product.sku}`,
          refId: product._id,
          amount: lineItem.productDiscount,
          scope: 'item',
        });
      }

      lineItem.total = lineItem.effectivePrice * item.quantity;
      result.subtotal += product.price * item.quantity;
      result.items.push(lineItem);
    }

    // ─── Step 3: Apply automatic discount rules ───────
    const now = new Date();
    const activeRules = await DiscountRule.find({
      isActive: true,
      $or: [
        { startsAt: null, expiresAt: null },
        { startsAt: { $lte: now }, expiresAt: { $gte: now } },
        { startsAt: { $lte: now }, expiresAt: null },
        { startsAt: null, expiresAt: { $gte: now } },
      ],
    })
      .sort({ priority: -1 })
      .lean();

    let nonStackableApplied = false;
    const subtotalAfterProductDiscounts = result.subtotal - result.productDiscounts;

    for (const rule of activeRules) {
      if (nonStackableApplied && !rule.stackable) continue;

      const ruleDiscount = this._evaluateRule(rule, result.items, subtotalAfterProductDiscounts);
      if (ruleDiscount > 0) {
        result.automaticDiscounts += ruleDiscount;

        result.appliedDiscounts.push({
          type: 'automatic',
          source: `rule:${rule.name}`,
          refId: rule._id,
          amount: ruleDiscount,
          scope: 'order',
        });

        if (!rule.stackable) {
          nonStackableApplied = true;
        }
      }
    }

    // ─── Step 4 & 5: Validate and apply coupon ────────
    let freeShipping = false;
    if (couponCode) {
      const couponResult = await this._validateAndApplyCoupon(
        couponCode,
        userId,
        result.items,
        subtotalAfterProductDiscounts - result.automaticDiscounts,
      );

      result.couponValidation = couponResult.validation;

      if (couponResult.valid) {
        if (couponResult.type === 'free_shipping') {
          freeShipping = true;
          result.appliedDiscounts.push({
            type: 'free_shipping',
            source: `coupon:${couponCode}`,
            refId: couponResult.couponId,
            amount: 0, // will be set after shipping calc
            scope: 'shipping',
          });
        } else {
          result.couponDiscount = couponResult.discount;
          result.appliedDiscounts.push({
            type: 'coupon',
            source: `coupon:${couponCode}`,
            refId: couponResult.couponId,
            amount: couponResult.discount,
            scope: 'order',
          });
        }
      }
    }

    // ─── Ensure total discounts don't exceed subtotal ─
    result.totalDiscount = result.productDiscounts + result.automaticDiscounts + result.couponDiscount;
    if (result.totalDiscount > result.subtotal) {
      result.totalDiscount = result.subtotal;
      // Recalculate coupon discount to fit
      result.couponDiscount = result.subtotal - result.productDiscounts - result.automaticDiscounts;
      if (result.couponDiscount < 0) result.couponDiscount = 0;
    }

    // ─── Step 6: Calculate shipping ───────────────────
    const afterDiscountTotal = result.subtotal - result.totalDiscount;
    result.shippingCost = config.shipping.defaultCost;

    // Free shipping threshold
    if (afterDiscountTotal >= config.shipping.freeThreshold) {
      freeShipping = true;
    }

    if (freeShipping) {
      // Update the free_shipping discount amount
      const fsDiscount = result.appliedDiscounts.find((d) => d.type === 'free_shipping');
      if (fsDiscount) {
        fsDiscount.amount = result.shippingCost;
      }
      result.shippingCost = 0;
    }

    // ─── Step 7: Calculate tax ────────────────────────
    const taxableAmount = afterDiscountTotal;
    result.taxAmount = Math.round((taxableAmount * config.tax.defaultRate) / 100 * 100) / 100;

    // ─── Step 8: Grand total ──────────────────────────
    result.grandTotal = Math.max(0, afterDiscountTotal + result.shippingCost + result.taxAmount);

    // Round all numbers
    result.subtotal = Math.round(result.subtotal * 100) / 100;
    result.totalDiscount = Math.round(result.totalDiscount * 100) / 100;
    result.grandTotal = Math.round(result.grandTotal * 100) / 100;

    logger.debug('Discount Engine calculation complete', {
      subtotal: result.subtotal,
      totalDiscount: result.totalDiscount,
      grandTotal: result.grandTotal,
      discountsApplied: result.appliedDiscounts.length,
    });

    return result;
  }

  /**
   * Evaluate a single discount rule against the cart.
   * @private
   */
  static _evaluateRule(rule, items, subtotal) {
    const now = new Date();

    // Check time bounds
    if (rule.startsAt && new Date(rule.startsAt) > now) return 0;
    if (rule.expiresAt && new Date(rule.expiresAt) < now) return 0;

    let eligibleAmount = 0;
    let eligibleItems = items;

    // Filter items by scope
    if (rule.conditions.productIds && rule.conditions.productIds.length > 0) {
      const pidSet = new Set(rule.conditions.productIds.map(String));
      eligibleItems = items.filter((i) => pidSet.has(i.product.toString()));
    }
    if (rule.conditions.categoryIds && rule.conditions.categoryIds.length > 0) {
      const cidSet = new Set(rule.conditions.categoryIds.map(String));
      eligibleItems = eligibleItems.filter((i) =>
        i.categories.some((c) => cidSet.has(c.toString())),
      );
    }
    if (rule.conditions.flagsRequired && rule.conditions.flagsRequired.length > 0) {
      eligibleItems = eligibleItems.filter((i) =>
        rule.conditions.flagsRequired.some((flag) => i.flags[flag]),
      );
    }

    if (eligibleItems.length === 0) return 0;

    eligibleAmount = eligibleItems.reduce(
      (sum, i) => sum + i.effectivePrice * i.quantity,
      0,
    );
    const totalQuantity = eligibleItems.reduce((sum, i) => sum + i.quantity, 0);

    switch (rule.type) {
      case 'spend_threshold': {
        if (subtotal < (rule.conditions.minSpend || 0)) return 0;
        break;
      }
      case 'bulk_discount': {
        if (totalQuantity < (rule.conditions.minQuantity || 0)) return 0;
        break;
      }
      case 'scheduled': {
        // Already checked time bounds above
        break;
      }
      case 'flagged_products': {
        // Already filtered by flags
        break;
      }
      default:
        return 0;
    }

    // Calculate discount amount
    let discount = 0;
    if (rule.discount.kind === 'percentage') {
      discount = (eligibleAmount * rule.discount.value) / 100;
    } else {
      discount = rule.discount.value;
    }

    // Apply cap
    if (rule.discount.cap && discount > rule.discount.cap) {
      discount = rule.discount.cap;
    }

    return Math.round(discount * 100) / 100;
  }

  /**
   * Validate and calculate coupon discount.
   * @private
   */
  static async _validateAndApplyCoupon(code, userId, items, currentTotal) {
    const result = {
      valid: false,
      validation: { valid: false, message: '' },
      discount: 0,
      type: null,
      couponId: null,
    };

    const coupon = await Coupon.findOne({ code: code.toUpperCase() }).lean();

    if (!coupon) {
      result.validation.message = 'Coupon not found';
      return result;
    }

    result.couponId = coupon._id;
    result.type = coupon.type;
    const now = new Date();

    // Status check
    if (coupon.status !== 'active') {
      result.validation.message = `Coupon is ${coupon.status}`;
      return result;
    }

    // Date check
    if (new Date(coupon.startsAt) > now) {
      result.validation.message = 'Coupon is not yet active';
      return result;
    }
    if (new Date(coupon.expiresAt) < now) {
      result.validation.message = 'Coupon has expired';
      return result;
    }

    // Max uses check
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      result.validation.message = 'Coupon usage limit reached';
      return result;
    }

    // Per-user usage check
    if (coupon.maxUsesPerUser) {
      const userUsageCount = await CouponUsage.countDocuments({
        coupon: coupon._id,
        user: userId,
      });
      if (userUsageCount >= coupon.maxUsesPerUser) {
        result.validation.message = 'You have already used this coupon';
        return result;
      }
    }

    // Assigned user check
    if (coupon.assignedToUser && coupon.assignedToUser.toString() !== userId.toString()) {
      result.validation.message = 'This coupon is not assigned to you';
      return result;
    }

    // First order check
    if (coupon.firstOrderOnly) {
      const orderCount = await Order.countDocuments({ user: userId });
      if (orderCount > 0) {
        result.validation.message = 'This coupon is for first orders only';
        return result;
      }
    }

    // Minimum order amount
    if (coupon.minOrderAmount && currentTotal < coupon.minOrderAmount) {
      result.validation.message = `Minimum order amount is ${coupon.minOrderAmount}`;
      return result;
    }

    // Calculate discount based on scope
    let eligibleAmount = currentTotal;

    if (coupon.scope === 'products' && coupon.productIds.length > 0) {
      const pidSet = new Set(coupon.productIds.map(String));
      eligibleAmount = items
        .filter((i) => pidSet.has(i.product.toString()))
        .reduce((sum, i) => sum + i.effectivePrice * i.quantity, 0);
    }

    if (coupon.scope === 'categories' && coupon.categoryIds.length > 0) {
      const cidSet = new Set(coupon.categoryIds.map(String));
      eligibleAmount = items
        .filter((i) => i.categories.some((c) => cidSet.has(c.toString())))
        .reduce((sum, i) => sum + i.effectivePrice * i.quantity, 0);
    }

    if (eligibleAmount <= 0) {
      result.validation.message = 'No eligible items for this coupon';
      return result;
    }

    // Calculate discount
    let discount = 0;

    switch (coupon.type) {
      case 'percentage':
        discount = (eligibleAmount * coupon.value) / 100;
        break;

      case 'fixed_amount':
        discount = coupon.value;
        break;

      case 'free_shipping':
        result.valid = true;
        result.validation = { valid: true, message: 'Free shipping applied' };
        return result;

      case 'buy_x_get_y': {
        const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
        if (totalQty >= coupon.buyQuantity) {
          const cheapestItems = [...items].sort(
            (a, b) => a.effectivePrice - b.effectivePrice,
          );
          let freeQty = coupon.getQuantity;
          for (const item of cheapestItems) {
            if (freeQty <= 0) break;
            const qtyToDiscount = Math.min(freeQty, item.quantity);
            discount += item.effectivePrice * qtyToDiscount * (coupon.getDiscountPercent / 100);
            freeQty -= qtyToDiscount;
          }
        } else {
          result.validation.message = `Buy at least ${coupon.buyQuantity} items to use this coupon`;
          return result;
        }
        break;
      }
    }

    // Apply cap
    if (coupon.maxDiscountCap && discount > coupon.maxDiscountCap) {
      discount = coupon.maxDiscountCap;
    }

    // Don't exceed eligible amount
    discount = Math.min(discount, eligibleAmount);
    discount = Math.round(discount * 100) / 100;

    result.valid = true;
    result.discount = discount;
    result.validation = {
      valid: true,
      message: 'Coupon applied successfully',
      discount,
      couponType: coupon.type,
    };

    return result;
  }
}

export default DiscountEngine;
