// ─── Roles ─────────────────────────────────────────────────
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff',
  WAREHOUSE_WORKER: 'warehouse_worker',
  CUSTOMER: 'customer',
};

export const ROLE_LIST = Object.values(ROLES);

// ─── Permissions ───────────────────────────────────────────
export const PERMISSIONS = {
  // Products
  PRODUCTS_CREATE: 'products.create',
  PRODUCTS_UPDATE: 'products.update',
  PRODUCTS_DELETE: 'products.delete',
  PRODUCTS_VIEW_ALL: 'products.view_all',

  // Categories
  CATEGORIES_CREATE: 'categories.create',
  CATEGORIES_UPDATE: 'categories.update',
  CATEGORIES_DELETE: 'categories.delete',

  // Orders
  ORDERS_VIEW_ALL: 'orders.view_all',
  ORDERS_UPDATE_STATUS: 'orders.update_status',
  ORDERS_CANCEL: 'orders.cancel',

  // Inventory
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_MANAGE: 'inventory.manage',
  INVENTORY_TRANSFER: 'inventory.transfer',

  // Warehouses
  WAREHOUSES_CREATE: 'warehouses.create',
  WAREHOUSES_UPDATE: 'warehouses.update',

  // Coupons
  COUPONS_CREATE: 'coupons.create',
  COUPONS_UPDATE: 'coupons.update',
  COUPONS_VIEW: 'coupons.view',
  COUPONS_BULK_GENERATE: 'coupons.bulk_generate',

  // Discount Rules
  DISCOUNT_RULES_CREATE: 'discount_rules.create',
  DISCOUNT_RULES_UPDATE: 'discount_rules.update',
  DISCOUNT_RULES_VIEW: 'discount_rules.view',

  // Reviews
  REVIEWS_MODERATE: 'reviews.moderate',
  REVIEWS_VIEW_QUEUE: 'reviews.view_queue',

  // Support
  TICKETS_VIEW_ALL: 'tickets.view_all',
  TICKETS_ASSIGN: 'tickets.assign',
  TICKETS_UPDATE: 'tickets.update',
  TICKETS_INTERNAL_NOTES: 'tickets.internal_notes',

  // Users
  USERS_VIEW_ALL: 'users.view_all',
  USERS_UPDATE: 'users.update',
  USERS_BAN: 'users.ban',

  // Reports
  REPORTS_VIEW: 'reports.view',

  // Admin Dashboard
  ADMIN_DASHBOARD: 'admin.dashboard',
};

// Default permissions per role
export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS), // all permissions

  [ROLES.MANAGER]: [
    PERMISSIONS.PRODUCTS_CREATE,
    PERMISSIONS.PRODUCTS_UPDATE,
    PERMISSIONS.PRODUCTS_DELETE,
    PERMISSIONS.PRODUCTS_VIEW_ALL,
    PERMISSIONS.CATEGORIES_CREATE,
    PERMISSIONS.CATEGORIES_UPDATE,
    PERMISSIONS.CATEGORIES_DELETE,
    PERMISSIONS.ORDERS_VIEW_ALL,
    PERMISSIONS.ORDERS_UPDATE_STATUS,
    PERMISSIONS.ORDERS_CANCEL,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.WAREHOUSES_UPDATE,
    PERMISSIONS.COUPONS_CREATE,
    PERMISSIONS.COUPONS_UPDATE,
    PERMISSIONS.COUPONS_VIEW,
    PERMISSIONS.COUPONS_BULK_GENERATE,
    PERMISSIONS.DISCOUNT_RULES_CREATE,
    PERMISSIONS.DISCOUNT_RULES_UPDATE,
    PERMISSIONS.DISCOUNT_RULES_VIEW,
    PERMISSIONS.REVIEWS_MODERATE,
    PERMISSIONS.REVIEWS_VIEW_QUEUE,
    PERMISSIONS.TICKETS_VIEW_ALL,
    PERMISSIONS.TICKETS_ASSIGN,
    PERMISSIONS.TICKETS_UPDATE,
    PERMISSIONS.TICKETS_INTERNAL_NOTES,
    PERMISSIONS.USERS_VIEW_ALL,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.ADMIN_DASHBOARD,
  ],

  [ROLES.STAFF]: [
    PERMISSIONS.ORDERS_VIEW_ALL,
    PERMISSIONS.ORDERS_UPDATE_STATUS,
    PERMISSIONS.REVIEWS_MODERATE,
    PERMISSIONS.REVIEWS_VIEW_QUEUE,
    PERMISSIONS.TICKETS_VIEW_ALL,
    PERMISSIONS.TICKETS_UPDATE,
    PERMISSIONS.TICKETS_INTERNAL_NOTES,
    PERMISSIONS.ADMIN_DASHBOARD,
  ],

  [ROLES.WAREHOUSE_WORKER]: [
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.INVENTORY_TRANSFER,
    PERMISSIONS.ADMIN_DASHBOARD,
  ],

  [ROLES.CUSTOMER]: [],
};

