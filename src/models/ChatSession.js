import mongoose from 'mongoose';

const ChatMessageSchema = new mongoose.Schema(
  {
    senderType: {
      type: String,
      enum: ['customer', 'agent', 'bot'],
      required: true,
    },
    senderId: String,
    body: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

const ChatSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    externalId: { type: String, index: true }, // ID from external chat provider
    provider: {
      type: String,
      enum: ['intercom', 'crisp', 'tawk', 'custom'],
      default: 'custom',
    },
    status: {
      type: String,
      enum: ['active', 'closed'],
      default: 'active',
    },
    messages: [ChatMessageSchema],
    metadata: { type: mongoose.Schema.Types.Mixed },
    startedAt: { type: Date, default: Date.now },
    endedAt: Date,
  },
  { timestamps: true },
);

ChatSessionSchema.index({ user: 1, createdAt: -1 });

const ChatSession = mongoose.model('ChatSession', ChatSessionSchema);
export default ChatSession;
