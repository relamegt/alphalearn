const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { getRedis, getNewRedisClient } = require('./redis');

let wss;
const contestRooms = new Map();
let pubClient;
let subClient;

const REDIS_WS_CHANNEL = 'ALPHALEARN_WS_EVENTS';
const PARTICIPANT_KEY_PREFIX = 'contest:participants:';
const SUBMISSION_THROTTLE_MS = 5000;
// BUG #7 FIX: submissionQueues was a plain in-memory Map.
// With Redis Pub/Sub for horizontal scaling, each server instance had its own
// local Map, so throttle timers fired independently on every instance instead
// of once globally — resulting in 3x broadcast volume with 3 server instances.
// Fix: Use Redis keys to coordinate the throttle window across all instances.
// The in-memory Map is kept ONLY to deduplicate within the same instance.
const submissionQueues = new Map(); // contestId -> Array of submissions (local-only dedup)

const initWebSocket = (server) => {
    wss = new WebSocket.Server({
        server,
        path: '/ws',
        perMessageDeflate: false,
        clientTracking: true
    });

    // Initialize Redis Pub/Sub for scaling across multiple server instances
    pubClient = getRedis();
    subClient = getNewRedisClient();

    subClient.subscribe(REDIS_WS_CHANNEL, (err) => {
        if (err) console.error('❌ Failed to subscribe to Redis WS channel:', err);
        else console.log('📡 Subscribed to Redis WS scaling channel');
    });

    subClient.on('message', (channel, message) => {
        if (channel === REDIS_WS_CHANNEL) {
            try {
                const { contestId, data } = JSON.parse(message);
                broadcastToLocalContest(contestId, data);
            } catch (err) {
                console.error('❌ Error handling Redis WS message:', err);
            }
        }
    });

    wss.on('connection', (ws, req) => {
        console.log('✅ New WebSocket connection established');

        ws.isAlive = true;
        ws.on('pong', () => {
            ws.isAlive = true;
        });

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                handleWebSocketMessage(ws, data);
            } catch (error) {
                console.error('❌ WebSocket message error:', error);
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Invalid message format'
                }));
            }
        });

        ws.on('close', async () => {
            console.log('🔌 WebSocket connection closed');
            if (ws.contestId && contestRooms.has(ws.contestId)) {
                const clients = contestRooms.get(ws.contestId);
                clients.delete(ws);
                console.log(`👤 User ${ws.userId || 'unknown'} left contest: ${ws.contestId}`);

                if (clients.size === 0) {
                    contestRooms.delete(ws.contestId);
                    console.log(`🗑️ Cleaned up empty contest room: ${ws.contestId}`);
                }
            }
        });

        ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error);
        });
    });

    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (!ws.isAlive) {
                console.log('💀 Terminating dead connection');
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on('close', () => {
        clearInterval(interval);
        subClient.quit();
    });

    console.log('✅ WebSocket server initialized on path /ws');
    return wss;
};

const handleWebSocketMessage = async (ws, data) => {
    const { type, contestId, token } = data;

    console.log(`📨 Received WebSocket message: ${type}`, { contestId });

    switch (type) {
        case 'join':
            try {
                if (!token) {
                    throw new Error('No token provided');
                }

                const cleanToken = token.replace('Bearer ', '').trim();
                const decoded = jwt.verify(cleanToken, process.env.JWT_ACCESS_SECRET);

                ws.userId = decoded.userId;
                ws.role = decoded.role;
                ws.contestId = contestId;

                console.log(`✅ User ${decoded.userId} authenticated for contest ${contestId}`);

                if (!contestRooms.has(contestId)) {
                    contestRooms.set(contestId, new Set());
                    console.log(`🆕 Created new contest room: ${contestId}`);
                }
                contestRooms.get(contestId).add(ws);

                ws.send(JSON.stringify({
                    type: 'joined',
                    contestId,
                    message: 'Successfully joined contest room',
                    userId: decoded.userId
                }));

            } catch (error) {
                console.error('❌ Authentication failed:', error.message);
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Authentication failed: ' + error.message
                }));
            }
            break;

        case 'leave':
            if (ws.contestId && contestRooms.has(ws.contestId)) {
                contestRooms.get(ws.contestId).delete(ws);
            }
            break;

        case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;

        default:
            console.log('❓ Unknown message type:', type);
    }
};

// broadcastToContest now publishes to REDIS for horizontal scalability
const broadcastToContest = (contestId, data) => {
    if (!pubClient) return;

    pubClient.publish(REDIS_WS_CHANNEL, JSON.stringify({
        contestId: contestId.toString(),
        data
    }));
};

