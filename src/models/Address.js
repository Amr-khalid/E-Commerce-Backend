import mongoose from 'mongoose';
import { ADDRESS_LABELS } from '../config/constants.js';

const AddressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    label: {
      type: String,
      enum: ADDRESS_LABELS,
      default: 'home',
    },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    area: { type: String, trim: true },
    street: { type: String, trim: true },
    building: { type: String, trim: true },
    apartment: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    notes: { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);

AddressSchema.index({ user: 1, isDefault: -1 });

// Ensure only one default address per user
AddressSchema.pre('save', async function (next) {
  if (this.isDefault) {
    await this.constructor.updateMany(
      { user: this.user, _id: { $ne: this._id } },
      { isDefault: false },
    );
  }
  next();
});

const Address = mongoose.model('Address', AddressSchema);
export default Address;
