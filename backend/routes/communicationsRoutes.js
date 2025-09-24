///var/www/movethatstuff/backend/routes/communicationsRoutes.js//
const express = require('express');
const Joi = require('joi');
const moment = require('moment-timezone');
const jwt = require('jsonwebtoken');
const { authenticateToken, requirePermission, validate, pool, secretKey, transporter, twilioClient } = require('../middleware');
const logger = require('../logger');  // Import logger for error handling

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
        logger.error(`Error sending SMS: ${err.message} - Stack: ${err.stack}`);
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
                logger.error(`Error finding estimate for inbound SMS from ${fromPhone}: ${err ? err.message : 'No match'} - Stack: ${err ? err.stack : ''}`);
                return; // Log but don't fail webhook
            }
            const { estimate_id, tenant_id } = result.rows[0];
            // Log to messages table
            pool.query(
                'INSERT INTO messages (estimate_id, sender_type, channel, content, tenant_id) VALUES ($1, $2, $3, $4, $5)',
                [estimate_id, 'customer', 'sms', content, tenant_id],
                (insertErr) => {
                    if (insertErr) logger.error(`Error logging inbound SMS: ${insertErr.message} - Stack: ${insertErr.stack}`);
                }
            );
        }
    );
});

// Mandrill Webhook Verification (HEAD for existence check)
router.head('/mandrill/webhook', (req, res) => {
    res.status(200).send('Webhook endpoint available');
});

// Mandrill Webhook for Email Events (e.g., opens)
router.post('/mandrill/webhook', (req, res) => {
    let events = [];
    try {
        const eventsStr = req.body.mandrill_events;
        if (eventsStr) {
            events = JSON.parse(eventsStr);
            if (!Array.isArray(events)) {
                throw new Error('mandrill_events is not an array');
            }
        }
    } catch (parseErr) {
        logger.error(`Error parsing Mandrill events: ${parseErr.message} - Stack: ${parseErr.stack}`);
        return res.status(400).send('Invalid webhook payload');
    }
    // Respond immediately to acknowledge (Mandrill requires 200 OK)
    res.status(200).send('Webhook received');
    // Process events asynchronously
    events.forEach(event => {
        try {
            if (event.event === 'open') {
                const metadata = event.msg?.metadata || {};
                const internalMessageId = metadata.internal_message_id;
                if (internalMessageId) {
                    // Update messages table with read_at (convert Unix ts to timestamp)
                    const readAt = new Date(event.ts * 1000).toISOString();
                    pool.query(
                        'UPDATE messages SET read_at = $1, is_read = TRUE WHERE id = $2 AND read_at IS NULL',
                        [readAt, internalMessageId],
                        (err) => {
                            if (err) logger.error(`Error updating message read_at for ID ${internalMessageId}: ${err.message} - Stack: ${err.stack}`);
                        }
                    );
                }
            }
            // Can handle other events like 'click', 'bounce' etc. later
        } catch (err) {
            logger.error(`Error processing Mandrill event: ${err.message} - Stack: ${err.stack}`);
        }
    });
});

// Notifications Endpoint (extended to include read_at for emails/SMS)
router.get('/notifications', authenticateToken, requirePermission('view_messages'), (req, res) => {
    pool.query(
        `SELECT 
            m.estimate_id,
            COUNT(*) FILTER (WHERE m.is_read = FALSE AND m.sender_type = 'customer') AS unread_count,
            MAX(m.timestamp) AS latest_timestamp,
            (SELECT content FROM messages WHERE id = (SELECT MAX(id) FROM messages WHERE estimate_id = m.estimate_id AND is_read = FALSE AND sender_type = 'customer')) AS latest_content,
            (SELECT read_at FROM messages WHERE estimate_id = m.estimate_id AND channel = 'email' AND sender_type = 'agent' ORDER BY timestamp DESC LIMIT 1) AS email_read_at
         FROM messages m
         WHERE m.tenant_id = $1
         GROUP BY m.estimate_id
         ORDER BY latest_timestamp DESC`,
        [req.tenantId],
        (err, result) => {
            if (err) {
                logger.error(`Error fetching notifications: ${err.message} - Stack: ${err.stack}`);
                return res.status(500).send(`Error fetching notifications: ${err.message}`);
            }
            const notifications = result.rows.map(row => {
                if (row.latest_timestamp) {
                    row.latest_timestamp = moment.utc(row.latest_timestamp).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
                }
                if (row.email_read_at) {
                    row.email_read_at = moment.utc(row.email_read_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
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