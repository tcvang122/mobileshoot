// Game State Management

import { MAX_STAMINA, EXHAUSTED_THRESHOLD, MAX_ATTACK_CHARGES, CHARGE_REGEN_TIME } from './config.js';

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
export let playerStamina = MAX_STAMINA; // Player stamina (kept for backward compatibility)
export let isExhausted = false; // Whether player is exhausted
// Attack charge system (Player)
export let availableCharges = MAX_ATTACK_CHARGES; // Number of available attack charges
export let chargeRegenTimers = []; // Array of timestamps when each charge will be ready [{readyTime: timestamp}, ...]

// Attack charge system (Opponent)
export let opponentAvailableCharges = MAX_ATTACK_CHARGES; // Number of available opponent attack charges
export let opponentChargeRegenTimers = []; // Array of timestamps when each opponent charge will be ready

// Game stats tracking
export let playerBlocks = 0; // Number of successful blocks
export let playerHits = 0; // Number of successful hits on opponent
export let opponentHits = 0; // Number of times opponent hit player

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

// Charge system functions
export function consumeCharge() {
    if (availableCharges > 0) {
        availableCharges--;
        // Add regen timer for this charge (each charge regenerates independently)
        const readyTime = Date.now() + CHARGE_REGEN_TIME;
        chargeRegenTimers.push({ readyTime });
        return true;
    }
    return false;
}

export function updateChargeRegeneration() {
    const now = Date.now();
    // Check each timer and regenerate charges that are ready
    const readyCount = chargeRegenTimers.filter(timer => timer.readyTime <= now).length;
    if (readyCount > 0 && availableCharges < MAX_ATTACK_CHARGES) {
        // Regenerate charges
        const chargesToAdd = Math.min(readyCount, MAX_ATTACK_CHARGES - availableCharges);
        availableCharges += chargesToAdd;
        // Remove processed timers (only remove the ones we just processed)
        let removed = 0;
        chargeRegenTimers = chargeRegenTimers.filter(timer => {
            if (timer.readyTime <= now && removed < chargesToAdd) {
                removed++;
                return false;
            }
            return true;
        });
    }
}

export function getChargeRegenProgress() {
    // Returns array of progress (0-1) for each charge being regenerated
    const now = Date.now();
    const progress = [];
    for (let i = 0; i < chargeRegenTimers.length; i++) {
        const timer = chargeRegenTimers[i];
        const elapsed = now - (timer.readyTime - CHARGE_REGEN_TIME);
        progress.push(Math.min(1, Math.max(0, elapsed / CHARGE_REGEN_TIME)));
    }
    return progress;
}

export function resetCharges() {
    availableCharges = MAX_ATTACK_CHARGES;
    chargeRegenTimers = [];
}

export function setAvailableCharges(value) {
    availableCharges = Math.max(0, Math.min(MAX_ATTACK_CHARGES, value));
}

// Opponent charge system functions
export function consumeOpponentCharge() {
    if (opponentAvailableCharges > 0) {
        opponentAvailableCharges--;
        // Add regen timer for this charge
        const readyTime = Date.now() + CHARGE_REGEN_TIME;
        opponentChargeRegenTimers.push({ readyTime });
        console.log(`Opponent charge consumed! Remaining: ${opponentAvailableCharges}/${MAX_ATTACK_CHARGES}, Regen in ${CHARGE_REGEN_TIME}ms`);
        return true;
    }
    console.warn(`Opponent tried to attack but has no charges! Available: ${opponentAvailableCharges}`);
    return false;
}

export function updateOpponentChargeRegeneration() {
    const now = Date.now();
    // Check each timer and regenerate charges that are ready
    const readyCount = opponentChargeRegenTimers.filter(timer => timer.readyTime <= now).length;
    if (readyCount > 0 && opponentAvailableCharges < MAX_ATTACK_CHARGES) {
        // Regenerate charges
        const chargesToAdd = Math.min(readyCount, MAX_ATTACK_CHARGES - opponentAvailableCharges);
        opponentAvailableCharges += chargesToAdd;
        // Remove processed timers
        let removed = 0;
        opponentChargeRegenTimers = opponentChargeRegenTimers.filter(timer => {
            if (timer.readyTime <= now && removed < chargesToAdd) {
                removed++;
                return false;
            }
            return true;
        });
        if (chargesToAdd > 0) {
            console.log(`Opponent charge regenerated! Now has ${opponentAvailableCharges}/${MAX_ATTACK_CHARGES} charges`);
        }
    }
}

export function resetOpponentCharges() {
    opponentAvailableCharges = MAX_ATTACK_CHARGES;
    opponentChargeRegenTimers = [];
}

// Stats tracking functions
export function incrementPlayerBlocks() {
    playerBlocks++;
}

export function incrementPlayerHits() {
    playerHits++;
}

export function incrementOpponentHits() {
    opponentHits++;
}

export function resetGameStats() {
    playerBlocks = 0;
    playerHits = 0;
    opponentHits = 0;
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
    availableCharges = MAX_ATTACK_CHARGES;
    chargeRegenTimers = [];
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

