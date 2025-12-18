// Game Configuration and Data

export const weapons = [
    { 
        id: 'pistol', 
        name: 'Pistol', 
        icon: '🔫', 
        model: './Assets/pistol.glb',
        damage: 20,
        ammo: 6,
        fireRate: 300,
        description: 'Standard sidearm'
    },
    { 
        id: 'rifle', 
        name: 'Assault Rifle', 
        icon: '🔫', 
        model: './Assets/AssultRifle.glb',
        damage: 25,
        ammo: 30,
        fireRate: 200,
        description: 'High-capacity automatic weapon',
        unlocked: false
    }
];

export const opponents = [
    { id: 'pfc-1', name: 'PFC Unit-001', type: 'Standard', health: 100, damage: 15, speed: 1.0, reward: 100 },
    { id: 'pfc-2', name: 'PFC Unit-002', type: 'Standard', health: 100, damage: 15, speed: 1.0, reward: 100 },
    { id: 'pfc-3', name: 'PFC Elite', type: 'Elite', health: 150, damage: 20, speed: 1.2, reward: 200, isBoss: false },
    { id: 'pfc-4', name: 'PFC Commander', type: 'Boss', health: 200, damage: 25, speed: 1.5, reward: 500, isBoss: true },
    { id: 'pfc-5', name: 'PFC Veteran', type: 'Veteran', health: 120, damage: 18, speed: 1.1, reward: 150 },
    { id: 'pfc-6', name: 'PFC Assassin', type: 'Assassin', health: 80, damage: 30, speed: 1.8, reward: 300 }
];

export const PERFECT_ZONE_WIDTH = 10; // Width of perfect zone in percentage
export const MESSAGE_DISPLAY_TIME = 2000; // Show important messages for 2 seconds
export const DODGE_COOLDOWN_DURATION = 2000; // 2 seconds
export const DODGE_INVINCIBILITY_DURATION = 500; // 0.5 seconds of invincibility
export const OPPONENT_SHOOT_INTERVAL_BASE = 1500; // Base shoot interval

export const ACCOUNTS_KEY = 'gunBattleAccounts';
export const CURRENT_USER_KEY = 'gunBattleCurrentUser';
export const USER_STATS_KEY = 'gunBattleUserStats';

