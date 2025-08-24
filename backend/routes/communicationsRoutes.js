const express = require('express');
const Joi = require('joi');
const moment = require('moment-timezone');
const jwt = require('jsonwebtoken');
const { authenticateToken, requirePermission, validate, pool, secretKey, transporter, twilioClient } = require('../middleware');

const router = express.Router();

const sendSmsSchema = Joi.object({
    content: Joi.string().optional() // Optional; auto-generate if not provided
});

// SMS Send Endpoint
router.post('/estimates/:id/send-sms', authenticateToken, requirePermission('edit_estimates'), validate(sendSmsSchema), async (req, res) => {
    const estimateId = parseInt(req.params.id);
    if (isNaN(estimateId)) return res.status(400).send('Invalid estimate ID');
    const { content } = req.body;
    try {
        // Check tenant communications enabled
        const tenantRes = await pool.query('SELECT enable_communications FROM tenants WHERE id = $1', [req.tenantId]);
        if (!tenantRes.rows[0].enable_communications) return res.status(403).send('Communications not enabled for this tenant.');
        // Fetch customer phone
        const phoneRes = await pool.query(
            `SELECT c.phone 
             FROM estimates e
             JOIN opportunities o ON e.opportunity_id = o.id
             JOIN customers c ON o.customer_id = c.id
             WHERE e.id = $1 AND c.tenant_id = $2`,
            [estimateId, req.tenantId]
        );
        if (phoneRes.rowCount === 0 || !phoneRes.rows[0].phone) return res.status(404).send('Customer phone not found or invalid.');
        const phone = phoneRes.rows[0].phone;
        // Generate short-lived customer token for portal link
        const customerToken = jwt.sign({ estimate_id: estimateId, type: 'customer_view' }, secretKey, { expiresIn: '24h' });
        const portalLink = `https://crm.movethatstuff.com/portal/estimates/${estimateId}?token=${customerToken}`;
        // Use provided content or default
        const message = content || `Your MoveThatStuff estimate is ready: ${portalLink}. Reply STOP to opt-out.`;
        // Send SMS
        await twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phone
        });
        // Log to messages table
        await pool.query(
            'INSERT INTO messages (estimate_id, sender_type, channel, content, tenant_id) VALUES ($1, $2, $3, $4, $5)',
            [estimateId, 'agent', 'sms', message, req.tenantId]
        );
        res.json({ message: 'SMS sent successfully' });
    } catch (err) {
        res.status(500).send(`Error sending SMS: ${err.message}`);
    }
});

// Twilio Webhook for Inbound SMS
router.post('/twilio/webhook', (req, res) => {
    const { From: fromPhone, Body: content } = req.body;
    if (!fromPhone || !content) return res.status(400).send('Invalid webhook payload');
    // Basic validation (add full Twilio signature validation later for production)
    // For now, assume valid; respond with empty TwiML
    res.type('text/xml').send('<Response/>');
    // Find matching customer/estimate (latest estimate for phone)
    pool.query(
        `SELECT e.id AS estimate_id, c.tenant_id
         FROM customers c
         JOIN opportunities o ON c.id = o.customer_id
         JOIN estimates e ON o.id = e.opportunity_id
         WHERE c.phone = $1
         ORDER BY e.created_at DESC LIMIT 1`,
        [fromPhone],
        (err, result) => {
            if (err || result.rowCount === 0) {
                console.error(`Error finding estimate for inbound SMS from ${fromPhone}: ${err ? err.message : 'No match'}`);
                return; // Log but don't fail webhook
            }
            const { estimate_id, tenant_id } = result.rows[0];
            // Log to messages table
            pool.query(
                'INSERT INTO messages (estimate_id, sender_type, channel, content, tenant_id) VALUES ($1, $2, $3, $4, $5)',
                [estimate_id, 'customer', 'sms', content, tenant_id],
                (insertErr) => {
                    if (insertErr) console.error(`Error logging inbound SMS: ${insertErr.message}`);
                }
            );
        }
    );
});

// Notifications Endpoint
router.get('/notifications', authenticateToken, requirePermission('view_messages'), (req, res) => {
    pool.query(
        `SELECT 
            m.estimate_id,
            COUNT(*) AS unread_count,
            MAX(m.timestamp) AS latest_timestamp,
            (SELECT content FROM messages WHERE id = (SELECT MAX(id) FROM messages WHERE estimate_id = m.estimate_id AND is_read = FALSE)) AS latest_content
         FROM messages m
         WHERE m.tenant_id = $1 AND m.is_read = FALSE AND m.sender_type = 'customer'  -- Only customer messages for notifications
         GROUP BY m.estimate_id
         ORDER BY latest_timestamp DESC`,
        [req.tenantId],
        (err, result) => {
            if (err) return res.status(500).send(`Error fetching notifications: ${err.message}`);
            const notifications = result.rows.map(row => {
                if (row.latest_timestamp) {
                    row.latest_timestamp = moment.utc(row.latest_timestamp).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
                }
                row.unread_count = parseInt(row.unread_count, 10);
                row.latest_content = row.latest_content ? row.latest_content.substring(0, 50) + '...' : '';  // Truncate summary
                return row;
            });
            res.json(notifications);
        }
    );
});

module.exports = router;