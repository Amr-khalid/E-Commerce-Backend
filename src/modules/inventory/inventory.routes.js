import { Router } from 'express';
import mongoose from 'mongoose';
import Warehouse from '../../models/Warehouse.js';
import Inventory from '../../models/Inventory.js';
import InventoryMovement from '../../models/InventoryMovement.js';
import Product from '../../models/Product.js';
import NotificationService from '../../services/NotificationService.js';
import ApiResponse from '../../utils/ApiResponse.js';
import ApiError from '../../utils/ApiError.js';
import asyncHandler from '../../middleware/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { authorizePermission } from '../../middleware/rbac.js';
import validate from '../../middleware/validate.js';
import { PERMISSIONS, NOTIFICATION_TYPES } from '../../config/constants.js';
import logger from '../../config/logger.js';
import Joi from 'joi';

// ─── Validation ───────────────────────────────────────
const createWarehouseSchema = Joi.object({
  name: Joi.string().trim().required(),
  code: Joi.string().trim().uppercase().required(),
  address: Joi.object({
    country: Joi.string(), city: Joi.string(), area: Joi.string(),
    street: Joi.string(), postalCode: Joi.string(),
  }),
  phone: Joi.string().allow(''),
  email: Joi.string().email().allow(''),
  isDefault: Joi.boolean(),
});

const movementSchema = Joi.object({
  productId: Joi.string().hex().length(24).required(),
  warehouseId: Joi.string().hex().length(24).required(),
  type: Joi.string().valid('in', 'out', 'adjustment', 'return').required(),
  quantity: Joi.number().integer().min(1).required(),
  reason: Joi.string().trim().allow(''),
});

const transferSchema = Joi.object({
  productId: Joi.string().hex().length(24).required(),
  fromWarehouseId: Joi.string().hex().length(24).required(),
  toWarehouseId: Joi.string().hex().length(24).required(),
  quantity: Joi.number().integer().min(1).required(),
  reason: Joi.string().trim().allow(''),
});

const router = Router();

// ─── Warehouses ───────────────────────────────────────
router.get('/warehouses',
  authenticate,
  authorizePermission(PERMISSIONS.INVENTORY_VIEW),
  asyncHandler(async (req, res) => {
    const warehouses = await Warehouse.find({ isActive: true }).lean();
    ApiResponse.success(res, { data: warehouses });
  }),
);

router.post('/warehouses',
  authenticate,
  authorizePermission(PERMISSIONS.WAREHOUSES_CREATE),
  validate(createWarehouseSchema),
  asyncHandler(async (req, res) => {
    const warehouse = await Warehouse.create(req.body);
    ApiResponse.created(res, { data: warehouse });
  }),
);

// ─── Inventory View ───────────────────────────────────
router.get('/',
  authenticate,
  authorizePermission(PERMISSIONS.INVENTORY_VIEW),
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.warehouse_id) filter.warehouse = req.query.warehouse_id;
    if (req.query.product_id) filter.product = req.query.product_id;

    const inventory = await Inventory.find(filter)
      .populate('product', 'name sku price stock')
      .populate('warehouse', 'name code')
      .lean();

    ApiResponse.success(res, { data: inventory });
  }),
);

// ─── Low Stock Alert ──────────────────────────────────
router.get('/low-stock',
  authenticate,
  authorizePermission(PERMISSIONS.INVENTORY_VIEW),
  asyncHandler(async (req, res) => {
    const lowStock = await Inventory.aggregate([
      {
        $match: {
          $expr: { $lte: ['$quantity', '$lowStockThreshold'] },
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'product',
          pipeline: [{ $project: { name: 1, sku: 1, price: 1, stock: 1, lowStockThreshold: 1 } }],
        },
      },
      { $unwind: '$product' },
      {
        $lookup: {
          from: 'warehouses',
          localField: 'warehouse',
          foreignField: '_id',
          as: 'warehouse',
          pipeline: [{ $project: { name: 1, code: 1 } }],
        },
      },
      { $unwind: '$warehouse' },
      { $sort: { quantity: 1 } },
    ]);

    ApiResponse.success(res, { data: lowStock });
  }),
);

