const crypto = require('crypto');

// Generate device fingerprint from request
const generateFingerprint = (req) => {
    const userAgent = req.headers['user-agent'] || '';
    const acceptLanguage = req.headers['accept-language'] || '';
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const ip = req.ip || req.connection.remoteAddress || '';

    const fingerprintString = `${userAgent}${acceptLanguage}${acceptEncoding}${ip}`;

    return crypto
        .createHash('sha256')
        .update(fingerprintString)
        .digest('hex');
};

// Compare fingerprints
const compareFingerprints = (fingerprint1, fingerprint2) => {
    return fingerprint1 === fingerprint2;
};

// Generate session ID
const generateSessionId = () => {
    return crypto.randomBytes(32).toString('hex');
};

module.exports = {
    generateFingerprint,
    compareFingerprints,
    generateSessionId
};
