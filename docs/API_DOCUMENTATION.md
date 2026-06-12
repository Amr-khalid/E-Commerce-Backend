# 🛒 E-Commerce API Documentation

> **Base URL:** `http://localhost:3000/api/v1`
>
> **Content-Type:** `application/json`
>
> **Authentication:** Bearer Token in `Authorization` header

---

## 📋 جدول المحتويات

1. [المصادقة (Auth)](#1-المصادقة-auth)
2. [الملف الشخصي (Profile)](#2-الملف-الشخصي-profile)
3. [العناوين (Addresses)](#3-العناوين-addresses)
4. [المنتجات (Products)](#4-المنتجات-products)
5. [التصنيفات (Categories)](#5-التصنيفات-categories)
6. [سلة التسوق (Cart)](#6-سلة-التسوق-cart)
7. [الطلبات (Orders)](#7-الطلبات-orders)
8. [القسائم والخصومات (Coupons)](#8-القسائم-والخصومات-coupons)
9. [قائمة المفضلة (Wishlist)](#9-قائمة-المفضلة-wishlist)
10. [التقييمات والمراجعات (Reviews)](#10-التقييمات-والمراجعات-reviews)
11. [الأسئلة والأجوبة (Q&A)](#11-الأسئلة-والأجوبة-qa)
12. [تذاكر الدعم (Support Tickets)](#12-تذاكر-الدعم-support-tickets)
13. [الإشعارات (Notifications)](#13-الإشعارات-notifications)
14. [لوحة التحكم - إدارة (Admin)](#14-لوحة-التحكم---إدارة-admin)
15. [صيغة الاستجابة (Response Format)](#15-صيغة-الاستجابة-response-format)
16. [أكواد الأخطاء (Error Codes)](#16-أكواد-الأخطاء-error-codes)

---

## 🔑 نظام المصادقة

### كيف يعمل التوكن؟

| النوع | المدة | الاستخدام |
|-------|-------|-----------|
| Access Token | 15 دقيقة | يُرسل في Header كل طلب: `Authorization: Bearer <token>` |
| Refresh Token | 7 أيام | يُخزن في httpOnly cookie تلقائياً، يُستخدم لتجديد Access Token |

### حسابات الاختبار

| الدور | البريد | كلمة المرور |
|-------|--------|-------------|
| Admin | admin@store.com | Admin@123456 |
| Manager | manager@store.com | Manager@123456 |
| Customer | customer@test.com | Customer@123456 |

---

## 1. المصادقة (Auth)

### `POST /auth/register` — تسجيل حساب جديد

**الصلاحية:** عام (Public)

**Request Body:**
```json
{
  "firstName": "أحمد",
  "lastName": "محمد",
  "email": "ahmed@example.com",
  "phone": "+966501234567",
  "password": "MyPass@123",
  "confirmPassword": "MyPass@123"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "user": {
      "_id": "665...",
      "firstName": "أحمد",
      "lastName": "محمد",
      "email": "ahmed@example.com",
      "phone": "+966501234567",
      "role": "customer",
      "isEmailVerified": false,
      "createdAt": "2026-06-11T15:00:00.000Z"
    },
    "accessToken": "eyJhbG..."
  }
}
```

**ملاحظات:**
- كلمة المرور يجب أن تحتوي على: حرف كبير + حرف صغير + رقم (8 أحرف على الأقل)
- الـ `refreshToken` يُخزن تلقائياً في cookie

---

### `POST /auth/login` — تسجيل الدخول

**الصلاحية:** عام

**Request Body:**
```json
{
  "email": "ahmed@example.com",
  "password": "MyPass@123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "665...",
      "firstName": "أحمد",
      "lastName": "محمد",
      "email": "ahmed@example.com",
      "role": "customer"
    },
    "accessToken": "eyJhbG..."
  }
}
```

**أخطاء محتملة:**
- `401` — بريد أو كلمة مرور خاطئة
- `403` — الحساب معطل أو مقفل مؤقتاً (بعد 5 محاولات خاطئة)

---

### `POST /auth/refresh` — تجديد التوكن

**الصلاحية:** عام

**Request Body:** (اختياري — إذا لم يكن في cookie)
```json
{
  "refreshToken": "eyJhbG..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbG... (جديد)"
  }
}
```

---

### `POST /auth/logout` — تسجيل الخروج

**الصلاحية:** مصادقة مطلوبة 🔒

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### `POST /auth/forgot-password` — طلب استعادة كلمة المرور

**الصلاحية:** عام

**Request Body:**
```json
{
  "email": "ahmed@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "If an account with that email exists, a reset link has been sent"
}
```

> ⚠️ الرد دائماً ناجح حتى لو البريد غير موجود (لأسباب أمنية)

---

### `POST /auth/reset-password` — إعادة تعيين كلمة المرور

**الصلاحية:** عام

**Request Body:**
```json
{
  "token": "abc123... (من رابط البريد)",
  "password": "NewPass@456",
  "confirmPassword": "NewPass@456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset successful. Please log in with your new password."
}
```

---

## 2. الملف الشخصي (Profile)

### `GET /auth/me` — بياناتي 🔒

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "665...",
    "firstName": "أحمد",
    "lastName": "محمد",
    "email": "ahmed@example.com",
    "phone": "+966501234567",
    "role": "customer",
    "permissions": []
  }
}
```

---

### `PATCH /auth/me` — تحديث بياناتي 🔒

**Request Body:** (جزئي — أرسل فقط الحقول المراد تعديلها)
```json
{
  "firstName": "أحمد",
  "lastName": "العلي",
  "phone": "+966509876543"
}
```

---

## 3. العناوين (Addresses)

### `GET /me/addresses` — قائمة عناويني 🔒

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "665...",
      "label": "home",
      "fullName": "أحمد محمد",
      "phone": "+966501234567",
      "country": "SA",
      "city": "الرياض",
      "area": "العليا",
      "street": "شارع التحلية",
      "building": "15",
      "apartment": "3",
      "postalCode": "12345",
      "notes": "بجانب المسجد",
      "isDefault": true
    }
  ]
}
```

---

### `POST /me/addresses` — إضافة عنوان جديد 🔒

**Request Body:**
```json
{
  "label": "work",
  "fullName": "أحمد محمد",
  "phone": "+966501234567",
  "country": "SA",
  "city": "الرياض",
  "area": "الملز",
  "street": "شارع الأمير سلطان",
  "building": "22",
  "postalCode": "11451",
  "isDefault": false
}
```

| الحقل | النوع | مطلوب | القيم المسموحة |
|-------|-------|-------|---------------|
| label | string | لا | `home`, `work`, `other` |
| fullName | string | نعم | — |
| phone | string | نعم | — |
| country | string | نعم | — |
| city | string | نعم | — |
| area | string | لا | — |
| street | string | لا | — |
| building | string | لا | — |
| apartment | string | لا | — |
| postalCode | string | لا | — |
| notes | string | لا | — |
| isDefault | boolean | لا | `true`/`false` |

---

### `PATCH /me/addresses/:id` — تعديل عنوان 🔒
### `DELETE /me/addresses/:id` — حذف عنوان 🔒

---

## 4. المنتجات (Products)

### `GET /products` — قائمة المنتجات مع فلترة

**الصلاحية:** عام

**Query Parameters:**

| المعامل | النوع | مثال | الوصف |
|---------|-------|------|-------|
| `q` | string | `q=حذاء رياضي` | بحث نصي في الاسم والوصف |
| `price_min` | number | `price_min=50` | الحد الأدنى للسعر |
| `price_max` | number | `price_max=500` | الحد الأقصى للسعر |
| `category_ids` | array | `category_ids[]=abc&category_ids[]=def` | تصنيفات (متعدد) |
| `brand_ids` | array | `brand_ids[]=Nike` | علامات تجارية |
| `rating_min` | number | `rating_min=4` | حد أدنى للتقييم |
| `on_sale` | boolean | `on_sale=true` | المنتجات المخفضة فقط |
| `in_stock` | boolean | `in_stock=true` | المتوفرة فقط |
| `flags` | array | `flags[]=featured&flags[]=newArrival` | أعلام التصنيف |
| `attributes` | object | `attributes[color][]=red&attributes[size][]=XL` | خصائص ديناميكية |
| `created_after` | date | `created_after=2024-01-01` | بعد تاريخ |
| `sort` | string | `sort=price_asc` | الترتيب (انظر أدناه) |
| `page` | number | `page=2` | رقم الصفحة |
| `per_page` | number | `per_page=24` | عدد العناصر |
| `after` | string | `after=cursor_token` | للتمرير اللانهائي |

**خيارات الترتيب `sort`:**

| القيمة | الوصف |
|--------|-------|
| `price_asc` | السعر: الأقل أولاً |
| `price_desc` | السعر: الأعلى أولاً |
| `newest` | الأحدث أولاً |
| `best_seller` | الأكثر مبيعاً |
| `top_rated` | الأعلى تقييماً |
| `most_reviewed` | الأكثر مراجعات |
| `priority` | ترتيب الأولوية اليدوي |
| `discount` | نسبة الخصم (الأعلى أولاً) |

**مثال طلب:**
```
GET /products?price_min=100&price_max=5000&sort=best_seller&flags[]=featured&page=1&per_page=12
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "665...",
      "name": "iPhone 15 Pro Max",
      "slug": "iphone-15-pro-max",
      "description": "...",
      "shortDescription": "...",
      "sku": "IPHONE15PM",
      "brand": "Apple",
      "price": 4999,
      "discountPrice": 4499,
      "effectivePrice": 4499,
      "discountPercent": 10,
      "isOnSale": true,
      "inStock": true,
      "stock": 50,
      "categories": [
        { "_id": "665...", "name": "Electronics", "slug": "electronics" }
      ],
      "attributes": [
        { "key": "color", "value": "Titanium Black" },
        { "key": "storage", "value": "256GB" }
      ],
      "images": [
        { "url": "/products/abc.webp", "alt": "iPhone 15", "isMain": true, "sortOrder": 0 }
      ],
      "videos": [],
      "flags": {
        "featured": true,
        "newArrival": false,
        "bestSeller": true,
        "topPriority": false
      },
      "avgRating": 4.5,
      "reviewsCount": 23,
      "salesCount": 150,
      "mainImage": "/products/abc.webp",
      "createdAt": "2026-06-11T15:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "type": "offset",
      "total": 156,
      "per_page": 12,
      "current_page": 1,
      "last_page": 13,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

**Pagination نوع Cursor (للتمرير اللانهائي):**
```
GET /products?after=CURSOR_TOKEN&limit=24
```
```json
{
  "meta": {
    "pagination": {
      "type": "cursor",
      "per_page": 24,
      "has_next": true,
      "next_cursor": "NEXT_TOKEN",
      "count": 24
    }
  }
}
```

---

### `GET /products/:slug` — تفاصيل منتج

**الصلاحية:** عام

**Response:** نفس هيكل المنتج أعلاه + `relatedProducts`

---

### `GET /products/:id/related` — منتجات ذات صلة

**الصلاحية:** عام

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "665...",
      "name": "Samsung Galaxy S24 Ultra",
      "slug": "samsung-galaxy-s24-ultra",
      "price": 4499,
      "discountPrice": 3999,
      "images": [...],
      "avgRating": 4.3,
      "reviewsCount": 12
    }
  ]
}
```

---

### `POST /products` — إنشاء منتج 🔒 Admin|Manager

**Request Body:**
```json
{
  "name": "سماعات Sony WH-1000XM5",
  "sku": "SONY-WH1KXM5",
  "price": 1499,
  "discountPrice": 1199,
  "brand": "Sony",
  "description": "سماعات لاسلكية بخاصية إلغاء الضوضاء",
  "shortDescription": "أفضل سماعات لاسلكية",
  "categories": ["665abc..."],
  "attributes": [
    { "key": "color", "value": "Black" },
    { "key": "type", "value": "Over-ear" }
  ],
  "videos": [
    { "url": "https://youtube.com/watch?v=xxx", "provider": "youtube" }
  ],
  "flags": {
    "featured": true,
    "newArrival": true
  },
  "status": "active",
  "isActive": true,
  "taxRate": 15,
  "lowStockThreshold": 10,
  "seo": {
    "title": "سماعات Sony WH-1000XM5",
    "description": "اشتر سماعات Sony",
    "keywords": ["سماعات", "sony", "لاسلكي"]
  }
}
```

---

### `POST /products/:id/images` — رفع صور منتج 🔒 Admin|Manager

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `images` — ملفات الصور (حد أقصى 10 ملفات، 5MB لكل ملف)
- الأنواع المسموحة: JPEG, PNG, WebP, GIF
- الصور تُعالج تلقائياً: تحويل إلى WebP، تصغير، إنشاء thumbnail

**Response (200):**
```json
{
  "success": true,
  "message": "Images uploaded",
  "data": [
    {
      "url": "/products/uuid.webp",
      "thumbnail": "/products/thumb_uuid.webp",
      "alt": "original_name",
      "isMain": true,
      "sortOrder": 0
    }
  ]
}
```

---

### `PATCH /products/:id` — تعديل منتج 🔒 Admin|Manager
### `DELETE /products/:id` — حذف منتج 🔒 Admin
### `PATCH /products/sort/order` — ترتيب المنتجات 🔒 Admin|Manager

**Request Body:**
```json
{
  "items": [
    { "id": "665abc...", "sortOrder": 1 },
    { "id": "665def...", "sortOrder": 2 },
    { "id": "665ghi...", "sortOrder": 3 }
  ]
}
```

---

## 5. التصنيفات (Categories)

### `GET /categories` — شجرة التصنيفات

**الصلاحية:** عام

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "665...",
      "name": "Electronics",
      "slug": "electronics",
      "image": null,
      "sortOrder": 0,
      "depth": 0,
      "productCount": 0,
      "children": [
        {
          "_id": "665...",
          "name": "Smartphones",
          "slug": "smartphones",
          "depth": 1,
          "children": []
        },
        {
          "_id": "665...",
          "name": "Laptops",
          "slug": "laptops",
          "depth": 1,
          "children": []
        }
      ]
    },
    {
      "_id": "665...",
      "name": "Clothing",
      "slug": "clothing",
      "children": [...]
    }
  ]
}
```

---

### `POST /categories` — إنشاء تصنيف 🔒 Admin|Manager

```json
{
  "name": "هواتف ذكية",
  "parent": "665abc... (ID التصنيف الأب — null للجذر)",
  "image": "/uploads/cat.webp",
  "sortOrder": 1,
  "isActive": true
}
```

### `PATCH /categories/:id` — تعديل تصنيف 🔒 Admin|Manager
### `DELETE /categories/:id` — حذف تصنيف 🔒 Admin

> ⚠️ لا يمكن حذف تصنيف له تصنيفات فرعية

---

## 6. سلة التسوق (Cart)

### `GET /cart` — عرض السلة 🔒

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "665...",
    "user": "665...",
    "items": [
      {
        "product": {
          "_id": "665...",
          "name": "iPhone 15 Pro Max",
          "slug": "iphone-15-pro-max",
          "price": 4999,
          "discountPrice": 4499,
          "stock": 50,
          "images": [{ "url": "/products/abc.webp", "isMain": true }],
          "isActive": true
        },
        "quantity": 2,
        "addedAt": "2026-06-11T15:00:00.000Z"
      }
    ],
    "couponCode": null
  }
}
```

---

### `POST /cart/items` — إضافة منتج للسلة 🔒

```json
{
  "productId": "665abc...",
  "quantity": 1
}
```

**أخطاء محتملة:**
- `400` — المنتج غير متوفر أو الكمية أكبر من المخزون

---

### `PATCH /cart/items/:productId` — تعديل الكمية 🔒

```json
{
  "quantity": 3
}
```

> إرسال `quantity: 0` يحذف المنتج من السلة

---

### `DELETE /cart/items/:productId` — حذف منتج من السلة 🔒

---

### `POST /cart/coupon` — تطبيق/إزالة كوبون 🔒

```json
{
  "couponCode": "SUMMER20"
}
```

> أرسل `couponCode: null` أو `""` لإزالة الكوبون

---

### `POST /cart/preview` — 🌟 معاينة الإجمالي مع الخصومات 🔒

هذا الـ Endpoint مهم جداً — يعرض الإجمالي النهائي **قبل** إنشاء الطلب.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "product": "665...",
        "name": "iPhone 15 Pro Max",
        "sku": "IPHONE15PM",
        "image": "/products/abc.webp",
        "unitPrice": 4999,
        "effectivePrice": 4499,
        "quantity": 2,
        "productDiscount": 1000,
        "automaticDiscount": 0,
        "couponDiscount": 0,
        "total": 8998
      }
    ],
    "subtotal": 9998,
    "productDiscounts": 1000,
    "automaticDiscounts": 0,
    "couponDiscount": 450,
    "totalDiscount": 1450,
    "shippingCost": 0,
    "taxAmount": 1282.2,
    "grandTotal": 9830.2,
    "appliedDiscounts": [
      {
        "type": "product_discount",
        "source": "product:IPHONE15PM",
        "amount": 1000,
        "scope": "item"
      },
      {
        "type": "coupon",
        "source": "coupon:SUMMER20",
        "amount": 450,
        "scope": "order"
      }
    ],
    "couponValidation": {
      "valid": true,
      "message": "Coupon applied successfully",
      "discount": 450,
      "couponType": "percentage"
    }
  }
}
```

---

## 7. الطلبات (Orders)

### `POST /orders` — إنشاء طلب جديد 🔒

```json
{
  "shippingAddressId": "665abc...",
  "billingAddressId": "665def... (اختياري — نفس الشحن إذا لم يُرسل)",
  "paymentMethod": "cod",
  "couponCode": "SUMMER20",
  "customerNotes": "يرجى التغليف كهدية"
}
```

| الحقل | النوع | مطلوب | القيم |
|-------|-------|-------|-------|
| shippingAddressId | string | نعم | ID عنوان من `/me/addresses` |
| billingAddressId | string | لا | ID عنوان |
| paymentMethod | string | نعم | `cod`, `card`, `wallet`, `bank_transfer` |
| couponCode | string | لا | كود خصم |
| customerNotes | string | لا | ملاحظات |

**ما يحدث عند إنشاء الطلب:**
1. ✅ التحقق من وجود منتجات في السلة
2. ✅ التحقق من المخزون لكل منتج (ذري — لا يمكن بيع أكثر من المتوفر)
3. ✅ حساب الخصومات عبر محرك الخصم
4. ✅ خصم المخزون
5. ✅ تسجيل استخدام الكوبون
6. ✅ تسجيل حركة المخزون
7. ✅ إفراغ السلة
8. ✅ إرسال إشعار

**Response (201):**
```json
{
  "success": true,
  "message": "Order placed successfully",
  "data": {
    "_id": "665...",
    "orderNumber": "ORD-2026-000001",
    "items": [...],
    "subtotal": 9998,
    "totalDiscount": 1450,
    "shippingCost": 0,
    "taxAmount": 1282.2,
    "grandTotal": 9830.2,
    "status": "pending",
    "paymentStatus": "unpaid",
    "paymentMethod": "cod",
    "shippingAddress": { "fullName": "أحمد", "city": "الرياض", ... },
    "billingAddress": { ... },
    "discounts": [ ... ],
    "placedAt": "2026-06-11T15:00:00.000Z"
  }
}
```

---

### `GET /orders` — طلباتي 🔒

**Query Parameters:**
- `page` — رقم الصفحة
- `per_page` — عدد العناصر (حد أقصى 50)
- `status` — فلتر حسب الحالة

---

### `GET /orders/:id` — تفاصيل طلب 🔒

يشمل: المنتجات، العناوين، الخصومات، **سجل تغييرات الحالة**

**Response يتضمن `statusHistory`:**
```json
{
  "statusHistory": [
    { "from": null, "to": "pending", "createdAt": "...", "changedBy": { "firstName": "أحمد" } },
    { "from": "pending", "to": "confirmed", "createdAt": "...", "changedBy": { "firstName": "Manager" } },
    { "from": "confirmed", "to": "shipped", "createdAt": "...", "note": "شحنة رقم 12345" }
  ]
}
```

---

### `POST /orders/:id/cancel` — إلغاء طلب 🔒

> يمكن الإلغاء فقط في حالة `pending` أو `confirmed`

**حالات الطلب ومسارها:**
```
pending → confirmed → processing → shipped → delivered
                                          ↘ cancelled / returned
```

---

## 8. القسائم والخصومات (Coupons)

### `POST /coupons/validate` — التحقق من صلاحية كوبون 🔒

```json
{
  "code": "SUMMER20",
  "cartItems": [
    { "product": "665abc...", "quantity": 2 }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "message": "Coupon applied successfully",
    "discount": 450
  }
}
```

**رسائل الفشل المحتملة:**
- `"Coupon not found"`
- `"Coupon has expired"`
- `"Coupon usage limit reached"`
- `"You have already used this coupon"`
- `"This coupon is for first orders only"`
- `"Minimum order amount is 500"`

---

### إدارة الكوبونات 🔒 Manager+

| Method | Endpoint | الوصف |
|--------|----------|-------|
| `GET` | `/coupons/admin` | قائمة الكوبونات (مع فلتر `status`, `type`) |
| `POST` | `/coupons/admin` | إنشاء كوبون جديد |
| `PATCH` | `/coupons/admin/:id` | تعديل كوبون |
| `GET` | `/coupons/admin/:id/usages` | سجل استخدام الكوبون |
| `POST` | `/coupons/admin/bulk-generate` | توليد أكواد بالجملة |

### توليد أكواد بالجملة:

```json
{
  "name": "حملة الصيف 2026",
  "prefix": "SUM26",
  "count": 500,
  "template": {
    "type": "percentage",
    "value": 15,
    "startsAt": "2026-06-01",
    "expiresAt": "2026-09-01",
    "singleUse": true,
    "maxUsesPerUser": 1,
    "minOrderAmount": 100
  }
}
```

---

### إدارة قواعد الخصم التلقائي 🔒 Manager+

| Method | Endpoint | الوصف |
|--------|----------|-------|
| `GET` | `/coupons/admin/rules` | قائمة القواعد |
| `POST` | `/coupons/admin/rules` | إنشاء قاعدة |
| `PATCH` | `/coupons/admin/rules/:id` | تعديل قاعدة |

**أنواع القواعد:**
- `spend_threshold` — خصم عند تجاوز مبلغ
- `bulk_discount` — خصم على الكمية
- `scheduled` — خصم بتوقيت محدد
- `flagged_products` — خصم على منتجات مميزة

---

## 9. قائمة المفضلة (Wishlist)

### `GET /wishlist` — المفضلة 🔒
### `POST /wishlist/:productId` — إضافة للمفضلة 🔒
### `DELETE /wishlist/:productId` — إزالة من المفضلة 🔒

---

## 10. التقييمات والمراجعات (Reviews)

### `GET /reviews/products/:productId/reviews` — مراجعات منتج

**الصلاحية:** عام

**Query:** `page`, `per_page`

**Response يتضمن:**
- `data` — المراجعات المعتمدة
- `meta.ratingDistribution` — توزيع التقييمات (كم 5 نجوم، كم 4، ...)

---

### `POST /reviews/products/:productId/reviews` — إضافة مراجعة 🔒

```json
{
  "rating": 5,
  "title": "منتج ممتاز",
  "body": "أفضل هاتف اشتريته",
  "orderId": "665abc... (اختياري — للتحقق من الشراء)"
}
```

> ⚠️ المراجعة تُرسل للإشراف أولاً (`pending_moderation`)
> ⚠️ مراجعة واحدة فقط لكل منتج لكل مستخدم

---

### `POST /reviews/reviews/:id/vote` — التصويت على مراجعة 🔒

```json
{
  "vote": "up"
}
```
القيم: `up` (مفيدة) أو `down` (غير مفيدة)

---

### `POST /reviews/reviews/:id/report` — الإبلاغ عن مراجعة 🔒

```json
{
  "reason": "spam",
  "note": "محتوى إعلاني"
}
```
الأسباب: `abuse`, `misleading`, `spam`, `other`

---

### `POST /reviews/reviews/:id/reply` — الرد على مراجعة 🔒

```json
{
  "body": "شكراً لتقييمك! يسعدنا أن المنتج نال إعجابك."
}
```

---

### إشراف المراجعات 🔒 Staff+

| Method | Endpoint | الوصف |
|--------|----------|-------|
| `GET` | `/reviews/admin/queue` | قائمة انتظار الإشراف |
| `PATCH` | `/reviews/admin/:id/moderate` | اعتماد/رفض: `{ "status": "approved" }` |

---

## 11. الأسئلة والأجوبة (Q&A)

### `GET /reviews/products/:productId/questions` — أسئلة المنتج (عام)

### `POST /reviews/products/:productId/questions` — طرح سؤال 🔒

```json
{
  "body": "هل تدعم الشحن اللاسلكي؟"
}
```

### `POST /reviews/questions/:id/answers` — إجابة 🔒

```json
{
  "body": "نعم، تدعم الشحن اللاسلكي Qi بقوة 15W"
}
```

> الإجابة من Staff/Admin تُعلّم تلقائياً كإجابة رسمية (`isStoreAnswer: true`)

---

## 12. تذاكر الدعم (Support Tickets)

### `POST /support/tickets` — فتح تذكرة جديدة 🔒

```json
{
  "subject": "مشكلة في الشحن",
  "category": "shipping",
  "priority": "high",
  "relatedOrder": "665abc... (اختياري)",
  "body": "الطلب لم يصل بعد 5 أيام"
}
```

| الحقل | القيم المسموحة |
|-------|---------------|
| category | `order`, `shipping`, `product`, `payment`, `other` |
| priority | `low`, `medium`, `high`, `urgent` |

---

### `GET /support/tickets/my` — تذاكري 🔒
### `GET /support/tickets/:id` — تفاصيل تذكرة 🔒

---

### `POST /support/tickets/:id/messages` — إضافة رسالة 🔒

```json
{
  "body": "هل من تحديث على الموضوع؟"
}
```

---

### إدارة التذاكر 🔒 Staff+

| Method | Endpoint | الوصف |
|--------|----------|-------|
| `GET` | `/support/tickets/admin/all` | كل التذاكر (مع فلتر `status`, `priority`, `assigned_to`) |
| `PATCH` | `/support/tickets/admin/:id` | تعيين/تغيير حالة |
| `POST` | `/support/tickets/:id/messages` | رد (مع `isInternalNote: true` للملاحظات الداخلية) |

**تغيير حالة التذكرة:**
```json
{
  "status": "in_progress",
  "assignedTo": "665abc... (ID الموظف)",
  "priority": "urgent"
}
```

---

## 13. الإشعارات (Notifications)

### `GET /notifications` — إشعاراتي 🔒

**Query:** `page`, `per_page`, `unread=true`

---

### `PATCH /notifications/:id/read` — تعليم كمقروء 🔒
### `PATCH /notifications/read-all` — تعليم الكل مقروء 🔒

---

## 14. لوحة التحكم - إدارة (Admin)

### `GET /admin/dashboard` — ملخص لوحة التحكم 🔒 Admin|Manager|Staff

```json
{
  "data": {
    "totalOrders": 1250,
    "pendingOrders": 15,
    "todayOrders": 8,
    "totalRevenue": 425000,
    "totalCustomers": 890,
    "lowStockCount": 12,
    "pendingReviews": 5,
    "openTickets": 3
  }
}
```

---

### `GET /admin/reports/revenue` — تقرير الإيرادات 🔒 Manager+

**Query:** `period` (`daily`|`weekly`|`monthly`), `from`, `to`

```json
{
  "data": {
    "period": "daily",
    "summary": {
      "totalRevenue": 125000,
      "totalOrders": 45,
      "avgOrderValue": 2777,
      "totalDiscount": 8500
    },
    "breakdown": [
      { "_id": "2026-06-01", "revenue": 15000, "orders": 5, "avgOrderValue": 3000 },
      { "_id": "2026-06-02", "revenue": 22000, "orders": 8, "avgOrderValue": 2750 }
    ]
  }
}
```

---

### `GET /admin/reports/top-products` — أعلى المنتجات مبيعاً 🔒 Manager+
### `GET /admin/reports/coupons` — أداء الكوبونات 🔒 Manager+
### `GET /admin/reports/tickets-sla` — تقرير SLA التذاكر 🔒 Manager+

---

### إدارة الطلبات 🔒 Staff+

| Method | Endpoint | الوصف |
|--------|----------|-------|
| `GET` | `/orders/admin/all` | كل الطلبات (فلتر: `status`, `payment_status`, `from`, `to`) |
| `PATCH` | `/orders/admin/:id/status` | تغيير حالة: `{ "status": "shipped", "note": "شحنة #123" }` |

---

### إدارة المخزون 🔒 Warehouse+

| Method | Endpoint | الوصف |
|--------|----------|-------|
| `GET` | `/inventory/warehouses` | المخازن |
| `POST` | `/inventory/warehouses` | إنشاء مخزن (Admin) |
| `GET` | `/inventory` | عرض المخزون (فلتر: `warehouse_id`, `product_id`) |
| `GET` | `/inventory/low-stock` | منتجات منخفضة المخزون |
| `POST` | `/inventory/movements` | تسجيل حركة (دخول/خروج/تسوية/إرجاع) |
| `POST` | `/inventory/transfer` | نقل بين مخازن |

**حركة مخزون:**
```json
{
  "productId": "665abc...",
  "warehouseId": "665def...",
  "type": "in",
  "quantity": 50,
  "reason": "وصول شحنة جديدة"
}
```

**نقل بين مخازن:**
```json
{
  "productId": "665abc...",
  "fromWarehouseId": "665aaa...",
  "toWarehouseId": "665bbb...",
  "quantity": 20,
  "reason": "نقل للفرع الجديد"
}
```

---

## 15. صيغة الاستجابة (Response Format)

### استجابة ناجحة:
```json
{
  "success": true,
  "message": "Success",
  "data": { ... }
}
```

### استجابة ناجحة مع Pagination:
```json
{
  "success": true,
  "message": "Success",
  "data": [ ... ],
  "meta": {
    "pagination": {
      "total": 100,
      "per_page": 24,
      "current_page": 1,
      "last_page": 5,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

### استجابة خطأ:
```json
{
  "success": false,
  "message": "Validation failed",
  "code": "BAD_REQUEST",
  "errors": [
    { "field": "email", "message": "email is required" },
    { "field": "password", "message": "password must be at least 8 characters" }
  ]
}
```

---

## 16. أكواد الأخطاء (Error Codes)

| كود HTTP | الكود | الوصف |
|----------|-------|-------|
| 400 | `BAD_REQUEST` | بيانات خاطئة أو ناقصة |
| 400 | `VALIDATION_ERROR` | فشل التحقق من البيانات |
| 401 | `UNAUTHORIZED` | غير مصادق (توكن مفقود أو منتهي) |
| 401 | `TOKEN_EXPIRED` | التوكن منتهي الصلاحية — استخدم refresh |
| 403 | `FORBIDDEN` | لا تملك صلاحية لهذا الإجراء |
| 404 | `NOT_FOUND` | المورد غير موجود |
| 409 | `CONFLICT` | تعارض (مثل: البريد مسجل مسبقاً) |
| 409 | `DUPLICATE_KEY` | قيمة مكررة في حقل فريد |
| 429 | `RATE_LIMITED` | طلبات كثيرة — انتظر |
| 500 | `INTERNAL_ERROR` | خطأ في الخادم |

---

## 🔐 ملاحظات أمنية مهمة للفرونت إند

1. **خزّن `accessToken` في الذاكرة فقط** (لا localStorage) — الـ refreshToken يُخزن في httpOnly cookie تلقائياً
2. عند استلام خطأ `401 TOKEN_EXPIRED`، استدعِ `POST /auth/refresh` تلقائياً
3. أضف `Authorization: Bearer <token>` في كل طلب يحتاج مصادقة
4. أضف `credentials: 'include'` في fetch/axios لإرسال cookies

**مثال Axios:**
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
  withCredentials: true, // مهم لإرسال cookies
});

// Interceptor لتجديد التوكن تلقائياً
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED') {
      const { data } = await api.post('/auth/refresh');
      api.defaults.headers.common['Authorization'] = `Bearer ${data.data.accessToken}`;
      error.config.headers['Authorization'] = `Bearer ${data.data.accessToken}`;
      return api(error.config);
    }
    return Promise.reject(error);
  }
);
```

---

## 📊 الأدوار والصلاحيات

| الدور | الصلاحيات |
|-------|-----------|
| **admin** | كامل الصلاحيات |
| **manager** | إدارة المنتجات، الطلبات، التقارير، الخصومات، التذاكر |
| **staff** | معالجة الطلبات، إشراف التعليقات، الرد على التذاكر |
| **warehouse_worker** | إدارة المخزون والحركات فقط |
| **customer** | واجهة العميل فقط |

---

> 📌 **Health Check:** `GET /api/v1/health` — يعيد حالة الخادم و uptime
