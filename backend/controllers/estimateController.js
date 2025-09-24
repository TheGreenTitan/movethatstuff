// /var/www/movethatstuff/backend/controllers/estimateController.js
const Joi = require('joi');
const moment = require('moment-timezone');
const { pool, validate } = require('../middleware');
const logger = require('../logger');
const { geocodeAddress, resequenceStops, calculateEstimate } = require('../services/estimateService');

const estimateSchema = Joi.object({
    customer_id: Joi.number().integer().required(),
    move_type: Joi.string().valid('house', 'apartment', 'commercial', 'storage').required(),
    move_service: Joi.string().valid('moving', 'packing', 'moving and packing', 'junk removal', 'labor only').required(),
    move_date: Joi.date().iso().optional(),
    move_time: Joi.string().optional(),
    notes: Joi.string().optional(),
    status: Joi.string().valid('new lead', 'estimate', 'booked', 'closed', 'cancelled', 'lost').optional(),
    method: Joi.string().valid('inventory', 'size', 'hourly').optional(),
    total_weight: Joi.number().precision(2).optional(),
    total_volume: Joi.number().precision(2).optional(),
    estimated_hours: Joi.number().precision(2).optional(),
    labor_cost: Joi.number().precision(2).optional(),
    truck_cost: Joi.number().precision(2).optional(),
    fuel_cost: Joi.number().precision(2).optional(),
    additional_services_cost: Joi.number().precision(2).optional(),
    total_cost: Joi.number().precision(2).optional(),
    number_of_movers: Joi.number().integer().optional(),
    number_of_trucks: Joi.number().integer().optional(),
    distance_miles: Joi.number().precision(2).optional(),
    depot_travel_time: Joi.number().precision(2).optional(),
    move_travel_time: Joi.number().precision(2).optional(),
    total_move_time: Joi.number().precision(2).optional()
});

const partialEstimateSchema = Joi.object({
    customer_id: Joi.number().integer(),
    move_type: Joi.string().valid('house', 'apartment', 'commercial', 'storage'),
    move_service: Joi.string().valid('moving', 'packing', 'moving and packing', 'junk removal', 'labor only'),
    move_date: Joi.date().iso(),
    move_time: Joi.string(),
    notes: Joi.string(),
    status: Joi.string().valid('new lead', 'estimate', 'booked', 'closed', 'cancelled', 'lost'),
    method: Joi.string().valid('inventory', 'size', 'hourly'),
    total_weight: Joi.number().precision(2),
    total_volume: Joi.number().precision(2),
    estimated_hours: Joi.number().precision(2),
    labor_cost: Joi.number().precision(2),
    truck_cost: Joi.number().precision(2),
    fuel_cost: Joi.number().precision(2),
    additional_services_cost: Joi.number().precision(2),
    total_cost: Joi.number().precision(2),
    number_of_movers: Joi.number().integer(),
    number_of_trucks: Joi.number().integer(),
    distance_miles: Joi.number().precision(2),
    depot_travel_time: Joi.number().precision(2),
    move_travel_time: Joi.number().precision(2),
    total_move_time: Joi.number().precision(2)
}).min(1);

const stopSchema = Joi.object({
    address: Joi.string().optional().allow(''),
    city: Joi.string().optional().allow(''),
    state: Joi.string().optional().allow(''),
    zip: Joi.string().required(),
    floor: Joi.number().integer().optional(),
    elevator: Joi.boolean().optional(),
    stairs: Joi.boolean().optional(),
    long_walk: Joi.boolean().optional()
});

const reorderSchema = Joi.object({
    order: Joi.array().items(Joi.number().integer().required()).required()
});

const lineItemSchema = Joi.object({
    item_type: Joi.string().required(),
    description: Joi.string().optional(),
    quantity: Joi.number().precision(2).required(),
    unit_price: Joi.number().precision(2).required(),
    total_cost: Joi.number().precision(2).required()
});

