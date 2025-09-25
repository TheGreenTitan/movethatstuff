const pool = require('./db'); // Assuming db.js exports the PG pool
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const moment = require('moment-timezone');
const Redis = require('ioredis'); // For token blacklisting
const nodemailer = require('nodemailer'); // For email transporter
const twilio = require('twilio'); // For SMS client

// Environment secret
const secretKey = process.env.SECRET_KEY;

// Redis client for token blacklisting (if enabled)
const redis = new Redis();

// Email transporter (Nodemailer with Mandrill)
const transporter = nodemailer.createTransporter({
  host: 'smtp.mandrillapp.com',
  port: 587,
  auth: {
    user: 'patricknorris@movethatstuff.com', // Or your Mandrill sending user
    pass: process.env.MANDRILL_API_KEY // From .env only—no fallback
  }
});

// Twilio client (env vars only—no hardcodes)
const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

// Middleware: Authenticate JWT token and set req.user, req.tenantId
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Check if token is blacklisted in Redis
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    jwt.verify(token, secretKey, async (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid token' });
      }

      // Fetch user details including tenant_id and permissions
      const result = await pool.query(
        'SELECT u.id, u.username, u.tenant_id, array_agg(rp.permission_id) as permission_ids FROM users u ' +
        'JOIN user_roles ur ON u.id = ur.user_id ' +
        'JOIN role_permissions rp ON ur.role_id = rp.role_id ' +
        'WHERE u.id = $1 GROUP BY u.id',
        [user.id]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'User not found' });
      }

      const userData = result.rows[0];
      req.user = { id: userData.id, username: userData.username };
      req.tenantId = userData.tenant_id;
      req.permissions = new Set(userData.permission_ids || []); // For quick lookup

      // Fetch tenant timezone
      const tenantResult = await pool.query('SELECT timezone FROM tenants WHERE id = $1', [req.tenantId]);
      req.tenantTimezone = tenantResult.rows[0]?.timezone || 'UTC';

      next();
    });
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Middleware: Require specific permission
const requirePermission = (permission) => (req, res, next) => {
  if (!req.permissions.has(permission)) {
    return res.status(403).json({ error: `Permission "${permission}" required` });
  }
  next();
};

// Middleware: Input validation with Joi (now with null-check safeguard)
const validate = (schema) => (req, res, next) => {
  // Safeguard: Skip validation if no schema provided
  if (!schema) {
    console.warn('No validation schema provided for this route');
    return next();
  }

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

// Middleware: Parse and validate ID params (e.g., for :id)
const parseId = (req, res, next) => {
  const id = req.params.id;
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  req.params.id = parseInt(id, 10);
  next();
};

// Error handling middleware (global)
const errorHandler = (err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ error: 'Internal server error' });
};

// Exports
module.exports = {
  authenticateToken,
  requirePermission,
  validate,
  parseId,
  errorHandler,
  pool,
  secretKey,
  moment,
  transporter,
  twilioClient,
  redis
};