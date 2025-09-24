///var/www/movethatstuff/backend/logger.js//
const winston = require('winston');
const moment = require('moment-timezone');

// Configure Winston logger with CST timestamps
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: () => moment().tz('America/Chicago').format('YYYY-MM-DD HH:mm:ss')
        }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.simple()
        }),
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

module.exports = logger;