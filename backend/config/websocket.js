// backend/config/websocket.js (FIXED)
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

let wss;
const contestRooms = new Map();

const initWebSocket = (server) => {
    wss = new WebSocket.Server({
        server,
        path: '/ws',
        perMessageDeflate: false,
        clientTracking: true
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

        ws.on('close', () => {
            console.log('🔌 WebSocket connection closed');
            contestRooms.forEach((clients, contestId) => {
                if (clients.has(ws)) {
                    clients.delete(ws);
                    console.log(`👤 User left contest: ${contestId}`);

                    if (clients.size >= 0) {
                        broadcastToContest(contestId, {
                            type: 'participantCount',
                            count: clients.size
                        });
                    }

                    if (clients.size === 0) {
                        contestRooms.delete(contestId);
                        console.log(`🗑️ Cleaned up empty contest room: ${contestId}`);
                    }
                }
            });
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
    });

    console.log('✅ WebSocket server initialized on path /ws');
    return wss;
};

const handleWebSocketMessage = (ws, data) => {
    const { type, contestId, token } = data;

    console.log(`📨 Received WebSocket message: ${type}`, { contestId });

    switch (type) {
        case 'join':
            try {
                if (!token) {
                    throw new Error('No token provided');
                }

                // Remove "Bearer " prefix if present
                const cleanToken = token.replace('Bearer ', '').trim();

                console.log('🔐 Verifying token with JWT_ACCESS_SECRET...');

                // FIXED: Use JWT_ACCESS_SECRET (same as auth controller)
                const decoded = jwt.verify(cleanToken, process.env.JWT_ACCESS_SECRET);

                ws.userId = decoded.userId;
                ws.role = decoded.role;
                ws.contestId = contestId;

                console.log(`✅ User ${decoded.userId} authenticated for contest ${contestId}`);

                // Join contest room
                if (!contestRooms.has(contestId)) {
                    contestRooms.set(contestId, new Set());
                    console.log(`🆕 Created new contest room: ${contestId}`);
                }
                contestRooms.get(contestId).add(ws);

                // Send join confirmation
                ws.send(JSON.stringify({
                    type: 'joined',
                    contestId,
                    message: 'Successfully joined contest room',
                    userId: decoded.userId
                }));

                // Broadcast participant count
                const participantCount = contestRooms.get(contestId).size;
                console.log(`👥 Contest ${contestId} now has ${participantCount} participants`);

                broadcastToContest(contestId, {
                    type: 'participantCount',
                    count: participantCount
                });

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
                console.log(`👋 User left contest: ${ws.contestId}`);

                broadcastToContest(ws.contestId, {
                    type: 'participantCount',
                    count: contestRooms.get(ws.contestId).size
                });
            }
            break;

        case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;

        default:
            console.log('❓ Unknown message type:', type);
    }
};

const broadcastToContest = (contestId, data) => {
    if (!contestRooms.has(contestId)) {
        console.log(`⚠️ No room found for contest: ${contestId}`);
        return;
    }

    const message = JSON.stringify(data);
    const clients = contestRooms.get(contestId);
    let successCount = 0;

    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(message);
                successCount++;
            } catch (error) {
                console.error('❌ Failed to send message to client:', error);
            }
        }
    });

    console.log(`📢 Broadcast to contest ${contestId}: ${data.type} (${successCount}/${clients.size} clients)`);
};

const notifyLeaderboardUpdate = (contestId, leaderboard) => {
    console.log(`🏆 Updating leaderboard for contest ${contestId} (${leaderboard.length} entries)`);
    broadcastToContest(contestId, {
        type: 'leaderboardUpdate',
        leaderboard,
        timestamp: new Date().toISOString()
    });
};

const notifySubmission = (contestId, submission) => {
    console.log(`📝 New submission in contest ${contestId}:`, submission.verdict);
    broadcastToContest(contestId, {
        type: 'newSubmission',
        submission,
        timestamp: new Date().toISOString()
    });
};

const notifyViolation = (contestId, userId, violation) => {
    if (!contestRooms.has(contestId)) return;

    console.log(`⚠️ Violation detected for user ${userId} in contest ${contestId}`);

    contestRooms.get(contestId).forEach((client) => {
        if (client.userId === userId && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'violation',
                violation,
                timestamp: new Date().toISOString()
            }));
        }
    });
};

const notifyContestEnd = (contestId) => {
    console.log(`⏰ Contest ${contestId} has ended`);
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
