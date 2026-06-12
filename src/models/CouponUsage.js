import mongoose from 'mongoose';

const CouponUsageSchema = new mongoose.Schema(
  {
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    discountApplied: {
      type: Number,
      required: true,
    },
    usedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  },
);

CouponUsageSchema.index({ coupon: 1, user: 1 });

const CouponUsage = mongoose.model('CouponUsage', CouponUsageSchema);
export default CouponUsage;
