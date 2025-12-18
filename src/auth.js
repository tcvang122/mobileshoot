// Authentication and Account Management

import * as gameState from './gameState.js';
import { ACCOUNTS_KEY, CURRENT_USER_KEY } from './config.js';

// Account storage functions
export function getAccounts() {
    try {
        const accountsJson = localStorage.getItem(ACCOUNTS_KEY);
        return accountsJson ? JSON.parse(accountsJson) : {};
    } catch (e) {
        console.warn('Failed to load accounts:', e);
        return {};
    }
}

export function saveAccounts(accounts) {
    try {
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch (e) {
        console.warn('Failed to save accounts:', e);
    }
}

export function createAccount(username, password) {
    const accounts = getAccounts();
    
    if (username.length < 3 || username.length > 20) {
        return { success: false, error: 'Username must be 3-20 characters' };
    }
    
    if (accounts[username.toLowerCase()]) {
        return { success: false, error: 'Username already exists' };
    }
    
    if (password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters' };
    }
    
    accounts[username.toLowerCase()] = {
        username: username,
        password: btoa(password),
        stats: {
            name: username.toUpperCase(),
            rank: "Rookie",
            wins: 0,
            credits: 0,
            avatar: null,
            selectedWeapon: 'pistol',
            characterCustomization: {
                primaryColor: '#ffffff',
                secondaryColor: '#333333'
            }
        },
        createdAt: Date.now()
    };
    
    saveAccounts(accounts);
    return { success: true };
}

export function loginAccount(username, password) {
    const accounts = getAccounts();
    const account = accounts[username.toLowerCase()];
    
    if (!account) {
        return { success: false, error: 'Username not found' };
    }
    
    if (account.password !== btoa(password)) {
        return { success: false, error: 'Incorrect password' };
    }
    
    gameState.currentUser = username.toLowerCase();
    gameState.userStats = { ...account.stats };
    gameState.isAuthenticated = true;
    
    try {
        localStorage.setItem(CURRENT_USER_KEY, gameState.currentUser);
    } catch (e) {
        console.warn('Failed to save session:', e);
    }
    
    return { success: true };
}

export function checkSession() {
    try {
        const savedUser = localStorage.getItem(CURRENT_USER_KEY);
        if (savedUser) {
            const accounts = getAccounts();
            const account = accounts[savedUser];
            if (account) {
                gameState.currentUser = savedUser;
                gameState.userStats = { ...account.stats };
                gameState.isAuthenticated = true;
                return true;
            }
        }
    } catch (e) {
        console.warn('Failed to check session:', e);
    }
    return false;
}

export function logout() {
    if (gameState.isAuthenticated && gameState.currentUser) {
        saveUserStats();
    }
    
    if (gameState.socket && gameState.socket.connected) {
        gameState.socket.disconnect();
        gameState.socket = null;
    }
    
    gameState.currentUser = null;
    gameState.isAuthenticated = false;
    gameState.userStats = {
        name: "OPERATOR",
        rank: "Rookie",
        wins: 0,
        credits: 0,
        avatar: null,
        selectedWeapon: 'pistol',
        characterCustomization: {
            primaryColor: '#ffffff',
            secondaryColor: '#333333'
        }
    };
    gameState.onlinePlayersList = [];
    
    try {
        localStorage.removeItem(CURRENT_USER_KEY);
    } catch (e) {
        console.warn('Failed to clear session:', e);
    }
}

export function saveUserStats() {
    if (!gameState.isAuthenticated || !gameState.currentUser) return;
    
    try {
        const accounts = getAccounts();
        if (accounts[gameState.currentUser]) {
            accounts[gameState.currentUser].stats = { ...gameState.userStats };
            saveAccounts(accounts);
        }
    } catch (e) {
        console.warn('Failed to save user stats:', e);
    }
}

export function loadUserStats() {
    if (!gameState.isAuthenticated || !gameState.currentUser) return;
    
    try {
        const accounts = getAccounts();
        const account = accounts[gameState.currentUser];
        if (account && account.stats) {
            gameState.userStats = { ...gameState.userStats, ...account.stats };
            if (!gameState.userStats.characterCustomization) {
                gameState.userStats.characterCustomization = {
                    primaryColor: '#ffffff',
                    secondaryColor: '#333333'
                };
            }
        }
    } catch (e) {
        console.warn('Failed to load user stats:', e);
    }
}

export function updateRank() {
    if (gameState.userStats.wins >= 50) {
        gameState.userStats.rank = "Legend";
    } else if (gameState.userStats.wins >= 30) {
        gameState.userStats.rank = "Master";
    } else if (gameState.userStats.wins >= 20) {
        gameState.userStats.rank = "Expert";
    } else if (gameState.userStats.wins >= 10) {
        gameState.userStats.rank = "Veteran";
    } else if (gameState.userStats.wins >= 5) {
        gameState.userStats.rank = "Soldier";
    } else {
        gameState.userStats.rank = "Rookie";
    }
}

