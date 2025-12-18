// Main Entry Point - Modular Game Structure
// This file coordinates all game modules and maintains the same workflow

// ============================================
// ERROR HANDLERS
// ============================================
window.addEventListener('error', (event) => {
    const errorMessage = event.message || event.error?.message || event.error?.toString() || '';
    const errorSource = event.filename || event.source || '';
    
    if (errorMessage.includes('message channel closed') || 
        errorMessage.includes('asynchronous response') ||
        errorSource.includes('extension://') ||
        errorSource.includes('solanaActionsContentScript')) {
        event.preventDefault();
        return true;
    }
    return false;
}, true);

window.addEventListener('unhandledrejection', (event) => {
    const errorMessage = event.reason?.message || event.reason?.toString() || '';
    if (errorMessage.includes('message channel closed') || 
        errorMessage.includes('asynchronous response')) {
        event.preventDefault();
    }
}, true);

const originalConsoleError = console.error;
console.error = function(...args) {
    const message = args.join(' ');
    if (message.includes('message channel closed') || 
        message.includes('asynchronous response') ||
        message.includes('solanaActionsContentScript')) {
        return;
    }
    originalConsoleError.apply(console, args);
};

// ============================================
// MODULE IMPORTS
// ============================================
import * as THREE from 'three';
import { scene, camera, renderer, setupScene, handleResize } from './src/sceneSetup.js';
import { gunGroup, opponentGroup, loadGunModel, loadOpponentModel, opponentMixer, opponentModel } from './src/gameObjects.js';
import * as gameState from './src/gameState.js';
import { weapons, opponents, MESSAGE_DISPLAY_TIME } from './src/config.js';
import { updateHealthBar, updateAmmoCount, updateOpponentHealthBar, updateHUD } from './src/ui.js';
import { gun, setupMouseLook, recalibrateGyroscope } from './src/controls.js';
import { handlePlayerFire, opponentShoot, updateOpponentAnimation, endGame, TWEEN } from './src/gameLogic.js';
import { startReloadSkillGame, setupReloadButton } from './src/reload.js';
import { checkSession, loginAccount, createAccount, logout, saveUserStats, loadUserStats, updateRank } from './src/auth.js';
import { initializeMenu, updateUserProfile, initializeCustomization, showCustomization, hideCustomization, showCharacterCustomization, hideCharacterCustomization, initializeCharacterCustomization } from './src/menu.js';
import { initializeNetworking, challengePlayer, calculatePlayerReward, fetchOnlinePlayers, addOnlinePlayersToGrid, sendPlayerAction, sendPlayerHit, showMatchmakingUI, hideMatchmakingUI } from './src/networking.js';

// ============================================
// GYROSCOPE PERMISSION
// ============================================
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (typeof window.orientation !== 'undefined') ||
           ('ontouchstart' in window) ||
           (navigator.maxTouchPoints > 0);
}

async function requestGyroscopePermission() {
    if (!isMobileDevice()) return false;
    if (typeof DeviceOrientationEvent === 'undefined') return false;
    
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            const response = await DeviceOrientationEvent.requestPermission();
            if (response === 'granted') {
                gun.addListeners();
                gameState.gyroEnabled = true;
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    } else {
        gun.addListeners();
        gameState.gyroEnabled = true;
        return true;
    }
}

