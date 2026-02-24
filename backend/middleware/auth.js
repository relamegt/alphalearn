const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getRedis } = require('../config/redis');

const USER_AUTH_CACHE_TTL = 60; // seconds — brief enough to catch deactivation quickly
const getUserAuthCacheKey = (userId) => `user:auth:${userId}`;

// Verify JWT Access Token
const verifyToken = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access token is missing or invalid'
            });
        }

        const token = authHeader.split(' ')[1];

        // Verify token using JWT
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

        // Fix #11: Check Redis cache before hitting DB on every request
        const redis = getRedis();
        const cacheKey = getUserAuthCacheKey(decoded.userId);
        let user;

        try {
            const cached = await redis.get(cacheKey);
            if (cached) {
                user = JSON.parse(cached);
            }
        } catch (cacheErr) {
            console.warn('[Auth] Redis cache miss (non-fatal):', cacheErr.message);
        }

        if (!user) {
            // Cache miss — fetch from DB and populate cache
            user = await User.findById(decoded.userId);
            if (user) {
                try {
                    // Cache only the fields needed for auth validation
                    const cachePayload = JSON.stringify({
                        _id: user._id,
                        isActive: user.isActive,
                        tokenVersion: user.tokenVersion,
                        batchId: user.batchId,
                        role: user.role,
                        isFirstLogin: user.isFirstLogin,
                        profileCompleted: user.profileCompleted
                    });
                    await redis.setex(cacheKey, USER_AUTH_CACHE_TTL, cachePayload);
                } catch (cacheErr) {
                    console.warn('[Auth] Redis cache write error (non-fatal):', cacheErr.message);
                }
            }
        }

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been deactivated. Please contact admin.'
            });
        }


        // SINGLE SESSION ENFORCEMENT: Verify Token Version
        if (decoded.tokenVersion !== undefined && user.tokenVersion !== decoded.tokenVersion) {
            return res.status(401).json({
                success: false,
                message: 'Session expired. Please login again.',
                code: 'SESSION_REPLACED'
            });
        }

        // Backward compatibility: If user has a version > 0 but token has none, invalidate
        if ((user.tokenVersion > 0) && decoded.tokenVersion === undefined) {
            return res.status(401).json({
                success: false,
                message: 'Session expired (Legacy). Please login again.',
                code: 'SESSION_REPLACED'
            });
        }

        // Attach user info to request
        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role,
            batchId: user.batchId,
            isSpotUser: decoded.isSpotUser || false
        };
        // Fix #12: Attach cached user object so requireProfileCompletion avoids a second DB call
        req.cachedAuthUser = user;

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Access token expired. Please refresh your token.',
                code: 'TOKEN_EXPIRED'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid access token',
                code: 'INVALID_TOKEN'
            });
        }

        return res.status(401).json({
            success: false,
            message: 'Authentication failed',
            error: error.message
        });
    }
};

// Optional authentication (doesn't fail if token is missing)
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

            // BUG #4 FIX: Apply the same Redis cache pattern as verifyToken.
            // Previously, optionalAuth did a raw DB lookup on every public request.
            // Under a public contest with 1,000 spot users, this causes 1,000 needless
            // DB reads per cycle. Now it reads from Redis cache (60s TTL) first.
            const redis = getRedis();
            const cacheKey = getUserAuthCacheKey(decoded.userId);
            let user = null;

            try {
                const cached = await redis.get(cacheKey);
                if (cached) {
                    user = JSON.parse(cached);
                }
            } catch (cacheErr) { /* non-fatal – fall through to DB */ }

            if (!user) {
                user = await User.findById(decoded.userId);
                if (user) {
                    try {
                        const cachePayload = JSON.stringify({
                            _id: user._id,
                            isActive: user.isActive,
                            tokenVersion: user.tokenVersion,
                            batchId: user.batchId,
                            role: user.role,
                            isFirstLogin: user.isFirstLogin,
                            profileCompleted: user.profileCompleted
                        });
                        await redis.setex(cacheKey, USER_AUTH_CACHE_TTL, cachePayload);
                    } catch (cacheErr) { /* non-fatal */ }
                }
            }

            if (user && user.isActive) {
                req.user = {
                    userId: decoded.userId,
                    email: decoded.email,
                    role: decoded.role,
                    batchId: user.batchId
                };
            }
        }

        next();
    } catch (error) {
        // Continue without authentication
        next();
    }
};


// Middleware to block access if first login is not completed
const requireProfileCompletion = async (req, res, next) => {
    try {
        // Admins, instructors, and spot users do not require profile completion checks
        if (req.user.role === 'admin' || req.user.role === 'instructor' || req.user.isSpotUser) {
            return next();
        }

        // Fix #12: reuse the user object already fetched by verifyToken (attached to req.cachedAuthUser)
        // Avoids a second DB call on every authenticated route that uses both middlewares.
        const user = req.cachedAuthUser || await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user needs to complete profile
        if (user.isFirstLogin === true || user.profileCompleted === false) {
            return res.status(403).json({
                success: false,
                message: 'Please complete your profile first',
                code: 'PROFILE_INCOMPLETE',
                redirectTo: '/complete-profile'
            });
        }

        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Profile verification failed',
            error: error.message
        });
    }
};

// Middleware to allow only first-time users (for profile completion endpoint)
const requireFirstLogin = async (req, res, next) => {
    try {
        const userId = req.user.userId;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Only allow if it's first login
        if (user.isFirstLogin !== true) {
            return res.status(400).json({
                success: false,
                message: 'Profile already completed'
            });
        }

        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Verification failed',
            error: error.message
        });
    }
};

module.exports = {
    verifyToken,
    optionalAuth,
    requireProfileCompletion,
    requireFirstLogin
};
