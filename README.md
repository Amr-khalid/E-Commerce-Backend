# 🛒 E-Commerce Backend API

Professional RESTful E-Commerce Backend built with **Express.js** and **MongoDB**.

> Production-ready API with authentication, RBAC, product management, orders, cart, coupons, inventory, reviews, support tickets, and more.

---

## ⚡ Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18 |
| Framework | Express.js 4 |
| Database | MongoDB (Mongoose 8) |
| Auth | JWT (Access + Refresh tokens) |
| Validation | Joi |
| Security | Helmet, CORS, HPP, Rate Limiting, Mongo Sanitize |
| Logging | Winston |
| Caching | node-cache (in-memory) |
| File Upload | Multer + Sharp |
| Deployment | Vercel (Serverless) |

---

## 📁 Project Structure

```
src/
├── config/          # App configuration, DB connection, logger, cache
├── middleware/      # Auth, RBAC, error handler, rate limiter, validation
├── models/          # Mongoose schemas (21 models)
├── modules/         # Feature modules (auth, products, orders, cart, etc.)
│   ├── auth/        # Register, login, JWT refresh, password reset
│   ├── products/    # CRUD, images, search, filtering
│   ├── categories/  # Nested categories with tree structure
│   ├── orders/      # Order lifecycle, status transitions
│   ├── cart/        # Cart management, coupon application
│   ├── coupons/     # Coupon CRUD, batch generation
│   ├── reviews/     # Reviews, moderation, Q&A
│   ├── inventory/   # Stock management, warehouse transfers
│   ├── tickets/     # Customer support tickets
│   ├── wishlist/    # User wishlists
│   ├── notifications/ # In-app notifications
│   ├── users/       # Address management
│   ├── admin/       # Admin dashboard & management
│   └── webhooks/    # External integrations
├── routes/          # Route mounting
├── services/        # Business logic (DiscountEngine, Email, Upload, etc.)
├── seeders/         # Database seeding
└── utils/           # ApiError, ApiResponse, pagination, slugify
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (Atlas or local)

### Installation

```bash
# Clone the repository
git clone https://github.com/Amr-khalid/E-Commerce-Backend.git
cd E-Commerce-Backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your values (MongoDB URI, JWT secrets, etc.)

# Seed the database
npm run seed

# Start development server
npm run dev
```

The server will start at `http://localhost:3000`

### Test Accounts (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@store.com | Admin@123456 |
| Manager | manager@store.com | Manager@123456 |
| Customer | customer@test.com | Customer@123456 |

---

## 🔗 API Endpoints

**Base URL:** `/api/v1`

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Login |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Logout |
| POST | `/auth/forgot-password` | Request password reset |
| POST | `/auth/reset-password` | Reset password |
| GET | `/auth/me` | Get profile |
| PATCH | `/auth/me` | Update profile |

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/products` | List products (filter, sort, paginate) |
| GET | `/products/:slug` | Get by slug |
| GET | `/products/:id` | Get by ID |
| POST | `/products` | Create product (admin) |
| PUT | `/products/:id` | Update product (admin) |
| DELETE | `/products/:id` | Delete product (admin) |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/orders` | Place order |
| GET | `/orders` | List user's orders |
| GET | `/orders/:id` | Order details |
| PATCH | `/orders/:id/status` | Update status (admin) |
| POST | `/orders/:id/cancel` | Cancel order |

### Cart
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/cart` | Get cart |
| POST | `/cart/items` | Add to cart |
| PATCH | `/cart/items/:productId` | Update quantity |
| DELETE | `/cart/items/:productId` | Remove from cart |
| POST | `/cart/coupon` | Apply coupon |
| POST | `/cart/preview` | Preview totals with discounts |

### Other Endpoints
- **Categories** — `/categories` (CRUD + tree)
- **Reviews** — `/reviews` (CRUD + moderation)
- **Coupons** — `/coupons` (CRUD + batch generation)
- **Inventory** — `/inventory` (stock + warehouse transfers)
- **Wishlist** — `/wishlist` (add/remove)
- **Notifications** — `/notifications` (list/mark read)
- **Support Tickets** — `/support/tickets` (CRUD + replies)
- **Admin** — `/admin` (dashboard + user management)
- **Health** — `/health` (server + DB status)

> 📖 Full API documentation: [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md)

---

## 🔐 Security Features

- **JWT Authentication** with access/refresh token rotation
- **RBAC** (Role-Based Access Control) — Admin, Manager, Staff, Warehouse Worker, Customer
- **Password Hashing** with bcrypt
- **Rate Limiting** — Global + per-endpoint (auth, sensitive routes)
- **Helmet** — Secure HTTP headers
- **CORS** — Configurable whitelist (strict in production)
- **NoSQL Injection Prevention** — mongo-sanitize
- **HPP** — HTTP Parameter Pollution protection
- **Account Lockout** — After failed login attempts
- **Input Validation** — Joi schemas on all endpoints

---

## 🛠 Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | ✅ | MongoDB connection string |
| `JWT_ACCESS_SECRET` | ✅ | JWT access token secret (32+ chars) |
| `JWT_REFRESH_SECRET` | ✅ | JWT refresh token secret (32+ chars) |
| `CORS_ORIGIN` | ❌ | Allowed origins (comma-separated) |
| `SMTP_HOST` | ❌ | Email SMTP host |
| `SMTP_USER` | ❌ | Email SMTP username |
| `SMTP_PASS` | ❌ | Email SMTP password |

> See [`.env.example`](.env.example) for all available variables.

---

## 🚢 Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add MONGO_URI
vercel env add JWT_ACCESS_SECRET
vercel env add JWT_REFRESH_SECRET
vercel env add NODE_ENV    # set to "production"

# Deploy to production
vercel --prod
```

### Required Vercel Environment Variables
Set these in your Vercel dashboard → Settings → Environment Variables:
- `NODE_ENV` = `production`
- `MONGO_URI` = your MongoDB Atlas URI
- `JWT_ACCESS_SECRET` = strong random string
- `JWT_REFRESH_SECRET` = strong random string
- `CORS_ORIGIN` = your frontend URL(s)

---

## 🧪 Testing

```bash
npm test
```

---

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (with auto-reload) |
| `npm start` | Start production server |
| `npm run seed` | Seed database with sample data |
| `npm test` | Run tests |

---

## 📄 License

MIT
