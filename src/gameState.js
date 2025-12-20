// Game State Management

import { MAX_STAMINA, EXHAUSTED_THRESHOLD } from './config.js';

// Game state variables
export let opponentHealth = 100;
export let playerHealth = 100;
export let gameStarted = false;
export let orientationEnabled = false;
export let lastAttackTime = 0;
export let lastImportantMessageTime = 0;

// Melee combat state (For Honor style)
export let currentDirection = null; // Keep for backward compatibility (synced with guardDirection)
export let guardDirection = null; // 'up', 'left', 'right' - persistent guard stance (no 'down' for guard)
export let currentAttackDirection = null; // Direction of current attack (can be different from guard)
export let currentAttackType = null; // 'light', 'heavy', or 'guard_break'
export let isAttacking = false;
export let attackCooldown = false;
export let opponentIncomingAttackDirection = null; // Direction of opponent's incoming attack
export let opponentAttackWindupTime = 0; // When the opponent will attack
export let opponentAttackType = null; // Type of opponent's attack
export let parryWindowStart = 0; // When parry window opens
export let parryWindowEnd = 0; // When parry window closes
export let playerStamina = MAX_STAMINA; // Player stamina
export let isExhausted = false; // Whether player is exhausted

// Opponent AI state
export let opponentLastAttackTime = 0;
export let OPPONENT_ATTACK_INTERVAL = 2000;
export let currentOpponentData = null;
export let currentPvPOpponentStats = null;
export let enemyAttackPhase = 'normal';
export let enemyPatternAttackCount = 0;
export let enemyPatternType = 'single';
export let enemyNextPatternTime = 0;
export let opponentCurrentDirection = null;
export let opponentGuardDirection = null; // Opponent's guard direction (for blocking checks)
export let opponentStamina = MAX_STAMINA; // Opponent stamina

// Dodge state (removed but keeping for compatibility)
export let isDodging = false;
export let dodgeCooldown = false;
export let dodgeCooldownTime = 0;
export let dodgeInvincibilityEnd = 0;

// Reticle state
export let reticleX = 0;
export let reticleY = 0;

// Gyroscope state
export let gyroCalibration = { alpha: 0, beta: 0, gamma: 0 };
export let gyroSmoothing = 0.15;
export let lastGyroValues = { alpha: 0, beta: 0, gamma: 0 };
export let gyroEnabled = false;
export let gyroscopePermissionGranted = false;

// PvP state
export let socket = null;
export let isPvPMode = false;
export let currentRoomId = null;
export let opponentPlayer = null;
export let isPlayer1 = false;
export let gameMode = 'singleplayer';
export let matchmakingActive = false;

// User state
export let currentUser = null;
export let isAuthenticated = false;
export let selectedOpponent = null;
export let userStats = {
    name: 'Player',
    rank: 'Bronze',
    wins: 0,
    credits: 100,
    avatar: null,
    selectedWeapon: 'sword',
    selectedCharacter: 'default',
    characterCustomization: {
        primaryColor: '#00ffff',
        secondaryColor: '#ff00ff'
    }
};

// Online players
export let onlinePlayersList = [];

// Setter functions for state that needs to be modified from other modules
// These are needed because namespace imports are read-only in some environments
export function setCurrentUser(value) {
    currentUser = value;
}

export function setIsAuthenticated(value) {
    isAuthenticated = value;
}

export function setUserStats(value) {
    userStats = value;
}

export function setSocket(value) {
    socket = value;
}

export function setOnlinePlayersList(value) {
    onlinePlayersList = value;
}

export function setGameStarted(value) {
    gameStarted = value;
}

export function setCurrentDirection(value) {
    currentDirection = value; // Keep for backward compatibility
    // Also update guardDirection if it's a valid guard direction
    if (value === 'up' || value === 'left' || value === 'right' || value === null) {
        guardDirection = value === 'down' ? null : value; // DOWN clears guard
    }
}

