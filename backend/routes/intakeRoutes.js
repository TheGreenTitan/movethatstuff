// /var/www/movethatstuff/backend/routes/intakeRoutes.js
const express = require('express');
const Joi = require('joi');
const { pool, validate } = require('../middleware');
const logger = require('../logger');
const { Client } = require('@googlemaps/google-maps-services-js');
const router = express.Router();

const googleMapsClient = new Client({});

// Public endpoint - no auth required
const intakeSchema = Joi.object({
    name: Joi.string().min(1).max(255).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().regex(/^\+?[\d\s-]{7,15}$/).optional(),
    source: Joi.string().required(), // New: source as string (name)
    move_type: Joi.string().valid('house', 'apartment', 'commercial', 'storage').required(),
    move_service: Joi.string().valid('moving', 'packing', 'moving and packing', 'junk removal', 'labor only').required(),
    move_date: Joi.date().iso().optional(),
    origin_address: Joi.string().required(),
    origin_city: Joi.string().required(),
    origin_state: Joi.string().required(),
    origin_zip: Joi.string().required(),
    destination_address: Joi.string().required(),
    destination_city: Joi.string().required(),
    destination_state: Joi.string().required(),
    destination_zip: Joi.string().required(),
    notes: Joi.string().allow('').optional(),
    move_size: Joi.string().optional() // New: move_size as size_description string
});

// GET public sources (for dropdown)
router.get('/sources', async (req, res) => {
    try {
        const result = await pool.query('SELECT name FROM sources WHERE is_public = true AND tenant_id = 1 ORDER BY name');
        res.json(result.rows.map(row => row.name));
    } catch (err) {
        logger.error(`Error fetching public sources: ${err.message} - Stack: ${err.stack}`);
        res.status(500).send('Error fetching sources');
    }
});

// GET residence sizes (for dropdown, filtered by move_type)
router.get('/residence-sizes', async (req, res) => {
    const move_type = req.query.move_type;
    if (!move_type) return res.status(400).send('move_type required');
    try {
        let sizes = [];
        if (move_type === 'house') {
            // Fetch bedrooms first (ordered by ID or description)
            const bedroomsResult = await pool.query('SELECT size_description FROM residence_sizes WHERE tenant_id = 1 AND type = $1 ORDER BY id', ['house_bedrooms']);
            // Fetch sqft next (ordered by ID or description)
            const sqftResult = await pool.query('SELECT size_description FROM residence_sizes WHERE tenant_id = 1 AND type = $1 ORDER BY id', ['house_sqft']);
            sizes = [...bedroomsResult.rows.map(row => row.size_description), ...sqftResult.rows.map(row => row.size_description)];
        } else {
            let query = 'SELECT size_description FROM residence_sizes WHERE tenant_id = 1';
            let params = [];
            if (move_type === 'apartment') {
                query += ' AND type = $1';
                params = ['apartment'];
            } else if (move_type === 'storage') {
                query += ' AND type = $1';
                params = ['storage'];
            } else if (move_type === 'commercial') {
                return res.json([]); // No sizes for commercial; custom
            } else {
                return res.status(400).send('Invalid move_type');
            }
            query += ' ORDER BY id'; // Order by ID for consistent DB order
            const result = await pool.query(query, params);
            sizes = result.rows.map(row => row.size_description);
        }
        res.json(sizes);
    } catch (err) {
        logger.error(`Error fetching residence sizes: ${err.message} - Stack: ${err.stack}`);
        res.status(500).send('Error fetching residence sizes');
    }
});

router.post('/', validate(intakeSchema), async (req, res) => {
    const { name, email, phone, source, move_type, move_service, move_date, origin_address, origin_city, origin_state, origin_zip, destination_address, destination_city, destination_state, destination_zip, notes, move_size } = req.body;
    try {
        logger.info(`Received source in intake POST: ${source}`);
        // Lookup source_id by name (case-insensitive)
        const sourceResult = await pool.query('SELECT id FROM sources WHERE name ILIKE $1 AND tenant_id = 1', [source]);
        logger.info(`Source lookup result for '${source}': ${sourceResult.rows.length} rows`);
        if (sourceResult.rows.length === 0) {
            logger.warn(`Invalid source: ${source}`);
            return res.status(400).send('Invalid source');
        }
        const source_id = sourceResult.rows[0].id;

        // Check for existing customer by email (and phone if provided)
        let customer_id;
        let customerQuery = 'SELECT id FROM customers WHERE email = $1 AND tenant_id = 1';
        let customerParams = [email];
        if (phone) {
            customerQuery += ' OR phone = $2';
            customerParams.push(phone);
        }
        const existingCustomer = await pool.query(customerQuery, customerParams);
        if (existingCustomer.rowCount > 0) {
            customer_id = existingCustomer.rows[0].id;
        } else {
            // Create new customer
            const customerResult = await pool.query(
                'INSERT INTO customers (name, email, phone, source_id, tenant_id) VALUES ($1, $2, $3, $4, 1) RETURNING id',
                [name, email, phone, source_id]
            );
            customer_id = customerResult.rows[0].id;
        }

        // Create estimate as 'new lead'
        const estimateResult = await pool.query(
            'INSERT INTO estimates (customer_id, move_type, move_service, move_date, origin_address, origin_city, origin_state, origin_zip, destination_address, destination_city, destination_state, destination_zip, notes, status, move_size_description, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 1) RETURNING id',
            [customer_id, move_type, move_service, move_date, origin_address, origin_city, origin_state, origin_zip, destination_address, destination_city, destination_state, destination_zip, notes, 'new lead', move_size]
        );
        const estimate_id = estimateResult.rows[0].id;

        // Auto-calculate
        await calculateEstimate(estimate_id, 1); // tenant_id=1 for intake

        res.status(201).json({ message: 'Lead submitted successfully', estimate_id, customer_id }); // Return customer_id for potential redirect
    } catch (err) {
        if (err.code === '23505' && err.constraint === 'customers_email_unique') {
            res.status(409).json({ message: 'Customer with this email already exists. Estimate added to existing record.', customer_id: existingCustomer.rows[0].id });
        } else {
            logger.error(`Error processing intake form: ${err.message} - Stack: ${err.stack}`);
            res.status(500).send('Error submitting lead');
        }
    }
});

