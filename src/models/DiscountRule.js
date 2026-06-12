import mongoose from 'mongoose';
import { DISCOUNT_RULE_TYPES } from '../config/constants.js';

const DiscountRuleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Discount rule name is required'],
      trim: true,
    },
    description: { type: String, trim: true },
    type: {
      type: String,
      enum: Object.values(DISCOUNT_RULE_TYPES),
      required: [true, 'Discount rule type is required'],
    },

    conditions: {
      minSpend: { type: Number, min: 0 },
      minQuantity: { type: Number, min: 1 },
      productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
      categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
      flagsRequired: [String], // ['featured', 'newArrival']
    },

    discount: {
      kind: {
        type: String,
        enum: ['percentage', 'fixed'],
        required: true,
      },
      value: {
        type: Number,
        required: true,
        min: 0,
      },
      cap: { type: Number, min: 0 }, // max discount cap
    },

    startsAt: { type: Date },
    expiresAt: { type: Date },
    priority: { type: Number, default: 0, index: true },
    stackable: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

DiscountRuleSchema.index({ isActive: 1, priority: -1 });
DiscountRuleSchema.index({ type: 1, isActive: 1 });

const DiscountRule = mongoose.model('DiscountRule', DiscountRuleSchema);
export default DiscountRule;
