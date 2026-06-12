import mongoose from 'mongoose';

const WarehouseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Warehouse name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Warehouse code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    address: {
      country: String,
      city: String,
      area: String,
      street: String,
      postalCode: String,
    },
    phone: String,
    email: String,
    isActive: { type: Boolean, default: true, index: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const Warehouse = mongoose.model('Warehouse', WarehouseSchema);
export default Warehouse;
