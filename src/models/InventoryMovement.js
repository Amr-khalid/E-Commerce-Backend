import mongoose from 'mongoose';
import { INVENTORY_MOVEMENT_TYPES } from '../config/constants.js';

const InventoryMovementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: INVENTORY_MOVEMENT_TYPES,
      required: [true, 'Movement type is required'],
      index: true,
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
    },
    previousQuantity: { type: Number },
    newQuantity: { type: Number },
    relatedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    fromWarehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
    },
    toWarehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: { type: String, trim: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

InventoryMovementSchema.index({ product: 1, createdAt: -1 });
InventoryMovementSchema.index({ warehouse: 1, createdAt: -1 });
InventoryMovementSchema.index({ type: 1, createdAt: -1 });

const InventoryMovement = mongoose.model('InventoryMovement', InventoryMovementSchema);
export default InventoryMovement;
