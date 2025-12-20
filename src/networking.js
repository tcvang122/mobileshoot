// Networking: Socket.io and PvP

import { io } from 'socket.io-client';
import * as gameState from './gameState.js';
import { setSocket, setOnlinePlayersList, setIsPvPMode, setPlayerHealth, setMatchmakingActive, setGameMode, setCurrentPvPOpponentStats } from './gameState.js';
import { updateHealthBar, updateOpponentHealthBar, updateHUD } from './ui.js';
import { endGame } from './gameLogic.js';
import { opponentGroup, opponentMuzzleLight } from './gameObjects.js';
import * as THREE from 'three';
import { scene } from './sceneSetup.js';

const getServerURL = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3000';
    }
    const hostname = window.location.hostname;
    return `http://${hostname}:3000`;
};

const SERVER_URL = getServerURL();

// TWEEN for networking effects
const TWEEN = {
    Tween: class {
        constructor(object) {
            this.object = object;
            this.valuesStart = {};
            this.valuesEnd = {};
            this.duration = 0;
            this.startTime = 0;
            this.onCompleteCallback = null;
        }
        to(values, duration) {
            this.valuesEnd = values;
            this.duration = duration;
            return this;
        }
        onComplete(callback) {
            this.onCompleteCallback = callback;
            return this;
        }
        start() {
            this.startTime = performance.now();
            for (const property in this.valuesEnd) {
                this.valuesStart[property] = this.object[property];
            }
            const update = () => {
                const time = performance.now();
                let elapsed = time - this.startTime;
                const isComplete = elapsed >= this.duration;
                if (isComplete) elapsed = this.duration;
                const value = elapsed / this.duration;
                for (const property in this.valuesEnd) {
                    const start = this.valuesStart[property];
                    const end = this.valuesEnd[property];
                    this.object[property] = start + (end - start) * value;
                }
                if (isComplete && this.onCompleteCallback) {
                    this.onCompleteCallback();
                } else if (!isComplete) {
                    requestAnimationFrame(update);
                }
            };
            update();
        }
    }
};

export function initializeNetworking() {
    try {
        setSocket(io(SERVER_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
            timeout: 20000
        }));
        
        gameState.socket.on('online-players-list', (players) => {
            setOnlinePlayersList(players || []);
            if (window.addOnlinePlayersToGrid) {
                window.addOnlinePlayersToGrid();
            }
        });
        
        gameState.socket.on('connect', () => {
            if (gameState.userStats.name) {
                gameState.socket.emit('update-username', { username: gameState.userStats.name, stats: gameState.userStats });
            }
            setTimeout(() => {
                if (window.fetchOnlinePlayers) {
                    window.fetchOnlinePlayers();
                }
            }, 500);
        });
        
        gameState.socket.on('online-players-update', (players) => {
            setOnlinePlayersList(players || []);
            if (window.addOnlinePlayersToGrid) {
                window.addOnlinePlayersToGrid();
            }
        });
        
        gameState.socket.on('game-start', (data) => {
            hideMatchmakingUI();
            document.getElementById('main-menu').classList.add('hidden');
            
            if (data.opponent && data.opponent.stats) {
                setCurrentPvPOpponentStats(data.opponent.stats);
            }
            
            setIsPvPMode(true);
            setGameMode('pvp');
            if (window.startPvPGame) {
                window.startPvPGame(data);
            }
        });
        
        gameState.socket.on('opponent-action', (data) => {
            handleOpponentAction(data);
        });
        
        gameState.        socket.on('health-update', (data) => {
            setPlayerHealth(data.health);
            updateHealthBar();
        });
        
        gameState.socket.on('opponent-health-update', (data) => {
            if (opponentGroup && opponentGroup.userData.healthBarFill) {
                const percentage = Math.max(0, Math.min(100, data.health));
                opponentGroup.userData.healthBarFill.scale.x = percentage / 100;
            }
        });
        
        gameState.socket.on('game-end', (data) => {
            endGame(data.victory);
        });
        
        gameState.socket.on('challenge-received', (data) => {
            const popup = document.getElementById('challenge-popup');
            const challengerNameEl = document.getElementById('challenge-challenger-name');
            challengerNameEl.textContent = data.challengerName;
            popup.classList.remove('hidden');
            
            const acceptBtn = document.getElementById('btn-accept-challenge');
            const rejectBtn = document.getElementById('btn-reject-challenge');
            
            const newAcceptBtn = acceptBtn.cloneNode(true);
            const newRejectBtn = rejectBtn.cloneNode(true);
            acceptBtn.parentNode.replaceChild(newAcceptBtn, acceptBtn);
            rejectBtn.parentNode.replaceChild(newRejectBtn, rejectBtn);
            
            newAcceptBtn.addEventListener('click', () => {
                popup.classList.add('hidden');
                gameState.socket.emit('challenge-response', { accepted: true });
                // Don't show matchmaking UI - game should start immediately
                updateHUD('Challenge accepted! Starting game...', '#00ff00');
            });
            
            newRejectBtn.addEventListener('click', () => {
                popup.classList.add('hidden');
                gameState.socket.emit('challenge-response', { accepted: false });
            });
        });
        
        gameState.socket.on('challenge-failed', (data) => {
            hideMatchmakingUI();
            alert(`Challenge failed: ${data.reason}`);
        });
        
        gameState.socket.on('challenge-rejected', (data) => {
            hideMatchmakingUI();
            alert(`${data.targetUsername} rejected your challenge.`);
        });
    } catch (error) {
        console.error('Error initializing networking:', error);
    }
}

