import { Router } from 'express';
import ChatSession from '../../models/ChatSession.js';
import User from '../../models/User.js';
import ApiResponse from '../../utils/ApiResponse.js';
import asyncHandler from '../../middleware/asyncHandler.js';
import logger from '../../config/logger.js';
import crypto from 'crypto';

const router = Router();

/**
 * Webhook: Receive chat events from external providers (Intercom, Crisp, Tawk.to).
 * Validates webhook signature and stores messages.
 */
router.post('/chat',
  asyncHandler(async (req, res) => {
    // Verify webhook signature (provider-specific)
    const signature = req.headers['x-webhook-signature'] || req.headers['x-hub-signature'];
    if (process.env.WEBHOOK_CHAT_SECRET && signature) {
      const expectedSig = crypto
        .createHmac('sha256', process.env.WEBHOOK_CHAT_SECRET)
        .update(JSON.stringify(req.body))
        .digest('hex');
      if (signature !== `sha256=${expectedSig}`) {
        return ApiResponse.error(res, { statusCode: 401, message: 'Invalid webhook signature' });
      }
    }

    const { event, data } = req.body;

    try {
      switch (event) {
        case 'chat.started': {
          // Find user by email
          let userId = null;
          if (data.email) {
            const user = await User.findOne({ email: data.email }).lean();
            if (user) userId = user._id;
          }

          await ChatSession.create({
            user: userId,
            externalId: data.sessionId || data.conversationId,
            provider: data.provider || 'custom',
            status: 'active',
            messages: [{
              senderType: data.senderType || 'customer',
              senderId: data.senderId,
              body: data.message || 'Chat started',
            }],
            metadata: data.metadata || {},
          });
          break;
        }

        case 'chat.message': {
          await ChatSession.findOneAndUpdate(
            { externalId: data.sessionId || data.conversationId },
            {
              $push: {
                messages: {
                  senderType: data.senderType || 'customer',
                  senderId: data.senderId,
                  body: data.message,
                },
              },
            },
          );
          break;
        }

        case 'chat.ended': {
          await ChatSession.findOneAndUpdate(
            { externalId: data.sessionId || data.conversationId },
            { status: 'closed', endedAt: new Date() },
          );
          break;
        }

        default:
          logger.debug(`Unknown chat webhook event: ${event}`);
      }
    } catch (error) {
      logger.error('Chat webhook error:', error.message);
    }

    // Always return 200 to acknowledge receipt
    ApiResponse.success(res, { message: 'Webhook received' });
  }),
);

/**
 * Webhook: Payment provider notifications (Stripe, PayPal, etc.)
 */
router.post('/payment',
  asyncHandler(async (req, res) => {
    const { event, data } = req.body;

    logger.info('Payment webhook received:', { event, ref: data?.paymentRef });

    // Payment webhook handling would go here
    // For now, log and acknowledge
    switch (event) {
      case 'payment.completed':
        // Update order payment status
        // await Order.findOneAndUpdate({ paymentRef: data.paymentRef }, { paymentStatus: 'paid' });
        break;

      case 'payment.failed':
        // await Order.findOneAndUpdate({ paymentRef: data.paymentRef }, { paymentStatus: 'failed' });
        break;

      case 'payment.refunded':
        // await Order.findOneAndUpdate({ paymentRef: data.paymentRef }, { paymentStatus: 'refunded' });
        break;
    }

    ApiResponse.success(res, { message: 'Webhook received' });
  }),
);

export default router;
