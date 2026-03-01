// backend/config/redis.js
const Redis = require('ioredis');
const dotenv = require('dotenv');

dotenv.config();

let redis = null;

const getRedisOptions = () => {
    const isTls = process.env.REDIS_URL && (
        process.env.REDIS_URL.startsWith('rediss://') ||
        process.env.REDIS_URL.includes('upstash')
    );

    const options = {
        maxRetriesPerRequest: null, // Required for BullMQ
        pingInterval: 10000, // Send application-level PING every 10s to prevent disconnects
        keepAlive: 10000,   // TCP Keep-alive
        // Reconnect silently if the connection drops
        retryStrategy(times) {
            const delay = Math.min(times * 100, 3000);
            return delay;
        }
    };

    if (isTls) {
        options.tls = { rejectUnauthorized: false };
    }

    return options;
};

const initRedis = () => {
    if (!process.env.REDIS_URL) {
        console.warn('⚠️  REDIS_URL is not defined in environment variables. Falling back to local/dummy mode.');
        redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', getRedisOptions());
    } else {
        redis = new Redis(process.env.REDIS_URL, getRedisOptions());
    }

    // Attempt to silently reconnect on error if needed:
    redis.on('connect', () => console.log('✅ Redis Connected'));
    redis.on('error', (err) => {
        // Prevent ECONNRESET spam from crashing or polluting the console terribly
        if (err.code === 'ECONNRESET') {
            console.warn('⚠️  Redis connection dropped (ECONNRESET). Auto-reconnecting...');
        } else {
            console.error('❌ Redis Connection Error:', err.message);
        }
    });

    return redis;
};

const getRedis = () => {
    if (!redis) return initRedis();
    return redis;
};

const getNewRedisClient = () => {
    // LOW-2 FIX: Previously this skipped the TLS/socket options that initRedis sets.
    // For Upstash (and other Redis-over-TLS providers), omitting TLS causes silent
    // connection failures on the subscriber (WebSocket pub/sub) and BullMQ clients.
    // Fix: Build the options object the same way initRedis does.
    return new Redis(process.env.REDIS_URL || 'redis://localhost:6379', getRedisOptions());
};

module.exports = {
    initRedis,
    getRedis,
    getNewRedisClient
};