export function challengePlayer(targetUsername) {
    if (!gameState.socket || !gameState.socket.connected) {
        alert('Not connected to server. Please make sure the server is running.');
        return;
    }
    
    gameState.socket.emit('challenge-player', {
        targetUsername: targetUsername,
        challengerName: gameState.userStats.name,
        challengerStats: gameState.userStats
    });
}

export function calculatePlayerReward(opponentStats) {
    const wins = opponentStats.wins || 0;
    const rank = opponentStats.rank || 'Rookie';
    
    const rankRewards = {
        'Rookie': 50,
        'Soldier': 100,
        'Veteran': 200,
        'Elite': 350,
        'Master': 500,
        'Legend': 750,
        'Champion': 1000
    };
    
    let baseReward = rankRewards[rank] || 50;
    const winBonus = Math.min(wins / 10 * 0.1, 1.0);
    const totalReward = Math.floor(baseReward * (1 + winBonus));
    
    return totalReward;
}

export function fetchOnlinePlayers() {
    if (gameState.socket && gameState.socket.connected) {
        gameState.socket.emit('request-online-players');
    }
}

export function addOnlinePlayersToGrid() {
    const opponentGrid = document.getElementById('opponent-grid');
    if (!opponentGrid) return;
    
    const existingPlayerCards = opponentGrid.querySelectorAll('.player-card');
    existingPlayerCards.forEach(card => card.remove());
    
    const availablePlayers = gameState.onlinePlayersList.filter(p => {
        if (!p || !p.username) return false;
        if (p.status !== 'available') return false;
        if (p.username.toLowerCase() === gameState.userStats.name.toLowerCase()) return false;
        return true;
    });
    
    if (availablePlayers.length === 0) return;
    
    availablePlayers.forEach((player) => {
        const card = document.createElement('div');
        card.className = 'opponent-card player-card';
        card.dataset.playerUsername = player.username;
        
        const wins = player.stats?.wins || 0;
        const rank = player.stats?.rank || 'Rookie';
        const reward = calculatePlayerReward(player.stats || {});
        
        card.innerHTML = `
            <div class="selected-badge" style="background: rgba(255, 200, 0, 0.9);">ONLINE</div>
            <div class="opponent-image-container">
                <div class="opponent-image-placeholder" style="display: flex;">👤</div>
            </div>
            <div class="opponent-name">${player.username}</div>
            <div class="opponent-type" style="color: #00ff00;">PLAYER</div>
            <div class="opponent-stats">
                <div class="opponent-stat">
                    <div>Rank</div>
                    <div class="opponent-stat-value">${rank}</div>
                </div>
                <div class="opponent-stat">
                    <div>Wins</div>
                    <div class="opponent-stat-value">${wins}</div>
                </div>
            </div>
            <div style="text-align: center; margin-top: 8px; color: #ffaa00; font-weight: bold; font-size: 0.75rem;">
                Reward: ${reward} Credits
            </div>
            <button class="card-battle-button player-challenge-button" data-player-username="${player.username}" style="width: 100%; margin-top: 10px; padding: 10px; background: linear-gradient(135deg, rgba(255, 200, 0, 0.9) 0%, rgba(255, 150, 0, 0.9) 100%); color: #000; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; text-transform: uppercase; font-size: 0.9rem;">CHALLENGE</button>
        `;
        
        opponentGrid.appendChild(card);
    });
    
    setTimeout(() => {
        document.querySelectorAll('.player-challenge-button').forEach(button => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            newButton.addEventListener('click', (e) => {
                e.stopPropagation();
                const username = newButton.dataset.playerUsername;
                if (username) {
                    challengePlayer(username);
                }
            });
        });
    }, 50);
}

function handleOpponentAction(data) {
    const action = data.action;
    
    switch (action.type) {
        case 'shoot':
            if (opponentMuzzleLight) {
                opponentMuzzleLight.intensity = 3;
                opponentMuzzleLight.color.setHex(0xff0000);
                setTimeout(() => {
                    opponentMuzzleLight.intensity = 0;
                }, 100);
            }
            break;
    }
}

export function sendPlayerAction(action) {
    if (gameState.socket && gameState.socket.connected && gameState.isPvPMode) {
        gameState.socket.emit('player-action', action);
    }
}

export function sendPlayerHit(damage) {
    if (gameState.socket && gameState.socket.connected && gameState.isPvPMode) {
        gameState.socket.emit('player-hit', { damage: damage });
    }
}

export function showMatchmakingUI() {
    document.getElementById('matchmaking-ui').classList.remove('hidden');
    document.getElementById('matchmaking-status').textContent = 'Searching for opponent...';
}

export function hideMatchmakingUI() {
    document.getElementById('matchmaking-ui').classList.add('hidden');
    setMatchmakingActive(false);
}

// Export for use in other modules
window.sendPlayerAction = sendPlayerAction;
window.sendPlayerHit = sendPlayerHit;
window.calculatePlayerReward = calculatePlayerReward;
window.fetchOnlinePlayers = fetchOnlinePlayers;
window.addOnlinePlayersToGrid = addOnlinePlayersToGrid;
window.challengePlayer = challengePlayer;

