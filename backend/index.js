///var/www/movethatstuff/backend/index.js///
require('dotenv').config(); // Load environment variables

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet'); // Added for security headers
const logger = require('./logger');
const app = express();
const http = require('http');
const server = http.createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: 'http://localhost:3000', // Restrict to frontend
    methods: ['GET', 'POST']
  }
});
const port = 3000;

app.use(helmet()); // Security headers (e.g., XSS protection)

app.use(cors({
  origin: 'http://localhost:3000', // Restrict to frontend domain
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json()); // Middleware to parse JSON bodies
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url} - IP: ${req.ip}`);
    next();
});

// Rate limiting middleware (100 requests per 15 minutes per IP)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false // Disable the `X-RateLimit-*` headers
});
app.use(limiter);

// Make io available to routes
app.set('io', io);

// Import routes
const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const estimateRoutes = require('./routes/estimateRoutes');
const tenantRoutes = require('./routes/tenantRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const reportsRoutes = require('./routes/reportsRoutes');
const communicationsRoutes = require('./routes/communicationsRoutes');
const portalRoutes = require('./routes/portalRoutes');
const intakeRoutes = require('./routes/intakeRoutes'); // New for public intake

// Mount routes
app.use('/auth', authRoutes);
app.use('/customers', customerRoutes);
app.use('/estimates', estimateRoutes);
app.use('/tenants', tenantRoutes);
app.use('/settings', settingsRoutes);
app.use('/reports', reportsRoutes);
app.use('/communications', communicationsRoutes);
app.use('/portal', portalRoutes);
app.use('/intake', intakeRoutes); // Public intake endpoint

// Root endpoint
app.get('/', (req, res) => {
    res.send('Welcome to MoveThatStuff CRM Backend!');
});

// Global error handling middleware
app.use((err, req, res, next) => {
    logger.error(`${err.message} - Stack: ${err.stack}`);
    res.status(500).send('Something broke!');
});

// Socket.io connection
io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    socket.on('joinEstimate', (estimateId) => {
        socket.join(`estimate_${estimateId}`);
        logger.info(`Socket ${socket.id} joined estimate_${estimateId}`);
    });

    socket.on('disconnect', () => {
        logger.info(`Socket disconnected: ${socket.id}`);
    });
});

// Start server
server.listen(port, () => {
    logger.info(`Server running on port ${port}`);
});