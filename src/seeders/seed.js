import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import Role from '../models/Role.js';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Warehouse from '../models/Warehouse.js';
import Inventory from '../models/Inventory.js';
import { ROLE_PERMISSIONS, ROLES } from '../config/constants.js';
import { generateUniqueSlug } from '../utils/slugify.js';
import logger from '../config/logger.js';

dotenv.config();

const seed = async () => {
  try {
    await mongoose.connect("mongodb+srv://hello:1234@cluster0.griwwl2.mongodb.net/we");
    logger.info('Connected to MongoDB for seeding');

    // ─── 1. Seed Roles ──────────────────────────────
    logger.info('Seeding roles...');
    const roles = {};
    for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      roles[roleName] = await Role.findOneAndUpdate(
        { name: roleName },
        { name: roleName, permissions, description: `${roleName} role` },
        { upsert: true, new: true },
      );
    }
    logger.info(`✓ ${Object.keys(roles).length} roles seeded`);

    // ─── 2. Seed Admin User ─────────────────────────
    logger.info('Seeding admin user...');
    const adminExists = await User.findOne({ email: 'admin@store.com' });
    if (!adminExists) {
      await User.create({
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@store.com',
        password: 'Admin@123456',
        role: roles[ROLES.ADMIN]._id,
        isActive: true,
        isEmailVerified: true,
      });
      logger.info('✓ Admin user created (admin@store.com / Admin@123456)');
    } else {
      logger.info('✓ Admin user already exists');
    }

    // ─── 3. Seed Manager ────────────────────────────
    const managerExists = await User.findOne({ email: 'manager@store.com' });
    if (!managerExists) {
      await User.create({
        firstName: 'Manager',
        lastName: 'User',
        email: 'manager@store.com',
        password: 'Manager@123456',
        role: roles[ROLES.MANAGER]._id,
        isActive: true,
        isEmailVerified: true,
      });
      logger.info('✓ Manager user created (manager@store.com / Manager@123456)');
    }

    // ─── 4. Seed Test Customer ──────────────────────
    const customerExists = await User.findOne({ email: 'customer@test.com' });
    if (!customerExists) {
      await User.create({
        firstName: 'Test',
        lastName: 'Customer',
        email: 'customer@test.com',
        password: 'Customer@123456',
        role: roles[ROLES.CUSTOMER]._id,
        isActive: true,
        isEmailVerified: true,
      });
      logger.info('✓ Test customer created (customer@test.com / Customer@123456)');
    }

    // ─── 5. Seed Categories ─────────────────────────
    logger.info('Seeding categories...');
    const categoryData = [
      { name: 'Electronics', children: ['Smartphones', 'Laptops', 'Accessories'] },
      { name: 'Clothing', children: ['Men', 'Women', 'Kids'] },
      { name: 'Home & Kitchen', children: ['Furniture', 'Appliances', 'Decor'] },
      { name: 'Sports', children: ['Fitness', 'Outdoor', 'Team Sports'] },
    ];

    let categoryCount = 0;
    for (const cat of categoryData) {
      const slug = await generateUniqueSlug(cat.name, Category);
      const parent = await Category.findOneAndUpdate(
        { name: cat.name },
        { name: cat.name, slug, isActive: true, path: ',', depth: 0 },
        { upsert: true, new: true },
      );
      categoryCount++;

      for (const childName of cat.children) {
        const childSlug = await generateUniqueSlug(childName, Category);
        await Category.findOneAndUpdate(
          { name: childName, parent: parent._id },
          {
            name: childName,
            slug: childSlug,
            parent: parent._id,
            path: `,${parent._id},`,
            depth: 1,
            isActive: true,
          },
          { upsert: true, new: true },
        );
        categoryCount++;
      }
    }
    logger.info(`✓ ${categoryCount} categories seeded`);

    // ─── 6. Seed Warehouse ──────────────────────────
    logger.info('Seeding warehouses...');
    const warehouse = await Warehouse.findOneAndUpdate(
      { code: 'MAIN' },
      {
        name: 'Main Warehouse',
        code: 'MAIN',
        address: { country: 'SA', city: 'Riyadh' },
        isActive: true,
        isDefault: true,
      },
      { upsert: true, new: true },
    );

    const warehouse2 = await Warehouse.findOneAndUpdate(
      { code: 'SEC' },
      {
        name: 'Secondary Warehouse',
        code: 'SEC',
        address: { country: 'SA', city: 'Jeddah' },
        isActive: true,
      },
      { upsert: true, new: true },
    );
    logger.info('✓ 2 warehouses seeded');

    // ─── 7. Seed Products ───────────────────────────
    logger.info('Seeding products...');
    const electronics = await Category.findOne({ name: 'Electronics' });
    const smartphones = await Category.findOne({ name: 'Smartphones' });
    const laptops = await Category.findOne({ name: 'Laptops' });
    const clothing = await Category.findOne({ name: 'Clothing' });

    const products = [
      {
        name: 'iPhone 15 Pro Max',
        sku: 'IPHONE15PM',
        price: 4999,
        discountPrice: 4499,
        brand: 'Apple',
        categories: [electronics?._id, smartphones?._id].filter(Boolean),
        attributes: [
          { key: 'color', value: 'Titanium Black' },
          { key: 'storage', value: '256GB' },
        ],
        flags: { featured: true, bestSeller: true },
        status: 'active',
        isActive: true,
        stock: 50,
      },
      {
        name: 'Samsung Galaxy S24 Ultra',
        sku: 'SAMS24U',
        price: 4499,
        discountPrice: 3999,
        brand: 'Samsung',
        categories: [electronics?._id, smartphones?._id].filter(Boolean),
        attributes: [
          { key: 'color', value: 'Phantom Black' },
          { key: 'storage', value: '512GB' },
        ],
        flags: { featured: true, newArrival: true },
        status: 'active',
        isActive: true,
        stock: 35,
      },
      {
        name: 'MacBook Pro M3 14"',
        sku: 'MBP14M3',
        price: 7999,
        brand: 'Apple',
        categories: [electronics?._id, laptops?._id].filter(Boolean),
        attributes: [
          { key: 'color', value: 'Space Gray' },
          { key: 'ram', value: '16GB' },
          { key: 'storage', value: '512GB' },
        ],
        flags: { featured: true, topPriority: true },
        status: 'active',
        isActive: true,
        stock: 20,
      },
      {
        name: 'Nike Air Max 270',
        sku: 'NIKE-AM270',
        price: 599,
        discountPrice: 449,
        brand: 'Nike',
        categories: [clothing?._id].filter(Boolean),
        attributes: [
          { key: 'color', value: 'Black/White' },
          { key: 'size', value: '42' },
        ],
        flags: { bestSeller: true },
        status: 'active',
        isActive: true,
        stock: 100,
      },
      {
        name: 'Sony WH-1000XM5',
        sku: 'SONY-WH1KXM5',
        price: 1499,
        discountPrice: 1199,
        brand: 'Sony',
        categories: [electronics?._id].filter(Boolean),
        attributes: [
          { key: 'color', value: 'Black' },
          { key: 'type', value: 'Over-ear' },
        ],
        flags: { newArrival: true },
        status: 'active',
        isActive: true,
        stock: 45,
      },
    ];

    let productCount = 0;
    for (const prod of products) {
      const existing = await Product.findOne({ sku: prod.sku });
      if (!existing) {
        prod.slug = await generateUniqueSlug(prod.name, Product);
        const created = await Product.create(prod);

        // Create inventory record
        await Inventory.findOneAndUpdate(
          { product: created._id, warehouse: warehouse._id },
          { product: created._id, warehouse: warehouse._id, quantity: prod.stock },
          { upsert: true },
        );
        productCount++;
      }
    }
    logger.info(`✓ ${productCount} products seeded`);

    // ─── Done ───────────────────────────────────────
    logger.info('');
    logger.info('═══════════════════════════════════════════');
    logger.info('  ✅ Database seeding completed!');
    logger.info('═══════════════════════════════════════════');
    logger.info('');
    logger.info('  Test accounts:');
    logger.info('  Admin:    admin@store.com    / Admin@123456');
    logger.info('  Manager:  manager@store.com  / Manager@123456');
    logger.info('  Customer: customer@test.com  / Customer@123456');
    logger.info('');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  }
};

seed();
