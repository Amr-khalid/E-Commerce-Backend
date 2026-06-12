import mongoose from 'mongoose';

const CouponBatchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    prefix: { type: String, uppercase: true, trim: true },
    count: { type: Number, required: true, min: 1 },
    generatedCount: { type: Number, default: 0 },

    // Template for generated coupons
    template: {
      type: { type: String, required: true },
      value: { type: Number, required: true },
      scope: String,
      startsAt: Date,
      expiresAt: Date,
      maxUsesPerUser: { type: Number, default: 1 },
      minOrderAmount: Number,
      maxDiscountCap: Number,
      singleUse: { type: Boolean, default: true },
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'completed',
    },
  },
  { timestamps: true },
);

const CouponBatch = mongoose.model('CouponBatch', CouponBatchSchema);
export default CouponBatch;