function showGyroscopePermissionModal() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.id = 'gyro-permission-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.8); display: flex; justify-content: center;
            align-items: center; z-index: 10000; flex-direction: column; padding: 20px;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: #1a1a1a; border: 2px solid #00ffff; border-radius: 12px;
            padding: 30px; max-width: 400px; width: 90%; text-align: center; color: #ffffff;
        `;
        
        const title = document.createElement('h2');
        title.textContent = 'Enable Gyroscope';
        title.style.cssText = 'margin: 0 0 20px 0; color: #00ffff; font-size: 1.5rem;';
        
        const message = document.createElement('p');
        message.textContent = 'This game uses your device\'s gyroscope for aiming. Please allow access to device motion and orientation.';
        message.style.cssText = 'margin: 0 0 30px 0; line-height: 1.5; color: #cccccc;';
        
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; gap: 15px; justify-content: center;';
        
        const allowButton = document.createElement('button');
        allowButton.textContent = 'ALLOW';
        allowButton.style.cssText = `
            padding: 12px 30px; background: linear-gradient(135deg, #00ffff, #0088ff);
            color: #000; border: none; border-radius: 6px; font-size: 1rem;
            font-weight: bold; cursor: pointer; flex: 1;
        `;
        
        const skipButton = document.createElement('button');
        skipButton.textContent = 'SKIP';
        skipButton.style.cssText = `
            padding: 12px 30px; background: rgba(255, 255, 255, 0.1);
            color: #ffffff; border: 2px solid #666; border-radius: 6px;
            font-size: 1rem; font-weight: bold; cursor: pointer; flex: 1;
        `;
        
        allowButton.addEventListener('click', async () => {
            const granted = await requestGyroscopePermission();
            modal.remove();
            if (granted) {
                gameState.gyroscopePermissionGranted = true;
                updateHUD('GYROSCOPE ENABLED - Tilt device to aim!', '#00ff00');
                setTimeout(() => {
                    if (!gameState.gameStarted) {
                        updateHUD('STATUS: WAITING', '');
                    }
                }, 3000);
            }
            resolve(granted);
        });
        
        skipButton.addEventListener('click', () => {
            modal.remove();
            resolve(false);
        });
        
        content.appendChild(title);
        content.appendChild(message);
        buttonContainer.appendChild(allowButton);
        buttonContainer.appendChild(skipButton);
        content.appendChild(buttonContainer);
        modal.appendChild(content);
        document.body.appendChild(modal);
    });
}

async function initializeGyroscopePermission() {
    if (isMobileDevice()) {
        return await showGyroscopePermissionModal();
    }
    return false;
}

// ============================================
// LOGIN SCREEN FUNCTIONS
// ============================================
function showLoginScreen() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('register-username').value = '';
    document.getElementById('register-password').value = '';
    document.getElementById('register-confirm').value = '';
    document.getElementById('login-error').textContent = '';
    document.getElementById('register-error').textContent = '';
}

function hideLoginScreen() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
    
    if (isMobileDevice() && !gameState.gyroscopePermissionGranted) {
        setTimeout(async () => {
            const granted = await initializeGyroscopePermission();
            gameState.gyroscopePermissionGranted = granted;
        }, 500);
    }
}

function switchToLogin() {
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('tab-register').classList.remove('active');
    document.getElementById('login-form').style.display = 'flex';
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('login-error').textContent = '';
}

function switchToRegister() {
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('tab-register').classList.add('active');
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'flex';
    document.getElementById('register-error').textContent = '';
}

function setupLoginHandlers() {
    document.getElementById('tab-login').addEventListener('click', switchToLogin);
    document.getElementById('tab-register').addEventListener('click', switchToRegister);
    
    document.getElementById('btn-login').addEventListener('click', () => {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');
        
        if (!username || !password) {
            errorDiv.textContent = 'Please enter username and password';
            return;
        }
        
        const result = loginAccount(username, password);
        if (result.success) {
            errorDiv.textContent = '';
            loadUserStats();
            hideLoginScreen();
            initializeNetworking();
            const checkConnection = setInterval(() => {
                if (gameState.socket && gameState.socket.connected) {
                    clearInterval(checkConnection);
                    initializeMenu();
                    initializeCustomization();
                    setupLogoutButton();
                    setupMenuButtons();
                }
            }, 100);
            setTimeout(() => {
                clearInterval(checkConnection);
                if (!gameState.socket || !gameState.socket.connected) {
                    initializeMenu();
                    initializeCustomization();
                    setupLogoutButton();
                    setupMenuButtons();
                }
            }, 5000);
        } else {
            errorDiv.textContent = result.error;
        }
    });
    
    document.getElementById('btn-register').addEventListener('click', () => {
        const username = document.getElementById('register-username').value.trim();
        const password = document.getElementById('register-password').value;
        const confirm = document.getElementById('register-confirm').value;
        const errorDiv = document.getElementById('register-error');
        
        if (!username || !password || !confirm) {
            errorDiv.textContent = 'Please fill in all fields';
            return;
        }
        
        if (password !== confirm) {
            errorDiv.textContent = 'Passwords do not match';
            return;
        }
        
        const result = createAccount(username, password);
        if (result.success) {
            errorDiv.textContent = '';
            const loginResult = loginAccount(username, password);
            if (loginResult.success) {
                loadUserStats();
                hideLoginScreen();
                initializeMenu();
                initializeCustomization();
                initializeNetworking();
                setTimeout(() => {
                    setupMenuButtons();
                }, 100);
            }
        } else {
            errorDiv.textContent = result.error;
        }
    });
    
    // Enter key handlers
    document.getElementById('login-username').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('login-password').focus();
    });
    document.getElementById('login-password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('btn-login').click();
    });
    document.getElementById('register-username').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('register-password').focus();
    });
    document.getElementById('register-password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('register-confirm').focus();
    });
    document.getElementById('register-confirm').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('btn-register').click();
    });
}

function setupLogoutButton() {
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to logout?')) {
                logout();
                showLoginScreen();
            }
        });
    }
}

function setupMenuButtons() {
    // User profile click handler
    document.querySelector('.user-profile-section')?.addEventListener('click', (e) => {
        if (e.target.id !== 'btn-edit-username' && !e.target.closest('#btn-edit-username')) {
            showCustomization();
        }
    });
    
    // Back buttons
    document.getElementById('btn-back-to-menu')?.addEventListener('click', () => {
        hideCustomization();
    });
    
    document.getElementById('btn-back-from-character')?.addEventListener('click', () => {
        hideCharacterCustomization();
    });
    
    // Character customization button
    document.getElementById('btn-customize-character')?.addEventListener('click', () => {
        showCharacterCustomization();
        setTimeout(() => {
            if (!document.querySelector('#character-preview-container canvas')) {
                initializeCharacterCustomization();
            }
        }, 100);
    });
    
    // Cancel matchmaking
    document.getElementById('btn-cancel-matchmaking')?.addEventListener('click', () => {
        if (gameState.socket && gameState.socket.connected) {
            gameState.socket.disconnect();
            gameState.socket = null;
        }
        hideMatchmakingUI();
        initializeNetworking();
    });
}

// ============================================
// GAME INITIALIZATION
// ============================================
function initializeAuth() {
    if (checkSession()) {
        loadUserStats();
        hideLoginScreen();
        initializeNetworking();
        const checkConnection = setInterval(() => {
            if (gameState.socket && gameState.socket.connected) {
                clearInterval(checkConnection);
                initializeMenu();
                initializeCustomization();
                setupLogoutButton();
                setupMenuButtons();
            }
        }, 100);
        setTimeout(() => {
            clearInterval(checkConnection);
            if (!gameState.socket || !gameState.socket.connected) {
                initializeMenu();
                initializeCustomization();
                setupLogoutButton();
                setupMenuButtons();
            }
        }, 5000);
    } else {
        showLoginScreen();
        setupLoginHandlers();
    }
}

// ============================================
// START GAME FUNCTION
// ============================================
async function startGame(opponentData) {
    let success = false;
    if (gameState.gyroscopePermissionGranted) {
        gun.addListeners();
        gameState.gyroEnabled = true;
        success = true;
    } else {
        success = await gun.initialize();
        if (success) {
            gameState.gyroEnabled = true;
            gameState.gyroscopePermissionGranted = true;
        }
    }
    
    if (success) {
        gameState.gyroCalibration = { alpha: 0, beta: 0, gamma: 0 };
        gameState.lastGyroValues = { alpha: 0, beta: 0, gamma: 0 };
    } else {
        gameState.gyroEnabled = false;
    }
    
    document.getElementById('ui-layer').style.background = 'none';
    document.getElementById('ui-layer').style.pointerEvents = 'none';
    
    gameState.opponentHealth = opponentData.health;
    gameState.currentOpponentData = opponentData;
    gameState.OPPONENT_SHOOT_INTERVAL = 1500 / opponentData.speed;
    
    gameState.enemyAttackPhase = 'normal';
    gameState.enemyPatternShotCount = 0;
    gameState.enemyPatternType = 'single';
    gameState.enemyNextPatternTime = 0;
    
    gameState.gameStarted = true;
    opponentGroup.visible = true;
    gunGroup.visible = true;
    
    camera.position.set(0, 1.7, 0);
    camera.quaternion.set(0, 0, 0, 1);
    camera.lookAt(0, 1.7, -10);
    
    setTimeout(() => {
        gameState.orientationEnabled = true;
    }, 100);
    
    const fireOnClick = (e) => {
        if (gameState.gameStarted && !gameState.isReloading) {
            e.preventDefault();
            gun.fire();
        }
    };
    document.addEventListener('click', fireOnClick);
    document.addEventListener('touchend', fireOnClick);
    
    setupMouseLook();
    gameState.reticleX = 0;
    gameState.reticleY = 0;
    
    updateHUD("STATUS: AIMING (Ready)", "");
    document.getElementById('crosshair').classList.add('visible');
    document.getElementById('health-bar-container').classList.add('visible');
    document.getElementById('ammo-count').classList.add('visible');
    document.getElementById('reload-button').classList.add('visible');
    
    gameState.playerHealth = 100;
    const selectedWeapon = weapons.find(w => w.id === gameState.userStats.selectedWeapon) || weapons[0];
    gameState.maxAmmo = selectedWeapon.ammo;
    gameState.playerAmmo = gameState.maxAmmo;
    
    await loadGunModel(selectedWeapon.model);
    
    const ammoCount = document.getElementById('ammo-count');
    ammoCount.innerHTML = '';
    for (let i = 0; i < gameState.maxAmmo; i++) {
        const bullet = document.createElement('div');
        bullet.className = 'bullet';
        ammoCount.appendChild(bullet);
    }
    
    updateHealthBar();
    updateAmmoCount();
    updateOpponentHealthBar();
}

async function startPvPGame(data) {
    let success = false;
    if (gameState.gyroscopePermissionGranted) {
        gun.addListeners();
        gameState.gyroEnabled = true;
        success = true;
    } else {
        success = await gun.initialize();
        if (success) {
            gameState.gyroEnabled = true;
            gameState.gyroscopePermissionGranted = true;
        }
    }
    
    if (success) {
        gameState.gyroCalibration = { alpha: 0, beta: 0, gamma: 0 };
        gameState.lastGyroValues = { alpha: 0, beta: 0, gamma: 0 };
    } else {
        gameState.gyroEnabled = false;
    }
    
    document.getElementById('ui-layer').style.background = 'none';
    document.getElementById('ui-layer').style.pointerEvents = 'none';
    
    gameState.opponentHealth = 100;
    gameState.playerHealth = 100;
    
    const selectedWeapon = weapons.find(w => w.id === gameState.userStats.selectedWeapon) || weapons[0];
    gameState.playerAmmo = selectedWeapon.ammo;
    gameState.maxAmmo = selectedWeapon.ammo;
    gameState.gameStarted = true;
    
    opponentGroup.visible = true;
    gunGroup.visible = true;
    
    camera.position.set(0, 1.7, 0);
    camera.quaternion.set(0, 0, 0, 1);
    camera.lookAt(0, 1.7, -10);
    
    setTimeout(() => {
        gameState.orientationEnabled = true;
    }, 100);
    
    opponentGroup.position.set(0, 0, -20);
    
    setupMouseLook();
    gameState.reticleX = 0;
    gameState.reticleY = 0;
    
    const fireOnClick = (e) => {
        if (gameState.gameStarted && !gameState.isReloading) {
            e.preventDefault();
            gun.fire();
        }
    };
    document.addEventListener('click', fireOnClick);
    document.addEventListener('touchend', fireOnClick);
    
    document.getElementById('crosshair').classList.add('visible');
    document.getElementById('health-bar-container').classList.add('visible');
    document.getElementById('ammo-count').classList.add('visible');
    document.getElementById('reload-button').classList.add('visible');
    
    const ammoCountEl = document.getElementById('ammo-count');
    ammoCountEl.innerHTML = '';
    for (let i = 0; i < gameState.maxAmmo; i++) {
        const bullet = document.createElement('div');
        bullet.className = 'bullet';
        ammoCountEl.appendChild(bullet);
    }
    
    updateHUD("STATUS: AIMING (Ready)", "");
    updateHealthBar();
    updateAmmoCount();
}

// ============================================
// ANIMATION LOOP
// ============================================
let opponentAnimationTime = 0;

function animate(time) {
    requestAnimationFrame(animate);
    TWEEN.update(time);
    
    if (opponentMixer && gameState.gameStarted) {
        const delta = opponentAnimationTime > 0 ? (time - opponentAnimationTime) / 1000 : 0.016;
        opponentAnimationTime = time;
        opponentMixer.update(delta);
    } else {
        opponentAnimationTime = time;
    }
    
    if (gameState.gameStarted) {
        camera.updateMatrixWorld();
        const localOffset = new THREE.Vector3(0.15, -0.15, -0.1);
        const worldOffset = localOffset.clone().applyMatrix4(camera.matrixWorld);
        gunGroup.position.copy(worldOffset);
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(gameState.reticleX, gameState.reticleY), camera);
        const direction = raycaster.ray.direction.clone();
        const targetPoint = gunGroup.position.clone().add(direction.multiplyScalar(100));
        gunGroup.lookAt(targetPoint);
    }
    
    if (gameState.opponentHealth > 0 && gameState.gameStarted && gameState.playerHealth > 0) {
        opponentGroup.position.x = Math.sin(time * 0.001) * 8;
        opponentGroup.position.y = 0;
        updateOpponentAnimation();
        
        const playerPos = camera.position.clone();
        const opponentPos = opponentGroup.position.clone();
        opponentPos.y += 1.5;
        const lookDirection = new THREE.Vector3()
            .subVectors(playerPos, opponentPos)
            .normalize();
        const angle = Math.atan2(lookDirection.x, lookDirection.z);
        opponentGroup.rotation.y = angle;
        
        if (opponentGroup.userData.healthBarFill) {
            opponentGroup.userData.healthBarFill.lookAt(camera.position);
            if (opponentGroup.userData.healthBarBg) {
                opponentGroup.userData.healthBarBg.lookAt(camera.position);
            }
        }
        
        if (!gameState.isPvPMode) {
            opponentShoot();
        }
    }
    
    renderer.render(scene, camera);
}
animate();

// ============================================
// INITIALIZATION
// ============================================
setupScene();
loadOpponentModel();
updateHealthBar();
updateAmmoCount();
setupReloadButton();

// Export functions for use by other modules
window.startGame = startGame;
window.startPvPGame = startPvPGame;
window.endGame = endGame;
window.updateUserProfile = updateUserProfile;
window.saveUserStats = saveUserStats;
window.calculatePlayerReward = calculatePlayerReward;
window.fetchOnlinePlayers = fetchOnlinePlayers;
window.addOnlinePlayersToGrid = addOnlinePlayersToGrid;
window.challengePlayer = challengePlayer;
window.sendPlayerAction = sendPlayerAction;
window.sendPlayerHit = sendPlayerHit;

// Initialize authentication
initializeAuth();

console.log('Game initialized with modular structure');

