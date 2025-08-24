const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool, secretKey, validate } = require('../middleware');

const router = express.Router();

const registerSchema = Joi.object({
    username: Joi.string().min(3).max(50).required(),
    password: Joi.string().min(6).required(),
    tenant_id: Joi.number().integer().positive().required()
});

const loginSchema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required()
});

const refreshSchema = Joi.object({
    refresh_token: Joi.string().required()
});

router.post('/register', validate(registerSchema), (req, res) => {
    const { username, password, tenant_id } = req.body;
    console.log(`Attempting to register user: ${username} for tenant: ${tenant_id}`);
    pool.query('SELECT id FROM tenants WHERE id = $1', [tenant_id], (err, result) => {
        if (err) {
            console.error(`Error checking tenant: ${err.message}`);
            return res.status(500).send('Error checking tenant');
        }
        if (result.rowCount === 0) return res.status(400).send('Invalid tenant_id');
        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) {
                console.error(`Error hashing password: ${err.message}`);
                return res.status(500).send(`Error hashing password: ${err.message}`);
            }
            pool.query(
                'INSERT INTO users (username, password, tenant_id) VALUES ($1, $2, $3) RETURNING id, username',
                [username, hashedPassword, tenant_id],
                (err, result) => {
                    if (err) {
                        console.error(`Error inserting user: ${err.message}`);
                        return res.status(500).send(`Error registering user: ${err.message}`);
                    }
                    const userId = result.rows[0].id;
                    // Assign default role: 'manager'
                    pool.query(
                        `INSERT INTO user_roles (user_id, role_id) 
                         SELECT $1, id FROM roles WHERE name = 'manager'`,
                        [userId],
                        (err) => {
                            if (err) {
                                console.error(`Error assigning role: ${err.message}`);
                                return res.status(500).send(`Error assigning default role: ${err.message}`);
                            }
                            res.status(201).json(result.rows[0]);
                        }
                    );
                }
            );
        });
    });
});

router.post('/login', validate(loginSchema), (req, res) => {
    const { username, password } = req.body;
    console.log(`Login attempt for user: ${username}`);
    pool.query('SELECT * FROM users WHERE username = $1', [username], (err, result) => {
        if (err) {
            console.error(`Error querying user: ${err.message}`);
            return res.status(500).send('Error querying user');
        }
        if (result.rowCount === 0) return res.status(400).send('Invalid credentials');
        const user = result.rows[0];
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                console.error(`Error comparing password: ${err.message}`);
                return res.status(500).send(`Error comparing password: ${err.message}`);
            }
            console.log(`Password comparison for ${username}: ${isMatch}`);
            if (!isMatch) return res.status(400).send('Invalid credentials');
            const accessToken = jwt.sign({ id: user.id, username: user.username }, secretKey, { expiresIn: '1h' });
            const refreshToken = crypto.randomBytes(64).toString('hex');
            pool.query(
                'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL \'7 days\')',
                [user.id, refreshToken],
                (err) => {
                    if (err) {
                        console.error(`Error storing refresh token: ${err.message}`);
                        return res.status(500).send(`Error storing refresh token: ${err.message}`);
                    }
                    console.log(`Login successful for ${username}. Access token generated.`);
                    res.json({ accessToken, refreshToken });
                }
            );
        });
    });
});

router.post('/refresh', validate(refreshSchema), (req, res) => {
    const { refresh_token } = req.body;
    pool.query(
        'SELECT user_id FROM refresh_tokens WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP',
        [refresh_token],
        (err, result) => {
            if (err || result.rowCount === 0) return res.status(403).send('Invalid or expired refresh token.');
            const userId = result.rows[0].user_id;
            pool.query('SELECT username FROM users WHERE id = $1', [userId], (err, userResult) => {
                if (err || userResult.rowCount === 0) return res.status(500).send('User not found.');
                const username = userResult.rows[0].username;
                const accessToken = jwt.sign({ id: userId, username }, secretKey, { expiresIn: '1h' });
                res.json({ accessToken });
            });
        }
    );
});

module.exports = router;