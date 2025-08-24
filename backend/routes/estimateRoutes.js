const express = require('express');
const Joi = require('joi');
const moment = require('moment-timezone');
const { Client } = require('@googlemaps/google-maps-services-js');
const { authenticateToken, requirePermission, pool, validate } = require('../middleware');
const jwt = require('jsonwebtoken');
const { secretKey, transporter } = require('../middleware');

const router = express.Router();

const estimateSchema = Joi.object({
    opportunity_id: Joi.number().integer().positive().required(),
    move_date: Joi.date().iso().optional(),
    move_type: Joi.string().valid('house', 'apartment', 'commercial', 'storage').optional(),
    move_service: Joi.string().valid('moving', 'packing', 'moving and packing', 'storage', 'other').optional(),
    origin_address: Joi.string().max(255).optional(),
    destination_address: Joi.string().max(255).optional(),
    origin_stairs: Joi.boolean().optional(),
    dest_stairs: Joi.boolean().optional(),
    notes: Joi.string().optional(),
    estimated_cost: Joi.number().precision(2).optional(),
    method: Joi.string().valid('inventory', 'size', 'hourly').required()
});

const partialEstimateSchema = Joi.object({
    opportunity_id: Joi.number().integer().positive(),
    move_date: Joi.date().iso(),
    move_type: Joi.string().valid('house', 'apartment', 'commercial', 'storage'),
    move_service: Joi.string().valid('moving', 'packing', 'moving and packing', 'storage', 'other'),
    origin_address: Joi.string().max(255),
    destination_address: Joi.string().max(255),
    origin_stairs: Joi.boolean(),
    dest_stairs: Joi.boolean(),
    notes: Joi.string(),
    estimated_cost: Joi.number().precision(2),
    method: Joi.string().valid('inventory', 'size', 'hourly')
}).min(1);

const inventoryItemSchema = Joi.object({
    inventory_item_id: Joi.number().integer().positive().required(),
    quantity: Joi.number().integer().min(1).required()
});

const residenceSizeSchema = Joi.object({
    residence_size_id: Joi.number().integer().positive().required(),
    quantity: Joi.number().integer().min(1).required()
});

const additionalServiceSchema = Joi.object({
    additional_service_id: Joi.number().integer().positive().required(),
    quantity: Joi.number().integer().min(1).required()
});

const calculateSchema = Joi.object({
    estimated_hours: Joi.number().positive().optional(),
    distance_miles: Joi.number().positive().optional()
});

router.get('/', authenticateToken, requirePermission('view_estimates'), (req, res) => {
    pool.query(
        'SELECT * FROM estimates WHERE opportunity_id IN (SELECT id FROM opportunities WHERE customer_id IN (SELECT id FROM customers WHERE tenant_id = $1))',
        [req.tenantId],
        (err, result) => {
            if (err) return res.status(500).send(`Error fetching estimates: ${err.message}`);
            const rows = result.rows.map(row => {
                if (row.created_at) {
                    row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
                }
                if (row.move_date) {
                    row.move_date = moment.utc(row.move_date).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
                }
                return row;
            });
            res.json(rows);
        }
    );
});

