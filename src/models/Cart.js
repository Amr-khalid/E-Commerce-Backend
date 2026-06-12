import mongoose from 'mongoose';

const CartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const CartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    items: [CartItemSchema],
    couponCode: { type: String, trim: true, uppercase: true },
  },
  { timestamps: true },
);

const Cart = mongoose.model('Cart', CartSchema);
export default Cart;
