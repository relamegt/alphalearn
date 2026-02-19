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

// Initialize Express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Allow WebSocket connections
    crossOriginEmbedderPolicy: false
}));

// CORS configuration (whitelist frontend)
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
        message: 'AlphaLearn API is running',
        timestamp: new Date().toISOString(),
        websocket: 'enabled'
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

// Start server
const startServer = async () => {
    try {
        // Connect to database
        console.log('🔌 Connecting to database...');
        await connectDB();

        // Test connection
        console.log('🔌 Testing database connection...');
        const dbConnected = await testConnection();

        if (!dbConnected) {
            console.error('❌ Failed to connect to database. Exiting...');
            process.exit(1);
        }

        // Create database indexes
        console.log('📊 Creating database indexes...');
        await createIndexes();

        // Verify email configuration
        console.log('📧 Verifying email service...');
        await verifyEmailConfig();

        // Initialize WebSocket Server
        console.log('🔌 Initializing WebSocket server...');
        initWebSocket(server);

        // Start cron jobs
        if (process.env.ENABLE_CRON_JOBS === 'true') {
            console.log('⏰ Starting cron jobs...');
            startBatchExpiryJob();
            startProfileSyncJob();
        }

        // Start HTTP server
        server.listen(PORT, () => {
            console.log('');
            console.log('✅ ═══════════════════════════════════════════════════');
            console.log(`✅ AlphaLearn API Server is running on port ${PORT}`);
            console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`✅ Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
            console.log(`✅ WebSocket: Enabled on ws://localhost:${PORT}/ws`);
            console.log('✅ ═══════════════════════════════════════════════════');
            console.log('');
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
