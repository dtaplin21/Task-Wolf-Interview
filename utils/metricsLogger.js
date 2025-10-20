// Metrics Logger for system events and error tracking
class MetricsLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 1000;
        this.logLevels = {
            ERROR: 'error',
            WARN: 'warn',
            INFO: 'info',
            DEBUG: 'debug'
        };
    }

    /**
     * Log a system event
     * @param {string} event - Event name
     * @param {Object} data - Event data
     * @param {string} level - Log level
     */
    logSystemEvent(event, data = {}, level = this.logLevels.INFO) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'system_event',
            event,
            level,
            data: this.sanitizeData(data),
            id: this.generateLogId()
        };

        this.addLog(logEntry);
        console.log(`[${level.toUpperCase()}] ${event}:`, data);
    }

    /**
     * Log a system error
     * @param {string} error - Error identifier
     * @param {Object} data - Error data
     */
    logSystemError(error, data = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'system_error',
            error,
            level: this.logLevels.ERROR,
            data: this.sanitizeData(data),
            id: this.generateLogId()
        };

        this.addLog(logEntry);
        console.error(`[ERROR] ${error}:`, data);
    }

    /**
     * Log API request
     * @param {string} method - HTTP method
     * @param {string} path - Request path
     * @param {number} statusCode - Response status code
     * @param {number} duration - Request duration in ms
     * @param {Object} metadata - Additional metadata
     */
    logApiRequest(method, path, statusCode, duration, metadata = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'api_request',
            method,
            path,
            statusCode,
            duration,
            level: this.getLogLevelForStatusCode(statusCode),
            data: this.sanitizeData(metadata),
            id: this.generateLogId()
        };

        this.addLog(logEntry);
        console.log(`[API] ${method} ${path} - ${statusCode} (${duration}ms)`);
    }

    /**
     * Log user action
     * @param {string} action - User action
     * @param {Object} data - Action data
     */
    logUserAction(action, data = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'user_action',
            action,
            level: this.logLevels.INFO,
            data: this.sanitizeData(data),
            id: this.generateLogId()
        };

        this.addLog(logEntry);
        console.log(`[USER] ${action}:`, data);
    }

    /**
     * Log performance metric
     * @param {string} metric - Metric name
     * @param {number} value - Metric value
     * @param {string} unit - Metric unit
     * @param {Object} metadata - Additional metadata
     */
    logPerformanceMetric(metric, value, unit = 'ms', metadata = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'performance_metric',
            metric,
            value,
            unit,
            level: this.logLevels.INFO,
            data: this.sanitizeData(metadata),
            id: this.generateLogId()
        };

        this.addLog(logEntry);
        console.log(`[PERF] ${metric}: ${value}${unit}`);
    }

    /**
     * Add log entry to internal storage
     * @param {Object} logEntry - Log entry
     */
    addLog(logEntry) {
        this.logs.unshift(logEntry);
        
        // Keep only recent logs
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(0, this.maxLogs);
        }
    }

    /**
     * Get logs with optional filtering
     * @param {Object} filters - Filter options
     * @returns {Array} Filtered logs
     */
    getLogs(filters = {}) {
        let filteredLogs = [...this.logs];

        if (filters.type) {
            filteredLogs = filteredLogs.filter(log => log.type === filters.type);
        }

        if (filters.level) {
            filteredLogs = filteredLogs.filter(log => log.level === filters.level);
        }

        if (filters.since) {
            const sinceDate = new Date(filters.since);
            filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= sinceDate);
        }

        if (filters.limit) {
            filteredLogs = filteredLogs.slice(0, filters.limit);
        }

        return filteredLogs;
    }

    /**
     * Get log statistics
     * @returns {Object} Log statistics
     */
    getStats() {
        const stats = {
            totalLogs: this.logs.length,
            byType: {},
            byLevel: {},
            recentErrors: 0,
            oldestLog: null,
            newestLog: null
        };

        if (this.logs.length === 0) {
            return stats;
        }

        // Calculate statistics
        this.logs.forEach(log => {
            stats.byType[log.type] = (stats.byType[log.type] || 0) + 1;
            stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
            
            if (log.level === this.logLevels.ERROR) {
                const logTime = new Date(log.timestamp);
                const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
                if (logTime >= oneHourAgo) {
                    stats.recentErrors++;
                }
            }
        });

        stats.oldestLog = this.logs[this.logs.length - 1]?.timestamp;
        stats.newestLog = this.logs[0]?.timestamp;

        return stats;
    }

    /**
     * Clear old logs
     * @param {number} maxAge - Maximum age in milliseconds
     */
    clearOldLogs(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
        const cutoff = new Date(Date.now() - maxAge);
        this.logs = this.logs.filter(log => new Date(log.timestamp) >= cutoff);
    }

    /**
     * Sanitize data to remove sensitive information
     * @param {Object} data - Data to sanitize
     * @returns {Object} Sanitized data
     */
    sanitizeData(data) {
        if (!data || typeof data !== 'object') {
            return data;
        }

        const sanitized = { ...data };
        const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth'];

        Object.keys(sanitized).forEach(key => {
            if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
                sanitized[key] = '[REDACTED]';
            }
        });

        return sanitized;
    }

    /**
     * Get log level for HTTP status code
     * @param {number} statusCode - HTTP status code
     * @returns {string} Log level
     */
    getLogLevelForStatusCode(statusCode) {
        if (statusCode >= 500) {
            return this.logLevels.ERROR;
        } else if (statusCode >= 400) {
            return this.logLevels.WARN;
        } else {
            return this.logLevels.INFO;
        }
    }

    /**
     * Generate unique log ID
     * @returns {string} Log ID
     */
    generateLogId() {
        return `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Export logs to JSON
     * @returns {string} JSON string of logs
     */
    exportLogs() {
        return JSON.stringify(this.logs, null, 2);
    }

    /**
     * Import logs from JSON
     * @param {string} jsonString - JSON string of logs
     */
    importLogs(jsonString) {
        try {
            const importedLogs = JSON.parse(jsonString);
            if (Array.isArray(importedLogs)) {
                this.logs = importedLogs;
            }
        } catch (error) {
            console.error('Failed to import logs:', error.message);
        }
    }
}

// Create singleton instance
const metricsLogger = new MetricsLogger();

module.exports = metricsLogger;