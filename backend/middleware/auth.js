const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

        // Get user to check if active
        const user = await User.findById(decoded.userId);

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
        // If the token version in the payload is different from the user's current version,
        // it means a new login (or logout) occurred, invalidating this token.
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
            batchId: user.batchId
        };

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

            // Get user
            const user = await User.findById(decoded.userId);

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
        const userId = req.user.userId;

        const user = await User.findById(userId);

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
