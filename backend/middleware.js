///var/www/movethatstuff/backend/middleware.js//
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const Joi = require('joi');
const moment = require('moment-timezone');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const Redis = require('ioredis'); // Added for Redis

require('dotenv').config();

const pool = new Pool({
    user: 'patrick',
    host: 'localhost',
    database: 'movethatstuff',
    password: '455454',
    port: 5432,
});

const redis = new Redis(); // Connect to local Redis

const secretKey = process.env.SECRET_KEY;

const authenticateToken = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).send('Access denied. No token provided.');
    const blacklisted = await redis.get(`blacklist:${token}`);
    if (blacklisted) return res.status(403).send('Token blacklisted.');
    jwt.verify(token, secretKey, (err, user) => {
        if (err) return res.status(403).send('Invalid token.');
        req.user = user;
        pool.query(
            `SELECT tenant_id, 
                    (SELECT timezone FROM tenants WHERE id = users.tenant_id) AS tenant_timezone,
                    ARRAY_AGG(DISTINCT r.name) AS roles,
                    ARRAY_AGG(DISTINCT p.name) FILTER (WHERE p.name IS NOT NULL) AS permissions
             FROM users
             LEFT JOIN user_roles ur ON users.id = ur.user_id
             LEFT JOIN roles r ON ur.role_id = r.id
             LEFT JOIN role_permissions rp ON r.id = rp.role_id
             LEFT JOIN permissions p ON rp.permission_id = p.id
             WHERE users.id = $1
             GROUP BY users.id, tenant_id`,
            [user.id],
            (err, result) => {
                if (err || result.rowCount === 0) return res.status(500).send('Error fetching user tenant, roles, and permissions.');
                req.tenantId = result.rows[0].tenant_id;
                req.roles = result.rows[0].roles || [];
                req.permissions = new Set(result.rows[0].permissions || []);
                req.tenantTimezone = result.rows[0].tenant_timezone || 'UTC';
                if (req.tenantId !== user.tenantId) return res.status(403).send('Tenant mismatch in token.');
                next();
            }
        );
    });
};

const requirePermission = (permission) => (req, res, next) => {
    if (!req.permissions.has(permission)) return res.status(403).send(`Permission "${permission}" required.`);
    next();
};

const validate = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ error: error.details.map(d => d.message) });
    next();
};

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

module.exports = { authenticateToken, requirePermission, validate, pool, secretKey, moment, transporter, twilioClient, redis };