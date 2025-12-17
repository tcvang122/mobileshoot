import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Game state
const waitingPlayers = new Map(); // playerId -> playerData
const activeRooms = new Map(); // roomId -> roomData
const playerRooms = new Map(); // playerId -> roomId
const onlinePlayers = new Map(); // username -> { socketId, username, stats, status }
const pendingChallenges = new Map(); // challengerSocketId -> { targetUsername, challengerName }

// Room structure:
// {
//   id: string,
//   players: [player1, player2],
//   gameState: {
//     player1: { health, ammo, position, isDodging, lastShotTime },
//     player2: { health, ammo, position, isDodging, lastShotTime }
//   },
//   startTime: timestamp
// }

// Player structure:
// {
//   id: string (socket.id),
//   name: string,
//   stats: object,
//   ready: boolean
// }

// Get list of online players (excluding current player)
function getOnlinePlayersList(excludeSocketId = null) {
    const onlineList = [];
    onlinePlayers.forEach((playerData, username) => {
        if (excludeSocketId && playerData.socketId === excludeSocketId) {
            return; // Skip current player
        }
        // Check if player is in a battle
        const roomId = playerRooms.get(playerData.socketId);
        const inBattle = roomId !== undefined;
        
        onlineList.push({
            username: playerData.username,
            stats: playerData.stats || {},
            status: inBattle ? 'in-battle' : 'available',
            isPlayer: true // Flag to distinguish from AI opponents
        });
    });
    console.log('Online players list requested. Returning:', onlineList);
    return onlineList;
}

