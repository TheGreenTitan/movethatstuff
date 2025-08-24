const { Pool } = require('pg');

const pool = new Pool({
    user: 'patrick',
    host: 'localhost',
    database: 'movethatstuff',
    password: '455454',
    port: 5432
});

module.exports = pool;
