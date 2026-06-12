import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: 50,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never return password by default
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: [true, 'Role is required'],
      index: true,
    },

    isActive: { type: Boolean, default: true, index: true },
    isEmailVerified: { type: Boolean, default: false },
    isReviewBanned: { type: Boolean, default: false },

    refreshTokenHash: { type: String, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },

    lastLoginAt: Date,
    loginAttempts: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.refreshTokenHash;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.loginAttempts;
        delete ret.lockedUntil;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// ─── Compound Indexes ─────────────────────────────────
UserSchema.index({ email: 1, isActive: 1 });

// ─── Virtuals ─────────────────────────────────────────
UserSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// ─── Pre-save: Hash password ──────────────────────────
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ─── Methods ──────────────────────────────────────────
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.isLocked = function () {
  return this.lockedUntil && new Date(this.lockedUntil) > new Date();
};

UserSchema.methods.incrementLoginAttempts = async function () {
  const MAX_ATTEMPTS = 5;
  const LOCK_DURATION = 30 * 60 * 1000; // 30 minutes

  this.loginAttempts += 1;
  if (this.loginAttempts >= MAX_ATTEMPTS) {
    this.lockedUntil = new Date(Date.now() + LOCK_DURATION);
  }
  await this.save();
};

UserSchema.methods.resetLoginAttempts = async function () {
  this.loginAttempts = 0;
  this.lockedUntil = undefined;
  this.lastLoginAt = new Date();
  await this.save();
};

const User = mongoose.model('User', UserSchema);
export default User;
