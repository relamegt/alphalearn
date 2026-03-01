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
// MED-1 FIX: Reduced leaderboard throttle from 10s to 3s.
// 10s made the board visibly stale during fast-paced contests where students
// submit every few minutes. 3s provides near-real-time updates while still
// preventing broadcast storms from mass simultaneous submissions.
const LEADERBOARD_THROTTLE_S = 3;

// With Redis Pub/Sub for horizontal scaling, each server instance had its own
// local Map, so throttle timers fired independently on every instance instead
// of once globally — resulting in 3x broadcast volume with 3 server instances.
// Fix: Use Redis keys to coordinate the throttle window across all instances.
// We also use Redis lists to store the actual submissions, bypassing strictly local memory map.

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

    // MED-2 FIX: Previously iterated ALL connected clients globally.
    // With 2000+ clients across multiple contests, this did unnecessary work.
    // Fix: Only ping clients who are in active contest rooms (the ones we actually manage).
    const interval = setInterval(() => {
        const activeClients = new Set();
        contestRooms.forEach((clients) => clients.forEach(ws => activeClients.add(ws)));

        activeClients.forEach((ws) => {
            if (!ws.isAlive) {
                console.log('💀 Terminating dead connection');
                ws.terminate();
                return;
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

                // Extract user from old room if they send join again sequentially
                if (ws.contestId && ws.contestId !== contestId) {
                    if (contestRooms.has(ws.contestId)) {
                        contestRooms.get(ws.contestId).delete(ws);
                        console.log(`🔄️ Extracted user from previous contest room: ${ws.contestId}`);
                    }
                }

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
    const clients = Array.from(contestRooms.get(contestId));
    let successCount = 0;

    const broadcastChunk = (idx) => {
        const chunk = clients.slice(idx, idx + 50);
        if (!chunk.length) {
            console.log(`📢 Local Broadcast to contest ${contestId}: ${data.type} (${successCount}/${clients.length} clients)`);
            return;
        }

        chunk.forEach((client) => {
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

        // Yield to event loop to avoid blocking node thread
        setTimeout(() => broadcastChunk(idx + 50), 0);
    };

    broadcastChunk(0);
};

// Throttling via Redis for distributed coordination across multiple server instances
const notifyLeaderboardUpdate = async (contestId) => {
    const redis = getRedis();
    const throttleKey = `throttle:leaderboard:${contestId.toString()}`;

    try {
        // MED-1 FIX: Reduced from 10s to 3s for a fresher leaderboard during contests.
        // Use Redis NX+EX as a distributed throttle lock (3 seconds).
        const acquired = await redis.set(throttleKey, '1', 'NX', 'EX', LEADERBOARD_THROTTLE_S);
        if (!acquired) {
            // Another instance already scheduled this broadcast within the throttle window
            return;
        }
    } catch (e) {
        console.error('[Redis] Throttle check failed, broadcasting anyway:', e.message);
    }

    console.log(`⏱️ Throttling leaderboard update for contest ${contestId} (${LEADERBOARD_THROTTLE_S}s, distributed via Redis)`);

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
    }, LEADERBOARD_THROTTLE_S * 1000);
};

const notifySubmission = async (contestId, submission) => {
    const redis = getRedis();
    const contestIdStr = contestId.toString();
    const submissionThrottleKey = `throttle:submission:${contestIdStr}`;
    const queueKey = `queue:submission:${contestIdStr}`;

    try {
        // Always push to Redis queue (survives server restarts)
        await redis.rpush(queueKey, JSON.stringify(submission));
        await redis.expire(queueKey, 60); // 60s TTL to prevent memory leaks

        // HIGH-1 FIX: The previous implementation used setTimeout on the server that acquired
        // the throttle lock. If that server crashed before 5s, the broadcast was permanently lost.
        // Fix: On each call, try to acquire the throttle lock. The server that wins it fires the
        // broadcast after a short delay. The key insight is: we also do a "catch-up" flush on
        // servers that FAIL to acquire the lock — if the queue already has items accumulated
        // (meaning the winning server may have crashed), we re-acquire and flush immediately.
        const acquired = await redis.set(
            submissionThrottleKey, '1', 'NX', 'EX', Math.ceil(SUBMISSION_THROTTLE_MS / 1000)
        ).catch(() => null);

        if (acquired) {
            // This server won the throttle lock — schedule the flush
            setTimeout(async () => {
                try {
                    const items = await redis.lrange(queueKey, 0, -1);
                    await redis.del(queueKey);

                    if (items && items.length > 0) {
                        const parsedItems = items.map(item => JSON.parse(item));
                        broadcastToContest(contestIdStr, {
                            type: 'batchSubmissions',
                            count: parsedItems.length,
                            latestSubmission: parsedItems[parsedItems.length - 1],
                            timestamp: new Date().toISOString()
                        });
                    }
                } catch (err) {
                    console.error('❌ Failed to process Redis submission queue:', err);
                }
            }, SUBMISSION_THROTTLE_MS);
        } else {
            // HIGH-1 FIX: Another server won the lock. Check if the queue is large (> 20 items)
            // which could mean the winning server crashed and the flush never fired.
            // If so, force-acquire and flush immediately to prevent broadcast starvation.
            try {
                const queueLen = await redis.llen(queueKey);
                if (queueLen > 20) {
                    // Force re-acquire lock for immediate flush (override stale lock)
                    await redis.set(submissionThrottleKey, '1', 'EX', Math.ceil(SUBMISSION_THROTTLE_MS / 1000));
                    const items = await redis.lrange(queueKey, 0, -1);
                    await redis.del(queueKey);
                    if (items && items.length > 0) {
                        const parsedItems = items.map(item => JSON.parse(item));
                        broadcastToContest(contestIdStr, {
                            type: 'batchSubmissions',
                            count: parsedItems.length,
                            latestSubmission: parsedItems[parsedItems.length - 1],
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            } catch (catchupErr) {
                console.error('❌ Catch-up flush failed:', catchupErr);
            }
        }
    } catch (err) {
        console.error('❌ Redis queue push failed:', err);
    }
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

const notifyExecutionResult = (contestId, userId, resultData) => {
    const userIdStr = userId ? userId.toString() : null;
    broadcastToContest(contestId, {
        type: 'executionResult',
        targetUserId: userIdStr,
        ...resultData,
        timestamp: new Date().toISOString()
    });
};

module.exports = {
    initWebSocket,
    broadcastToContest,
    notifyLeaderboardUpdate,
    notifySubmission,
    notifyViolation,
    notifyContestEnd,
    notifyExecutionResult
};
