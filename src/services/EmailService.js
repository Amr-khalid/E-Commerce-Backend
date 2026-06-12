import logger from '../config/logger.js';
import config from '../config/index.js';

/**
 * Email Service — sends transactional emails.
 * Uses Nodemailer-compatible interface.
 * In production, swap with SendGrid/Mailgun SDK.
 */
class EmailService {
  /**
   * Send an email.
   * @param {Object} params
   * @param {string} params.to Recipient email
   * @param {string} params.subject Email subject
   * @param {string} params.html HTML body
   * @param {string} [params.text] Plain text body
   */
  static async send({ to, subject, html, text = '' }) {
    try {
      // In development/test: log instead of sending
      if (config.env !== 'production') {
        logger.info('Email sent (dev mode):', {
          to,
          subject,
          preview: html.substring(0, 200),
        });
        return { success: true, messageId: `dev-${Date.now()}` };
      }

      // Production: use Nodemailer or external service
      // This is where you'd integrate with your email provider
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.port === 465,
        auth: {
          user: config.email.user,
          pass: config.email.pass,
        },
      });

      const info = await transporter.sendMail({
        from: `"Store" <${config.email.from}>`,
        to,
        subject,
        text,
        html,
      });

      logger.info('Email sent:', { to, subject, messageId: info.messageId });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error('Failed to send email:', { to, subject, error: error.message });
      return { success: false, error: error.message };
    }
  }

  // ─── Template Methods ───────────────────────────────

  static async sendWelcome(user) {
    return this.send({
      to: user.email,
      subject: 'Welcome to Our Store!',
      html: `
        <h1>Welcome, ${user.firstName}!</h1>
        <p>Thank you for creating an account. Start shopping now!</p>
      `,
    });
  }

  static async sendPasswordReset(user, resetToken) {
    const resetUrl = `${config.cors.origin}/reset-password?token=${resetToken}`;
    return this.send({
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <h1>Password Reset</h1>
        <p>Hi ${user.firstName},</p>
        <p>Click the link below to reset your password. This link expires in 1 hour.</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });
  }

  static async sendOrderConfirmation(user, order) {
    const itemsList = order.items
      .map((i) => `<li>${i.name} × ${i.quantity} — ${i.total}</li>`)
      .join('');

    return this.send({
      to: user.email,
      subject: `Order Confirmed: ${order.orderNumber}`,
      html: `
        <h1>Order Confirmed!</h1>
        <p>Hi ${user.firstName},</p>
        <p>Your order <strong>${order.orderNumber}</strong> has been confirmed.</p>
        <h3>Items:</h3>
        <ul>${itemsList}</ul>
        <p><strong>Total: ${order.grandTotal}</strong></p>
      `,
    });
  }

  static async sendOrderStatusUpdate(user, order, newStatus) {
    return this.send({
      to: user.email,
      subject: `Order ${order.orderNumber} — Status Update`,
      html: `
        <h1>Order Status Update</h1>
        <p>Hi ${user.firstName},</p>
        <p>Your order <strong>${order.orderNumber}</strong> is now: <strong>${newStatus}</strong></p>
        ${order.trackingNumber ? `<p>Tracking: ${order.trackingNumber}</p>` : ''}
      `,
    });
  }

  static async sendTicketReply(user, ticket) {
    return this.send({
      to: user.email,
      subject: `Ticket ${ticket.ticketNumber} — New Reply`,
      html: `
        <h1>New Reply on Your Ticket</h1>
        <p>Hi ${user.firstName},</p>
        <p>There's a new reply on your support ticket: <strong>${ticket.subject}</strong></p>
        <p>Log in to view the full conversation.</p>
      `,
    });
  }

  static async sendLowStockAlert(product, warehouse) {
    return this.send({
      to: config.email.from, // Send to admin
      subject: `⚠️ Low Stock Alert: ${product.name}`,
      html: `
        <h1>Low Stock Alert</h1>
        <p>Product <strong>${product.name}</strong> (SKU: ${product.sku}) is running low.</p>
        <p>Warehouse: ${warehouse.name}</p>
        <p>Current stock: ${product.stock}</p>
      `,
    });
  }
}

export default EmailService;
