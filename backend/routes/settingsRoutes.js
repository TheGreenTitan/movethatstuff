const express = require('express');
const Joi = require('joi');
const moment = require('moment-timezone');
const { authenticateToken, requirePermission, pool, validate } = require('../middleware');
const logger = require('../logger');  // Import logger for error handling

const router = express.Router();

const moverTeamSchema = Joi.object({
    number_of_movers: Joi.number().integer().min(1).required(),
    lbs_per_hour: Joi.number().precision(2).positive().required(),
    price_per_hour: Joi.number().precision(2).positive().required()
});

const partialMoverTeamSchema = Joi.object({
    number_of_movers: Joi.number().integer().min(1),
    lbs_per_hour: Joi.number().precision(2).positive(),
    price_per_hour: Joi.number().precision(2).positive()
}).min(1);

const truckSchema = Joi.object({
    unit_number: Joi.string().max(50).required(),
    length_ft: Joi.number().integer().positive().required(),
    volume_cf: Joi.number().precision(2).positive().required(),
    mpg: Joi.number().precision(2).positive().required(),
    has_lift_gate: Joi.boolean().optional(),
    has_ramp: Joi.boolean().optional()
});

const partialTruckSchema = Joi.object({
    unit_number: Joi.string().max(50),
    length_ft: Joi.number().integer().positive(),
    volume_cf: Joi.number().precision(2).positive(),
    mpg: Joi.number().precision(2).positive(),
    has_lift_gate: Joi.boolean(),
    has_ramp: Joi.boolean()
}).min(1);

const fuelPriceTierSchema = Joi.object({
    miles_min: Joi.number().precision(2).positive().required(),
    miles_max: Joi.number().precision(2).optional(),
    price_per_gallon: Joi.number().precision(2).positive().required()
});

const partialFuelPriceTierSchema = Joi.object({
    miles_min: Joi.number().precision(2).positive(),
    miles_max: Joi.number().precision(2),
    price_per_gallon: Joi.number().precision(2).positive()
}).min(1);

const additionalServicesSchema = Joi.object({
    name: Joi.string().max(255).required(),
    price: Joi.number().precision(2).positive().required(),
    movers_required: Joi.number().integer().min(0).optional()
});

const partialAdditionalServicesSchema = Joi.object({
    name: Joi.string().max(255),
    price: Joi.number().precision(2).positive(),
    movers_required: Joi.number().integer().min(0)
}).min(1);

