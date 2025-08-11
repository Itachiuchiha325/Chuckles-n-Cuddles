const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Email transporter setup (configure with your email service)
const transport = nodemailer.createTransport({
  service: 'gmail', // or your email service
  auth: {
    user: process.env.EMAIL_USER, // your email
    pass: process.env.EMAIL_PASSWORD // your app password
  }
});

// Multer configuration for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('public/uploads'));

// Create uploads directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync('public/uploads')) {
  fs.mkdirSync('public/uploads', { recursive: true });
}

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/little-treasures', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// OTP Schema
const otpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp: { type: String, required: true },
  type: { type: String, enum: ['registration', 'login', 'password_reset'], required: true },
  verified: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } }
});

// Product Schema (Enhanced with image support)
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  stock: { type: Number, required: true, default: 0 },
  description: { type: String },
  images: [{ type: String }], // Array of image URLs
  mainImage: { type: String }, // Primary image
  featured: { type: Boolean, default: false },
  tags: [String],
  sku: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now }
});

// Auto-generate SKU
productSchema.pre('save', async function(next) {
  if (!this.sku) {
    const count = await mongoose.models.Product.countDocuments();
    this.sku = `LT-${this.category.toUpperCase()}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Order Schema
const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  customerPhone: { type: String, required: true },
  customerAddress: { type: String, required: true },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    price: Number,
    quantity: Number,
    image: String
  }],
  totalAmount: { type: Number, required: true },
  paymentMethod: { type: String, default: 'cod' },
  paymentStatus: { type: String, default: 'pending', enum: ['pending', 'paid', 'failed'] },
  status: { type: String, default: 'pending', enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'] },
  notes: { type: String },
  trackingNumber: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Auto-generate order number
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const count = await mongoose.models.Order.countDocuments();
    this.orderNumber = `LT${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Enhanced User Schema with email verification
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  phone: { type: String },
  address: { type: String },
  dateOfBirth: { type: Date },
  gender: { type: String, enum: ['male', 'female', 'other'] },
  role: { type: String, default: 'customer' },
  isActive: { type: Boolean, default: false }, // Requires email verification
  emailVerified: { type: Boolean, default: false },
  avatar: { type: String },
  orders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  addresses: [{
    type: { type: String, enum: ['home', 'work', 'other'], default: 'home' },
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' },
    isDefault: { type: Boolean, default: false }
  }],
  lastLogin: { type: Date },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Enhanced Admin Schema
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, default: 'admin' },
  permissions: {
    type: [String],
    default: ['products', 'orders', 'users', 'dashboard', 'analytics']
  },
  avatar: { type: String },
  isActive: { type: Boolean, default: true },
  emailVerified: { type: Boolean, default: false },
  lastLogin: { type: Date },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

// Hash admin password before saving
adminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Models
const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);
const User = mongoose.model('User', userSchema);
const Admin = mongoose.model('Admin', adminSchema);
const OTP = mongoose.model('OTP', otpSchema);

// JWT Token Generation
const generateToken = (userId, role, model = 'User') => {
  return jwt.sign(
    { userId, role, model },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  );
};

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP Email
const sendOTPEmail = async (email, otp, type) => {
  const subject = {
    registration: 'Verify Your Email - Little Treasures',
    login: 'Your Login OTP - Little Treasures',
    password_reset: 'Password Reset OTP - Little Treasures'
  };

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%); padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Little Treasures</h1>
        <p style="color: white; margin: 5px 0;">Kids Stationery & More</p>
      </div>
      <div style="padding: 30px; background: white;">
        <h2>Your OTP Code</h2>
        <p>Your One-Time Password (OTP) for ${type.replace('_', ' ')} is:</p>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 10px; margin: 20px 0;">
          <h1 style="color: #ff6b6b; font-size: 36px; margin: 0; letter-spacing: 5px;">${otp}</h1>
        </div>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 14px;">
          Thanks,<br>
          Little Treasures Team
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: subject[type],
      html: html
    });
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
};

// Authentication Middlewares
const authenticateUser = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    if (decoded.role !== 'customer') {
      return res.status(403).json({ error: 'Customer access required.' });
    }

    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive || !user.emailVerified) {
      return res.status(401).json({ error: 'Invalid token or user inactive.' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid token.' });
  }
};

const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const admin = await Admin.findById(decoded.userId);
    
    if (!admin || !admin.isActive) {
      return res.status(401).json({ error: 'Invalid admin token.' });
    }

    req.admin = admin;
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid admin token.' });
  }
};