// Broadcast online players list to all clients
function broadcastOnlinePlayers() {
    const onlineList = [];
    console.log('=== Broadcasting online players ===');
    console.log('Current onlinePlayers map size:', onlinePlayers.size);
    console.log('Online players keys:', Array.from(onlinePlayers.keys()));
    
    onlinePlayers.forEach((playerData, username) => {
        // Check if player is in a battle
        const roomId = playerRooms.get(playerData.socketId);
        const inBattle = roomId !== undefined;
        
        console.log(`  Player: ${playerData.username}, Status: ${inBattle ? 'in-battle' : 'available'}, Socket: ${playerData.socketId}`);
        
        onlineList.push({
            username: playerData.username,
            stats: playerData.stats || {},
            status: inBattle ? 'in-battle' : 'available',
            isPlayer: true
        });
    });
    console.log('Broadcasting to all clients:', onlineList);
    io.emit('online-players-update', onlineList);
}

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Request online players list
    socket.on('request-online-players', () => {
        console.log('=== Online players list requested ===');
        console.log('Requested by socket:', socket.id);
        console.log('Current onlinePlayers map:', Array.from(onlinePlayers.entries()));
        const onlineList = getOnlinePlayersList(socket.id);
        console.log('Sending online players list to socket', socket.id, ':', onlineList);
        socket.emit('online-players-list', onlineList);
        console.log('Emitted online-players-list event');
    });

    // Update username mapping when player connects or updates username
    socket.on('update-username', (data) => {
        console.log('update-username received:', data);
        const oldUsername = Array.from(onlinePlayers.entries()).find(([_, playerData]) => playerData.socketId === socket.id)?.[0];
        if (oldUsername) {
            console.log('Removing old username:', oldUsername);
            onlinePlayers.delete(oldUsername);
        }
        if (data.username) {
            console.log('Adding new player to online list:', data.username);
            onlinePlayers.set(data.username.toLowerCase(), {
                socketId: socket.id,
                username: data.username,
                stats: data.stats || {},
                status: 'available'
            });
            console.log('Current online players:', Array.from(onlinePlayers.keys()));
            broadcastOnlinePlayers();
        }
    });

    // Challenge a specific player by username
    socket.on('challenge-player', (challengeData) => {
        const { targetUsername, challengerName, challengerStats } = challengeData;
        const targetPlayerData = onlinePlayers.get(targetUsername.toLowerCase());
        
        if (!targetPlayerData) {
            socket.emit('challenge-failed', { reason: 'Player not found or offline' });
            return;
        }
        
        const targetSocketId = targetPlayerData.socketId;
        
        if (targetSocketId === socket.id) {
            socket.emit('challenge-failed', { reason: 'You cannot challenge yourself' });
            return;
        }
        
        // Check if target is already in a game
        const targetRoomId = playerRooms.get(targetSocketId);
        if (targetRoomId) {
            socket.emit('challenge-failed', { reason: 'Player is already in a game' });
            return;
        }
        
        // Store pending challenge
        pendingChallenges.set(socket.id, {
            targetUsername: targetUsername.toLowerCase(),
            challengerName: challengerName,
            challengerSocketId: socket.id,
            targetSocketId: targetSocketId
        });
        
        // Notify target player
        io.to(targetSocketId).emit('challenge-received', {
            challengerName: challengerName,
            challengerStats: challengerStats
        });
        
        socket.emit('challenge-sent', { targetUsername: targetUsername });
    });

    // Accept a challenge
    socket.on('accept-challenge', () => {
        const challenge = Array.from(pendingChallenges.values()).find(c => c.targetSocketId === socket.id);
        if (!challenge) {
            socket.emit('challenge-failed', { reason: 'No pending challenge found' });
            return;
        }
        
        const challengerSocket = io.sockets.sockets.get(challenge.challengerSocketId);
        if (!challengerSocket || !challengerSocket.connected) {
            socket.emit('challenge-failed', { reason: 'Challenger disconnected' });
            pendingChallenges.delete(challenge.challengerSocketId);
            return;
        }
        
        // Create room for challenge
        const roomId = `challenge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const challengerData = waitingPlayers.get(challenge.challengerSocketId) || {
            id: challenge.challengerSocketId,
            socket: challengerSocket,
            name: challenge.challengerName,
            stats: {},
            ready: false
        };
        
        const targetData = waitingPlayers.get(socket.id) || {
            id: socket.id,
            socket: socket,
            name: socket.handshake.auth?.username || 'Player',
            stats: {},
            ready: false
        };
        
        const room = {
            id: roomId,
            players: [challengerData, targetData],
            gameState: {
                [challengerData.id]: {
                    health: 100,
                    ammo: 6,
                    maxAmmo: 6,
                    position: { x: 0, y: 1.7, z: 0 },
                    isDodging: false,
                    lastShotTime: 0
                },
                [targetData.id]: {
                    health: 100,
                    ammo: 6,
                    maxAmmo: 6,
                    position: { x: 0, y: 1.7, z: 0 },
                    isDodging: false,
                    lastShotTime: 0
                }
            },
            startTime: null
        };
        
        activeRooms.set(roomId, room);
        playerRooms.set(challengerData.id, roomId);
        playerRooms.set(targetData.id, roomId);
        
        // Remove from waiting and challenges
        waitingPlayers.delete(challengerData.id);
        waitingPlayers.delete(targetData.id);
        pendingChallenges.delete(challenge.challengerSocketId);
        
        // Get challenger stats from onlinePlayers
        const challengerOnlineData = onlinePlayers.get(challenge.challengerName.toLowerCase());
        if (challengerOnlineData && challengerOnlineData.stats) {
            challengerData.stats = challengerOnlineData.stats;
        }
        
        // Get target stats from onlinePlayers
        const targetOnlineData = Array.from(onlinePlayers.values()).find(p => p.socketId === socket.id);
        if (targetOnlineData && targetOnlineData.stats) {
            targetData.stats = targetOnlineData.stats;
        }
        
        // Update room with player data
        room.players = [challengerData, targetData];
        
        // Start game immediately (no ready button needed for challenges)
        startGame(roomId);
    });

    // Reject a challenge
    socket.on('reject-challenge', () => {
        const challenge = Array.from(pendingChallenges.values()).find(c => c.targetSocketId === socket.id);
        if (challenge) {
            io.to(challenge.challengerSocketId).emit('challenge-rejected', {
                targetUsername: challenge.targetUsername
            });
            pendingChallenges.delete(challenge.challengerSocketId);
        }
    });

    // Player joins matchmaking
    socket.on('join-matchmaking', (playerData) => {
        console.log('Player joining matchmaking:', socket.id, playerData);
        
        const playerName = playerData.name || 'Player';
        waitingPlayers.set(socket.id, {
            id: socket.id,
            socket: socket,
            name: playerName,
            stats: playerData.stats || {},
            ready: false,
            joinedAt: Date.now()
        });
        
        // Register player as online for challenges
        if (playerName) {
            onlinePlayers.set(playerName.toLowerCase(), {
                socketId: socket.id,
                username: playerName,
                stats: playerData.stats || {},
                status: 'available'
            });
            broadcastOnlinePlayers();
        }

        // Try to match with another player
        matchPlayers();
    });

    // Player ready to start
    socket.on('player-ready', () => {
        const player = waitingPlayers.get(socket.id);
        if (player) {
            player.ready = true;
        }

        const roomId = playerRooms.get(socket.id);
        if (roomId) {
            const room = activeRooms.get(roomId);
            if (room) {
                // Check if both players are ready
                const allReady = room.players.every(p => {
                    const playerData = waitingPlayers.get(p.id) || activeRooms.get(roomId)?.players.find(pl => pl.id === p.id);
                    return playerData?.ready || false;
                });

                if (allReady && room.players.length === 2) {
                    // Start the game
                    startGame(roomId);
                }
            }
        }
    });

    // Player action (shoot, dodge, etc.)
    socket.on('player-action', (action) => {
        const roomId = playerRooms.get(socket.id);
        if (!roomId) return;

        const room = activeRooms.get(roomId);
        if (!room) return;

        // Broadcast action to other player
        const otherPlayer = room.players.find(p => p.id !== socket.id);
        if (otherPlayer) {
            io.to(otherPlayer.id).emit('opponent-action', {
                playerId: socket.id,
                action: action,
                timestamp: Date.now()
            });
        }

        // Update game state based on action
        updateGameState(roomId, socket.id, action);
    });

    // Player position update (for smooth movement)
    socket.on('player-position', (position) => {
        const roomId = playerRooms.get(socket.id);
        if (!roomId) return;

        const room = activeRooms.get(roomId);
        if (!room) return;

        // Broadcast to other player
        const otherPlayer = room.players.find(p => p.id !== socket.id);
        if (otherPlayer) {
            io.to(otherPlayer.id).emit('opponent-position', {
                playerId: socket.id,
                position: position,
                timestamp: Date.now()
            });
        }
    });

    // Player hit (damage dealt)
    socket.on('player-hit', (hitData) => {
        const roomId = playerRooms.get(socket.id);
        if (!roomId) return;

        const room = activeRooms.get(roomId);
        if (!room) return;

        // Update opponent's health
        const opponent = room.players.find(p => p.id !== socket.id);
        if (opponent && room.gameState[opponent.id]) {
            room.gameState[opponent.id].health -= hitData.damage || 20;
            
            // Check for game end
            if (room.gameState[opponent.id].health <= 0) {
                endGame(roomId, socket.id); // socket.id wins
            } else {
                // Broadcast health update
                io.to(opponent.id).emit('health-update', {
                    health: room.gameState[opponent.id].health
                });
                io.to(socket.id).emit('opponent-health-update', {
                    health: room.gameState[opponent.id].health
                });
            }
        }
    });

    // Disconnect handling
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        
        const roomId = playerRooms.get(socket.id);
        if (roomId) {
            const room = activeRooms.get(roomId);
            if (room) {
                // Notify other player
                const otherPlayer = room.players.find(p => p.id !== socket.id);
                if (otherPlayer) {
                    io.to(otherPlayer.id).emit('opponent-disconnected');
                }
                
                // Clean up room
                activeRooms.delete(roomId);
                room.players.forEach(p => playerRooms.delete(p.id));
            }
        }
        
        waitingPlayers.delete(socket.id);
        pendingChallenges.delete(socket.id);
        
        // Remove from online players
        const username = Array.from(onlinePlayers.entries()).find(([_, id]) => id === socket.id)?.[0];
        if (username) {
            onlinePlayers.delete(username);
        }
    });
});

function matchPlayers() {
    const players = Array.from(waitingPlayers.values())
        .filter(p => !p.ready || !playerRooms.has(p.id))
        .sort((a, b) => a.joinedAt - b.joinedAt); // Match oldest waiting players first

    // Try to create pairs
    while (players.length >= 2) {
        const player1 = players.shift();
        const player2 = players.shift();

        // Create room
        const roomId = `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const room = {
            id: roomId,
            players: [player1, player2],
            gameState: {
                [player1.id]: {
                    health: 100,
                    ammo: 6,
                    maxAmmo: 6,
                    position: { x: 0, y: 1.7, z: 0 },
                    isDodging: false,
                    lastShotTime: 0
                },
                [player2.id]: {
                    health: 100,
                    ammo: 6,
                    maxAmmo: 6,
                    position: { x: 0, y: 1.7, z: 0 },
                    isDodging: false,
                    lastShotTime: 0
                }
            },
            startTime: null
        };

        activeRooms.set(roomId, room);
        playerRooms.set(player1.id, roomId);
        playerRooms.set(player2.id, roomId);

        // Notify both players
        player1.socket.emit('matched', {
            roomId: roomId,
            opponent: {
                id: player2.id,
                name: player2.name,
                stats: player2.stats
            },
            isPlayer1: true
        });

        player2.socket.emit('matched', {
            roomId: roomId,
            opponent: {
                id: player1.id,
                name: player1.name,
                stats: player1.stats
            },
            isPlayer1: false
        });

        // Remove from waiting
        waitingPlayers.delete(player1.id);
        waitingPlayers.delete(player2.id);
    }
}

