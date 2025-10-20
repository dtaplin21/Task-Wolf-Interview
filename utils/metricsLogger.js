const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'ai-metrics.log');

function ensureLogDirectory() {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
}

function appendLog(entry) {
    ensureLogDirectory();
    const serialized = JSON.stringify(entry);
    fs.appendFile(LOG_FILE, serialized + '\n', (err) => {
        if (err) {
            console.error('[AI METRICS] Failed to write log entry', err);
        }
    });
}

function createMetricEntry(type, payload) {
    return {
        timestamp: new Date().toISOString(),
        type,
        ...payload
    };
}

function logMetric(type, payload) {
    const entry = createMetricEntry(type, payload);
    console.log(`[AI METRICS] ${JSON.stringify(entry)}`);
    appendLog(entry);
}

function logAIRequest({ requestId, provider, model, operation, inputCount, metadata }) {
    logMetric('ai-request', {
        requestId,
        provider,
        model,
        operation,
        inputCount,
        metadata: metadata || {}
    });
}

function logAIResponse({ requestId, provider, model, operation, latencyMs, status, outputCount }) {
    logMetric('ai-response', {
        requestId,
        provider,
        model,
        operation,
        latencyMs,
        status,
        outputCount
    });
}

function logAIError({ requestId, provider, model, operation, latencyMs, error }) {
    logMetric('ai-error', {
        requestId,
        provider,
        model,
        operation,
        latencyMs,
        error: {
            message: error.message,
            stack: error.stack
        }
    });
}

function logSystemEvent(event, details) {
    logMetric('system-event', {
        event,
        details: details || {}
    });
}

function logSystemError(event, errorDetails) {
    logMetric('system-error', {
        event,
        error: errorDetails
    });
}

module.exports = {
    logAIRequest,
    logAIResponse,
    logAIError,
    logSystemEvent,
    logSystemError
};