async function getAllEstimates(req, res) {
    pool.query(
        `SELECT e.*, c.name AS customer_name 
         FROM estimates e 
         LEFT JOIN customers c ON e.customer_id = c.id 
         WHERE e.tenant_id = $1`,
        [req.tenantId],
        (err, result) => {
            if (err) {
                logger.error(`Error fetching estimates: ${err.message} - Stack: ${err.stack}`);
                return res.status(500).send(`Error fetching estimates: ${err.message}`);
            }
            const rows = result.rows.map(row => {
                if (row.move_date) {
                    row.move_date = moment.utc(row.move_date).tz(req.tenantTimezone).format('YYYY-MM-DD');
                }
                if (row.created_at) {
                    row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
                }
                return row;
            });
            res.json(rows);
        }
    );
}

async function getEstimateById(req, res) {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid estimate ID');
    pool.query(
        `SELECT e.*, c.name AS customer_name, c.email AS email, c.phone AS phone, s.name AS source,
                (SELECT json_agg(row_to_json(es)) FROM (SELECT * FROM estimate_stops es WHERE es.estimate_id = e.id ORDER BY es.sequence) es) AS stops,
                (SELECT json_agg(row_to_json(eli)) FROM (SELECT * FROM estimate_line_items eli WHERE eli.estimate_id = e.id) eli) AS line_items
         FROM estimates e 
         LEFT JOIN customers c ON e.customer_id = c.id 
         LEFT JOIN sources s ON c.source_id = s.id
         WHERE e.id = $1 AND e.tenant_id = $2`,
        [id, req.tenantId],
        (err, result) => {
            if (err) {
                logger.error(`Error fetching estimate: ${err.message} - Stack: ${err.stack}`);
                return res.status(500).send(`Error fetching estimate: ${err.message}`);
            }
            if (result.rowCount === 0) return res.status(404).send('Estimate not found');
            const row = result.rows[0];
            if (row.move_date) {
                row.move_date = moment.utc(row.move_date).tz(req.tenantTimezone).format('YYYY-MM-DD');
            }
            if (row.created_at) {
                row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            res.json(row);
        }
    );
}

async function createEstimate(req, res) {
    const body = req.body;
    body.tenant_id = req.tenantId;
    const fields = Object.keys(body);
    const values = Object.values(body);
    const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
    const fieldNames = fields.join(', ');

    pool.query(
        `INSERT INTO estimates (${fieldNames}) VALUES (${placeholders}) RETURNING *`,
        values,
        (err, result) => {
            if (err) {
                logger.error(`Error creating estimate: ${err.message} - Stack: ${err.stack}`);
                return res.status(500).send(`Error creating estimate: ${err.message}`);
            }
            const row = result.rows[0];
            if (row.move_date) {
                row.move_date = moment.utc(row.move_date).tz(req.tenantTimezone).format('YYYY-MM-DD');
            }
            if (row.created_at) {
                row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            res.status(201).json(row);
        }
    );
}

async function updateEstimate(req, res) {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid estimate ID');
    const body = req.body;
    const updates = [];
    let paramIndex = 1;
    const values = [];

    Object.keys(body).forEach(key => {
        if (key === 'move_date' && body[key]) {
            updates.push(`${key} = $${paramIndex}`);
            values.push(moment.tz(body[key], req.tenantTimezone).utc().format('YYYY-MM-DD'));
            paramIndex++;
        } else {
            updates.push(`${key} = $${paramIndex}`);
            values.push(body[key]);
            paramIndex++;
        }
    });

    if (updates.length === 0) return res.status(400).send('No fields to update');

    const query = `UPDATE estimates SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`;
    values.push(id, req.tenantId);

    pool.query(query, values, (err, result) => {
        if (err) {
            logger.error(`Error updating estimate: ${err.message} - Stack: ${err.stack}`);
            return res.status(500).send(`Error updating estimate: ${err.message}`);
        }
        if (result.rowCount === 0) return res.status(404).send('Estimate not found');
        const row = result.rows[0];
        if (row.move_date) {
            row.move_date = moment.utc(row.move_date).tz(req.tenantTimezone).format('YYYY-MM-DD');
        }
        if (row.created_at) {
            row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
        }
        req.app.get('io').to(`estimate_${id}`).emit('update', { message: 'Estimate updated' });
        res.json(row);
    });
}

async function deleteEstimate(req, res) {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid estimate ID');
    pool.query(
        'DELETE FROM estimates WHERE id = $1 AND tenant_id = $2 RETURNING *',
        [id, req.tenantId],
        (err, result) => {
            if (err) {
                logger.error(`Error deleting estimate: ${err.message} - Stack: ${err.stack}`);
                return res.status(500).send(`Error deleting estimate: ${err.message}`);
            }
            if (result.rowCount === 0) return res.status(404).send('Estimate not found');
            res.status(200).json({ message: 'Estimate deleted', data: result.rows[0] });
        }
    );
}

async function calculate(req, res) {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid estimate ID');
    const full = req.query.full === 'true'; // ?full=true to recalc locations
    try {
        await calculateEstimate(id, req.tenantId, full);
        const result = await pool.query('SELECT * FROM estimates WHERE id = $1', [id]);
        const row = result.rows[0];
        if (row.move_date) {
            row.move_date = moment.utc(row.move_date).tz(req.tenantTimezone).format('YYYY-MM-DD');
        }
        if (row.created_at) {
            row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
        }
        req.app.get('io').to(`estimate_${id}`).emit('update', { message: 'Estimate updated' });
        res.json(row);
    } catch (err) {
        logger.error(`Error calculating estimate: ${err.message} - Stack: ${err.stack}`);
        res.status(500).send(`Error calculating estimate: ${err.message}`);
    }
}

async function reorderStops(req, res) {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid estimate ID');
    const { order } = req.body;

    try {
        await pool.query('BEGIN');
        for (let i = 0; i < order.length; i++) {
            await pool.query(
                'UPDATE estimate_stops SET sequence = $1 WHERE id = $2 AND estimate_id = $3',
                [i + 1, order[i], id]
            );
        }
        await resequenceStops(id);
        await pool.query('COMMIT');
        await calculateEstimate(id, req.tenantId, true); // Full recalc for reorder
        req.app.get('io').to(`estimate_${id}`).emit('update', { message: 'Estimate updated' });
        res.status(200).send('Stops reordered successfully');
    } catch (err) {
        await pool.query('ROLLBACK');
        logger.error(`Error reordering stops: ${err.message} - Stack: ${err.stack}`);
        res.status(500).send(`Error reordering stops: ${err.message}`);
    }
}

async function addStop(req, res) {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid estimate ID');
    const { address, city, state, zip, floor, elevator, stairs, long_walk } = req.body;

    try {
        const estimateRes = await pool.query('SELECT 1 FROM estimates WHERE id = $1 AND tenant_id = $2', [id, req.tenantId]);
        if (estimateRes.rowCount === 0) return res.status(404).send('Estimate not found');

        const destSeqRes = await pool.query('SELECT sequence FROM estimate_stops WHERE estimate_id = $1 AND type = \'destination\'', [id]);
        let destSeq = destSeqRes.rowCount > 0 ? destSeqRes.rows[0].sequence : 1;

        await pool.query('UPDATE estimate_stops SET sequence = sequence + 1 WHERE estimate_id = $1 AND sequence >= $2', [id, destSeq]);

        const fullAddress = `${address || ''}, ${city || ''}, ${state || ''} ${zip}`;
        const coords = await geocodeAddress(fullAddress, req.tenantId);
        const lat = coords ? coords.lat : null;
        const lng = coords ? coords.lng : null;

        const result = await pool.query(
            'INSERT INTO estimate_stops (estimate_id, type, sequence, address, city, state, zip, lat, lng, floor, elevator, stairs, long_walk) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *',
            [id, 'stop', destSeq, address, city, state, zip, lat, lng, floor, elevator, stairs, long_walk]
        );
        await resequenceStops(id);
        await calculateEstimate(id, req.tenantId, true); // Full recalc for new stop
        req.app.get('io').to(`estimate_${id}`).emit('update', { message: 'Estimate updated' });
        res.status(201).json(result.rows[0]);
    } catch (err) {
        logger.error(`Error adding stop: ${err.message} - Stack: ${err.stack}`);
        res.status(500).send(`Error adding stop: ${err.message}`);
    }
}

async function deleteStop(req, res) {
    const id = parseInt(req.params.id);
    const stopId = parseInt(req.params.stopId);
    if (isNaN(id) || isNaN(stopId)) return res.status(400).send('Invalid ID');
    try {
        await pool.query('BEGIN');
        const result = await pool.query('DELETE FROM estimate_stops WHERE id = $1 AND estimate_id = $2 RETURNING *', [stopId, id]);
        if (result.rowCount === 0) return res.status(404).send('Stop not found');
        await resequenceStops(id);
        await calculateEstimate(id, req.tenantId, true); // Full recalc for delete
        await pool.query('COMMIT');
        req.app.get('io').to(`estimate_${id}`).emit('update', { message: 'Estimate updated' });
        res.status(200).json({ message: 'Stop deleted' });
    } catch (err) {
        await pool.query('ROLLBACK');
        logger.error(`Error deleting stop: ${err.message} - Stack: ${err.stack}`);
        res.status(500).send(`Error deleting stop: ${err.message}`);
    }
}

async function updateStop(req, res) {
    const id = parseInt(req.params.id);
    const stopId = parseInt(req.params.stopId);
    if (isNaN(id) || isNaN(stopId)) return res.status(400).send('Invalid ID');
    const body = req.body;

    let lat, lng;
    if (body.zip) {
        const fullAddress = body.address && body.city && body.state ? `${body.address}, ${body.city}, ${body.state} ${body.zip}` : `${body.zip}, OK`;
        const geo = await geocodeAddress(fullAddress, req.tenantId);
        if (geo) {
            body.lat = geo.lat;
            body.lng = geo.lng;
        }
    }

    const updates = [];
    let paramIndex = 1;
    const values = [];

    Object.keys(body).forEach(key => {
        updates.push(`${key} = $${paramIndex}`);
        values.push(body[key]);
        paramIndex++;
    });

    if (updates.length === 0) return res.status(400).send('No fields to update');

    const query = `UPDATE estimate_stops SET ${updates.join(', ')} WHERE id = $${paramIndex} AND estimate_id = $${paramIndex + 1} RETURNING *`;
    values.push(stopId, id);

    pool.query(query, values, (err, result) => {
        if (err) {
            logger.error(`Error updating stop: ${err.message} - Stack: ${err.stack}`);
            return res.status(500).send(`Error updating stop: ${err.message}`);
        }
        if (result.rowCount === 0) return res.status(404).send('Stop not found');
        req.app.get('io').to(`estimate_${id}`).emit('update', { message: 'Estimate updated' });
        res.json(result.rows[0]);
    });
}

async function getLineItems(req, res) {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid estimate ID');
    try {
        const result = await pool.query('SELECT * FROM estimate_line_items WHERE estimate_id = $1', [id]);
        res.json(result.rows);
    } catch (err) {
        logger.error(`Error fetching line items: ${err.message} - Stack: ${err.stack}`);
        res.status(500).send(`Error fetching line items: ${err.message}`);
    }
}

async function addLineItem(req, res) {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid estimate ID');
    const { item_type, description, quantity, unit_price, total_cost } = req.body;
    try {
        const estimateRes = await pool.query('SELECT 1 FROM estimates WHERE id = $1 AND tenant_id = $2', [id, req.tenantId]);
        if (estimateRes.rowCount === 0) return res.status(404).send('Estimate not found');
        const result = await pool.query(
            'INSERT INTO estimate_line_items (estimate_id, item_type, description, quantity, unit_price, total_cost) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [id, item_type, description, quantity, unit_price, total_cost]
        );
        const sumRes = await pool.query('SELECT SUM(total_cost) AS total FROM estimate_line_items WHERE estimate_id = $1', [id]);
        const newTotal = parseFloat(sumRes.rows[0].total || 0);
        await pool.query('UPDATE estimates SET total_cost = $1 WHERE id = $2', [newTotal, id]);
        req.app.get('io').to(`estimate_${id}`).emit('update', { message: 'Estimate updated' });
        res.status(201).json(result.rows[0]);
    } catch (err) {
        logger.error(`Error adding line item: ${err.message} - Stack: ${err.stack}`);
        res.status(500).send(`Error adding line item: ${err.message}`);
    }
}

async function updateLineItem(req, res) {
    const id = parseInt(req.params.id);
    const lineId = parseInt(req.params.lineId);
    if (isNaN(id) || isNaN(lineId)) return res.status(400).send('Invalid ID');
    const { item_type, description, quantity, unit_price, total_cost } = req.body;
    try {
        const result = await pool.query(
            'UPDATE estimate_line_items SET item_type = $1, description = $2, quantity = $3, unit_price = $4, total_cost = $5 WHERE id = $6 AND estimate_id = $7 RETURNING *',
            [item_type, description, quantity, unit_price, total_cost, lineId, id]
        );
        if (result.rowCount === 0) return res.status(404).send('Line item not found');
        const sumRes = await pool.query('SELECT SUM(total_cost) AS total FROM estimate_line_items WHERE estimate_id = $1', [id]);
        const newTotal = parseFloat(sumRes.rows[0].total || 0);
        await pool.query('UPDATE estimates SET total_cost = $1 WHERE id = $2', [newTotal, id]);
        req.app.get('io').to(`estimate_${id}`).emit('update', { message: 'Estimate updated' });
        res.json(result.rows[0]);
    } catch (err) {
        logger.error(`Error updating line item: ${err.message} - Stack: ${err.stack}`);
        res.status(500).send(`Error updating line item: ${err.message}`);
    }
}

async function deleteLineItem(req, res) {
    const id = parseInt(req.params.id);
    const lineId = parseInt(req.params.lineId);
    if (isNaN(id) || isNaN(lineId)) return res.status(400).send('Invalid ID');
    try {
        const result = await pool.query('DELETE FROM estimate_line_items WHERE id = $1 AND estimate_id = $2 RETURNING *', [lineId, id]);
        if (result.rowCount === 0) return res.status(404).send('Line item not found');
        const sumRes = await pool.query('SELECT SUM(total_cost) AS total FROM estimate_line_items WHERE estimate_id = $1', [id]);
        const newTotal = parseFloat(sumRes.rows[0].total || 0);
        await pool.query('UPDATE estimates SET total_cost = $1 WHERE id = $2', [newTotal, id]);
        req.app.get('io').to(`estimate_${id}`).emit('update', { message: 'Estimate updated' });
        res.status(200).json({ message: 'Line item deleted' });
    } catch (err) {
        logger.error(`Error deleting line item: ${err.message} - Stack: ${err.stack}`);
        res.status(500).send(`Error deleting line item: ${err.message}`);
    }
}

module.exports = {
    getAllEstimates,
    getEstimateById,
    createEstimate,
    updateEstimate,
    deleteEstimate,
    calculate,
    reorderStops,
    addStop,
    deleteStop,
    updateStop,
    getLineItems,
    addLineItem,
    updateLineItem,
    deleteLineItem
};