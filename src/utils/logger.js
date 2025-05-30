const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'aegisum-tipbot' },
    transports: [
        // Write all logs with level 'error' and below to error.log
        new winston.transports.File({ 
            filename: path.join(logsDir, 'error.log'), 
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // Write all logs with level 'info' and below to combined.log
        new winston.transports.File({ 
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});

// If we're not in production, log to the console with a simple format
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

// Create specialized loggers for different components
const createComponentLogger = (component) => {
    return {
        info: (message, meta = {}) => logger.info(message, { component, ...meta }),
        warn: (message, meta = {}) => logger.warn(message, { component, ...meta }),
        error: (message, meta = {}) => logger.error(message, { component, ...meta }),
        debug: (message, meta = {}) => logger.debug(message, { component, ...meta })
    };
};

module.exports = logger;
module.exports.createComponentLogger = createComponentLogger;