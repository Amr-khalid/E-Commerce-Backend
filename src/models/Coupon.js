import mongoose from 'mongoose';
import {
  COUPON_TYPES,
  COUPON_SCOPES,
  COUPON_STATUS,
} from '../config/constants.js';

const CouponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    description: { type: String, trim: true },

    type: {
      type: String,
      enum: Object.values(COUPON_TYPES),
      required: [true, 'Coupon type is required'],
    },
    value: {
      type: Number,
      required: [true, 'Coupon value is required'],
      min: 0,
    },

    // buy_x_get_y specifics
    buyQuantity: { type: Number, min: 1 },
    getQuantity: { type: Number, min: 1 },
    getDiscountPercent: { type: Number, default: 100, min: 0, max: 100 },

    // Scope
    scope: {
      type: String,
      enum: Object.values(COUPON_SCOPES),
      default: 'order',
    },
    productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    firstOrderOnly: { type: Boolean, default: false },

    // Constraints
    startsAt: { type: Date, required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    maxUses: { type: Number, default: null },
    maxUsesPerUser: { type: Number, default: 1 },
    minOrderAmount: { type: Number, default: 0 },
    maxDiscountCap: { type: Number, default: null },

    // Usage counter
    usedCount: { type: Number, default: 0 },

    // Single-use / assigned
    singleUse: { type: Boolean, default: false },
    assignedToUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      sparse: true,
      index: true,
    },
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CouponBatch',
      index: true,
    },

    stackable: { type: Boolean, default: false },
    priority: { type: Number, default: 0 },

    status: {
      type: String,
      enum: Object.values(COUPON_STATUS),
      default: 'active',
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// ─── Compound Indexes ─────────────────────────────────
CouponSchema.index({ code: 1, status: 1 });
CouponSchema.index({ startsAt: 1, expiresAt: 1, status: 1 });

const Coupon = mongoose.model('Coupon', CouponSchema);
export default Coupon;