function startGame(roomId) {
    const room = activeRooms.get(roomId);
    if (!room || room.players.length !== 2) return;

    room.startTime = Date.now();
    
    // Update player statuses to "in-battle"
    room.players.forEach(player => {
        const username = Array.from(onlinePlayers.entries()).find(([_, pData]) => pData.socketId === player.id)?.[0];
        if (username) {
            onlinePlayers.get(username).status = 'in-battle';
        }
    });
    broadcastOnlinePlayers();

    // Notify both players to start
    room.players.forEach((player, index) => {
        const opponent = room.players[1 - index];
        // Get opponent stats from onlinePlayers if available
        const opponentOnlineData = Array.from(onlinePlayers.values()).find(p => p.socketId === opponent.id);
        if (opponentOnlineData && opponentOnlineData.stats) {
            opponent.stats = opponentOnlineData.stats;
        }
        
        io.to(player.id).emit('game-start', {
            roomId: roomId,
            opponent: {
                id: opponent.id,
                name: opponent.name,
                stats: opponent.stats || {}
            },
            gameState: room.gameState,
            startTime: room.startTime
        });
    });
}

function updateGameState(roomId, playerId, action) {
    const room = activeRooms.get(roomId);
    if (!room || !room.gameState[playerId]) return;

    const state = room.gameState[playerId];

    switch (action.type) {
        case 'shoot':
            if (state.ammo > 0 && Date.now() - state.lastShotTime > 200) {
                state.ammo--;
                state.lastShotTime = Date.now();
            }
            break;
        case 'reload':
            state.ammo = state.maxAmmo;
            break;
        case 'dodge':
            state.isDodging = true;
            setTimeout(() => {
                if (room.gameState[playerId]) {
                    room.gameState[playerId].isDodging = false;
                }
            }, 500);
            break;
        case 'position':
            state.position = action.position;
            break;
    }
}

function endGame(roomId, winnerId) {
    const room = activeRooms.get(roomId);
    if (!room) return;

    // Notify both players
    room.players.forEach(player => {
        io.to(player.id).emit('game-end', {
            winner: winnerId,
            victory: player.id === winnerId,
            gameState: room.gameState
        });
    });

    // Update player statuses back to "available"
    room.players.forEach(player => {
        const username = Array.from(onlinePlayers.entries()).find(([_, pData]) => pData.socketId === player.id)?.[0];
        if (username) {
            onlinePlayers.get(username).status = 'available';
        }
    });
    broadcastOnlinePlayers();

    // Clean up after delay
    setTimeout(() => {
        room.players.forEach(p => {
            playerRooms.delete(p.id);
            waitingPlayers.delete(p.id);
        });
        activeRooms.delete(roomId);
        broadcastOnlinePlayers(); // Update again after cleanup
    }, 5000);
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Game server running on port ${PORT}`);
});

