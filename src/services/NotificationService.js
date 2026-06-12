import Notification from '../models/Notification.js';
import logger from '../config/logger.js';

/**
 * Notification Service — creates and dispatches notifications.
 * In production, integrates with a queue (BullMQ) for async delivery.
 * Currently uses in-process dispatch for simplicity.
 */
class NotificationService {
  /**
   * Send a notification to a user.
   * @param {Object} params
   * @param {ObjectId} params.userId
   * @param {string} params.type Notification type from constants
   * @param {string} params.title
   * @param {string} [params.body]
   * @param {Object} [params.data] Additional payload
   * @param {string[]} [params.channels] Delivery channels
   */
  static async send({ userId, type, title, body = '', data = {}, channels = ['in_app'] }) {
    try {
      const notification = await Notification.create({
        user: userId,
        type,
        title,
        body,
        data,
        channels,
      });

      // Process each channel
      for (const channel of channels) {
        await this._dispatch(channel, notification);
      }

      return notification;
    } catch (error) {
      logger.error('Failed to send notification:', {
        userId,
        type,
        error: error.message,
      });
      // Don't throw — notifications should never break main flow
      return null;
    }
  }

  /**
   * Send notification to multiple users.
   * @param {ObjectId[]} userIds
   * @param {Object} params Same as send() minus userId
   */
  static async sendBulk(userIds, { type, title, body = '', data = {}, channels = ['in_app'] }) {
    const notifications = userIds.map((userId) => ({
      user: userId,
      type,
      title,
      body,
      data,
      channels,
    }));

    try {
      await Notification.insertMany(notifications);
      logger.info(`Bulk notification sent to ${userIds.length} users`, { type });
    } catch (error) {
      logger.error('Failed to send bulk notifications:', error.message);
    }
  }

  /**
   * Get unread count for a user.
   * @param {ObjectId} userId
   * @returns {number}
   */
  static async getUnreadCount(userId) {
    return Notification.countDocuments({ user: userId, isRead: false });
  }

  /**
   * Mark notification as read.
   * @param {ObjectId} notificationId
   * @param {ObjectId} userId
   */
  static async markAsRead(notificationId, userId) {
    return Notification.findOneAndUpdate(
      { _id: notificationId, user: userId },
      { isRead: true, readAt: new Date() },
      { new: true },
    );
  }

  /**
   * Mark all notifications as read for a user.
   * @param {ObjectId} userId
   */
  static async markAllAsRead(userId) {
    return Notification.updateMany(
      { user: userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
  }

  /**
   * Dispatch notification through a specific channel.
   * @private
   */
  static async _dispatch(channel, notification) {
    switch (channel) {
      case 'in_app':
        // Already saved to DB — nothing more to do
        break;

      case 'email':
        // In production: push to email queue
        logger.debug(`Email notification queued for user ${notification.user}`, {
          type: notification.type,
        });
        break;

      case 'sms':
        logger.debug(`SMS notification queued for user ${notification.user}`, {
          type: notification.type,
        });
        break;

      case 'push':
        logger.debug(`Push notification queued for user ${notification.user}`, {
          type: notification.type,
        });
        break;

      default:
        logger.warn(`Unknown notification channel: ${channel}`);
    }
  }
}

export default NotificationService;
