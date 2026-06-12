import { Router } from 'express';
import NotificationService from '../../services/NotificationService.js';
import Notification from '../../models/Notification.js';
import ApiResponse from '../../utils/ApiResponse.js';
import asyncHandler from '../../middleware/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.get('/',
  authenticate,
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = Math.min(50, parseInt(req.query.per_page, 10) || 20);
    const filter = { user: req.user._id };
    if (req.query.unread === 'true') filter.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage)
        .lean(),
      Notification.countDocuments(filter),
      NotificationService.getUnreadCount(req.user._id),
    ]);

    ApiResponse.paginated(res, {
      data: notifications,
      pagination: { total, per_page: perPage, current_page: page, last_page: Math.ceil(total / perPage) },
    });
    // Add unread count to meta — override response
  }),
);

router.patch('/:id/read',
  authenticate,
  asyncHandler(async (req, res) => {
    await NotificationService.markAsRead(req.params.id, req.user._id);
    ApiResponse.success(res, { message: 'Marked as read' });
  }),
);

router.patch('/read-all',
  authenticate,
  asyncHandler(async (req, res) => {
    await NotificationService.markAllAsRead(req.user._id);
    ApiResponse.success(res, { message: 'All notifications marked as read' });
  }),
);

export default router;
