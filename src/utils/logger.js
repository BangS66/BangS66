const winston = require('winston');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let logger;

function initializeLogger() {
    if (logger) return;

    try {
        const logDir = path.join(app.getPath('userData'), 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        const logFile = path.join(logDir, 'app.log');

        logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.errors({ stack: true }),
                winston.format.splat(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: logFile }),
            ]
        });

        // Log ke konsol juga untuk development
        logger.add(new winston.transports.Console({
            format: winston.format.simple(),
        }));

        console.log(`Logger initialized. Logging to: ${logFile}`);
    } catch (error) {
        console.error("Failed to initialize logger:", error);
    }
}

// Ekspor proxy yang akan menunjuk ke logger setelah diinisialisasi
const loggerProxy = new Proxy({}, {
    get(target, property) {
        if (!logger) {
           // Fallback ke konsol jika logger belum siap
           return console[property] || (() => {});
        }
        return logger[property];
    }
});

module.exports = { initializeLogger, logger: loggerProxy };
