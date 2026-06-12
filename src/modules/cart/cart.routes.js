import { Router } from 'express';
import Cart from '../../models/Cart.js';
import Product from '../../models/Product.js';
import DiscountEngine from '../../services/DiscountEngine.js';
import ApiResponse from '../../utils/ApiResponse.js';
import ApiError from '../../utils/ApiError.js';
import asyncHandler from '../../middleware/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import validate from '../../middleware/validate.js';
import Joi from 'joi';

const addItemSchema = Joi.object({
  productId: Joi.string().hex().length(24).required(),
  quantity: Joi.number().integer().min(1).default(1),
});

const updateItemSchema = Joi.object({
  quantity: Joi.number().integer().min(0).required(), // 0 = remove
});

const applyCouponSchema = Joi.object({
  couponCode: Joi.string().trim().uppercase().allow('', null),
});

const router = Router();

// Get cart with populated products
router.get('/',
  authenticate,
  asyncHandler(async (req, res) => {
    let cart = await Cart.findOne({ user: req.user._id })
      .populate('items.product', 'name slug price discountPrice stock images isActive status');

    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    ApiResponse.success(res, { data: cart });
  }),
);

// Add item to cart
router.post('/items',
  authenticate,
  validate(addItemSchema),
  asyncHandler(async (req, res) => {
    const { productId, quantity } = req.body;

    // Verify product exists and is available
    const product = await Product.findOne({
      _id: productId,
      isActive: true,
      status: 'active',
    }).lean();

    if (!product) throw ApiError.notFound('Product not found');
    if (product.stock < quantity) {
      throw ApiError.badRequest(`Insufficient stock. Available: ${product.stock}`);
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    // Check if product already in cart
    const existingIndex = cart.items.findIndex(
      (i) => i.product.toString() === productId,
    );

    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += quantity;
      // Check stock for total quantity
      if (cart.items[existingIndex].quantity > product.stock) {
        throw ApiError.badRequest(`Cannot add more. Max available: ${product.stock}`);
      }
    } else {
      cart.items.push({ product: productId, quantity });
    }

    await cart.save();

    cart = await Cart.findById(cart._id)
      .populate('items.product', 'name slug price discountPrice stock images');

    ApiResponse.success(res, { message: 'Item added to cart', data: cart });
  }),
);

// Update item quantity
router.patch('/items/:productId',
  authenticate,
  validate(updateItemSchema),
  asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body;

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) throw ApiError.notFound('Cart not found');

    if (quantity === 0) {
      // Remove item
      cart.items = cart.items.filter((i) => i.product.toString() !== productId);
    } else {
      const item = cart.items.find((i) => i.product.toString() === productId);
      if (!item) throw ApiError.notFound('Item not in cart');

      // Check stock
      const product = await Product.findById(productId).lean();
      if (product && quantity > product.stock) {
        throw ApiError.badRequest(`Max available: ${product.stock}`);
      }
      item.quantity = quantity;
    }

    await cart.save();

    const populatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'name slug price discountPrice stock images');

    ApiResponse.success(res, { data: populatedCart });
  }),
);

// Remove item from cart
router.delete('/items/:productId',
  authenticate,
  asyncHandler(async (req, res) => {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) throw ApiError.notFound('Cart not found');

    cart.items = cart.items.filter((i) => i.product.toString() !== req.params.productId);
    await cart.save();

    ApiResponse.success(res, { message: 'Item removed from cart' });
  }),
);

// Apply/remove coupon
router.post('/coupon',
  authenticate,
  validate(applyCouponSchema),
  asyncHandler(async (req, res) => {
    const cart = await Cart.findOneAndUpdate(
      { user: req.user._id },
      { couponCode: req.body.couponCode || null },
      { new: true },
    );
    if (!cart) throw ApiError.notFound('Cart not found');
    ApiResponse.success(res, { message: 'Coupon updated', data: cart });
  }),
);

// Preview cart totals with all discounts
router.post('/preview',
  authenticate,
  asyncHandler(async (req, res) => {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart || cart.items.length === 0) {
      throw ApiError.badRequest('Cart is empty');
    }

    const calculation = await DiscountEngine.calculate({
      items: cart.items.map((i) => ({ product: i.product, quantity: i.quantity })),
      couponCode: cart.couponCode,
      userId: req.user._id,
    });

    ApiResponse.success(res, { data: calculation });
  }),
);

export default router;
