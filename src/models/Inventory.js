import mongoose from 'mongoose';

const InventorySchema = new mongoose.Schema(
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
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    reserved: {
      type: Number,
      default: 0,
      min: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
      min: 0,
    },
  },
  { timestamps: true },
);

// Unique compound: one record per product per warehouse
InventorySchema.index({ product: 1, warehouse: 1 }, { unique: true });

// ─── Virtuals ─────────────────────────────────────────
InventorySchema.virtual('available').get(function () {
  return Math.max(0, this.quantity - this.reserved);
});

InventorySchema.virtual('isLowStock').get(function () {
  return this.quantity <= this.lowStockThreshold;
});

const Inventory = mongoose.model('Inventory', InventorySchema);
export default Inventory;
