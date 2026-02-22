const { body, param, query, validationResult } = require('express-validator');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
};

// User validation rules
const validateUserCreation = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('role').isIn(['admin', 'instructor', 'student']).withMessage('Invalid role'),
    body('phone').optional().isMobilePhone().withMessage('Valid phone number required'),
    handleValidationErrors
];

const validateLogin = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    handleValidationErrors
];

const validatePasswordChange = [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
    handleValidationErrors
];

const validatePasswordReset = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    handleValidationErrors
];

const validateOTP = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Valid 6-digit OTP is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
    handleValidationErrors
];

// Batch validation rules
const validateBatchCreation = [
    body('name').trim().notEmpty().withMessage('Batch name is required'),
    body('startDate').isISO8601().withMessage('Valid start date is required'),
    body('endDate').isISO8601().withMessage('Valid end date is required'),
    body('description').optional().trim(),
    handleValidationErrors
];

// Problem validation rules
const validateProblemCreation = [
    body('title').trim().notEmpty().withMessage('Problem title is required'),
    body('difficulty').isIn(['Easy', 'Medium', 'Hard']).withMessage('Invalid difficulty'),
    body('description').trim().notEmpty().withMessage('Problem description is required'),
    body('testCases').isArray({ min: 1 }).withMessage('At least one test case is required'),
    handleValidationErrors
];

// Submission validation rules
const validateSubmission = [
    body('problemId').notEmpty().withMessage('Problem ID is required'),
    body('code').trim().notEmpty().withMessage('Code is required'),
    body('language').isIn(['c', 'cpp', 'java', 'python', 'javascript', 'csharp']).withMessage('Invalid language'),
    handleValidationErrors
];

// Contest validation rules
const validateContestCreation = [
    body('title').trim().notEmpty().withMessage('Contest title is required'),
    body('startTime').isISO8601().withMessage('Valid start time is required'),
    body('endTime').isISO8601().withMessage('Valid end time is required'),
    body('problems').isArray({ min: 1 }).withMessage('At least one problem is required'),
    body('batchId').optional({ nullable: true }),
    handleValidationErrors
];

// External profile validation rules
const validateExternalProfile = [
    body('platform').isIn(['leetcode', 'codechef', 'codeforces', 'hackerrank', 'interviewbit']).withMessage('Invalid platform'),
    body('username').trim().notEmpty().withMessage('Username is required'),
    handleValidationErrors
];

// Profile update validation rules
const validateProfileUpdate = [
    body('phone').optional({ nullable: true, checkFalsy: true }).isMobilePhone().withMessage('Valid phone number required'),
    body('whatsapp').optional({ nullable: true, checkFalsy: true }).isMobilePhone().withMessage('Valid WhatsApp number required'),
    body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('aboutMe').optional().isLength({ max: 250 }).withMessage('About me must be less than 250 characters'),
    handleValidationErrors
];

// ID or Slug parameter validation
const validateObjectId = (paramName = 'id') => [
    param(paramName).custom((value) => {
        if (value === 'all' || value === 'global') return true;
        if (/^[0-9a-fA-F]{24}$/.test(value)) return true;

        // Allow slugs only for contestId and problemId
        if ((paramName === 'contestId' || paramName === 'problemId') && /^[a-z0-9-]+$/.test(value)) {
            return true;
        }

        throw new Error('Invalid format');
    }),
    handleValidationErrors
];

// Query validation
const validatePagination = [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    handleValidationErrors
];

const validateFilterQuery = [
    query('difficulty').optional().isIn(['Easy', 'Medium', 'Hard']).withMessage('Invalid difficulty'),
    query('timeline').optional().isIn(['week', 'month', 'year', 'all']).withMessage('Invalid timeline'),
    handleValidationErrors
];

// File upload validation
const validateFileUpload = (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: 'File is required'
        });
    }

    const allowedTypes = ['text/csv', 'application/json'];
    if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid file type. Only CSV and JSON files are allowed.'
        });
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (req.file.size > maxSize) {
        return res.status(400).json({
            success: false,
            message: 'File size exceeds 5MB limit'
        });
    }

    next();
};
const validateProfileCompletion = [
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('newPassword')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/)
        .withMessage('Password must contain uppercase, lowercase, number, and special character'),
    body('phone').optional({ nullable: true, checkFalsy: true }).isMobilePhone().withMessage('Invalid phone number'),
    body('whatsapp').optional({ nullable: true, checkFalsy: true }).isMobilePhone().withMessage('Invalid WhatsApp number'),
    handleValidationErrors
];


module.exports = {
    handleValidationErrors,
    validateUserCreation,
    validateLogin,
    validatePasswordChange,
    validatePasswordReset,
    validateOTP,
    validateBatchCreation,
    validateProblemCreation,
    validateSubmission,
    validateContestCreation,
    validateExternalProfile,
    validateProfileUpdate,
    validateObjectId,
    validatePagination,
    validateFilterQuery,
    validateFileUpload,
    validateProfileCompletion
};
