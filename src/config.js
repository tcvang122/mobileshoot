// Game Configuration and Data - Melee Combat System

// For Honor combat timings (much faster) - Define these first
export const LIGHT_ATTACK_SPEED = 500; // 500ms for light attacks
export const HEAVY_ATTACK_SPEED = 1000; // 1000ms for heavy attacks
export const GUARD_BREAK_SPEED = 800; // 800ms for guard break
export const PARRY_WINDOW = 200; // 200ms window for parry (before attack lands)
export const GUARD_BREAK_COUNTER_WINDOW = 300; // 300ms to counter guard break

export const weapons = [
    { 
        id: 'sword', 
        name: 'Sword', 
        icon: '⚔️', 
        model: './Assets/pistol.glb', // Reuse model for now
        lightDamage: 12,
        heavyDamage: 25,
        guardBreakDamage: 5, // Guard break does minimal damage but opens opponent
        lightAttackSpeed: LIGHT_ATTACK_SPEED,
        heavyAttackSpeed: HEAVY_ATTACK_SPEED,
        guardBreakSpeed: GUARD_BREAK_SPEED,
        staminaCost: { light: 10, heavy: 20, guardBreak: 15 },
        description: 'Balanced melee weapon'
    },
    { 
        id: 'axe', 
        name: 'Axe', 
        icon: '🪓', 
        model: './Assets/AssultRifle.glb', // Reuse model for now
        lightDamage: 15,
        heavyDamage: 30,
        guardBreakDamage: 8,
        lightAttackSpeed: LIGHT_ATTACK_SPEED + 100, // Slightly slower
        heavyAttackSpeed: HEAVY_ATTACK_SPEED + 200,
        guardBreakSpeed: GUARD_BREAK_SPEED + 100,
        staminaCost: { light: 12, heavy: 25, guardBreak: 18 },
        description: 'Heavy hitting weapon',
        unlocked: false
    }
];

// Guard/Attack directions (For Honor style - only 3 guard directions)
export const GUARD_DIRECTIONS = {
    UP: 'up',
    LEFT: 'left',
    RIGHT: 'right'
    // DOWN is for dodging, not guarding
};

// Attack directions (can attack from any direction, including guard direction)
export const ATTACK_DIRECTIONS = {
    UP: 'up',
    DOWN: 'down',
    LEFT: 'left',
    RIGHT: 'right'
};

// Attack types
export const ATTACK_TYPES = {
    LIGHT: 'light',
    HEAVY: 'heavy',
    GUARD_BREAK: 'guard_break' // Special unblockable attack
};

// Tilt thresholds for direction detection (in degrees)
export const TILT_THRESHOLD = 30; // Minimum tilt to register a direction
export const TILT_DEADZONE = 10; // Deadzone to prevent accidental direction changes

export const opponents = [
    { id: 'pfc-1', name: 'PFC Unit-001', type: 'Standard', health: 100, damage: 15, speed: 1.0, reward: 100 },
    { id: 'pfc-2', name: 'PFC Unit-002', type: 'Standard', health: 100, damage: 15, speed: 1.0, reward: 100 },
    { id: 'pfc-3', name: 'PFC Elite', type: 'Elite', health: 150, damage: 20, speed: 1.2, reward: 200, isBoss: false },
    { id: 'pfc-4', name: 'PFC Commander', type: 'Boss', health: 200, damage: 25, speed: 1.5, reward: 500, isBoss: true },
    { id: 'pfc-5', name: 'PFC Veteran', type: 'Veteran', health: 120, damage: 18, speed: 1.1, reward: 150 },
    { id: 'pfc-6', name: 'PFC Assassin', type: 'Assassin', health: 80, damage: 30, speed: 1.8, reward: 300 }
];

export const MESSAGE_DISPLAY_TIME = 2000; // Show important messages for 2 seconds
export const DODGE_COOLDOWN_DURATION = 1000; // 1 second cooldown
export const DODGE_INVINCIBILITY_DURATION = 400; // 0.4 seconds of invincibility
export const OPPONENT_ATTACK_INTERVAL_BASE = 3000; // Base attack interval for opponent (faster combat)
export const ATTACK_COOLDOWN = 100; // Minimum time between attacks (ms) - very fast
export const OPPONENT_ATTACK_WINDUP_TIME = 800; // Time player has to block before attack lands (ms) - For Honor style
// Attack Charge System (per-attack meter)
export const MAX_ATTACK_CHARGES = 3; // Maximum number of attack charges
export const CHARGE_REGEN_TIME = 3000; // Time in ms for each charge to regenerate (3 seconds)
export const MAX_STAMINA = 100; // Keep for backward compatibility (opponent stamina)
export const STAMINA_REGEN_RATE = 10; // Keep for backward compatibility
export const EXHAUSTED_THRESHOLD = 20; // Keep for backward compatibility

// Block timing slider constants
export const BLOCK_TIMING_SLIDER_DURATION = 1000; // How long the slider takes to cross (ms)
export const BLOCK_PERFECT_ZONE_START = 0.40; // Perfect zone starts at 40% of slider
export const BLOCK_PERFECT_ZONE_END = 0.60; // Perfect zone ends at 60% of slider
export const BLOCK_GOOD_ZONE_START = 0.30; // Good zone starts at 30%
export const BLOCK_GOOD_ZONE_END = 0.70; // Good zone ends at 70%

// Melee combat range
export const MELEE_RANGE = 8; // Distance for melee attacks to connect

export const ACCOUNTS_KEY = 'gunBattleAccounts';
export const CURRENT_USER_KEY = 'gunBattleCurrentUser';
export const USER_STATS_KEY = 'gunBattleUserStats';

