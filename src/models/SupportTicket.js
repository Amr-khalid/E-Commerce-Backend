import mongoose from 'mongoose';
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '../config/constants.js';

const TicketMessageSchema = new mongoose.Schema(
  {
    senderType: {
      type: String,
      enum: ['customer', 'staff'],
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    body: { type: String, required: true, trim: true },
    attachments: [String],
    isInternalNote: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const TicketStatusHistorySchema = new mongoose.Schema(
  {
    from: String,
    to: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: String,
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const SupportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: {
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
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: 300,
    },
    category: {
      type: String,
      enum: TICKET_CATEGORIES,
      required: true,
    },
    priority: {
      type: String,
      enum: TICKET_PRIORITIES,
      default: 'medium',
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },
    relatedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },

    messages: [TicketMessageSchema],
    statusHistory: [TicketStatusHistorySchema],

    firstResponseAt: Date,
    resolvedAt: Date,
    closedAt: Date,
    slaBreached: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// ─── Compound Indexes ─────────────────────────────────
SupportTicketSchema.index({ status: 1, priority: 1, createdAt: -1 });
SupportTicketSchema.index({ assignedTo: 1, status: 1 });
SupportTicketSchema.index({ user: 1, createdAt: -1 });

const SupportTicket = mongoose.model('SupportTicket', SupportTicketSchema);
export default SupportTicket;
