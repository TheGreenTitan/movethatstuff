///var/www/movethatstuff/backend/index.js
require('dotenv').config(); // Load environment variables

const express = require('express');
const app = express();
const port = 3000;

app.use(express.json()); // Middleware to parse JSON bodies
app.use(express.urlencoded({ extended: true }));

// Import routes
const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const opportunityRoutes = require('./routes/opportunityRoutes');
const estimateRoutes = require('./routes/estimateRoutes');
const tenantRoutes = require('./routes/tenantRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const reportsRoutes = require('./routes/reportsRoutes');
const communicationsRoutes = require('./routes/communicationsRoutes');

// Mount routes
app.use('/auth', authRoutes);
app.use('/customers', customerRoutes);
app.use('/opportunities', opportunityRoutes);
app.use('/estimates', estimateRoutes);
app.use('/tenants', tenantRoutes);
app.use('/settings', settingsRoutes);
app.use('/reports', reportsRoutes);
app.use('/communications', communicationsRoutes); // For communications like /twilio/webhook, /notifications, etc.

// Root endpoint
app.get('/', (req, res) => {
    res.send('Welcome to MoveThatStuff CRM Backend!');
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});