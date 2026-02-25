// backend/config/redis.js
const Redis = require('ioredis');
const dotenv = require('dotenv');

dotenv.config();

let redis = null;

const initRedis = () => {
    if (!process.env.REDIS_URL) {
        console.warn('⚠️  REDIS_URL is not defined in environment variables. Falling back to local/dummy mode.');
        // For development if Redis is not available, we could return a mock
        // but for now, we'll try to connect to localhost or just let it fail
        redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    } else {
        // Upstash Redis URL usually looks like rediss://default:password@host:port
        redis = new Redis(process.env.REDIS_URL, {
            maxRetriesPerRequest: null // Required for BullMQ
        });
    }

    redis.on('connect', () => console.log('✅ Redis Connected'));
    redis.on('error', (err) => console.error('❌ Redis Connection Error:', err));

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
    const isUpstash = process.env.REDIS_URL && (
        process.env.REDIS_URL.startsWith('rediss://') ||
        process.env.REDIS_URL.includes('upstash')
    );

    const options = { maxRetriesPerRequest: null };
    if (isUpstash) {
        options.tls = { rejectUnauthorized: false };
    }

    return new Redis(process.env.REDIS_URL || 'redis://localhost:6379', options);
};

module.exports = {
    initRedis,
    getRedis,
    getNewRedisClient
};
