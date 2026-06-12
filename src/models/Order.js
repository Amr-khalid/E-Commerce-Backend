import mongoose from 'mongoose';
import { ORDER_STATUS_LIST, PAYMENT_METHODS } from '../config/constants.js';

// ─── Embedded: Order Item (snapshot of product at purchase time) ───
const OrderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    image: String,
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
    attributes: [
      {
        key: String,
        value: String,
        _id: false,
      },
    ],
  },
  { _id: false },
);

// ─── Embedded: Applied Discount Record ────────────────
const OrderDiscountSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['coupon', 'automatic', 'product_discount', 'free_shipping'],
      required: true,
    },
    source: String, // e.g. 'coupon:SUMMER20', 'rule:bulk_discount'
    refId: mongoose.Schema.Types.ObjectId,
    amount: { type: Number, required: true },
    scope: {
      type: String,
      enum: ['order', 'shipping', 'item'],
      default: 'order',
    },
    appliedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

// ─── Embedded: Address Snapshot ───────────────────────
const AddressSnapshotSchema = new mongoose.Schema(
  {
    fullName: String,
    phone: String,
    country: String,
    city: String,
    area: String,
    street: String,
    building: String,
    apartment: String,
    postalCode: String,
    notes: String,
  },
  { _id: false },
);

// ─── Main Order Schema ───────────────────────────────
const OrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    items: [OrderItemSchema],

    subtotal: { type: Number, required: true },
    totalDiscount: { type: Number, default: 0 },
    shippingCost: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },

    discounts: [OrderDiscountSchema],

    shippingAddress: {
      type: AddressSnapshotSchema,
      required: true,
    },
    billingAddress: {
      type: AddressSnapshotSchema,
      required: true,
    },

    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'refunded', 'failed'],
      default: 'unpaid',
      index: true,
    },
    paymentRef: String,

    status: {
      type: String,
      enum: ORDER_STATUS_LIST,
      default: 'pending',
      index: true,
    },

    shippingMethod: String,
    trackingNumber: String,
    notes: String,
    customerNotes: String,
    couponCode: { type: String, index: true, sparse: true },

    placedAt: { type: Date, default: Date.now, index: true },
    confirmedAt: Date,
    shippedAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─── Compound Indexes ─────────────────────────────────
OrderSchema.index({ user: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ paymentStatus: 1, status: 1 });
OrderSchema.index({ placedAt: -1 });

// ─── Virtuals ─────────────────────────────────────────
OrderSchema.virtual('itemsCount').get(function () {
  return this.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
});

const Order = mongoose.model('Order', OrderSchema);
export default Order;
