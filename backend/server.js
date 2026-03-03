// backend/server.js (Complete with WebSocket Integration)
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { connectDB, testConnection, createIndexes } = require('./config/astra');
const { verifyEmailConfig } = require('./config/nodemailer');
const { errorHandler, notFoundHandler } = require('./utils/errorHandler');
const { startBatchExpiryJob } = require('./cron/batchExpiry');
const { startProfileSyncJob } = require('./cron/profileSync');
const { initWebSocket } = require('./config/websocket');

// Load environment variables
dotenv.config();

// Remove unnecessary console logs in production
if (process.env.NODE_ENV === 'production') {
    console.log = () => { };
    console.info = () => { };
    console.debug = () => { };
}

// Initialize Express app
const app = express();

const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedis } = require('./config/redis');

// Enable Gzip compression
app.use(compression());

// Create HTTP server
const server = http.createServer(app);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Allow WebSocket connections
    crossOriginEmbedderPolicy: false
}));

// Rate limiting — backed by Redis so limits hold across multiple server instances.
// Each limiter gets its own unique prefix to prevent key collisions in Redis.
// ERR_ERL_DOUBLE_COUNT: routes like /api/auth match BOTH /api and /api/auth limiters.
// Using unique prefixes means they write to separate Redis keys and don't conflict.
const buildRateLimitStore = (prefix) => {
    try {
        const redis = getRedis();
        return new RedisStore({
            sendCommand: (...args) => redis.call(...args),
            prefix  // unique prefix per limiter prevents key collision
        });
    } catch (e) {
        console.warn('[RateLimit] Redis store init failed, using in-memory store:', e.message);
        return undefined; // express-rate-limit defaults to MemoryStore
    }
};

// General API limiter — skips /api/auth/* so only the stricter authLimiter applies there.
// This avoids ERR_ERL_DOUBLE_COUNT from express-rate-limit v7's double-count detection.
// MED-3 FIX: Raised from 500 to 2000 req/15min. During contests, students behind a shared
// college NAT/proxy were hitting the old limit (all on the same IP). 10 students × 50 req/min
// each = 500 total/IP/15min — dangerously close to the old cap with normal contest usage.
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10000, // Raised to 10000 per 15 min to accommodate large schools/colleges
    standardHeaders: true,
    legacyHeaders: false,
    store: buildRateLimitStore('rl:api:'),
    skip: (req) => {
        // Skip in development or for specific paths
        return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV || req.path.startsWith('/auth');
    },
    message: { success: false, message: 'Too many requests, please try again later.' }
});

// Auth-specific limiter — stricter limits for login/register/forgot-password
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500, // Raised to 500 per 15 min to accommodate multiple students logging in from same college Wi-Fi
    standardHeaders: true,
    legacyHeaders: false,
    store: buildRateLimitStore('rl:auth:'),
    skip: (req) => {
        return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
    },
    message: { success: false, message: 'Too many login attempts, please try again in 15 minutes.' }
});

// Apply rate limiting
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);

// Body parser middleware (Moved earlier to support potential body-based rate limit keys)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS configuration (whitelist frontend)
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Trust proxy (for rate limiting with correct IPs)
app.set('trust proxy', 1);

// Health check route
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'AlphaKnowledge API is running',
        timestamp: new Date().toISOString(),
        websocket: 'enabled',
        compression: 'enabled'
    });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/sections', require('./routes/section'));
app.use('/api/problem', require('./routes/problem'));
app.use('/api/student', require('./routes/student'));
app.use('/api/instructor', require('./routes/instructor'));
app.use('/api/contest', require('./routes/contest'));
app.use('/api/reports', require('./routes/report'));
app.use('/api/public', require('./routes/public'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/batches', require('./routes/batch'));
// 404 handler
app.use(notFoundHandler);

// Global error handlerf
app.use(errorHandler);

// Server port
const PORT = process.env.PORT || 5000;

const { initRedis } = require('./config/redis');
const { startScoreWorker } = require('./workers/scoreWorker');
const { startCodeExecutionWorker } = require('./workers/codeExecutionWorker');

// Start server
const startServer = async () => {
    try {
        // 0. Initialize Redis first (needed for Queues & Cache)
        console.warn('🔌 Connecting to Redis (Upstash)...');
        initRedis();

        // 1. Start Background Workers
        console.warn('👷 Starting background workers...');
        startScoreWorker();
        startCodeExecutionWorker();

        // 2. Connect to database
        /* startup log */ console.warn('🔌 Connecting to database...');
        await connectDB();

        // Test connection
        console.warn('🔌 Testing database connection...');
        const dbConnected = await testConnection();

        if (!dbConnected) {
            console.error('❌ Failed to connect to database. Exiting...');
            process.exit(1);
        }

        // Create database indexes
        console.warn('📊 Creating database indexes...');
        await createIndexes();

        // Verify email configuration
        console.warn('📧 Verifying email service...');
        await verifyEmailConfig();

        // Initialize WebSocket Server
        console.warn('🔌 Initializing WebSocket server...');
        initWebSocket(server);

        // Start cron jobs
        if (process.env.ENABLE_CRON_JOBS === 'true') {
            console.warn('⏰ Starting cron jobs...');
            startBatchExpiryJob();
            startProfileSyncJob();
        }

        // Start HTTP server
        server.listen(PORT, () => {
            console.warn('');
            console.warn('✅ ═══════════════════════════════════════════════════');
            console.warn(`✅ AlphaKnowledge API Server is running on port ${PORT}`);
            console.warn(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
            console.warn(`✅ Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
            console.warn(`✅ WebSocket: Enabled on ws://localhost:${PORT}/ws`);
            console.warn('✅ ═══════════════════════════════════════════════════');
            console.warn('');
        });
    } catch (error) {
        console.error('❌ Server startup error:', error);
        process.exit(1);
    }
};

// Graceful shutdown
const shutdown = () => {
    console.log('⚠️ Shutdown signal received: closing HTTP server...');
    server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
        console.error('⚠️ Forcefully shutting down...');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start the server
startServer();

module.exports = app;
