const jwt = require('jsonwebtoken');

// JWT Configuration (Access: 15min, Refresh: 7 days)
const jwtConfig = {
    accessTokenSecret: process.env.JWT_ACCESS_SECRET || 'alphalearn_access_secret_2026',
    refreshTokenSecret: process.env.JWT_REFRESH_SECRET || 'alphalearn_refresh_secret_2026',
    accessTokenExpiry: '15m', // 15 minutes
    refreshTokenExpiry: '7d', // 7 days
    issuer: 'alphalearn',
    audience: 'alphalearn-users'
};

// Generate Access Token
const generateAccessToken = (payload) => {
    return jwt.sign(
        {
            userId: payload.userId,
            email: payload.email,
            role: payload.role,
            batchId: payload.batchId || null
        },
        jwtConfig.accessTokenSecret,
        {
            expiresIn: jwtConfig.accessTokenExpiry,
            issuer: jwtConfig.issuer,
            audience: jwtConfig.audience
        }
    );
};

// Generate Refresh Token
const generateRefreshToken = (payload) => {
    return jwt.sign(
        {
            userId: payload.userId,
            email: payload.email,
            tokenVersion: payload.tokenVersion || Date.now()
        },
        jwtConfig.refreshTokenSecret,
        {
            expiresIn: jwtConfig.refreshTokenExpiry,
            issuer: jwtConfig.issuer,
            audience: jwtConfig.audience
        }
    );
};

// Verify Access Token
const verifyAccessToken = (token) => {
    try {
        return jwt.verify(token, jwtConfig.accessTokenSecret, {
            issuer: jwtConfig.issuer,
            audience: jwtConfig.audience
        });
    } catch (error) {
        throw new Error('Invalid or expired access token');
    }
};

// Verify Refresh Token
const verifyRefreshToken = (token) => {
    try {
        return jwt.verify(token, jwtConfig.refreshTokenSecret, {
            issuer: jwtConfig.issuer,
            audience: jwtConfig.audience
        });
    } catch (error) {
        throw new Error('Invalid or expired refresh token');
    }
};

// Generate Token Pair (Access + Refresh)
const generateTokenPair = (payload) => {
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return {
        accessToken,
        refreshToken,
        accessTokenExpiry: 15 * 60 * 1000, // 15 minutes in ms
        refreshTokenExpiry: 7 * 24 * 60 * 60 * 1000 // 7 days in ms
    };
};

module.exports = {
    jwtConfig,
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    generateTokenPair
};
