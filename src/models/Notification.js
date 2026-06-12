import mongoose from 'mongoose';
import { NOTIFICATION_CHANNELS } from '../config/constants.js';

const NotificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Notification type is required'],
    },
    title: { type: String, required: true },
    body: { type: String },
    data: { type: mongoose.Schema.Types.Mixed }, // any extra payload
    channels: [{
      type: String,
      enum: NOTIFICATION_CHANNELS,
    }],
    isRead: { type: Boolean, default: false, index: true },
    readAt: Date,
  },
  { timestamps: true },
);

NotificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', NotificationSchema);
export default Notification;
