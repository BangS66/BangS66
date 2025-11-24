const winston = require('winston');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// Tentukan path untuk file log di dalam direktori data pengguna aplikasi
const logDir = path.join(app.getPath('userData'), 'logs');

// Buat direktori jika belum ada
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logFile = path.join(logDir, 'app.log');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'user-service' },
  transports: [
    //
    // - Tulis semua log dengan level `info` dan di bawahnya ke `app.log`
    // - Tulis semua log dengan level `error` dan di bawahnya ke `app.log`
    //
    new winston.transports.File({ filename: logFile, level: 'info' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

module.exports = logger;
