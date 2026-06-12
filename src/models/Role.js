import mongoose from 'mongoose';
import { ROLE_LIST } from '../config/constants.js';

const RoleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: ROLE_LIST,
      unique: true,
      required: [true, 'Role name is required'],
      index: true,
    },
    permissions: [{ type: String }],
    description: { type: String },
  },
  { timestamps: true },
);

const Role = mongoose.model('Role', RoleSchema);
export default Role;
