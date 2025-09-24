// /var/www/movethatstuff/backend/services/estimateService.js
const moment = require('moment-timezone');
const { Client } = require('@googlemaps/google-maps-services-js');
const { pool } = require('../middleware');
const logger = require('../logger');

const googleMapsClient = new Client({});

async function geocodeAddress(address, tenantId) {
    try {
        const tenantRes = await pool.query('SELECT google_maps_api_key FROM tenants WHERE id = $1', [tenantId]);
        const apiKey = tenantRes.rows[0]?.google_maps_api_key || process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) throw new Error('No Google Maps API key configured for this tenant.');
        const response = await googleMapsClient.geocode({
            params: {
                address: address,
                key: apiKey,
                region: 'us'
            }
        });
        const data = response.data;
        if (data.status !== 'OK' || data.results.length === 0) {
            throw new Error(`Geocoding failed: ${data.status} - ${data.error_message || 'No results'}`);
        }
        const { lat, lng } = data.results[0].geometry.location;
        return { lat, lng };
    } catch (err) {
        logger.error(`Geocoding error for ${address} (tenant ${tenantId}): ${err.message}`);
        throw err;
    }
}

async function resequenceStops(estimateId) {
    try {
        await pool.query('BEGIN');
        const stopsRes = await pool.query('SELECT * FROM estimate_stops WHERE estimate_id = $1 ORDER BY sequence', [estimateId]);
        const stops = stopsRes.rows;
        for (let i = 0; i < stops.length; i++) {
            await pool.query(
                'UPDATE estimate_stops SET sequence = $1 WHERE id = $2',
                [i + 1, stops[i].id]
            );
        }
        await pool.query(
            'UPDATE estimate_stops SET type = \'origin\' WHERE estimate_id = $1 AND sequence = 1',
            [estimateId]
        );
        await pool.query(
            'UPDATE estimate_stops SET type = \'destination\' WHERE estimate_id = $1 AND sequence = (SELECT MAX(sequence) FROM estimate_stops WHERE estimate_id = $1)',
            [estimateId]
        );
        await pool.query(
            'UPDATE estimate_stops SET type = \'stop\' WHERE estimate_id = $1 AND sequence > 1 AND sequence < (SELECT MAX(sequence) FROM estimate_stops WHERE estimate_id = $1)',
            [estimateId]
        );
        await pool.query('COMMIT');
    } catch (err) {
        await pool.query('ROLLBACK');
        throw err;
    }
}