// Routes - Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===================
// OTP ROUTES
// ===================

// Send OTP for user registration/login
app.post('/api/send-otp', async (req, res) => {
  try {
    const { email, type } = req.body; // type: 'registration', 'login', 'password_reset'
    
    if (!email || !type) {
      return res.status(400).json({ error: 'Email and type are required.' });
    }

    // Check if user exists based on type
    const existingUser = await User.findOne({ email });
    
    if (type === 'registration' && existingUser) {
      return res.status(400).json({ error: 'User already exists with this email.' });
    }
    
    if ((type === 'login' || type === 'password_reset') && !existingUser) {
      return res.status(404).json({ error: 'User not found with this email.' });
    }

    // Generate and save OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Remove existing OTPs for this email and type
    await OTP.deleteMany({ email, type });

    const newOTP = new OTP({
      email,
      otp,
      type,
      expiresAt
    });

    await newOTP.save();

    // Send OTP email
    const emailSent = await sendOTPEmail(email, otp, type);
    
    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to send OTP email.' });
    }

    res.json({ 
      message: 'OTP sent successfully to your email.',
      email: email 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify OTP
app.post('/api/verify-otp', async (req, res) => {
  try {
    const { email, otp, type } = req.body;
    
    if (!email || !otp || !type) {
      return res.status(400).json({ error: 'Email, OTP, and type are required.' });
    }

    // Find and verify OTP
    const otpRecord = await OTP.findOne({ 
      email, 
      otp, 
      type, 
      verified: false 
    });

    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    // Mark OTP as verified
    otpRecord.verified = true;
    await otpRecord.save();

    res.json({ 
      message: 'OTP verified successfully.',
      verified: true 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===================
// USER AUTHENTICATION ROUTES
// ===================

// User Registration (with OTP verification)
app.post('/api/user/register', async (req, res) => {
  try {
    const { name, email, password, phone, address, otp } = req.body;

    // Verify OTP first
    const otpRecord = await OTP.findOne({ 
      email, 
      otp, 
      type: 'registration',
      verified: true 
    });

    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid or unverified OTP.' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email.' });
    }

    // Create new user
    const user = new User({ 
      name, 
      email, 
      password, 
      phone, 
      address, 
      role: 'customer',
      isActive: true,
      emailVerified: true
    });
    
    await user.save();

    // Clean up OTP
    await OTP.deleteMany({ email, type: 'registration' });

    // Generate token
    const token = generateToken(user._id, user.role);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User Login (with OTP option)
app.post('/api/user/login', async (req, res) => {
  try {
    const { email, password, otp, loginType } = req.body; // loginType: 'password' or 'otp'

    // Find user
    const user = await User.findOne({ email, role: 'customer' });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    if (!user.isActive || !user.emailVerified) {
      return res.status(401).json({ error: 'Account not verified or inactive.' });
    }

    let isValid = false;

    if (loginType === 'otp') {
      // OTP Login
      const otpRecord = await OTP.findOne({ 
        email, 
        otp, 
        type: 'login',
        verified: true 
      });
      
      if (otpRecord) {
        isValid = true;
        // Clean up OTP
        await OTP.deleteMany({ email, type: 'login' });
      }
    } else {
      // Password Login
      isValid = await bcrypt.compare(password, user.password);
    }

    if (!isValid) {
      user.loginAttempts += 1;
      
      if (user.loginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
      }
      
      await user.save();
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Reset login attempts and update last login
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id, user.role);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        emailVerified: user.emailVerified
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===================
// ADMIN AUTHENTICATION ROUTES
// ===================

// Admin Login (password only, can add OTP later)
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const admin = await Admin.findOne({ email });
    if (!admin || !admin.isActive) {
      return res.status(400).json({ error: 'Invalid admin credentials' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      admin.loginAttempts += 1;
      
      if (admin.loginAttempts >= 3) {
        admin.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // Lock for 15 minutes
      }
      
      await admin.save();
      return res.status(400).json({ error: 'Invalid admin credentials' });
    }

    // Reset login attempts and update last login
    admin.loginAttempts = 0;
    admin.lockUntil = undefined;
    admin.lastLogin = new Date();
    await admin.save();

    const token = generateToken(admin._id, admin.role, 'Admin');

    res.json({ 
      message: 'Admin login successful',
      token, 
      admin: { 
        id: admin._id, 
        username: admin.username, 
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions
      } 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===================
// PRODUCT ROUTES (Enhanced with image support)
// ===================

// Get all products (Public)
app.get('/api/products', async (req, res) => {
  try {
    const { category, featured, search, sort, limit } = req.query;
    let filter = {};
    
    if (category && category !== 'all') filter.category = category;
    if (featured === 'true') filter.featured = true;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    let query = Product.find(filter);
    
    if (sort === 'price_low') query = query.sort({ price: 1 });
    else if (sort === 'price_high') query = query.sort({ price: -1 });
    else if (sort === 'name') query = query.sort({ name: 1 });
    else query = query.sort({ createdAt: -1 });
    
    if (limit) query = query.limit(parseInt(limit));

    const products = await query;
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add product with image upload (Admin only)
app.post('/api/products', authenticateAdmin, upload.array('images', 5), async (req, res) => {
  try {
    const { name, price, category, stock, description, tags, featured } = req.body;
    
    // Process uploaded images
    const imageUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
    
    const product = new Product({
      name,
      price: parseFloat(price),
      category,
      stock: parseInt(stock),
      description,
      images: imageUrls,
      mainImage: imageUrls[0] || null,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      featured: featured === 'true'
    });

    await product.save();
    res.status(201).json({
      message: 'Product added successfully',
      product
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update product (Admin only)
app.put('/api/products/:id', authenticateAdmin, upload.array('images', 5), async (req, res) => {
  try {
    const { name, price, category, stock, description, tags, featured, removeImages } = req.body;
    
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Handle image updates
    let currentImages = [...product.images];
    
    // Remove specified images
    if (removeImages) {
      const toRemove = JSON.parse(removeImages);
      currentImages = currentImages.filter(img => !toRemove.includes(img));
    }
    
    // Add new images
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => `/uploads/${file.filename}`);
      currentImages = [...currentImages, ...newImages];
    }

    const updateData = {
      name,
      price: parseFloat(price),
      category,
      stock: parseInt(stock),
      description,
      images: currentImages,
      mainImage: currentImages[0] || null,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : product.tags,
      featured: featured === 'true'
    };

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    res.json({
      message: 'Product updated successfully',
      product: updatedProduct
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete product (Admin only)
app.delete('/api/products/:id', authenticateAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // TODO: Delete associated image files from filesystem
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===================
// ORDER ROUTES (Enhanced)
// ===================

// Create order (Enhanced with better validation)
app.post('/api/create-order', async (req, res) => {
  try {
    const { customerInfo, items, paymentMethod, notes, userId } = req.body;

    // Validate and calculate total
    let totalAmount = 0;
    const orderItems = [];

    for (let item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(400).json({ error: `Product ${item.name} not found` });
      }
      
      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
      }

      orderItems.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        image: product.mainImage
      });

      totalAmount += product.price * item.quantity;
    }

    // Create order
    const order = new Order({
      userId: userId || null,
      customerName: customerInfo.name,
      customerEmail: customerInfo.email,
      customerPhone: customerInfo.phone,
      customerAddress: customerInfo.address,
      items: orderItems,
      totalAmount,
      paymentMethod: paymentMethod || 'cod',
      notes: notes || ''
    });

    await order.save();

    // Update product stock
    for (let item of orderItems) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { stock: -item.quantity } }
      );
    }

    // If user is logged in, add order to their profile
    if (userId) {
      await User.findByIdAndUpdate(
        userId,
        { $push: { orders: order._id } }
      );
    }

    res.status(201).json({
      success: true,
      order: order,
      message: 'Order created successfully!'
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize sample data with images
app.post('/api/init-data', async (req, res) => {
  try {
    const existingProducts = await Product.countDocuments();
    if (existingProducts > 0) {
      return res.json({ message: 'Data already exists' });
    }

    const sampleProducts = [
      {
        name: "Rainbow Pencil Set",
        price: 150,
        category: "stationery",
        stock: 25,
        description: "Colorful set of 12 pencils with rainbow design, perfect for art and writing",
        images: [],
        mainImage: "🌈",
        tags: ["pencils", "colorful", "art", "rainbow"],
        featured: true
      },
      {
        name: "Unicorn Backpack",
        price: 850,
        category: "bags",
        stock: 12,
        description: "Beautiful unicorn themed backpack with sparkly details and multiple compartments",
        images: [],
        mainImage: "🦄",
        tags: ["backpack", "unicorn", "school", "sparkly"],
        featured: true
      },
      {
        name: "Star Sticker Pack",
        price: 75,
        category: "accessories",
        stock: 30,
        description: "Pack of 50 colorful star stickers in various sizes",
        images: [],
        mainImage: "⭐",
        tags: ["stickers", "stars", "decoration"],
        featured: false
      },
      {
        name: "Colorful Notebooks",
        price: 200,
        category: "stationery",
        stock: 20,
        description: "Set of 3 colorful notebooks with fun animal designs and lined pages",
        images: [],
        mainImage: "📚",
        tags: ["notebooks", "animals", "writing"],
        featured: true
      },
      {
        name: "Princess Lunch Bag",
        price: 450,
        category: "bags",
        stock: 15,
        description: "Insulated lunch bag with princess theme, keeps food fresh and cool",
        images: [],
        mainImage: "👸",
        tags: ["lunch bag", "princess", "insulated"],
        featured: false
      },
      {
        name: "Fun Erasers Set",
        price: 120,
        category: "accessories",
        stock: 40,
        description: "Set of 10 fun-shaped erasers including fruits, animals, and toys",
        images: [],
        mainImage: "🧽",
        tags: ["erasers", "fun shapes", "animals", "fruits"],
        featured: false
      }
    ];

    await Product.insertMany(sampleProducts);
    res.json({ message: 'Sample data created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all orders (Admin only)
app.get('/api/orders', authenticateAdmin, async (req, res) => {
  try {
    const { status, limit, page } = req.query;
    let filter = {};
    
    if (status && status !== 'all') filter.status = status;
    
    const pageSize = parseInt(limit) || 20;
    const pageNum = parseInt(page) || 1;
    const skip = (pageNum - 1) * pageSize;

    const orders = await Order.find(filter)
      .populate('items.productId')
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    const total = await Order.countDocuments(filter);

    res.json({
      orders,
      pagination: {
        page: pageNum,
        pages: Math.ceil(total / pageSize),
        total,
        limit: pageSize
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update order status (Admin only)
app.put('/api/orders/:id', authenticateAdmin, async (req, res) => {
  try {
    const { status, paymentStatus, paymentMethod, trackingNumber } = req.body;
    
    const updateData = {};
    if (status) updateData.status = status;
    if (paymentStatus) updateData.paymentStatus = paymentStatus;
    if (paymentMethod) updateData.paymentMethod = paymentMethod;
    if (trackingNumber) updateData.trackingNumber = trackingNumber;

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('items.productId');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      message: 'Order updated successfully',
      order
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===================
// USER PROFILE ROUTES
// ===================

// Get User Profile
app.get('/api/user/profile', authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('orders', 'orderNumber status totalAmount createdAt')
      .populate('wishlist', 'name price mainImage');

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        avatar: user.avatar,
        addresses: user.addresses,
        orders: user.orders,
        wishlist: user.wishlist,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update User Profile
app.put('/api/user/profile', authenticateUser, upload.single('avatar'), async (req, res) => {
  try {
    const { name, phone, address, dateOfBirth, gender } = req.body;
    
    const updateData = { name, phone, address };
    if (dateOfBirth) updateData.dateOfBirth = new Date(dateOfBirth);
    if (gender) updateData.gender = gender;
    if (req.file) updateData.avatar = `/uploads/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true }
    ).select('-password');

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        avatar: user.avatar
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add Address
app.post('/api/user/addresses', authenticateUser, async (req, res) => {
  try {
    const { type, street, city, state, pincode, country, isDefault } = req.body;
    
    const user = await User.findById(req.user._id);
    
    // If this is default address, unset others
    if (isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }
    
    user.addresses.push({
      type: type || 'home',
      street,
      city,
      state,
      pincode,
      country: country || 'India',
      isDefault: isDefault || false
    });

    await user.save();
    
    res.json({
      message: 'Address added successfully',
      addresses: user.addresses
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Wishlist Management
app.post('/api/user/wishlist/:productId', authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const productId = req.params.productId;
    
    if (!user.wishlist.includes(productId)) {
      user.wishlist.push(productId);
      await user.save();
      res.json({ message: 'Product added to wishlist' });
    } else {
      res.json({ message: 'Product already in wishlist' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/user/wishlist/:productId', authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.wishlist = user.wishlist.filter(id => id.toString() !== req.params.productId);
    await user.save();
    
    res.json({ message: 'Product removed from wishlist' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get User Orders
app.get('/api/user/orders', authenticateUser, async (req, res) => {
  try {
    const orders = await Order.find({ 
      $or: [
        { customerEmail: req.user.email },
        { userId: req.user._id }
      ]
    })
    .populate('items.productId')
    .sort({ createdAt: -1 });
    
    res.json({ orders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===================
// ADMIN DASHBOARD ROUTES (Enhanced)
// ===================

// Get dashboard statistics (Admin only)
app.get('/api/dashboard-stats', authenticateAdmin, async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalUsers = await User.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    
    // Calculate total revenue
    const revenueData = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalRevenue = revenueData.length > 0 ? revenueData[0].total : 0;
    
    // Monthly revenue (last 12 months)
    const monthlyRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
          status: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    
    // Low stock products
    const lowStockProducts = await Product.find({ stock: { $lte: 5 } });

    // Recent orders
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('items.productId')
      .populate('userId', 'name email');

    // Top selling products
    const topProducts = await Order.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          totalSold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' }
    ]);

    res.json({
      totalOrders,
      totalProducts,
      totalUsers,
      pendingOrders,
      totalRevenue,
      lowStockCount: lowStockProducts.length,
      lowStockProducts,
      recentOrders,
      monthlyRevenue,
      topProducts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all users (Admin only)
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
  try {
    const { page, limit, search, status } = req.query;
    
    let filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) filter.isActive = status === 'active';

    const pageSize = parseInt(limit) || 20;
    const pageNum = parseInt(page) || 1;
    const skip = (pageNum - 1) * pageSize;

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    const total = await User.countDocuments(filter);

    res.json({ 
      users,
      pagination: {
        page: pageNum,
        pages: Math.ceil(total / pageSize),
        total,
        limit: pageSize
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle user status (Admin only)
app.patch('/api/admin/users/:userId/toggle-status', authenticateAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully.`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===================
// ANALYTICS ROUTES (Admin only)
// ===================

// Sales Analytics
app.get('/api/analytics/sales', authenticateAdmin, async (req, res) => {
  try {
    const { period } = req.query; // daily, weekly, monthly, yearly
    
    let groupBy;
    let matchDate = new Date();
    
    switch (period) {
      case 'daily':
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
        matchDate.setDate(matchDate.getDate() - 30);
        break;
      case 'weekly':
        groupBy = {
          year: { $year: '$createdAt' },
          week: { $week: '$createdAt' }
        };
        matchDate.setDate(matchDate.getDate() - 90);
        break;
      case 'monthly':
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        };
        matchDate.setFullYear(matchDate.getFullYear() - 1);
        break;
      default:
        groupBy = { year: { $year: '$createdAt' } };
        matchDate.setFullYear(matchDate.getFullYear() - 5);
    }

    const salesData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: matchDate },
          status: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: groupBy,
          totalRevenue: { $sum: '$totalAmount' },
          totalOrders: { $sum: 1 },
          avgOrderValue: { $avg: '$totalAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1, '_id.day': 1 } }
    ]);

    res.json({ salesData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===================
// UTILITY ROUTES
// ===================

// Test Route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Little Treasures API is working!' });
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
    }
  }
  
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Little Treasures server running on port ${PORT}`);
  console.log(`Visit: http://localhost:${PORT}`);
  console.log('\n=== API ENDPOINTS ===');
  console.log('OTP ROUTES:');
  console.log('POST /api/send-otp - Send OTP for verification');
  console.log('POST /api/verify-otp - Verify OTP');
  console.log('\nUSER ROUTES:');
  console.log('POST /api/user/register - User registration (requires OTP)');
  console.log('POST /api/user/login - User login (password or OTP)');
  console.log('GET /api/user/profile - Get user profile');
  console.log('PUT /api/user/profile - Update user profile');
  console.log('POST /api/user/addresses - Add user address');
  console.log('POST /api/user/wishlist/:productId - Add to wishlist');
  console.log('DELETE /api/user/wishlist/:productId - Remove from wishlist');
  console.log('GET /api/user/orders - Get user orders');
  console.log('\nADMIN ROUTES:');
  console.log('POST /api/admin/login - Admin login');
  console.log('POST /api/products - Add product with images (Admin)');
  console.log('PUT /api/products/:id - Update product (Admin)');
  console.log('DELETE /api/products/:id - Delete product (Admin)');
  console.log('GET /api/orders - Get all orders (Admin)');
  console.log('PUT /api/orders/:id - Update order status (Admin)');
  console.log('GET /api/dashboard-stats - Dashboard statistics (Admin)');
  console.log('GET /api/admin/users - Get all users (Admin)');
  console.log('GET /api/analytics/sales - Sales analytics (Admin)');
  console.log('\nPUBLIC ROUTES:');
  console.log('GET /api/products - Get all products (with filters)');
  console.log('GET /api/products/:id - Get single product');
  console.log('POST /api/create-order - Create order');
});

module.exports = app;