// broadcastToLocalContest actually sends to the local clients
const broadcastToLocalContest = (contestId, data) => {
    if (!contestRooms.has(contestId)) return;

    const message = JSON.stringify(data);
    const clients = contestRooms.get(contestId);
    let successCount = 0;

    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            // Target specific user if targetUserId is set (e.g. for violations)
            if (data.targetUserId && client.userId !== data.targetUserId) {
                return;
            }
            try {
                client.send(message);
                successCount++;
            } catch (error) {
                console.error('❌ Failed to send message to client:', error);
            }
        }
    });

    console.log(`📢 Local Broadcast to contest ${contestId}: ${data.type} (${successCount}/${clients.size} clients)`);
};

// Throttling via Redis for distributed coordination across multiple server instances
const notifyLeaderboardUpdate = async (contestId) => {
    const redis = getRedis();
    const throttleKey = `throttle:leaderboard:${contestId.toString()}`;

    try {
        // Use Redis NX+EX as a distributed throttle lock (10 seconds)
        // If another instance already set this key, we bail out immediately.
        const acquired = await redis.set(throttleKey, '1', 'NX', 'EX', 10);
        if (!acquired) {
            // Another instance already scheduled this broadcast within the throttle window
            return;
        }
    } catch (e) {
        console.error('[Redis] Throttle check failed, broadcasting anyway:', e.message);
    }

    console.log(`⏱️ Throttling leaderboard update for contest ${contestId} (10s, distributed via Redis)`);

    setTimeout(async () => {
        try {
            console.log(`🏆 Broadcasting leaderboard refetch signal for contest ${contestId}`);
            broadcastToContest(contestId, {
                type: 'leaderboardRefetch',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('❌ Throttled leaderboard broadcast failed:', error);
        }
    }, 10000);
};

const notifySubmission = async (contestId, submission) => {
    const redis = getRedis();
    const contestIdStr = contestId.toString();
    // BUG #7 FIX: Use Redis to coordinate submission throttle across instances.
    // The Redis key acts as a distributed lock: only the first instance to set it
    // within the SUBMISSION_THROTTLE_MS window will schedule the broadcast.
    const submissionThrottleKey = `throttle:submission:${contestIdStr}`;

    // Queue submission locally for batching (within this instance)
    if (!submissionQueues.has(contestIdStr)) {
        submissionQueues.set(contestIdStr, []);
    }
    submissionQueues.get(contestIdStr).push(submission);

    // Try to acquire the distributed throttle lock
    // NX = only set if not already exists; EX = TTL in seconds
    const acquired = await redis.set(
        submissionThrottleKey, '1', 'NX', 'EX', Math.ceil(SUBMISSION_THROTTLE_MS / 1000)
    ).catch(() => null);

    if (!acquired) {
        // Another instance (or this one already) has scheduled the broadcast
        return;
    }

    // BUG #10 FIX: Schedule a single timeout per throttle window (not one per submission).
    // Previously, notifyLeaderboardUpdate was called once per submission, creating
    // dozens of pending setTimeout callbacks queued in the event loop simultaneously.
    // Now: only the lock-acquiring instance schedules the broadcast timer.
    setTimeout(async () => {
        const queue = submissionQueues.get(contestIdStr) || [];
        submissionQueues.delete(contestIdStr);

        if (queue.length > 0) {
            broadcastToContest(contestIdStr, {
                type: 'batchSubmissions',
                count: queue.length,
                latestSubmission: queue[queue.length - 1],
                timestamp: new Date().toISOString()
            });
        }
    }, SUBMISSION_THROTTLE_MS);
};

const notifyViolation = (contestId, userId, violation) => {
    // Always cast userId to string to prevent type mismatches in broadcastToLocalContest
    const userIdStr = userId ? userId.toString() : null;
    console.log(`⚠️ Violation broadcast initiated for user ${userIdStr} in contest ${contestId}`);

    // Broadcast through Redis so the message reaches the user
    // on whichever server node they are connected to
    broadcastToContest(contestId, {
        type: 'violation',
        targetUserId: userIdStr,
        violation,
        timestamp: new Date().toISOString()
    });
};

const notifyContestEnd = (contestId) => {
    broadcastToContest(contestId, {
        type: 'contestEnded',
        message: 'Contest has ended',
        timestamp: new Date().toISOString()
    });
};

module.exports = {
    initWebSocket,
    broadcastToContest,
    notifyLeaderboardUpdate,
    notifySubmission,
    notifyViolation,
    notifyContestEnd
};
