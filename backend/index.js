const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const app = express();
const port = 3000;
app.use(express.json()); // Middleware to parse JSON bodies
const pool = new Pool({
    user: 'patrick',
    host: 'localhost',
    database: 'movethatstuff',
    password: '455454',
    port: 5432,
});
const secretKey = 'your-secret-key'; // Replace with a secure key in production
// Middleware to verify JWT and attach tenant_id
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).send('Access denied. No token provided.');
    jwt.verify(token, secretKey, (err, user) => {
        if (err) return res.status(403).send('Invalid token.');
        req.user = user;
        pool.query('SELECT tenant_id FROM users WHERE id = $1', [user.id], (err, result) => {
            if (err || result.rowCount === 0) return res.status(500).send('Error fetching user tenant.');
            req.tenantId = result.rows[0].tenant_id;
            next();
        });
    });
};
app.post('/register', (req, res) => {
    const { username, password, tenant_id } = req.body;
    if (!username || !password || !tenant_id) return res.status(400).send('Username, password, and tenant_id are required');
    pool.query('SELECT id FROM tenants WHERE id = $1', [tenant_id], (err, result) => {
        if (err || result.rowCount === 0) return res.status(400).send('Invalid tenant_id');
        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) return res.status(500).send(`Error hashing password: ${err.message}`);
            pool.query(
                'INSERT INTO users (username, password, tenant_id) VALUES ($1, $2, $3) RETURNING id, username',
                [username, hashedPassword, tenant_id],
                (err, result) => {
                    if (err) return res.status(500).send(`Error registering user: ${err.message}`);
                    res.status(201).json(result.rows[0]);
                }
            );
        });
    });
});
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    pool.query('SELECT * FROM users WHERE username = $1', [username], (err, result) => {
        if (err || result.rowCount === 0) return res.status(400).send('Invalid credentials');
        const user = result.rows[0];
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) return res.status(500).send(`Error comparing password: ${err.message}`);
            console.log(`Password comparison for ${username}: ${password} vs ${user.password} = ${isMatch}`);
            if (!isMatch) return res.status(400).send('Invalid credentials');
            const token = jwt.sign({ id: user.id, username: user.username }, secretKey, { expiresIn: '8h' });
            res.json({ token });
        });
    });
});
// Protected routes
app.get('/customers', authenticateToken, (req, res) => {
    pool.query('SELECT id, name, email, phone, company_name, is_commercial, source, created_at FROM customers WHERE tenant_id = $1', [req.tenantId], (err, result) => {
        if (err) return res.status(500).send(`Error fetching customers: ${err.message}`);
        res.json(result.rows);
    });
});
app.post('/customers', authenticateToken, (req, res) => {
    const { name, email, phone, company_name, is_commercial, source } = req.body;
    if (!name || !email) return res.status(400).send('Name and email are required');
    pool.query(
        'INSERT INTO customers (name, email, phone, company_name, is_commercial, source, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [name, email, phone, company_name, is_commercial, source, req.tenantId],
        (err, result) => {
            if (err) return res.status(500).send(`Error creating customer: ${err.message}`);
            res.status(201).json(result.rows[0]);
        }
    );
});
app.put('/customers/:id', authenticateToken, (req, res) => {
    const id = req.params.id;
    const { name, email, phone, company_name, is_commercial, source } = req.body;
    if (!name || !email) return res.status(400).send('Name and email are required');
    pool.query(
        'UPDATE customers SET name = $1, email = $2, phone = $3, company_name = $4, is_commercial = $5, source = $6 WHERE id = $7 AND tenant_id = $8 RETURNING *',
        [name, email, phone, company_name, is_commercial, source, id, req.tenantId],
        (err, result) => {
            if (err) return res.status(500).send(`Error updating customer: ${err.message}`);
            if (result.rowCount === 0) return res.status(404).send('Customer not found');
            res.json(result.rows[0]);
        }
    );
});
app.delete('/customers/:id', authenticateToken, (req, res) => {
    const id = req.params.id;
    pool.query(
        'DELETE FROM customers WHERE id = $1 AND tenant_id = $2 RETURNING *',
        [id, req.tenantId],
        (err, result) => {
            if (err) return res.status(500).send(`Error deleting customer: ${err.message}`);
            if (result.rowCount === 0) return res.status(404).send('Customer not found');
            res.status(200).json({ message: 'Customer deleted', data: result.rows[0] });
        }
    );
});
app.get('/opportunities', authenticateToken, (req, res) => {
    pool.query(
        'SELECT id, customer_id, move_date, move_type, move_service, origin_address, destination_address, origin_stairs, dest_stairs, notes, created_at FROM opportunities WHERE customer_id IN (SELECT id FROM customers WHERE tenant_id = $1)',
        [req.tenantId],
        (err, result) => {
            if (err) return res.status(500).send(`Error fetching opportunities: ${err.message}`);
            res.json(result.rows);
        }
    );
});
app.post('/opportunities', authenticateToken, (req, res) => {
    const { customer_id, move_date, move_type, move_service, origin_address, destination_address, origin_stairs, dest_stairs, notes } = req.body;
    if (!customer_id || !move_date || !move_type || !move_service) return res.status(400).send('customer_id, move_date, move_type, and move_service are required');
    pool.query(
        'INSERT INTO opportunities (customer_id, move_date, move_type, move_service, origin_address, destination_address, origin_stairs, dest_stairs, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
        [customer_id, move_date, move_type, move_service, origin_address, destination_address, origin_stairs, dest_stairs, notes],
        (err, result) => {
            if (err) return res.status(500).send(`Error creating opportunity: ${err.message}`);
            res.status(201).json(result.rows[0]);
        }
    );
});
app.put('/opportunities/:id', authenticateToken, (req, res) => {
    const id = req.params.id;
    const { customer_id, move_date, move_type, move_service, origin_address, destination_address, origin_stairs, dest_stairs, notes } = req.body;
    if (!customer_id || !move_date || !move_type || !move_service) return res.status(400).send('customer_id, move_date, move_type, and move_service are required');
    pool.query(
        'UPDATE opportunities SET customer_id = $1, move_date = $2, move_type = $3, move_service = $4, origin_address = $5, destination_address = $6, origin_stairs = $7, dest_stairs = $8, notes = $9 WHERE id = $10 RETURNING *',
        [customer_id, move_date, move_type, move_service, origin_address, destination_address, origin_stairs, dest_stairs, notes, id],
        (err, result) => {
            if (err) return res.status(500).send(`Error updating opportunity: ${err.message}`);
            if (result.rowCount === 0) return res.status(404).send('Opportunity not found');
            res.json(result.rows[0]);
        }
    );
});
app.delete('/opportunities/:id', authenticateToken, (req, res) => {
    const id = req.params.id;
    pool.query(
        'DELETE FROM opportunities WHERE id = $1 RETURNING *',
        [id],
        (err, result) => {
            if (err) return res.status(500).send(`Error deleting opportunity: ${err.message}`);
            if (result.rowCount === 0) return res.status(404).send('Opportunity not found');
            res.status(200).json({ message: 'Opportunity deleted', data: result.rows[0] });
        }
    );
});
app.get('/estimates', authenticateToken, (req, res) => {
    pool.query(
        'SELECT * FROM estimates WHERE opportunity_id IN (SELECT id FROM opportunities WHERE customer_id IN (SELECT id FROM customers WHERE tenant_id = $1))',
        [req.tenantId],
        (err, result) => {
            if (err) return res.status(500).send(`Error fetching estimates: ${err.message}`);
            res.json(result.rows);
        }
    );
});
app.post('/estimates', authenticateToken, (req, res) => {
    const { opportunity_id, move_date, move_type, move_service, origin_address, destination_address, origin_stairs, dest_stairs, notes, estimated_cost, method } = req.body;
    if (!opportunity_id || !method) return res.status(400).send('opportunity_id and method are required');
    pool.query(
        'INSERT INTO estimates (opportunity_id, move_date, move_type, move_service, origin_address, destination_address, origin_stairs, dest_stairs, notes, estimated_cost, method) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
        [opportunity_id, move_date, move_type, move_service, origin_address, destination_address, origin_stairs, dest_stairs, notes, estimated_cost, method],
        (err, result) => {
            if (err) return res.status(500).send(`Error creating estimate: ${err.message}`);
            const estimate = result.rows[0];
            res.status(201).json(estimate);
        }
    );
});
app.put('/estimates/:id', authenticateToken, (req, res) => {
    const id = req.params.id;
    const { opportunity_id, move_date, move_type, move_service, origin_address, destination_address, origin_stairs, dest_stairs, notes, estimated_cost, method } = req.body;
    if (!opportunity_id || !method) return res.status(400).send('opportunity_id and method are required');
    pool.query(
        'UPDATE estimates SET opportunity_id = $1, move_date = $2, move_type = $3, move_service = $4, origin_address = $5, destination_address = $6, origin_stairs = $7, dest_stairs = $8, notes = $9, estimated_cost = $10, method = $11 WHERE id = $12 RETURNING *',
        [opportunity_id, move_date, move_type, move_service, origin_address, destination_address, origin_stairs, dest_stairs, notes, estimated_cost, method, id],
        (err, result) => {
            if (err) return res.status(500).send(`Error updating estimate: ${err.message}`);
            if (result.rowCount === 0) return res.status(404).send('Estimate not found');
            const estimate = result.rows[0];
            res.json(estimate);
        }
    );
});
app.delete('/estimates/:id', authenticateToken, (req, res) => {
    const id = req.params.id;
    pool.query(
        'DELETE FROM estimates WHERE id = $1 RETURNING *',
        [id],
        (err, result) => {
            if (err) return res.status(500).send(`Error deleting estimate: ${err.message}`);
            if (result.rowCount === 0) return res.status(404).send('Estimate not found');
            res.status(200).json({ message: 'Estimate deleted', data: result.rows[0] });
        }
    );
});
// New endpoint to add inventory items to an estimate
app.post('/estimates/:id/inventory-items', authenticateToken, (req, res) => {
    const estimateId = req.params.id;
    const { inventory_item_id, quantity } = req.body;
    if (!inventory_item_id || !quantity) return res.status(400).send('inventory_item_id and quantity are required');
    pool.query(
        'INSERT INTO estimate_inventory_items (estimate_id, inventory_item_id, quantity) VALUES ($1, $2, $3) RETURNING *',
        [estimateId, inventory_item_id, quantity],
        (err, result) => {
            if (err) return res.status(500).send(`Error adding inventory item: ${err.message}`);
            res.status(201).json(result.rows[0]);
        }
    );
});
// Similar endpoints for residence sizes and additional services
app.post('/estimates/:id/residence-sizes', authenticateToken, (req, res) => {
    const estimateId = req.params.id;
    const { residence_size_id, quantity } = req.body;
    if (!residence_size_id || !quantity) return res.status(400).send('residence_size_id and quantity are required');
    pool.query(
        'INSERT INTO estimate_residence_sizes (estimate_id, residence_size_id, quantity) VALUES ($1, $2, $3) RETURNING *',
        [estimateId, residence_size_id, quantity],
        (err, result) => {
            if (err) return res.status(500).send(`Error adding residence size: ${err.message}`);
            res.status(201).json(result.rows[0]);
        }
    );
});
app.post('/estimates/:id/additional-services', authenticateToken, (req, res) => {
    const estimateId = req.params.id;
    const { additional_service_id, quantity } = req.body;
    if (!additional_service_id || !quantity) return res.status(400).send('additional_service_id and quantity are required');
    pool.query(
        'INSERT INTO estimate_additional_services (estimate_id, additional_service_id, quantity) VALUES ($1, $2, $3) RETURNING *',
        [estimateId, additional_service_id, quantity],
        (err, result) => {
            if (err) return res.status(500).send(`Error adding additional service: ${err.message}`);
            res.status(201).json(result.rows[0]);
        }
    );
});
// New endpoint to calculate the estimate
app.post('/estimates/:id/calculate', authenticateToken, async (req, res) => {
    const estimateId = req.params.id;
    try {
        // Fetch the estimate and its method
        const estimateRes = await pool.query('SELECT * FROM estimates WHERE id = $1', [estimateId]);
        if (estimateRes.rowCount === 0) return res.status(404).send('Estimate not found');
        const estimate = estimateRes.rows[0];
        const method = estimate.method;
        const { estimated_hours, distance_miles } = req.body;
        let totalWeight = 0;
        let totalVolume = 0;
        let additionalServicesCost = 0;
        let maxAdditionalMovers = 0;
        let estimatedHours = 0;
        let numberOfMovers = 2; // Default min
        if (method === 'inventory') {
            const inventoryRes = await pool.query('SELECT SUM(total_weight) AS tw, SUM(total_volume) AS tv FROM estimate_inventory_items WHERE estimate_id = $1', [estimateId]);
            totalWeight = inventoryRes.rows[0].tw || 0;
            totalVolume = inventoryRes.rows[0].tv || 0;
        } else if (method === 'size') {
            const sizeRes = await pool.query('SELECT SUM(total_weight) AS tw FROM estimate_residence_sizes WHERE estimate_id = $1', [estimateId]);
            totalWeight = sizeRes.rows[0].tw || 0;
            totalVolume = totalWeight / 7; // Assuming 7 lbs per cf
        } else if (method === 'hourly') {
            if (!estimated_hours) return res.status(400).send('estimated_hours required for hourly method');
            estimatedHours = estimated_hours;
            await pool.query('UPDATE estimates SET estimated_hours = $1 WHERE id = $2', [estimatedHours, estimateId]);
            totalWeight = 0;
            totalVolume = 0;
        } else {
            return res.status(400).send('Invalid method');
        }
        // Additional services (common to all)
        const addRes = await pool.query(
            'SELECT SUM(eas.total_price) AS tp, MAX(ads.movers_required) AS mm FROM estimate_additional_services eas JOIN additional_services ads ON eas.additional_service_id = ads.id WHERE eas.estimate_id = $1 AND ads.tenant_id = $2',
            [estimateId, req.tenantId]
        );
        additionalServicesCost = addRes.rows[0].tp || 0;
        maxAdditionalMovers = addRes.rows[0].mm || 0;
        // Fetch mover teams and assignment rules for tenant
        const teamsRes = await pool.query('SELECT * FROM mover_teams WHERE tenant_id = $1 ORDER BY number_of_movers', [req.tenantId]);
        const rulesRes = await pool.query('SELECT * FROM mover_assignment_rules WHERE tenant_id = $1 ORDER BY hours_min', [req.tenantId]);
        const teams = teamsRes.rows;
        const rules = rulesRes.rows;
        // Mover and hours calculation
        if (method !== 'hourly') {
            // Weight-based iterative for inventory/size
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
            // Hours-based for hourly
            const rule = rules.find(r => estimatedHours > r.hours_min && estimatedHours <= r.hours_max);
            if (rule) numberOfMovers = rule.number_of_movers;
        }
        numberOfMovers = Math.max(numberOfMovers, maxAdditionalMovers); // Adjust for additional services
        const team = teams.find(t => t.number_of_movers === numberOfMovers);
        const laborCost = estimatedHours * (team ? team.price_per_hour : 0);
        // Trucks
        let numberOfTrucks = 1; // Default for hourly
        if (method !== 'hourly') {
            const trucksRes = await pool.query('SELECT * FROM trucks WHERE tenant_id = $1 ORDER BY volume_cf DESC LIMIT 1', [req.tenantId]); // Assume largest truck
            const truckVolume = trucksRes.rows[0] ? trucksRes.rows[0].volume_cf : 1250; // Default
            numberOfTrucks = Math.ceil(totalVolume / truckVolume);
        }
        const truckCost = (numberOfTrucks > 1) ? (numberOfTrucks - 1) * 200 : 0; // $200 per additional
        // Fuel (placeholder)
        const distance = distance_miles || 0; // From request body
        const tiersRes = await pool.query('SELECT * FROM fuel_price_tiers WHERE tenant_id = $1 ORDER BY miles_min', [req.tenantId]);
        const tiers = tiersRes.rows;
        const trucksRes = await pool.query('SELECT * FROM trucks WHERE tenant_id = $1 ORDER BY volume_cf DESC LIMIT 1', [req.tenantId]);
        const mpg = trucksRes.rows[0] ? trucksRes.rows[0].mpg : 8;
        const gallons = distance / mpg;
        const tier = tiers.find(t => (t.miles_min <= distance && (t.miles_max === null || distance < t.miles_max)));
        const fuelCost = gallons * (tier ? tier.price_per_gallon : 0);
        // Update distance_miles and travel_time
        const travelTime = distance / 30; // Assume 30 mph average
        // Total cost
        const totalCost = laborCost + truckCost + fuelCost + additionalServicesCost;
        // Update estimate
        await pool.query(
            'UPDATE estimates SET total_weight = $1, total_volume = $2, estimated_hours = $3, labor_cost = $4, truck_cost = $5, fuel_cost = $6, additional_services_cost = $7, total_cost = $8, number_of_movers = $9, number_of_trucks = $10, distance_miles = $11, travel_time = $12 WHERE id = $13',
            [totalWeight, totalVolume, estimatedHours, laborCost, truckCost, fuelCost, additionalServicesCost, totalCost, numberOfMovers, numberOfTrucks, distance, travelTime, estimateId]
        );
        res.json({ message: 'Estimate calculated successfully' });
    } catch (err) {
        res.status(500).send(`Error calculating estimate: ${err.message}`);
    }
});
app.get('/', (req, res) => {
    pool.query('SELECT NOW()', (err, result) => {
        if (err) return res.send(`Error connecting to database: ${err.message}`);
        res.send(`Welcome to MoveThatStuff CRM Backend! Server time: ${result.rows[0].now}`);
    });
});
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
process.on('SIGTERM', () => {
    pool.end();
    process.exit(0);
});
