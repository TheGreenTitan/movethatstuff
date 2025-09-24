///var/www/movethatstuff/backend/routes/tenantRoutes.js//
const express = require('express');
const Joi = require('joi');
const { authenticateToken, requirePermission, pool, validate } = require('../middleware');
const logger = require('../logger');  // Import logger for error handling

const router = express.Router();

const tenantSchema = Joi.object({
    name: Joi.string().min(1).max(255).required(),
    timezone: Joi.string().max(50).required(),
    google_maps_api_key: Joi.string().max(255).optional(),
    phone_number: Joi.string().regex(/^\+?[\d\s-]{7,15}$/).optional(),
    email: Joi.string().email().optional(),
    address: Joi.string().max(500).optional(),
    primary_color: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/).optional(),
    secondary_color: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/).optional(),
    lat: Joi.number().precision(6).optional(),
    lng: Joi.number().precision(6).optional()
});

const partialTenantSchema = Joi.object({
    name: Joi.string().min(1).max(255),
    timezone: Joi.string().max(50),
    google_maps_api_key: Joi.string().max(255),
    phone_number: Joi.string().regex(/^\+?[\d\s-]{7,15}$/),
    email: Joi.string().email(),
    address: Joi.string().max(500),
    primary_color: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/),
    secondary_color: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/),
    lat: Joi.number().precision(6),
    lng: Joi.number().precision(6)
}).min(1);

router.get('/', authenticateToken, requirePermission('manage_tenants'), (req, res) => {
    pool.query('SELECT * FROM tenants', (err, result) => {
        if (err) {
            logger.error(`Error fetching tenants: ${err.message} - Stack: ${err.stack}`);
            return res.status(500).send(`Error fetching tenants: ${err.message}`);
        }
        res.json(result.rows);
    });
});

router.get('/my', authenticateToken, (req, res) => {
    pool.query('SELECT * FROM tenants WHERE id = $1', [req.tenantId], (err, result) => {
        if (err) {
            logger.error(`Error fetching current tenant: ${err.message} - Stack: ${err.stack}`);
            return res.status(500).send(`Error fetching current tenant: ${err.message}`);
        }
        if (result.rowCount === 0) return res.status(404).send('Tenant not found');
        res.json(result.rows[0]);
    });
});

router.get('/:id', authenticateToken, requirePermission('view_settings'), (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid tenant ID');
    pool.query(
        'SELECT * FROM tenants WHERE id = $1',
        [id],
        (err, result) => {
            if (err) {
                logger.error(`Error fetching tenant: ${err.message} - Stack: ${err.stack}`);
                return res.status(500).send(`Error fetching tenant: ${err.message}`);
            }
            if (result.rowCount === 0) return res.status(404).send('Tenant not found');
            res.json(result.rows[0]);
        }
    );
});

router.post('/', authenticateToken, requirePermission('manage_tenants'), validate(tenantSchema), (req, res) => {
    const { name, timezone, google_maps_api_key, phone_number, email, address, primary_color, secondary_color, lat, lng } = req.body;
    pool.query(
        'INSERT INTO tenants (name, timezone, google_maps_api_key, phone_number, email, address, primary_color, secondary_color, lat, lng) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
        [name, timezone, google_maps_api_key, phone_number, email, address, primary_color, secondary_color, lat, lng],
        (err, result) => {
            if (err) {
                logger.error(`Error creating tenant: ${err.message} - Stack: ${err.stack}`);
                return res.status(500).send(`Error creating tenant: ${err.message}`);
            }
            res.status(201).json(result.rows[0]);
        }
    );
});

router.put('/:id', authenticateToken, requirePermission('manage_tenants'), validate(partialTenantSchema), (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid tenant ID');
    const { name, timezone, google_maps_api_key, phone_number, email, address, primary_color, secondary_color, lat, lng } = req.body;
    pool.query(
        'UPDATE tenants SET name = COALESCE($1, name), timezone = COALESCE($2, timezone), google_maps_api_key = COALESCE($3, google_maps_api_key), phone_number = COALESCE($4, phone_number), email = COALESCE($5, email), address = COALESCE($6, address), primary_color = COALESCE($7, primary_color), secondary_color = COALESCE($8, secondary_color), lat = COALESCE($9, lat), lng = COALESCE($10, lng) WHERE id = $11 RETURNING *',
        [name, timezone, google_maps_api_key, phone_number, email, address, primary_color, secondary_color, lat, lng, id],
        (err, result) => {
            if (err) {
                logger.error(`Error updating tenant: ${err.message} - Stack: ${err.stack}`);
                return res.status(500).send(`Error updating tenant: ${err.message}`);
            }
            if (result.rowCount === 0) return res.status(404).send('Tenant not found');
            res.json(result.rows[0]);
        }
    );
});

router.delete('/:id', authenticateToken, requirePermission('manage_tenants'), (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid tenant ID');
    pool.query(
        'DELETE FROM tenants WHERE id = $1 RETURNING *',
        [id],
        (err, result) => {
            if (err) {
                logger.error(`Error deleting tenant: ${err.message} - Stack: ${err.stack}`);
                return res.status(500).send(`Error deleting tenant: ${err.message}`);
            }
            if (result.rowCount === 0) return res.status(404).send('Tenant not found');
            res.status(200).json({ message: 'Tenant deleted', data: result.rows[0] });
        }
    );
});

module.exports = router;