router.get('/mover-teams', authenticateToken, requirePermission('view_settings'), (req, res) => {
    pool.query('SELECT id, number_of_movers, lbs_per_hour, price_per_hour, created_at, updated_at FROM mover_teams WHERE tenant_id = $1', [req.tenantId], (err, result) => {
        if (err) {
            logger.error(`Error fetching mover teams: ${err.message} - Stack: ${err.stack}`);
            return res.status(500).send(`Error fetching mover teams: ${err.message}`);
        }
        const rows = result.rows.map(row => {
            if (row.created_at) {
                row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            if (row.updated_at) {
                row.updated_at = moment.utc(row.updated_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            return row;
        });
        res.json(rows);
    });
});

router.post('/mover-teams', authenticateToken, requirePermission('edit_settings'), validate(moverTeamSchema), (req, res) => {
    const { number_of_movers, lbs_per_hour, price_per_hour } = req.body;
    pool.query(
        'INSERT INTO mover_teams (tenant_id, number_of_movers, lbs_per_hour, price_per_hour) VALUES ($1, $2, $3, $4) RETURNING *',
        [req.tenantId, number_of_movers, lbs_per_hour, price_per_hour],
        (err, result) => {
            if (err) {
                logger.error(`Error creating mover team: ${err.message} - Stack: ${err.stack}`);
                return res.status(500).send(`Error creating mover team: ${err.message}`);
            }
            const row = result.rows[0];
            if (row.created_at) {
                row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            if (row.updated_at) {
                row.updated_at = moment.utc(row.updated_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            res.status(201).json(row);
        }
    );
});

router.put('/mover-teams/:id', authenticateToken, requirePermission('edit_settings'), validate(partialMoverTeamSchema), (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid mover team ID');
    const { number_of_movers, lbs_per_hour, price_per_hour } = req.body;
    pool.query(
        'UPDATE mover_teams SET number_of_movers = COALESCE($1, number_of_movers), lbs_per_hour = COALESCE($2, lbs_per_hour), price_per_hour = COALESCE($3, price_per_hour), updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND tenant_id = $5 RETURNING *',
        [number_of_movers, lbs_per_hour, price_per_hour, id, req.tenantId],
        (err, result) => {
            if (err) {
                logger.error(`Error updating mover team: ${err.message} - Stack: ${err.stack}`);
                return res.status(500).send(`Error updating mover team: ${err.message}`);
            }
            if (result.rowCount === 0) return res.status(404).send('Mover team not found');
            const row = result.rows[0];
            if (row.created_at) {
                row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            if (row.updated_at) {
                row.updated_at = moment.utc(row.updated_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            res.json(row);
        }
    );
});

router.delete('/mover-teams/:id', authenticateToken, requirePermission('edit_settings'), (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid mover team ID');
    pool.query(
        'DELETE FROM mover_teams WHERE id = $1 AND tenant_id = $2 RETURNING *',
        [id, req.tenantId],
        (err, result) => {
            if (err) {
                logger.error(`Error deleting mover team: ${err.message} - Stack: ${err.stack}`);
                return res.status(500).send(`Error deleting mover team: ${err.message}`);
            }
            if (result.rowCount === 0) return res.status(404).send('Mover team not found');
            const row = result.rows[0];
            if (row.created_at) {
                row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            if (row.updated_at) {
                row.updated_at = moment.utc(row.updated_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            res.status(200).json({ message: 'Mover team deleted', data: row });
        }
    );
});

// Trucks Endpoints
router.get('/trucks', authenticateToken, requirePermission('view_settings'), (req, res) => {
    pool.query('SELECT id, unit_number, length_ft, volume_cf, mpg, has_lift_gate, has_ramp, created_at, updated_at FROM trucks WHERE tenant_id = $1', [req.tenantId], (err, result) => {
        if (err) {
            logger.error(`Error fetching trucks: ${err.message} - Stack: ${err.stack}`);
            return res.status(500).send(`Error fetching trucks: ${err.message}`);
        }
        const rows = result.rows.map(row => {
            if (row.created_at) {
                row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            if (row.updated_at) {
                row.updated_at = moment.utc(row.updated_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            return row;
        });
        res.json(rows);
    });
});

router.post('/trucks', authenticateToken, requirePermission('edit_settings'), validate(truckSchema), (req, res) => {
    const { unit_number, length_ft, volume_cf, mpg, has_lift_gate, has_ramp } = req.body;
    pool.query(
        'INSERT INTO trucks (tenant_id, unit_number, length_ft, volume_cf, mpg, has_lift_gate, has_ramp) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [req.tenantId, unit_number, length_ft, volume_cf, mpg, has_lift_gate || false, has_ramp || false],
        (err, result) => {
            if (err) {
                logger.error(`Error creating truck: ${err.message} - Stack: ${err.stack}`);
                return res.status(500).send(`Error creating truck: ${err.message}`);
            }
            const row = result.rows[0];
            if (row.created_at) {
                row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            if (row.updated_at) {
                row.updated_at = moment.utc(row.updated_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            res.status(201).json(row);
        }
    );
});

router.put('/trucks/:id', authenticateToken, requirePermission('edit_settings'), validate(partialTruckSchema), (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid truck ID');
    const { unit_number, length_ft, volume_cf, mpg, has_lift_gate, has_ramp } = req.body;
    pool.query(
        'UPDATE trucks SET unit_number = COALESCE($1, unit_number), length_ft = COALESCE($2, length_ft), volume_cf = COALESCE($3, volume_cf), mpg = COALESCE($4, mpg), has_lift_gate = COALESCE($5, has_lift_gate), has_ramp = COALESCE($6, has_ramp), updated_at = CURRENT_TIMESTAMP WHERE id = $7 AND tenant_id = $8 RETURNING *',
        [unit_number, length_ft, volume_cf, mpg, has_lift_gate, has_ramp, id, req.tenantId],
        (err, result) => {
            if (err) {
                logger.error(`Error updating truck: ${err.message} - Stack: ${err.stack}`);
                return res.status(500).send(`Error updating truck: ${err.message}`);
            }
            if (result.rowCount === 0) return res.status(404).send('Truck not found');
            const row = result.rows[0];
            if (row.created_at) {
                row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            if (row.updated_at) {
                row.updated_at = moment.utc(row.updated_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            res.json(row);
        }
    );
});

router.delete('/trucks/:id', authenticateToken, requirePermission('edit_settings'), (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid truck ID');
    pool.query(
        'DELETE FROM trucks WHERE id = $1 AND tenant_id = $2 RETURNING *',
        [id, req.tenantId],
        (err, result) => {
            if (err) {
                logger.error(`Error deleting truck: ${err.message} - Stack: ${err.stack}`);
                return res.status(500).send(`Error deleting truck: ${err.message}`);
            }
            if (result.rowCount === 0) return res.status(404).send('Truck not found');
            const row = result.rows[0];
            if (row.created_at) {
                row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            if (row.updated_at) {
                row.updated_at = moment.utc(row.updated_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            res.status(200).json({ message: 'Truck deleted', data: row });
        }
    );
});

// Fuel Price Tiers Endpoints
router.get('/fuel-price-tiers', authenticateToken, requirePermission('view_settings'), (req, res) => {
    pool.query('SELECT id, miles_min, miles_max, price_per_gallon, created_at, updated_at FROM fuel_price_tiers WHERE tenant_id = $1', [req.tenantId], (err, result) => {
        if (err) {
            logger.error(`Error fetching fuel price tiers: ${err.message} - Stack: ${err.stack}`);
            return res.status(500).send(`Error fetching fuel price tiers: ${err.message}`);
        }
        const rows = result.rows.map(row => {
            if (row.created_at) {
                row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            if (row.updated_at) {
                row.updated_at = moment.utc(row.updated_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            return row;
        });
        res.json(rows);
    });
});

router.post('/fuel-price-tiers', authenticateToken, requirePermission('edit_settings'), validate(fuelPriceTierSchema), (req, res) => {
    const { miles_min, miles_max, price_per_gallon } = req.body;
    pool.query(
        'INSERT INTO fuel_price_tiers (tenant_id, miles_min, miles_max, price_per_gallon) VALUES ($1, $2, $3, $4) RETURNING *',
        [req.tenantId, miles_min, miles_max, price_per_gallon],
        (err, result) => {
            if (err) {
                logger.error(`Error creating fuel price tier: ${err.message} - Stack: ${err.stack}`);
                return res.status(500).send(`Error creating fuel price tier: ${err.message}`);
            }
            const row = result.rows[0];
            if (row.created_at) {
                row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            if (row.updated_at) {
                row.updated_at = moment.utc(row.updated_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            res.status(201).json(row);
        }
    );
});

router.put('/fuel-price-tiers/:id', authenticateToken, requirePermission('edit_settings'), validate(partialFuelPriceTierSchema), (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid fuel price tier ID');
    const { miles_min, miles_max, price_per_gallon } = req.body;
    pool.query(
        'UPDATE fuel_price_tiers SET miles_min = COALESCE($1, miles_min), miles_max = COALESCE($2, miles_max), price_per_gallon = COALESCE($3, price_per_gallon), updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND tenant_id = $5 RETURNING *',
        [miles_min, miles_max, price_per_gallon, id, req.tenantId],
        (err, result) => {
            if (err) {
                logger.error(`Error updating fuel price tier: ${err.message} - Stack: ${err.stack}`);
                return res.status(500).send(`Error updating fuel price tier: ${err.message}`);
            }
            if (result.rowCount === 0) return res.status(404).send('Fuel price tier not found');
            const row = result.rows[0];
            if (row.created_at) {
                row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            if (row.updated_at) {
                row.updated_at = moment.utc(row.updated_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            res.json(row);
        }
    );
});

router.delete('/fuel-price-tiers/:id', authenticateToken, requirePermission('edit_settings'), (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid fuel price tier ID');
    pool.query(
        'DELETE FROM fuel_price_tiers WHERE id = $1 AND tenant_id = $2 RETURNING *',
        [id, req.tenantId],
        (err, result) => {
            if (err) {
                logger.error(`Error deleting fuel price tier: ${err.message} - Stack: ${err.stack}`);
                return res.status(500).send(`Error deleting fuel price tier: ${err.message}`);
            }
            if (result.rowCount === 0) return res.status(404).send('Fuel price tier not found');
            const row = result.rows[0];
            if (row.created_at) {
                row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            if (row.updated_at) {
                row.updated_at = moment.utc(row.updated_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            res.status(200).json({ message: 'Fuel price tier deleted', data: row });
        }
    );
});

// Additional Services Endpoints
router.get('/additional-services', authenticateToken, requirePermission('view_settings'), (req, res) => {
    pool.query('SELECT id, name, price, movers_required, created_at, updated_at FROM additional_services WHERE tenant_id = $1', [req.tenantId], (err, result) => {
        if (err) {
            logger.error(`Error fetching additional services: ${err.message} - Stack: ${err.stack}`);
            return res.status(500).send(`Error fetching additional services: ${err.message}`);
        }
        const rows = result.rows.map(row => {
            if (row.created_at) {
                row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            if (row.updated_at) {
                row.updated_at = moment.utc(row.updated_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            return row;
        });
        res.json(rows);
    });
});

router.post('/additional-services', authenticateToken, requirePermission('edit_settings'), validate(additionalServicesSchema), (req, res) => {
    const { name, price, movers_required } = req.body;
    pool.query(
        'INSERT INTO additional_services (tenant_id, name, price, movers_required) VALUES ($1, $2, $3, $4) RETURNING *',
        [req.tenantId, name, price, movers_required || 0],
        (err, result) => {
            if (err) {
                logger.error(`Error creating additional service: ${err.message} - Stack: ${err.stack}`);
                return res.status(500).send(`Error creating additional service: ${err.message}`);
            }
            const row = result.rows[0];
            if (row.created_at) {
                row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            if (row.updated_at) {
                row.updated_at = moment.utc(row.updated_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            res.status(201).json(row);
        }
    );
});

router.put('/additional-services/:id', authenticateToken, requirePermission('edit_settings'), validate(partialAdditionalServicesSchema), (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid additional service ID');
    const { name, price, movers_required } = req.body;
    pool.query(
        'UPDATE additional_services SET name = COALESCE($1, name), price = COALESCE($2, price), movers_required = COALESCE($3, movers_required), updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND tenant_id = $5 RETURNING *',
        [name, price, movers_required, id, req.tenantId],
        (err, result) => {
            if (err) {
                logger.error(`Error updating additional service: ${err.message} - Stack: ${err.stack}`);
                return res.status(500).send(`Error updating additional service: ${err.message}`);
            }
            if (result.rowCount === 0) return res.status(404).send('Additional service not found');
            const row = result.rows[0];
            if (row.created_at) {
                row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            if (row.updated_at) {
                row.updated_at = moment.utc(row.updated_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            res.json(row);
        }
    );
});

router.delete('/additional-services/:id', authenticateToken, requirePermission('edit_settings'), (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid additional service ID');
    pool.query(
        'DELETE FROM additional_services WHERE id = $1 AND tenant_id = $2 RETURNING *',
        [id, req.tenantId],
        (err, result) => {
            if (err) {
                logger.error(`Error deleting additional service: ${err.message} - Stack: ${err.stack}`);
                return res.status(500).send(`Error deleting additional service: ${err.message}`);
            }
            if (result.rowCount === 0) return res.status(404).send('Additional service not found');
            const row = result.rows[0];
            if (row.created_at) {
                row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            if (row.updated_at) {
                row.updated_at = moment.utc(row.updated_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            res.status(200).json({ message: 'Additional service deleted', data: row });
        }
    );
});

module.exports = router;