router.post('/', authenticateToken, requirePermission('edit_estimates'), validate(estimateSchema), async (req, res) => {
    const { opportunity_id, move_date, move_type, move_service, origin_address, destination_address, origin_stairs, dest_stairs, notes, estimated_cost, method } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO estimates (opportunity_id, move_date, move_type, move_service, origin_address, destination_address, origin_stairs, dest_stairs, notes, estimated_cost, method) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
            [opportunity_id, move_date, move_type, move_service, origin_address, destination_address, origin_stairs, dest_stairs, notes, estimated_cost, method]
        );
        const estimate = result.rows[0];
        if (estimate.created_at) {
            estimate.created_at = moment.utc(estimate.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
        }
        if (estimate.move_date) {
            estimate.move_date = moment.utc(estimate.move_date).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
        }
        // Check tenant communications enabled and send email
        const tenantRes = await pool.query('SELECT enable_communications FROM tenants WHERE id = $1', [req.tenantId]);
        if (tenantRes.rows[0].enable_communications) {
            const customerRes = await pool.query(
                `SELECT c.email 
                 FROM estimates e
                 JOIN opportunities o ON e.opportunity_id = o.id
                 JOIN customers c ON o.customer_id = c.id
                 WHERE e.id = $1 AND c.tenant_id = $2`,
                [estimate.id, req.tenantId]
            );
            if (customerRes.rowCount > 0 && customerRes.rows[0].email) {
                const email = customerRes.rows[0].email;
                // Generate view link (short-lived token)
                const viewToken = jwt.sign({ estimate_id: estimate.id, type: 'customer_view' }, secretKey, { expiresIn: '24h' });
                const viewLink = `https://crm.movethatstuff.com/portal/estimates/${estimate.id}?token=${viewToken}`;
                await transporter.sendMail({
                    from: process.env.SENDER_EMAIL,
                    to: email,
                    subject: 'New Moving Estimate Created',
                    text: `A new estimate for your move on ${moment.utc(move_date || estimate.move_date).tz(req.tenantTimezone).format('YYYY-MM-DD')} has been created. View details: ${viewLink}`
                });
            }
        }
        res.status(201).json(estimate);
    } catch (err) {
        res.status(500).send(`Error creating estimate: ${err.message}`);
    }
});

