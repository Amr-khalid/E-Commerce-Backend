import mongoose from 'mongoose';

const OrderStatusHistorySchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    from: { type: String },
    to: { type: String, required: true },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    note: { type: String, trim: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

OrderStatusHistorySchema.index({ order: 1, createdAt: -1 });

const OrderStatusHistory = mongoose.model('OrderStatusHistory', OrderStatusHistorySchema);
export default OrderStatusHistory;