// ─── Inventory Movement (in/out/adjust/return) ────────
router.post('/movements',
  authenticate,
  authorizePermission(PERMISSIONS.INVENTORY_MANAGE),
  validate(movementSchema),
  asyncHandler(async (req, res) => {
    const { productId, warehouseId, type, quantity, reason } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get or create inventory record
      let inv = await Inventory.findOne({ product: productId, warehouse: warehouseId }).session(session);
      if (!inv) {
        [inv] = await Inventory.create([{ product: productId, warehouse: warehouseId, quantity: 0 }], { session });
      }

      const previousQuantity = inv.quantity;
      const quantityChange = (type === 'in' || type === 'return') ? quantity : -quantity;

      if (inv.quantity + quantityChange < 0) {
        throw ApiError.badRequest(`Insufficient stock. Available: ${inv.quantity}`);
      }

      inv.quantity += quantityChange;
      await inv.save({ session });

      // Record movement
      await InventoryMovement.create([{
        product: productId,
        warehouse: warehouseId,
        type,
        quantity: quantityChange,
        previousQuantity,
        newQuantity: inv.quantity,
        performedBy: req.user._id,
        reason,
      }], { session });

      // Update product aggregate stock
      const totalStock = await Inventory.aggregate([
        { $match: { product: new mongoose.Types.ObjectId(productId) } },
        { $group: { _id: null, total: { $sum: '$quantity' } } },
      ]).session(session);

      const newStock = totalStock[0]?.total || 0;
      await Product.findByIdAndUpdate(productId, { stock: newStock }, { session });

      // Low stock check
      if (inv.quantity <= inv.lowStockThreshold) {
        NotificationService.send({
          userId: req.user._id,
          type: NOTIFICATION_TYPES.LOW_STOCK,
          title: 'Low Stock Alert',
          body: `Product inventory is low in warehouse`,
          data: { productId, warehouseId, quantity: inv.quantity },
          channels: ['in_app', 'email'],
        }).catch(() => {});
      }

      await session.commitTransaction();

      ApiResponse.success(res, {
        message: 'Inventory movement recorded',
        data: { previousQuantity, newQuantity: inv.quantity, productStock: newStock },
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }),
);

// ─── Inventory Transfer ───────────────────────────────
router.post('/transfer',
  authenticate,
  authorizePermission(PERMISSIONS.INVENTORY_TRANSFER),
  validate(transferSchema),
  asyncHandler(async (req, res) => {
    const { productId, fromWarehouseId, toWarehouseId, quantity, reason } = req.body;

    if (fromWarehouseId === toWarehouseId) {
      throw ApiError.badRequest('Source and destination warehouses must be different');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Deduct from source
      const source = await Inventory.findOneAndUpdate(
        {
          product: productId,
          warehouse: fromWarehouseId,
          quantity: { $gte: quantity },
        },
        { $inc: { quantity: -quantity } },
        { session, new: true },
      );

      if (!source) {
        throw ApiError.badRequest('Insufficient stock in source warehouse');
      }

      // Add to destination
      let dest = await Inventory.findOne({ product: productId, warehouse: toWarehouseId }).session(session);
      if (!dest) {
        [dest] = await Inventory.create([{ product: productId, warehouse: toWarehouseId, quantity: 0 }], { session });
      }
      dest.quantity += quantity;
      await dest.save({ session });

      // Record movements
      await InventoryMovement.create([
        {
          product: productId,
          warehouse: fromWarehouseId,
          type: 'transfer_out',
          quantity: -quantity,
          fromWarehouse: fromWarehouseId,
          toWarehouse: toWarehouseId,
          performedBy: req.user._id,
          reason: reason || `Transfer to ${toWarehouseId}`,
        },
        {
          product: productId,
          warehouse: toWarehouseId,
          type: 'transfer_in',
          quantity: quantity,
          fromWarehouse: fromWarehouseId,
          toWarehouse: toWarehouseId,
          performedBy: req.user._id,
          reason: reason || `Transfer from ${fromWarehouseId}`,
        },
      ], { session });

      await session.commitTransaction();

      logger.info('Inventory transfer completed', { productId, fromWarehouseId, toWarehouseId, quantity });

      ApiResponse.success(res, {
        message: 'Transfer completed',
        data: {
          source: { warehouse: fromWarehouseId, newQuantity: source.quantity },
          destination: { warehouse: toWarehouseId, newQuantity: dest.quantity },
        },
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }),
);

export default router;