export function setGuardDirection(value) {
    // Only allow UP, LEFT, RIGHT (no DOWN for guard)
    if (value === 'down') {
        guardDirection = null; // DOWN clears guard (for dodging)
        currentDirection = null; // Also clear currentDirection for compatibility
    } else if (value === 'up' || value === 'left' || value === 'right' || value === null) {
        guardDirection = value;
        currentDirection = value; // Sync with currentDirection for compatibility
    }
}

export function setCurrentAttackDirection(value) {
    currentAttackDirection = value;
}

export function setPlayerStamina(value) {
    playerStamina = Math.max(0, Math.min(MAX_STAMINA, value));
    isExhausted = playerStamina < EXHAUSTED_THRESHOLD;
}

export function setParryWindow(start, end) {
    parryWindowStart = start;
    parryWindowEnd = end;
}

export function setOpponentAttackType(value) {
    opponentAttackType = value;
}

export function setAttackType(value) {
    currentAttackType = value;
}

export function setIsAttacking(value) {
    isAttacking = value;
}

export function setAttackCooldown(value) {
    attackCooldown = value;
}

export function setOpponentIncomingAttackDirection(value) {
    opponentIncomingAttackDirection = value;
}

export function setOpponentAttackWindupTime(value) {
    opponentAttackWindupTime = value;
}

export function setPlayerHealth(value) {
    playerHealth = value;
}

export function setOpponentHealth(value) {
    opponentHealth = value;
}

export function setIsPvPMode(value) {
    isPvPMode = value;
}

export function setReticleX(value) {
    reticleX = value;
}

export function setReticleY(value) {
    reticleY = value;
}

export function setGyroEnabled(value) {
    gyroEnabled = value;
}

export function setGyroscopePermissionGranted(value) {
    gyroscopePermissionGranted = value;
}

export function setGyroCalibration(value) {
    gyroCalibration = value;
}

export function setLastGyroValues(value) {
    lastGyroValues = value;
}

export function setMatchmakingActive(value) {
    matchmakingActive = value;
}

export function setGameMode(value) {
    gameMode = value;
}

export function setCurrentRoomId(value) {
    currentRoomId = value;
}

export function setOpponentPlayer(value) {
    opponentPlayer = value;
}

export function setIsPlayer1(value) {
    isPlayer1 = value;
}

export function setCurrentOpponentData(value) {
    currentOpponentData = value;
}

export function setCurrentPvPOpponentStats(value) {
    currentPvPOpponentStats = value;
}


export function setOrientationEnabled(value) {
    orientationEnabled = value;
}

export function setOPPONENT_ATTACK_INTERVAL(value) {
    OPPONENT_ATTACK_INTERVAL = value;
}

export function setEnemyAttackPhase(value) {
    enemyAttackPhase = value;
}

export function setEnemyPatternAttackCount(value) {
    enemyPatternAttackCount = value;
}

export function setEnemyPatternType(value) {
    enemyPatternType = value;
}

export function setEnemyNextPatternTime(value) {
    enemyNextPatternTime = value;
}

export function setOpponentLastAttackTime(value) {
    opponentLastAttackTime = value;
}

export function setOpponentCurrentDirection(value) {
    opponentCurrentDirection = value;
}

export function setOpponentGuardDirection(value) {
    opponentGuardDirection = value;
}

export function setOpponentStamina(value) {
    opponentStamina = Math.max(0, Math.min(MAX_STAMINA, value));
}

export function setLastAttackTime(value) {
    lastAttackTime = value;
}

export function setLastImportantMessageTime(value) {
    lastImportantMessageTime = value;
}


// Reset game state
export function resetGameState() {
    opponentHealth = 100;
    playerHealth = 100;
    gameStarted = false;
    orientationEnabled = false;
    currentDirection = null;
    guardDirection = null;
    currentAttackDirection = null;
    opponentAttackType = null;
    playerStamina = MAX_STAMINA;
    isExhausted = false;
    parryWindowStart = 0;
    parryWindowEnd = 0;
    opponentAttackType = null;
    currentAttackType = null;
    isAttacking = false;
    attackCooldown = false;
    reticleX = 0;
    reticleY = 0;
    gyroCalibration = { alpha: 0, beta: 0, gamma: 0 };
    lastGyroValues = { alpha: 0, beta: 0, gamma: 0 };
}

