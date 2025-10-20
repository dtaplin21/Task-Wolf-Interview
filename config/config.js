// Configuration module for environment variables and settings
const path = require('path');

class Config {
    constructor() {
        this.loadEnvironmentVariables();
    }

    /**
     * Load environment variables from .env file if it exists
     */
    loadEnvironmentVariables() {
        try {
            // Try to load dotenv if available
            const dotenv = require('dotenv');
            dotenv.config();
        } catch (error) {
            // dotenv not installed, continue without it
            console.log('[Config] dotenv not available, using system environment variables');
        }
    }

    /**
     * Get OpenAI API key from environment or provide fallback
     * @returns {string|null} API key or null if not found
     */
    getOpenAIAPIKey() {
        const apiKey = process.env.OPENAI_API_KEY || 
                      process.env.OPENAI_KEY || 
                      process.env.OPENAI_SECRET_KEY;
        
        if (!apiKey) {
            console.warn('[Config] OpenAI API key not found in environment variables');
            console.warn('[Config] Please set OPENAI_API_KEY environment variable');
            console.warn('[Config] Example: export OPENAI_API_KEY="sk-your-api-key-here"');
            return null;
        }
        
        return apiKey;
    }

    /**
     * Get server port
     * @returns {number} Port number
     */
    getPort() {
        return parseInt(process.env.PORT) || 3000;
    }

    /**
     * Get node environment
     * @returns {string} Environment name
     */
    getNodeEnv() {
        return process.env.NODE_ENV || 'development';
    }

    /**
     * Check if OpenAI is configured
     * @returns {boolean} True if API key is available
     */
    isOpenAIConfigured() {
        return !!this.getOpenAIAPIKey();
    }

    /**
     * Get configuration status
     * @returns {Object} Configuration status
     */
    getStatus() {
        return {
            openaiConfigured: this.isOpenAIConfigured(),
            port: this.getPort(),
            nodeEnv: this.getNodeEnv(),
            hasApiKey: !!this.getOpenAIAPIKey()
        };
    }

    /**
     * Print configuration help
     */
    printHelp() {
        console.log('\n=== OpenAI Configuration Help ===');
        console.log('To use AI features, you need to set your OpenAI API key:');
        console.log('');
        console.log('Option 1 - Environment Variable:');
        console.log('  export OPENAI_API_KEY="sk-your-api-key-here"');
        console.log('');
        console.log('Option 2 - Create .env file:');
        console.log('  echo "OPENAI_API_KEY=sk-your-api-key-here" > .env');
        console.log('');
        console.log('Option 3 - Install dotenv and create .env:');
        console.log('  npm install dotenv');
        console.log('  echo "OPENAI_API_KEY=sk-your-api-key-here" > .env');
        console.log('');
        console.log('Get your API key from: https://platform.openai.com/api-keys');
        console.log('=====================================\n');
    }
}

// Create singleton instance
const config = new Config();

module.exports = config;
