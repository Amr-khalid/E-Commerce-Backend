import mongoose from 'mongoose';

const AnswerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    body: { type: String, required: true, trim: true, maxlength: 3000 },
    isStoreAnswer: { type: Boolean, default: false },
    helpfulVotes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const QuestionSchema = new mongoose.Schema(
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
    },
    body: {
      type: String,
      required: [true, 'Question body is required'],
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ['open', 'answered', 'closed'],
      default: 'open',
      index: true,
    },
    answers: [AnswerSchema],
  },
  { timestamps: true },
);

QuestionSchema.index({ product: 1, status: 1, createdAt: -1 });

const Question = mongoose.model('Question', QuestionSchema);
export default Question;
