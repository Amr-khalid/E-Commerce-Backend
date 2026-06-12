import mongoose from 'mongoose';
import Order from '../../models/Order.js';
import OrderStatusHistory from '../../models/OrderStatusHistory.js';
import Product from '../../models/Product.js';
import Inventory from '../../models/Inventory.js';
import InventoryMovement from '../../models/InventoryMovement.js';
import Cart from '../../models/Cart.js';
import CouponUsage from '../../models/CouponUsage.js';
import Coupon from '../../models/Coupon.js';
import Address from '../../models/Address.js';
import DiscountEngine from '../../services/DiscountEngine.js';
import NotificationService from '../../services/NotificationService.js';
import EmailService from '../../services/EmailService.js';
import { generateOrderNumber } from '../../utils/crypto.js';
import ApiError from '../../utils/ApiError.js';
import logger from '../../config/logger.js';
import { ORDER_STATUS_TRANSITIONS, NOTIFICATION_TYPES } from '../../config/constants.js';

class OrderService {
  /**
   * Create order — ATOMIC: checks stock, applies discounts, updates inventory.
   * Uses MongoDB session for transactional consistency.
   */
  static async createOrder({ userId, shippingAddressId, billingAddressId, paymentMethod, couponCode, customerNotes }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Get cart
      const cart = await Cart.findOne({ user: userId }).session(session);
      if (!cart || cart.items.length === 0) {
        throw ApiError.badRequest('Cart is empty');
      }

      // 2. Get addresses
      const [shippingAddr, billingAddr] = await Promise.all([
        Address.findOne({ _id: shippingAddressId, user: userId }).lean(),
        Address.findOne({ _id: billingAddressId || shippingAddressId, user: userId }).lean(),
      ]);

      if (!shippingAddr) throw ApiError.badRequest('Invalid shipping address');

      // 3. Verify stock atomically & reserve
      const productIds = cart.items.map((i) => i.product);
      const products = await Product.find({ _id: { $in: productIds } }).session(session).lean();
      const productMap = new Map(products.map((p) => [p._id.toString(), p]));

      for (const item of cart.items) {
        const product = productMap.get(item.product.toString());
        if (!product) {
          throw ApiError.badRequest(`Product ${item.product} not found`);
        }
        if (!product.isActive || product.status !== 'active') {
          throw ApiError.badRequest(`Product "${product.name}" is not available`);
        }

        // Atomic stock check + decrement
        const result = await Product.findOneAndUpdate(
          {
            _id: item.product,
            stock: { $gte: item.quantity },
          },
          {
            $inc: { stock: -item.quantity, salesCount: item.quantity },
          },
          { session, new: true },
        );

        if (!result) {
          throw ApiError.badRequest(
            `Insufficient stock for "${product.name}". Available: ${product.stock}`,
          );
        }
      }

      // 4. Calculate totals with discount engine
      const effectiveCoupon = couponCode || cart.couponCode;
      const calculation = await DiscountEngine.calculate({
        items: cart.items.map((i) => ({
          product: i.product,
          quantity: i.quantity,
        })),
        couponCode: effectiveCoupon,
        userId,
      });

      // 5. Generate order number
      const orderNumber = await generateOrderNumber(mongoose.connection);

      // 6. Build order items (snapshots)
      const orderItems = calculation.items.map((item) => ({
        product: item.product,
        name: item.name,
        sku: item.sku,
        image: item.image,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        discount: item.productDiscount + item.automaticDiscount + item.couponDiscount,
        tax: 0,
        total: item.effectivePrice * item.quantity,
        attributes: item.attributes,
      }));

      // 7. Create order
      const [order] = await Order.create(
        [
          {
            orderNumber,
            user: userId,
            items: orderItems,
            subtotal: calculation.subtotal,
            totalDiscount: calculation.totalDiscount,
            shippingCost: calculation.shippingCost,
            taxAmount: calculation.taxAmount,
            grandTotal: calculation.grandTotal,
            discounts: calculation.appliedDiscounts,
            shippingAddress: {
              fullName: shippingAddr.fullName,
              phone: shippingAddr.phone,
              country: shippingAddr.country,
              city: shippingAddr.city,
              area: shippingAddr.area,
              street: shippingAddr.street,
              building: shippingAddr.building,
              apartment: shippingAddr.apartment,
              postalCode: shippingAddr.postalCode,
            },
            billingAddress: {
              fullName: billingAddr.fullName,
              phone: billingAddr.phone,
              country: billingAddr.country,
              city: billingAddr.city,
              area: billingAddr.area,
              street: billingAddr.street,
              building: billingAddr.building,
              apartment: billingAddr.apartment,
              postalCode: billingAddr.postalCode,
            },
            paymentMethod,
            couponCode: effectiveCoupon,
            customerNotes,
          },
        ],
        { session },
      );

      // 8. Record coupon usage
      if (effectiveCoupon && calculation.couponDiscount > 0) {
        const coupon = await Coupon.findOne({ code: effectiveCoupon.toUpperCase() }).session(session);
        if (coupon) {
          await CouponUsage.create(
            [
              {
                coupon: coupon._id,
                user: userId,
                order: order._id,
                discountApplied: calculation.couponDiscount,
              },
            ],
            { session },
          );
          await Coupon.findByIdAndUpdate(coupon._id, { $inc: { usedCount: 1 } }, { session });
        }
      }

      // 9. Record inventory movements
      for (const item of cart.items) {
        await InventoryMovement.create(
          [
            {
              product: item.product,
              warehouse: (await Inventory.findOne({ product: item.product }).lean())?.warehouse,
              type: 'sale',
              quantity: -item.quantity,
              relatedOrder: order._id,
              performedBy: userId,
              reason: `Order ${orderNumber}`,
            },
          ],
          { session },
        );
      }

      // 10. Record initial status history
      await OrderStatusHistory.create(
        [{ order: order._id, from: null, to: 'pending', changedBy: userId }],
        { session },
      );

      // 11. Clear cart
      await Cart.findOneAndUpdate({ user: userId }, { items: [], couponCode: null }, { session });

      await session.commitTransaction();

      // 12. Non-blocking: notifications + email
      NotificationService.send({
        userId,
        type: NOTIFICATION_TYPES.ORDER_CONFIRMED,
        title: 'Order Placed',
        body: `Your order ${orderNumber} has been placed successfully`,
        data: { orderId: order._id, orderNumber },
      }).catch(() => {});

      logger.info(`Order created: ${orderNumber}`, { userId, grandTotal: calculation.grandTotal });

      return order;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get user's orders with pagination.
   */
  static async getUserOrders(userId, query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const perPage = Math.min(50, parseInt(query.per_page, 10) || 10);

    const filter = { user: userId };
    if (query.status) filter.status = query.status;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage)
        .lean(),
      Order.countDocuments(filter),
    ]);

    return {
      data: orders,
      pagination: {
        total,
        per_page: perPage,
        current_page: page,
        last_page: Math.ceil(total / perPage),
      },
    };
  }

  /**
   * Get order details with full history.
   */
  static async getOrderDetails(orderId, userId = null) {
    const filter = { _id: orderId };
    if (userId) filter.user = userId;

    const order = await Order.findOne(filter)
      .populate('user', 'firstName lastName email phone')
      .lean();

    if (!order) throw ApiError.notFound('Order not found');

    const history = await OrderStatusHistory.find({ order: orderId })
      .populate('changedBy', 'firstName lastName')
      .sort({ createdAt: 1 })
      .lean();

    return { ...order, statusHistory: history };
  }

  /**
   * Update order status with transition validation.
   */
  static async updateStatus(orderId, newStatus, changedBy, note = '') {
    const order = await Order.findById(orderId);
    if (!order) throw ApiError.notFound('Order not found');

    const allowedTransitions = ORDER_STATUS_TRANSITIONS[order.status];
    if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
      throw ApiError.badRequest(
        `Cannot transition from "${order.status}" to "${newStatus}"`,
      );
    }

    const oldStatus = order.status;
    order.status = newStatus;

    // Set timestamps
    const timestampMap = {
      confirmed: 'confirmedAt',
      shipped: 'shippedAt',
      delivered: 'deliveredAt',
      cancelled: 'cancelledAt',
    };
    if (timestampMap[newStatus]) {
      order[timestampMap[newStatus]] = new Date();
    }

    await order.save();

    // Record history
    await OrderStatusHistory.create({
      order: orderId,
      from: oldStatus,
      to: newStatus,
      changedBy,
      note,
    });

    // Handle cancellation: restore stock
    if (newStatus === 'cancelled') {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: item.quantity, salesCount: -item.quantity },
        });
      }
    }

    // Notifications
    const notifTypeMap = {
      confirmed: NOTIFICATION_TYPES.ORDER_CONFIRMED,
      shipped: NOTIFICATION_TYPES.ORDER_SHIPPED,
      delivered: NOTIFICATION_TYPES.ORDER_DELIVERED,
      cancelled: NOTIFICATION_TYPES.ORDER_CANCELLED,
    };
    if (notifTypeMap[newStatus]) {
      NotificationService.send({
        userId: order.user,
        type: notifTypeMap[newStatus],
        title: `Order ${order.orderNumber}`,
        body: `Your order status changed to: ${newStatus}`,
        data: { orderId, orderNumber: order.orderNumber, status: newStatus },
      }).catch(() => {});
    }

    return order;
  }

  /**
   * Cancel order by customer.
   */
  static async cancelOrder(orderId, userId) {
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) throw ApiError.notFound('Order not found');

    if (!['pending', 'confirmed'].includes(order.status)) {
      throw ApiError.badRequest('Order cannot be cancelled at this stage');
    }

    return this.updateStatus(orderId, 'cancelled', userId, 'Cancelled by customer');
  }

  /**
   * Admin: Get all orders with filters.
   */
  static async getAllOrders(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const perPage = Math.min(50, parseInt(query.per_page, 10) || 20);

    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.payment_status) filter.paymentStatus = query.payment_status;
    if (query.from) filter.createdAt = { $gte: new Date(query.from) };
    if (query.to) filter.createdAt = { ...filter.createdAt, $lte: new Date(query.to) };

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('user', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage)
        .lean(),
      Order.countDocuments(filter),
    ]);

    return {
      data: orders,
      pagination: {
        total,
        per_page: perPage,
        current_page: page,
        last_page: Math.ceil(total / perPage),
      },
    };
  }
}

export default OrderService;
