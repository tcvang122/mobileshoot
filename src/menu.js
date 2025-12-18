// Menu System

import * as gameState from './gameState.js';
import { opponents, weapons } from './config.js';

// Update user profile display
export function updateUserProfile() {
    document.getElementById('user-name').textContent = gameState.userStats.name;
    document.getElementById('user-rank').textContent = gameState.userStats.rank;
    document.getElementById('user-wins').textContent = gameState.userStats.wins;
    document.getElementById('user-credits').textContent = gameState.userStats.credits.toLocaleString();
    
    const avatarContainer = document.getElementById('user-avatar-container');
    const placeholder = avatarContainer.querySelector('.user-avatar-placeholder');
    const avatarImg = avatarContainer.querySelector('#user-avatar-img');
    
    if (gameState.userStats.avatar && avatarImg) {
        avatarImg.src = gameState.userStats.avatar;
        avatarImg.style.display = 'block';
        placeholder.style.display = 'none';
    } else {
        if (avatarImg) avatarImg.style.display = 'none';
        placeholder.style.display = 'flex';
    }
}

// Initialize menu
export function initializeMenu() {
    updateUserProfile();
    
    if (gameState.socket && gameState.socket.connected) {
        if (window.fetchOnlinePlayers) {
            window.fetchOnlinePlayers();
        }
    }
    
    const opponentGrid = document.getElementById('opponent-grid');
    opponentGrid.innerHTML = '';
    
    opponents.forEach((opponent) => {
        const card = document.createElement('div');
        card.className = `opponent-card ${opponent.isBoss ? 'boss' : ''}`;
        card.dataset.opponentId = opponent.id;
        
        card.innerHTML = `
            <div class="selected-badge">SELECTED</div>
            <div class="opponent-image-container">
                <div class="opponent-image-placeholder">🤖</div>
            </div>
            <div class="opponent-name">${opponent.name}</div>
            <div class="opponent-type">${opponent.type}</div>
            <div class="opponent-stats">
                <div class="opponent-stat">
                    <div>HP</div>
                    <div class="opponent-stat-value">${opponent.health}</div>
                </div>
                <div class="opponent-stat">
                    <div>DMG</div>
                    <div class="opponent-stat-value">${opponent.damage}</div>
                </div>
                <div class="opponent-stat">
                    <div>SPD</div>
                    <div class="opponent-stat-value">${opponent.speed}x</div>
                </div>
            </div>
            <div style="text-align: center; margin-top: 8px; color: #ffaa00; font-weight: bold; font-size: 0.75rem;">
                Reward: ${opponent.reward}
            </div>
            <button class="card-battle-button" data-opponent-id="${opponent.id}" style="width: 100%; margin-top: 10px; padding: 10px; background: linear-gradient(135deg, #00ffff 0%, #00aaff 100%); color: #000; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; text-transform: uppercase; font-size: 0.9rem;">START BATTLE</button>
        `;
        
        opponentGrid.appendChild(card);
    });
    
    if (window.addOnlinePlayersToGrid) {
        window.addOnlinePlayersToGrid();
    }
    
    setTimeout(() => {
        document.querySelectorAll('.card-battle-button:not(.player-challenge-button)').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const opponentId = button.dataset.opponentId;
                const opponent = opponents.find(o => o.id === opponentId);
                if (opponent && window.startGame) {
                    gameState.gameMode = 'singleplayer';
                    gameState.isPvPMode = false;
                    document.getElementById('main-menu').classList.add('hidden');
                    await window.startGame(opponent);
                }
            });
        });
        
        document.querySelectorAll('.player-challenge-button').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const username = button.dataset.playerUsername;
                if (username && window.challengePlayer) {
                    window.challengePlayer(username);
                }
            });
        });
    }, 100);
}

// Player customization
export function initializeCustomization() {
    const weaponGrid = document.getElementById('weapon-grid');
    weaponGrid.innerHTML = '';
    
    weapons.forEach((weapon) => {
        const isUnlocked = weapon.unlocked !== false;
        const isSelected = gameState.userStats.selectedWeapon === weapon.id;
        
        const card = document.createElement('div');
        card.className = `weapon-card ${isSelected ? 'selected' : ''} ${!isUnlocked ? 'locked' : ''}`;
        card.dataset.weaponId = weapon.id;
        
        if (!isUnlocked) {
            card.style.opacity = '0.5';
            card.style.cursor = 'not-allowed';
        }
        
        card.innerHTML = `
            <div class="weapon-icon">${weapon.icon}</div>
            <div class="weapon-name">${weapon.name}</div>
            ${!isUnlocked ? '<div style="color: #ffaa00; font-size: 0.7rem; margin-bottom: 8px;">LOCKED</div>' : ''}
            <div class="weapon-stats">
                <div class="weapon-stat">
                    <span>Damage:</span>
                    <span class="weapon-stat-value">${weapon.damage}</span>
                </div>
                <div class="weapon-stat">
                    <span>Ammo:</span>
                    <span class="weapon-stat-value">${weapon.ammo}</span>
                </div>
                <div class="weapon-stat">
                    <span>Fire Rate:</span>
                    <span class="weapon-stat-value">${weapon.fireRate}ms</span>
                </div>
            </div>
        `;
        
        if (isUnlocked) {
            card.addEventListener('click', () => {
                document.querySelectorAll('.weapon-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                gameState.userStats.selectedWeapon = weapon.id;
                if (window.saveUserStats) window.saveUserStats();
                updateCustomizationStatus();
            });
        }
        
        weaponGrid.appendChild(card);
    });
    
    updateCustomizationStatus();
}

function updateCustomizationStatus() {
    document.getElementById('status-wins').textContent = gameState.userStats.wins;
    document.getElementById('status-credits').textContent = gameState.userStats.credits.toLocaleString();
    document.getElementById('status-rank').textContent = gameState.userStats.rank;
    
    const selectedWeapon = weapons.find(w => w.id === gameState.userStats.selectedWeapon);
    document.getElementById('status-weapon').textContent = selectedWeapon ? selectedWeapon.name : 'Pistol';
    document.getElementById('status-character').textContent = 'Customized';
}

export function showCustomization() {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('player-customization').classList.add('visible');
    updateCustomizationStatus();
}

export function hideCustomization() {
    document.getElementById('player-customization').classList.remove('visible');
    document.getElementById('main-menu').classList.remove('hidden');
}

// Character customization (simplified - full implementation in original main.js)
export function initializeCharacterCustomization() {
    // Character customization code would go here
    // This is a placeholder - full implementation is in original main.js
    console.log('Character customization initialized');
}

export function showCharacterCustomization() {
    document.getElementById('player-customization').classList.remove('visible');
    document.getElementById('character-customization').classList.add('visible');
}

export function hideCharacterCustomization() {
    document.getElementById('character-customization').classList.remove('visible');
    document.getElementById('player-customization').classList.add('visible');
}