async function calculateEstimate(estimateId, tenantId, full = true) {
    try {
        const estimateRes = await pool.query(
            `SELECT e.*, t.lat AS depot_lat, t.lng AS depot_lng, t.google_maps_api_key
             FROM estimates e 
             JOIN tenants t ON e.tenant_id = t.id 
             WHERE e.id = $1 AND e.tenant_id = $2`,
            [estimateId, tenantId]
        );
        if (estimateRes.rowCount === 0) throw new Error('Estimate not found');
        let estimate = estimateRes.rows[0];
        const depotLat = estimate.depot_lat;
        const depotLng = estimate.depot_lng;
        const apiKey = estimate.google_maps_api_key || process.env.GOOGLE_MAPS_API_KEY;

        let distance_miles = parseFloat(estimate.distance_miles) || 0;
        let depot_travel_time = parseFloat(estimate.depot_travel_time) || 0;
        let move_travel_time = parseFloat(estimate.move_travel_time) || 0;

        if (full) {
            const stopsRes = await pool.query('SELECT * FROM estimate_stops WHERE estimate_id = $1 ORDER BY sequence', [estimateId]);
            const stops = stopsRes.rows;
            if (stops.length < 2) throw new Error('At least origin and destination required');

            // Geocode if missing lat/lng
            for (let stop of stops) {
                if (!stop.lat || !stop.lng) {
                    const fullAddress = `${stop.address || ''}, ${stop.city || ''}, ${stop.state || ''} ${stop.zip}`;
                    const coords = await geocodeAddress(fullAddress, tenantId);
                    if (coords) {
                        await pool.query('UPDATE estimate_stops SET lat = $1, lng = $2 WHERE id = $3', [coords.lat, coords.lng, stop.id]);
                        stop.lat = coords.lat;
                        stop.lng = coords.lng;
                    }
                }
            }

            distance_miles = 0;
            depot_travel_time = 0;
            move_travel_time = 0;

            // Depot to origin
            if (stops[0].lat && stops[0].lng) {
                const depotToOrigin = await googleMapsClient.directions({
                    params: {
                        origin: `${depotLat},${depotLng}`,
                        destination: `${stops[0].lat},${stops[0].lng}`,
                        key: apiKey,
                        mode: 'driving'
                    }
                });
                if (depotToOrigin.data.status === 'OK') {
                    depot_travel_time += depotToOrigin.data.routes[0].legs.reduce((acc, leg) => acc + parseFloat(leg.duration.value) / 3600, 0);
                    distance_miles += depotToOrigin.data.routes[0].legs.reduce((acc, leg) => acc + parseFloat(leg.distance.value) / 1609.34, 0);
                }
            }

            // Origin to dest with stops
            if (stops[0].lat && stops[0].lng && stops[stops.length - 1].lat && stops[stops.length - 1].lng) {
                const waypoints = stops.slice(1, -1).filter(s => s.lat && s.lng).map(s => ({ location: `${s.lat},${s.lng}`, stopover: true }));
                const originToDest = await googleMapsClient.directions({
                    params: {
                        origin: `${stops[0].lat},${stops[0].lng}`,
                        destination: `${stops[stops.length - 1].lat},${stops[stops.length - 1].lng}`,
                        waypoints: waypoints.length > 0 ? waypoints : undefined,
                        key: apiKey,
                        mode: 'driving'
                    }
                });
                if (originToDest.data.status === 'OK') {
                    move_travel_time = originToDest.data.routes[0].legs.reduce((acc, leg) => acc + parseFloat(leg.duration.value) / 3600, 0);
                    distance_miles += originToDest.data.routes[0].legs.reduce((acc, leg) => acc + parseFloat(leg.distance.value) / 1609.34, 0);
                }
            }

            // Dest to depot
            if (stops[stops.length - 1].lat && stops[stops.length - 1].lng) {
                const destToDepot = await googleMapsClient.directions({
                    params: {
                        origin: `${stops[stops.length - 1].lat},${stops[stops.length - 1].lng}`,
                        destination: `${depotLat},${depotLng}`,
                        key: apiKey,
                        mode: 'driving'
                    }
                });
                if (destToDepot.data.status === 'OK') {
                    depot_travel_time += destToDepot.data.routes[0].legs.reduce((acc, leg) => acc + parseFloat(leg.duration.value) / 3600, 0);
                    distance_miles += destToDepot.data.routes[0].legs.reduce((acc, leg) => acc + parseFloat(leg.distance.value) / 1609.34, 0);
                }
            }
        }

        const teamsRes = await pool.query('SELECT * FROM mover_teams WHERE tenant_id = $1 ORDER BY number_of_movers', [tenantId]);
        const teams = teamsRes.rows;

        const trucksRes = await pool.query('SELECT AVG(volume_cf) AS avg_capacity, AVG(mpg) AS avg_mpg FROM trucks WHERE tenant_id = $1', [tenantId]);
        const avg_capacity = parseFloat(trucksRes.rows[0].avg_capacity) || 1250.00;
        const avg_mpg = parseFloat(trucksRes.rows[0].avg_mpg) || 8.00;

        // Fetch total_weight from inventory or residence if not overridden
        let total_weight = estimate.is_total_weight_overridden ? estimate.total_weight : 0;
        if (!estimate.is_total_weight_overridden) {
            const invRes = await pool.query('SELECT SUM(quantity * weight_lbs) AS total_weight FROM estimate_inventory_items eii JOIN inventory_items ii ON eii.inventory_item_id = ii.id WHERE eii.estimate_id = $1', [estimateId]);
            total_weight = parseFloat(invRes.rows[0].total_weight || 0);
            if (total_weight === 0) {
                const resRes = await pool.query('SELECT SUM(quantity * weight_lbs) AS total_weight FROM estimate_residence_sizes ers JOIN residence_sizes rs ON ers.residence_size_id = rs.id WHERE ers.estimate_id = $1', [estimateId]);
                total_weight = parseFloat(resRes.rows[0].total_weight || 0);
            }
        }

        // Similar for total_volume if needed
        let total_volume = estimate.is_total_volume_overridden ? estimate.total_volume : 0;
        if (!estimate.is_total_volume_overridden) {
            // Add logic if volume is derived separately
        }

        // Number of movers (use rules from mover_assignment_rules if not overridden)
        let number_of_movers = estimate.is_number_of_movers_overridden ? estimate.number_of_movers : teams[0].number_of_movers; // Default; expand with rules

        // Find team
        const team = teams.find(t => t.number_of_movers === number_of_movers) || teams[0];

        // Estimated hours
        let estimated_hours = estimate.is_estimated_hours_overridden ? estimate.estimated_hours : (total_weight / team.lbs_per_hour);

        // Number of trucks
        let number_of_trucks = estimate.is_number_of_trucks_overridden ? estimate.number_of_trucks : Math.ceil(total_volume / avg_capacity) || 1;

        // Total move time
        let total_move_time = estimate.is_total_move_time_overridden ? estimate.total_move_time : estimated_hours + depot_travel_time + move_travel_time;

        // Labor cost
        let labor_cost = estimate.is_labor_cost_overridden ? estimate.labor_cost : estimated_hours * team.price_per_hour;

        // Truck cost (assume from settings; add query if needed)
        let truck_cost = estimate.is_truck_cost_overridden ? estimate.truck_cost : number_of_trucks * 150; // Placeholder

        // Fuel cost
        let fuel_cost = estimate.is_fuel_cost_overridden ? estimate.fuel_cost : (distance_miles / avg_mpg) * 3.00; // Placeholder

        // Additional services (unchanged)
        const addlRes = await pool.query('SELECT SUM(total_price) AS additional_services_cost FROM estimate_additional_services WHERE estimate_id = $1', [estimateId]);
        let additional_services_cost = parseFloat(addlRes.rows[0].additional_services_cost || 0);
        if (estimate.is_additional_services_cost_overridden) {
            additional_services_cost = estimate.additional_services_cost;
        }

        // Total cost
        let total_cost = estimate.is_total_cost_overridden ? estimate.total_cost : labor_cost + truck_cost + fuel_cost + additional_services_cost;

        // Update estimate fields
        await pool.query(
            'UPDATE estimates SET total_weight = $1, total_volume = $2, estimated_hours = $3, labor_cost = $4, truck_cost = $5, fuel_cost = $6, additional_services_cost = $7, total_cost = $8, number_of_movers = $9, number_of_trucks = $10, distance_miles = $11, depot_travel_time = $12, move_travel_time = $13, total_move_time = $14 WHERE id = $15',
            [total_weight, total_volume, estimated_hours, labor_cost, truck_cost, fuel_cost, additional_services_cost, total_cost, number_of_movers, number_of_trucks, distance_miles, depot_travel_time, move_travel_time, total_move_time, estimateId]
        );

        // Clear and reinsert line_items for auto-generated (labor, truck, fuel, etc.)
        await pool.query("DELETE FROM estimate_line_items WHERE estimate_id = $1 AND item_type NOT IN ('additional')", [estimateId]);

        // Insert updated line items (example; expand as needed)
        await pool.query(
            'INSERT INTO estimate_line_items (estimate_id, item_type, description, quantity, unit_price, total_cost) VALUES ($1, $2, $3, $4, $5, $6)',
            [estimateId, 'labor', `${number_of_movers} Movers`, estimated_hours, team.price_per_hour, labor_cost]
        );
        // Add similar for truck, fuel, etc.

    } catch (err) {
        throw err;
    }
}

module.exports = {
    geocodeAddress,
    resequenceStops,
    calculateEstimate
};