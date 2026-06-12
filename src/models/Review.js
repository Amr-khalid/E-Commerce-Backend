import mongoose from 'mongoose';
import { REVIEW_STATUS, REPORT_REASONS } from '../config/constants.js';

const ReviewReplySchema = new mongoose.Schema(
  {
    body: { type: String, required: true, trim: true },
    repliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isStoreReply: { type: Boolean, default: false },
    repliedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const ReviewReportSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: {
      type: String,
      enum: REPORT_REASONS,
      required: true,
    },
    note: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const VoterSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, required: true },
    vote: { type: String, enum: ['up', 'down'], required: true },
  },
  { _id: false },
);

const ReviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },

    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: 1,
      max: 5,
    },
    title: { type: String, trim: true, maxlength: 200 },
    body: {
      type: String,
      required: [true, 'Review body is required'],
      trim: true,
      maxlength: 5000,
    },
    images: [String],

    verifiedPurchase: { type: Boolean, default: false },
    status: {
      type: String,
      enum: Object.values(REVIEW_STATUS),
      default: REVIEW_STATUS.PENDING,
      index: true,
    },

    helpfulVotes: { type: Number, default: 0 },
    notHelpfulVotes: { type: Number, default: 0 },
    voters: [VoterSchema],

    reports: [ReviewReportSchema],
    replies: [ReviewReplySchema],
  },
  { timestamps: true },
);

// One review per user per product
ReviewSchema.index({ product: 1, user: 1 }, { unique: true });
ReviewSchema.index({ product: 1, status: 1, createdAt: -1 });
ReviewSchema.index({ status: 1, createdAt: -1 }); // moderation queue

const Review = mongoose.model('Review', ReviewSchema);
export default Review;