// Calculation function (extracted for reuse)
async function calculateEstimate(id, tenantId) {
    try {
        const estimateRes = await pool.query('SELECT * FROM estimates WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
        if (estimateRes.rowCount === 0) throw new Error('Estimate not found');
        const estimate = estimateRes.rows[0];

        // Get depot address from tenants
        const tenantRes = await pool.query('SELECT address AS depot_address FROM tenants WHERE id = $1', [tenantId]);
        const depot_address = tenantRes.rows[0]?.depot_address;

        const updates = [];
        const values = [];
        let paramIndex = 1;

        // Get weight from residence_sizes if move_size_description
        let total_weight = estimate.total_weight;
        if (!total_weight && estimate.move_size_description) {
            const sizeRes = await pool.query('SELECT weight_lbs FROM residence_sizes WHERE size_description = $1 AND tenant_id = $2', [estimate.move_size_description, tenantId]);
            if (sizeRes.rowCount > 0) {
                total_weight = sizeRes.rows[0].weight_lbs;
                updates.push(`total_weight = $${paramIndex}`);
                values.push(total_weight);
                paramIndex++;
            }
        }

        // Total volume = weight / 7 if weight set
        let total_volume = estimate.total_volume;
        if (total_weight && !total_volume) {
            total_volume = total_weight / 7;
            updates.push(`total_volume = $${paramIndex}`);
            values.push(total_volume);
            paramIndex++;
        }

        // Select mover_team (smallest that can handle weight within 8 hours)
        let number_of_movers = estimate.number_of_movers;
        let lbs_per_hour = 0;
        let price_per_hour = 0;
        if (!estimate.is_number_of_movers_overridden && total_weight) {
            const teamRes = await pool.query('SELECT * FROM mover_teams WHERE tenant_id = $1 ORDER BY number_of_movers ASC', [tenantId]);
            for (const team of teamRes.rows) {
                if (total_weight <= team.lbs_per_hour * 8) {
                    number_of_movers = team.number_of_movers;
                    lbs_per_hour = team.lbs_per_hour;
                    price_per_hour = team.price_per_hour;
                    break;
                }
            }
            if (!number_of_movers && teamRes.rowCount > 0) {
                // Select largest if none match
                const largestTeam = teamRes.rows[teamRes.rowCount - 1];
                number_of_movers = largestTeam.number_of_movers;
                lbs_per_hour = largestTeam.lbs_per_hour;
                price_per_hour = largestTeam.price_per_hour;
            }
            if (number_of_movers) {
                updates.push(`number_of_movers = $${paramIndex}`);
                values.push(number_of_movers);
                paramIndex++;
            }
        }

        // Estimated hours (ceil to nearest 0.25, min 2)
        let estimated_hours = estimate.estimated_hours;
        if (!estimate.is_estimated_hours_overridden && total_weight && lbs_per_hour) {
            const raw_hours = total_weight / lbs_per_hour;
            const rounded_hours = Math.ceil(raw_hours * 4) / 4;
            estimated_hours = Math.max(2, rounded_hours);
            updates.push(`estimated_hours = $${paramIndex}`);
            values.push(estimated_hours);
            paramIndex++;
        }

        // Labor cost
        let labor_cost = estimate.labor_cost;
        if (!estimate.is_labor_cost_overridden && estimated_hours && price_per_hour) {
            labor_cost = estimated_hours * price_per_hour;
            updates.push(`labor_cost = $${paramIndex}`);
            values.push(labor_cost);
            paramIndex++;
        }

        let distance_miles = estimate.distance_miles;
        let depot_travel_time = estimate.depot_travel_time || 0;
        let move_travel_time = estimate.move_travel_time || 0;
        if (depot_address && estimate.origin_address && estimate.destination_address) {
            // Depot to origin
            let depot_to_origin_dist = 0;
            let depot_to_origin_time = 0;
            const res1 = await googleMapsClient.distancematrix({
                params: {
                    origins: [depot_address],
                    destinations: [estimate.origin_address],
                    key: process.env.GOOGLE_MAPS_API_KEY
                }
            });
            const data1 = res1.data.rows[0].elements[0];
            if (data1.status === 'OK') {
                depot_to_origin_dist = data1.distance.value / 1609.34;
                depot_to_origin_time = data1.duration.value / 3600;
            }

            // Origin to destination
            let origin_to_dest_dist = 0;
            let origin_to_dest_time = 0;
            const res2 = await googleMapsClient.distancematrix({
                params: {
                    origins: [estimate.origin_address],
                    destinations: [estimate.destination_address],
                    key: process.env.GOOGLE_MAPS_API_KEY
                }
            });
            const data2 = res2.data.rows[0].elements[0];
            if (data2.status === 'OK') {
                origin_to_dest_dist = data2.distance.value / 1609.34;
                origin_to_dest_time = data2.duration.value / 3600;
            }

            // Destination to depot
            let dest_to_depot_dist = 0;
            let dest_to_depot_time = 0;
            const res3 = await googleMapsClient.distancematrix({
                params: {
                    origins: [estimate.destination_address],
                    destinations: [depot_address],
                    key: process.env.GOOGLE_MAPS_API_KEY
                }
            });
            const data3 = res3.data.rows[0].elements[0];
            if (data3.status === 'OK') {
                dest_to_depot_dist = data3.distance.value / 1609.34;
                dest_to_depot_time = data3.duration.value / 3600;
            }

            // Total distance for fuel
            distance_miles = depot_to_origin_dist + origin_to_dest_dist + dest_to_depot_dist;
            if (distance_miles > 0) {
                updates.push(`distance_miles = $${paramIndex}`);
                values.push(distance_miles);
                paramIndex++;
            }

            // Depot travel time
            depot_travel_time = depot_to_origin_time + dest_to_depot_time;
            updates.push(`depot_travel_time = $${paramIndex}`);
            values.push(depot_travel_time);
            paramIndex++;

            // Move travel time
            move_travel_time = origin_to_dest_time;
            updates.push(`move_travel_time = $${paramIndex}`);
            values.push(move_travel_time);
            paramIndex++;
        }

        // Number of trucks (assume 1 for now, or based on volume if added)
        let number_of_trucks = estimate.number_of_trucks || 1;
        if (!estimate.is_number_of_trucks_overridden) {
            updates.push(`number_of_trucks = $${paramIndex}`);
            values.push(number_of_trucks);
            paramIndex++;
        }

        // Truck cost (fixed $150 per truck)
        let truck_cost = estimate.truck_cost;
        if (!estimate.is_truck_cost_overridden) {
            truck_cost = number_of_trucks * 150; // Updated to 150
            updates.push(`truck_cost = $${paramIndex}`);
            values.push(truck_cost);
            paramIndex++;
        }

        // Fuel cost (find tier, assume 1 truck mpg)
        let fuel_cost = estimate.fuel_cost;
        if (!estimate.is_fuel_cost_overridden && distance_miles) {
            const truckRes = await pool.query('SELECT mpg FROM trucks WHERE tenant_id = $1 LIMIT 1', [tenantId]);
            const mpg = truckRes.rows[0]?.mpg || 8;
            const gallons = distance_miles / mpg;
            const tierRes = await pool.query('SELECT price_per_gallon FROM fuel_price_tiers WHERE tenant_id = $1 AND miles_min <= $2 AND (miles_max >= $2 OR miles_max IS NULL) LIMIT 1', [tenantId, distance_miles]);
            const price_per_gallon = tierRes.rows[0]?.price_per_gallon || 3.00;
            fuel_cost = gallons * price_per_gallon;
            updates.push(`fuel_cost = $${paramIndex}`);
            values.push(fuel_cost);
            paramIndex++;
        }

        // Total move time (estimated_hours + depot_travel_time + move_travel_time)
        let total_move_time = estimate.total_move_time;
        if (!estimate.is_total_move_time_overridden && estimated_hours) {
            total_move_time = estimated_hours + depot_travel_time + move_travel_time;
            updates.push(`total_move_time = $${paramIndex}`);
            values.push(total_move_time);
            paramIndex++;
        }

        // Total cost (sum)
        let total_cost = estimate.total_cost;
        if (!estimate.is_total_cost_overridden) {
            total_cost = (labor_cost || 0) + (truck_cost || 0) + (fuel_cost || 0) + (estimate.additional_services_cost || 0);
            updates.push(`total_cost = $${paramIndex}`);
            values.push(total_cost);
            paramIndex++;
        }

        if (updates.length === 0) return;

        const query = `UPDATE estimates SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}`;
        values.push(id, tenantId);

        await pool.query(query, values);
    } catch (err) {
        logger.error(`Error calculating estimate: ${err.message} - Stack: ${err.stack}`);
        throw err;
    }
}

module.exports = router;