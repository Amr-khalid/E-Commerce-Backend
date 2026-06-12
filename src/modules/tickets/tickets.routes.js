import { Router } from 'express';
import mongoose from 'mongoose';
import SupportTicket from '../../models/SupportTicket.js';
import User from '../../models/User.js';
import NotificationService from '../../services/NotificationService.js';
import EmailService from '../../services/EmailService.js';
import { generateTicketNumber } from '../../utils/crypto.js';
import ApiResponse from '../../utils/ApiResponse.js';
import ApiError from '../../utils/ApiError.js';
import asyncHandler from '../../middleware/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { authorizePermission } from '../../middleware/rbac.js';
import validate from '../../middleware/validate.js';
import { PERMISSIONS, NOTIFICATION_TYPES } from '../../config/constants.js';
import config from '../../config/index.js';
import Joi from 'joi';

// ─── Validation ───────────────────────────────────────
const createTicketSchema = Joi.object({
  subject: Joi.string().trim().max(300).required(),
  category: Joi.string().valid('order', 'shipping', 'product', 'payment', 'other').required(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
  relatedOrder: Joi.string().hex().length(24).allow(null),
  body: Joi.string().trim().required(),
});

const messageSchema = Joi.object({
  body: Joi.string().trim().required(),
  isInternalNote: Joi.boolean().default(false),
});

const updateTicketSchema = Joi.object({
  status: Joi.string().valid('open', 'in_progress', 'waiting_customer', 'resolved', 'closed'),
  assignedTo: Joi.string().hex().length(24).allow(null),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent'),
});

const router = Router();

// ─── Customer: Create Ticket ──────────────────────────
router.post('/',
  authenticate,
  validate(createTicketSchema),
  asyncHandler(async (req, res) => {
    const ticketNumber = await generateTicketNumber(mongoose.connection);

    const ticket = await SupportTicket.create({
      ticketNumber,
      user: req.user._id,
      subject: req.body.subject,
      category: req.body.category,
      priority: req.body.priority,
      relatedOrder: req.body.relatedOrder,
      messages: [{
        senderType: 'customer',
        sender: req.user._id,
        body: req.body.body,
      }],
      statusHistory: [{ from: null, to: 'open', changedBy: req.user._id }],
    });

    ApiResponse.created(res, { data: ticket });
  }),
);

// Customer: Get my tickets
router.get('/my',
  authenticate,
  asyncHandler(async (req, res) => {
    const tickets = await SupportTicket.find({ user: req.user._id })
      .select('-messages')
      .sort({ createdAt: -1 })
      .lean();
    ApiResponse.success(res, { data: tickets });
  }),
);

// Customer: Get ticket detail
router.get('/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const isStaff = ['admin', 'manager', 'staff'].includes(req.user.role);
    const filter = { _id: req.params.id };
    if (!isStaff) filter.user = req.user._id;

    const ticket = await SupportTicket.findOne(filter)
      .populate('user', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName')
      .populate('messages.sender', 'firstName lastName')
      .lean();

    if (!ticket) throw ApiError.notFound('Ticket not found');

    // Filter out internal notes for customers
    if (!isStaff) {
      ticket.messages = ticket.messages.filter((m) => !m.isInternalNote);
    }

    ApiResponse.success(res, { data: ticket });
  }),
);

// Customer: Add message
router.post('/:id/messages',
  authenticate,
  validate(messageSchema),
  asyncHandler(async (req, res) => {
    const isStaff = ['admin', 'manager', 'staff'].includes(req.user.role);
    const filter = { _id: req.params.id };
    if (!isStaff) filter.user = req.user._id;

    const ticket = await SupportTicket.findOne(filter);
    if (!ticket) throw ApiError.notFound('Ticket not found');

    if (['resolved', 'closed'].includes(ticket.status)) {
      throw ApiError.badRequest('Cannot add message to a resolved/closed ticket');
    }

    ticket.messages.push({
      senderType: isStaff ? 'staff' : 'customer',
      sender: req.user._id,
      body: req.body.body,
      isInternalNote: isStaff ? req.body.isInternalNote : false,
    });

    // Track first response time for SLA
    if (isStaff && !ticket.firstResponseAt && !req.body.isInternalNote) {
      ticket.firstResponseAt = new Date();
      const createdAt = new Date(ticket.createdAt);
      const responseMs = ticket.firstResponseAt - createdAt;
      const slaMs = config.sla.firstResponseHours * 60 * 60 * 1000;
      if (responseMs > slaMs) {
        ticket.slaBreached = true;
      }
    }

    // Update status
    if (isStaff && ticket.status === 'open') {
      ticket.status = 'in_progress';
      ticket.statusHistory.push({ from: 'open', to: 'in_progress', changedBy: req.user._id });
    }

    await ticket.save();

    // Notify customer of staff reply
    if (isStaff && !req.body.isInternalNote) {
      NotificationService.send({
        userId: ticket.user,
        type: NOTIFICATION_TYPES.TICKET_REPLY,
        title: `Ticket ${ticket.ticketNumber}`,
        body: 'New reply on your support ticket',
        data: { ticketId: ticket._id },
        channels: ['in_app', 'email'],
      }).catch(() => {});
    }

    ApiResponse.success(res, { message: 'Message added' });
  }),
);

// ─── Admin: Get all tickets ───────────────────────────
router.get('/admin/all',
  authenticate,
  authorizePermission(PERMISSIONS.TICKETS_VIEW_ALL),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = Math.min(50, parseInt(req.query.per_page, 10) || 20);

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.assigned_to) filter.assignedTo = req.query.assigned_to;
    if (req.query.category) filter.category = req.query.category;

    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter)
        .populate('user', 'firstName lastName email')
        .populate('assignedTo', 'firstName lastName')
        .select('-messages')
        .sort({ priority: -1, createdAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage)
        .lean(),
      SupportTicket.countDocuments(filter),
    ]);

    ApiResponse.paginated(res, {
      data: tickets,
      pagination: { total, per_page: perPage, current_page: page, last_page: Math.ceil(total / perPage) },
    });
  }),
);

// Admin: Update ticket (assign, status, priority)
router.patch('/admin/:id',
  authenticate,
  authorizePermission(PERMISSIONS.TICKETS_UPDATE),
  validate(updateTicketSchema),
  asyncHandler(async (req, res) => {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) throw ApiError.notFound('Ticket not found');

    if (req.body.status && req.body.status !== ticket.status) {
      ticket.statusHistory.push({
        from: ticket.status,
        to: req.body.status,
        changedBy: req.user._id,
      });
      ticket.status = req.body.status;

      if (req.body.status === 'resolved') ticket.resolvedAt = new Date();
      if (req.body.status === 'closed') ticket.closedAt = new Date();
    }

    if (req.body.assignedTo !== undefined) ticket.assignedTo = req.body.assignedTo;
    if (req.body.priority) ticket.priority = req.body.priority;

    await ticket.save();

    // Notify customer of resolution
    if (req.body.status === 'resolved') {
      NotificationService.send({
        userId: ticket.user,
        type: NOTIFICATION_TYPES.TICKET_RESOLVED,
        title: `Ticket ${ticket.ticketNumber} Resolved`,
        body: 'Your support ticket has been resolved',
        data: { ticketId: ticket._id },
      }).catch(() => {});
    }

    ApiResponse.success(res, { data: ticket });
  }),
);

export default router;
