// Role-based access control middleware

// Check if user has required role
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
            });
        }

        next();
    };
};

// Admin only
const adminOnly = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }
    next();
};

// Instructor or Admin
const instructorOrAdmin = (req, res, next) => {
    if (!req.user || !['admin', 'instructor'].includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: 'Instructor or Admin access required'
        });
    }
    next();
};

// Student only
const studentOnly = (req, res, next) => {
    if (!req.user || req.user.role !== 'student') {
        return res.status(403).json({
            success: false,
            message: 'Student access required'
        });
    }
    next();
};

// Check if user is in a batch (students only)
const requireBatch = (req, res, next) => {
    if (!req.user.batchId) {
        return res.status(403).json({
            success: false,
            message: 'You must be assigned to a batch to access this resource'
        });
    }
    next();
};

// Check if user owns the resource
const checkOwnership = (userIdField = 'userId') => {
    return (req, res, next) => {
        const resourceUserId = req.params[userIdField] || req.body[userIdField];

        if (req.user.role === 'admin' || req.user.role === 'instructor') {
            // Admins and instructors can access any resource
            return next();
        }

        if (req.user.userId !== resourceUserId) {
            return res.status(403).json({
                success: false,
                message: 'You can only access your own resources'
            });
        }

        next();
    };
};

module.exports = {
    requireRole,
    adminOnly,
    instructorOrAdmin,
    studentOnly,
    requireBatch,
    checkOwnership
};