router.put('/:id', authenticateToken, requirePermission('edit_estimates'), validate(partialEstimateSchema), (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid estimate ID');
    const { opportunity_id, move_date, move_type, move_service, origin_address, destination_address, origin_stairs, dest_stairs, notes, estimated_cost, method } = req.body;
    pool.query(
        'UPDATE estimates SET opportunity_id = COALESCE($1, opportunity_id), move_date = COALESCE($2, move_date), move_type = COALESCE($3, move_type), move_service = COALESCE($4, move_service), origin_address = COALESCE($5, origin_address), destination_address = COALESCE($6, destination_address), origin_stairs = COALESCE($7, origin_stairs), dest_stairs = COALESCE($8, dest_stairs), notes = COALESCE($9, notes), estimated_cost = COALESCE($10, estimated_cost), method = COALESCE($11, method) WHERE id = $12 RETURNING *',
        [opportunity_id, move_date, move_type, move_service, origin_address, destination_address, origin_stairs, dest_stairs, notes, estimated_cost, method, id],
        (err, result) => {
            if (err) return res.status(500).send(`Error updating estimate: ${err.message}`);
            if (result.rowCount === 0) return res.status(404).send('Estimate not found');
            const estimate = result.rows[0];
            if (estimate.created_at) {
                estimate.created_at = moment.utc(estimate.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            if (estimate.move_date) {
                estimate.move_date = moment.utc(estimate.move_date).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            res.json(estimate);
        }
    );
});

router.delete('/:id', authenticateToken, requirePermission('edit_estimates'), (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid estimate ID');
    pool.query(
        'DELETE FROM estimates WHERE id = $1 RETURNING *',
        [id],
        (err, result) => {
            if (err) return res.status(500).send(`Error deleting estimate: ${err.message}`);
            if (result.rowCount === 0) return res.status(404).send('Estimate not found');
            const estimate = result.rows[0];
            if (estimate.created_at) {
                estimate.created_at = moment.utc(estimate.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            if (estimate.move_date) {
                estimate.move_date = moment.utc(estimate.move_date).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            res.status(200).json({ message: 'Estimate deleted', data: estimate });
        }
    );
});

// Inventory Items Routes
router.get('/:id/inventory-items', authenticateToken, requirePermission('view_estimates'), (req, res) => {
    const estimateId = parseInt(req.params.id);
    if (isNaN(estimateId)) return res.status(400).send('Invalid estimate ID');
    pool.query(
        'SELECT * FROM estimate_inventory_items WHERE estimate_id = $1',
        [estimateId],
        (err, result) => {
            if (err) return res.status(500).send(`Error fetching inventory items: ${err.message}`);
            res.json(result.rows);
        }
    );
});

router.post('/:id/inventory-items', authenticateToken, requirePermission('edit_estimates'), validate(inventoryItemSchema), (req, res) => {
    const estimateId = parseInt(req.params.id);
    if (isNaN(estimateId)) return res.status(400).send('Invalid estimate ID');
    const { inventory_item_id, quantity } = req.body;
    pool.query(
        'INSERT INTO estimate_inventory_items (estimate_id, inventory_item_id, quantity) VALUES ($1, $2, $3) RETURNING *',
        [estimateId, inventory_item_id, quantity],
        (err, result) => {
            if (err) return res.status(500).send(`Error adding inventory item: ${err.message}`);
            res.status(201).json(result.rows[0]);
        }
    );
});

// Similar routes for DELETE and PUT for inventory items...

// Residence Sizes Routes
router.get('/:id/residence-sizes', authenticateToken, requirePermission('view_estimates'), (req, res) => {
    const estimateId = parseInt(req.params.id);
    if (isNaN(estimateId)) return res.status(400).send('Invalid estimate ID');
    pool.query(
        'SELECT * FROM estimate_residence_sizes WHERE estimate_id = $1',
        [estimateId],
        (err, result) => {
            if (err) return res.status(500).send(`Error fetching residence sizes: ${err.message}`);
            res.json(result.rows);
        }
    );
});

router.post('/:id/residence-sizes', authenticateToken, requirePermission('edit_estimates'), validate(residenceSizeSchema), (req, res) => {
    const estimateId = parseInt(req.params.id);
    if (isNaN(estimateId)) return res.status(400).send('Invalid estimate ID');
    const { residence_size_id, quantity } = req.body;
    pool.query(
        'INSERT INTO estimate_residence_sizes (estimate_id, residence_size_id, quantity) VALUES ($1, $2, $3) RETURNING *',
        [estimateId, residence_size_id, quantity],
        (err, result) => {
            if (err) return res.status(500).send(`Error adding residence size: ${err.message}`);
            res.status(201).json(result.rows[0]);
        }
    );
});

// Similar for DELETE and PUT...

// Additional Services Routes
router.get('/:id/additional-services', authenticateToken, requirePermission('view_estimates'), (req, res) => {
    const estimateId = parseInt(req.params.id);
    if (isNaN(estimateId)) return res.status(400).send('Invalid estimate ID');
    pool.query(
        'SELECT * FROM estimate_additional_services WHERE estimate_id = $1',
        [estimateId],
        (err, result) => {
            if (err) return res.status(500).send(`Error fetching additional services: ${err.message}`);
            res.json(result.rows);
        }
    );
});

router.post('/:id/additional-services', authenticateToken, requirePermission('edit_estimates'), validate(additionalServiceSchema), (req, res) => {
    const estimateId = parseInt(req.params.id);
    if (isNaN(estimateId)) return res.status(400).send('Invalid estimate ID');
    const { additional_service_id, quantity } = req.body;
    pool.query(
        'INSERT INTO estimate_additional_services (estimate_id, additional_service_id, quantity) VALUES ($1, $2, $3) RETURNING *',
        [estimateId, additional_service_id, quantity],
        (err, result) => {
            if (err) return res.status(500).send(`Error adding additional service: ${err.message}`);
            res.status(201).json(result.rows[0]);
        }
    );
});

// Similar for DELETE and PUT...

router.post('/:id/calculate', authenticateToken, requirePermission('edit_estimates'), validate(calculateSchema), async (req, res) => {
    const estimateId = parseInt(req.params.id);
    if (isNaN(estimateId)) return res.status(400).send('Invalid estimate ID');
    const { estimated_hours, distance_miles } = req.body;
    let estimatedHours = estimated_hours || 0;
    let distance = distance_miles || 0;
    let travelTime = 0;
    try {
        const estRes = await pool.query('SELECT * FROM estimates WHERE id = $1', [estimateId]);
        if (estRes.rowCount === 0) return res.status(404).send('Estimate not found');
        const estimate = estRes.rows[0];
        const method = estimate.method;
        let totalWeight = 0;
        let totalVolume = 0;
        let additionalServicesCost = 0;
        let numberOfMovers = 2; // Default
        let maxAdditionalMovers = 0;
        if (method === 'inventory') {
            const invRes = await pool.query(
                `SELECT eii.quantity, ii.weight_lbs, ii.volume_cf 
                 FROM estimate_inventory_items eii 
                 JOIN inventory_items ii ON eii.inventory_item_id = ii.id 
                 WHERE eii.estimate_id = $1`,
                [estimateId]
            );
            invRes.rows.forEach(item => {
                totalWeight += item.quantity * parseFloat(item.weight_lbs);
                totalVolume += item.quantity * parseFloat(item.volume_cf);
            });
        } else if (method === 'size') {
            const resRes = await pool.query(
                `SELECT ers.quantity, rs.weight_lbs, rs.volume_cf 
                 FROM estimate_residence_sizes ers 
                 JOIN residence_sizes rs ON ers.residence_size_id = rs.id 
                 WHERE ers.estimate_id = $1`,
                [estimateId]
            );
            resRes.rows.forEach(size => {
                totalWeight += size.quantity * parseFloat(size.weight_lbs);
                totalVolume += size.quantity * parseFloat(size.volume_cf);
            });
        }
        const addRes = await pool.query(
            `SELECT eas.quantity, ads.price_per_unit, ads.movers_required 
             FROM estimate_additional_services eas 
             JOIN additional_services ads ON eas.additional_service_id = ads.id 
             WHERE eas.estimate_id = $1`,
            [estimateId]
        );
        addRes.rows.forEach(service => {
            additionalServicesCost += service.quantity * parseFloat(service.price_per_unit);
            if (service.movers_required > maxAdditionalMovers) maxAdditionalMovers = service.movers_required;
        });
        const teamsRes = await pool.query('SELECT * FROM mover_teams WHERE tenant_id = $1 ORDER BY number_of_movers', [req.tenantId]);
        const teams = teamsRes.rows.map(t => ({
            ...t,
            number_of_movers: parseInt(t.number_of_movers, 10),
            lbs_per_hour: parseFloat(t.lbs_per_hour),
            price_per_hour: parseFloat(t.price_per_hour)
        }));
        const rulesRes = await pool.query('SELECT * FROM mover_assignment_rules WHERE tenant_id = $1 ORDER BY hours_min', [req.tenantId]);
        const rules = rulesRes.rows.map(r => ({
            ...r,
            hours_min: parseFloat(r.hours_min),
            hours_max: parseFloat(r.hours_max),
            number_of_movers: parseInt(r.number_of_movers, 10)
        }));
        if (method !== 'hourly') {
            estimatedHours = totalWeight / teams.find(t => t.number_of_movers === numberOfMovers).lbs_per_hour;
            estimatedHours = Math.ceil(estimatedHours * 4) / 4; // Round up to nearest 0.25
            let iterations = 0;
            while (iterations < 5) { // Prevent infinite loop
                const rule = rules.find(r => estimatedHours > r.hours_min && estimatedHours <= r.hours_max);
                if (!rule) break; // No matching rule
                if (rule.number_of_movers === numberOfMovers) break;
                numberOfMovers = rule.number_of_movers;
                const team = teams.find(t => t.number_of_movers === numberOfMovers);
                if (!team) break;
                estimatedHours = totalWeight / team.lbs_per_hour;
                estimatedHours = Math.ceil(estimatedHours * 4) / 4;
                iterations++;
            }
        } else {
            const rule = rules.find(r => estimatedHours > r.hours_min && estimatedHours <= r.hours_max);
            if (rule) numberOfMovers = rule.number_of_movers;
        }
        numberOfMovers = Math.max(numberOfMovers, maxAdditionalMovers); // Adjust for additional services
        const team = teams.find(t => t.number_of_movers === numberOfMovers);
        const laborCost = estimatedHours * (team ? team.price_per_hour : 0);
        let numberOfTrucks = 1; // Default for hourly
        if (method !== 'hourly') {
            const trucksRes = await pool.query('SELECT * FROM trucks WHERE tenant_id = $1 ORDER BY volume_cf DESC LIMIT 1', [req.tenantId]); // Assume largest truck
            const truck = trucksRes.rows[0] ? {
                volume_cf: parseFloat(trucksRes.rows[0].volume_cf),
                mpg: parseFloat(trucksRes.rows[0].mpg)
            } : { volume_cf: 1250, mpg: 8 }; // Default
            numberOfTrucks = Math.ceil(totalVolume / truck.volume_cf);
        }
        const truckCost = (numberOfTrucks > 1) ? (numberOfTrucks - 1) * 200 : 0; // $200 per additional
        const tenantRes = await pool.query('SELECT google_maps_api_key, address FROM tenants WHERE id = $1', [req.tenantId]);
        const apiKey = tenantRes.rows[0].google_maps_api_key;
        const depotAddress = tenantRes.rows[0].address;
        let originAddress = estimate.origin_address;
        let destinationAddress = estimate.destination_address;
        if (!originAddress || !destinationAddress) {
            const oppRes = await pool.query('SELECT origin_address, destination_address FROM opportunities WHERE id = $1', [estimate.opportunity_id]);
            if (oppRes.rowCount > 0) {
                if (!originAddress) originAddress = oppRes.rows[0].origin_address;
                if (!destinationAddress) destinationAddress = oppRes.rows[0].destination_address;
            }
        }
        if (apiKey && depotAddress && originAddress && destinationAddress) {
            const client = new Client({});
            const legs = [
                { origin: depotAddress, destination: originAddress },
                { origin: originAddress, destination: destinationAddress },
                { origin: destinationAddress, destination: depotAddress }
            ];
            let totalDistanceMeters = 0;
            let totalDurationSeconds = 0;
            for (const leg of legs) {
                const response = await client.distMatrix({
                    params: {
                        origins: [leg.origin],
                        destinations: [leg.destination],
                        mode: 'driving',
                        key: apiKey
                    },
                    timeout: 1000 // optional
                });
                const data = response.data.rows[0].elements[0];
                if (data.status !== 'OK') {
                    console.error(`Distance Matrix error for leg ${leg.origin} to ${leg.destination}: ${data.status}`);
                    continue; // Skip this leg if error, but proceed with others
                }
                totalDistanceMeters += data.distance.value;
                totalDurationSeconds += data.duration.value;
            }
            distance = totalDistanceMeters / 1609.34; // Convert to miles
            travelTime = totalDurationSeconds / 3600; // Convert to hours
        } else {
            travelTime = distance / 30; // Assume 30 mph average
        }
        const tiersRes = await pool.query('SELECT * FROM fuel_price_tiers WHERE tenant_id = $1 ORDER BY miles_min', [req.tenantId]);
        const tiers = tiersRes.rows.map(t => ({
            ...t,
            miles_min: parseFloat(t.miles_min),
            miles_max: t.miles_max ? parseFloat(t.miles_max) : null,
            price_per_gallon: parseFloat(t.price_per_gallon)
        }));
        const trucksRes = await pool.query('SELECT * FROM trucks WHERE tenant_id = $1 ORDER BY volume_cf DESC LIMIT 1', [req.tenantId]);
        const mpg = trucksRes.rows[0] ? parseFloat(trucksRes.rows[0].mpg) : 8;
        const gallons = distance / mpg;
        const tier = tiers.find(t => (t.miles_min <= distance && (t.miles_max === null || distance < t.miles_max)));
        const fuelCost = gallons * (tier ? tier.price_per_gallon : 0);
        const totalCost = laborCost + truckCost + fuelCost + additionalServicesCost;
        await pool.query(
            'UPDATE estimates SET total_weight = $1, total_volume = $2, estimated_hours = $3, labor_cost = $4, truck_cost = $5, fuel_cost = $6, additional_services_cost = $7, total_cost = $8, number_of_movers = $9, number_of_trucks = $10, distance_miles = $11, travel_time = $12 WHERE id = $13',
            [totalWeight, totalVolume, estimatedHours, laborCost, truckCost, fuelCost, additionalServicesCost, totalCost, numberOfMovers, numberOfTrucks, distance, travelTime, estimateId]
        );
        res.json({ message: 'Estimate calculated successfully' });
    } catch (err) {
        res.status(500).send(`Error calculating estimate: ${err.message}`);
    }
});

module.exports = router;