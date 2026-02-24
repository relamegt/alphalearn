const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedis } = require('../config/redis');

// BUG #14 FIX: All rate limiters now use Redis-backed stores.
// Previously, loginLimiter, otpLimiter, codeExecutionLimiter, profileSyncLimiter,
// fileUploadLimiter, and reportLimiter all used in-memory stores that are per-server-instance.
// With horizontal scaling (multiple Node.js instances), a user could bypass any of these limits
// by hitting different instances. Redis-backed stores enforce limits globally.
//
// RedisStore uses sendCommand to avoid depending on a specific Redis client version.
// Falls back transparently to in-memory if Redis is unavailable (non-fatal).

const makeStore = (prefix) => {
    try {
        return new RedisStore({
            sendCommand: (...args) => getRedis().call(...args),
            prefix: `rl:${prefix}:`
        });
    } catch (e) {
        console.warn(`[RateLimiter] Redis store unavailable for '${prefix}', using in-memory fallback.`);
        return undefined; // express-rate-limit defaults to in-memory
    }
};

// Login rate limiter: 5 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: {
        success: false,
        message: 'Too many login attempts. Please try again after 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    store: makeStore('login')
});

// OTP rate limiter: 3 attempts per 10 minutes per IP
// BUG #15 fix is handled inside authController.forgotPassword via Redis NX check.
// This limiter adds a distributed Redis-backed IP limit as a second layer of defence.
const otpLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 3, // 3 requests per window
    message: {
        success: false,
        message: 'Too many OTP requests. Please try again after 10 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: makeStore('otp')
});

// API rate limiter: 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: {
        success: false,
        message: 'Too many API requests. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: makeStore('api')
});

// Code execution rate limiter: 20 submissions per 5 minutes per user
const codeExecutionLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // 20 submissions per window
    message: {
        success: false,
        message: 'Too many code submissions. Please wait before submitting again.'
    },
    keyGenerator: (req) => {
        return req.user?.userId || req.ip;
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: makeStore('code')
});

// Profile sync rate limiter: 1 request per 7 days per user (manual sync)
const profileSyncLimiter = rateLimit({
    windowMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    max: 1, // 1 request per week
    message: {
        success: false,
        message: 'Manual sync allowed once per week. Please wait before syncing again.'
    },
    keyGenerator: (req) => {
        return req.user?.userId || req.ip;
    },
    skip: (req, res) => {
        // Skip limit in development mode
        return !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipFailedRequests: true,
    store: makeStore('sync')
});

// File upload rate limiter: 10 uploads per hour
const fileUploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: {
        success: false,
        message: 'Too many file uploads. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: makeStore('upload')
});

// Report generation rate limiter: 5 reports per hour
const reportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: {
        success: false,
        message: 'Too many report generation requests. Please try again later.'
    },
    keyGenerator: (req) => {
        return req.user?.userId || req.ip;
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: makeStore('report')
});

module.exports = {
    loginLimiter,
    otpLimiter,
    apiLimiter,
    codeExecutionLimiter,
    profileSyncLimiter,
    fileUploadLimiter,
    reportLimiter
};