// ─── Order Statuses ────────────────────────────────────────
export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  RETURNED: 'returned',
};

// Valid status transitions
export const ORDER_STATUS_TRANSITIONS = {
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.RETURNED],
  [ORDER_STATUS.DELIVERED]: [ORDER_STATUS.RETURNED],
  [ORDER_STATUS.CANCELLED]: [],
  [ORDER_STATUS.RETURNED]: [],
};

export const ORDER_STATUS_LIST = Object.values(ORDER_STATUS);

// ─── Payment ───────────────────────────────────────────────
export const PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  PAID: 'paid',
  REFUNDED: 'refunded',
  FAILED: 'failed',
};

export const PAYMENT_METHODS = ['cod', 'card', 'wallet', 'bank_transfer'];

// ─── Product ───────────────────────────────────────────────
export const PRODUCT_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  OUT_OF_STOCK: 'out_of_stock',
  ARCHIVED: 'archived',
};

export const PRODUCT_STATUS_LIST = Object.values(PRODUCT_STATUS);

// ─── Coupon ────────────────────────────────────────────────
export const COUPON_TYPES = {
  PERCENTAGE: 'percentage',
  FIXED_AMOUNT: 'fixed_amount',
  FREE_SHIPPING: 'free_shipping',
  BUY_X_GET_Y: 'buy_x_get_y',
};

export const COUPON_SCOPES = {
  ORDER: 'order',
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
};

export const COUPON_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  EXPIRED: 'expired',
  EXHAUSTED: 'exhausted',
};

// ─── Discount Rules ────────────────────────────────────────
export const DISCOUNT_RULE_TYPES = {
  SPEND_THRESHOLD: 'spend_threshold',
  BULK_DISCOUNT: 'bulk_discount',
  SCHEDULED: 'scheduled',
  FLAGGED_PRODUCTS: 'flagged_products',
};

// ─── Review ────────────────────────────────────────────────
export const REVIEW_STATUS = {
  PENDING: 'pending_moderation',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const REPORT_REASONS = ['abuse', 'misleading', 'spam', 'other'];

// ─── Support Ticket ────────────────────────────────────────
export const TICKET_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  WAITING_CUSTOMER: 'waiting_customer',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
};

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
export const TICKET_CATEGORIES = ['order', 'shipping', 'product', 'payment', 'other'];

// ─── Notification ──────────────────────────────────────────
export const NOTIFICATION_CHANNELS = ['in_app', 'email', 'sms', 'push'];

export const NOTIFICATION_TYPES = {
  ORDER_CONFIRMED: 'order.confirmed',
  ORDER_SHIPPED: 'order.shipped',
  ORDER_DELIVERED: 'order.delivered',
  ORDER_CANCELLED: 'order.cancelled',
  REVIEW_APPROVED: 'review.approved',
  REVIEW_REJECTED: 'review.rejected',
  TICKET_REPLY: 'ticket.reply',
  TICKET_RESOLVED: 'ticket.resolved',
  LOW_STOCK: 'inventory.low_stock',
  PRICE_DROP: 'product.price_drop',
};

// ─── Inventory ─────────────────────────────────────────────
export const INVENTORY_MOVEMENT_TYPES = [
  'in',
  'out',
  'transfer_in',
  'transfer_out',
  'adjustment',
  'return',
  'sale',
  'reservation',
  'reservation_release',
];

// ─── Sorting ───────────────────────────────────────────────
export const SORT_OPTIONS = {
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  newest: { createdAt: -1 },
  best_seller: { salesCount: -1 },
  top_rated: { avgRating: -1 },
  most_reviewed: { reviewsCount: -1 },
  priority: { sortOrder: -1 },
  discount: { _discountPercent: -1 },  // computed in query
};

// ─── Pagination Defaults ───────────────────────────────────
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PER_PAGE: 24,
  MAX_PER_PAGE: 100,
};

// ─── Address Labels ────────────────────────────────────────
export const ADDRESS_LABELS = ['home', 'work', 'other'];

// ─── Video Providers ───────────────────────────────────────
export const VIDEO_PROVIDERS = ['upload', 'youtube', 'vimeo'];
