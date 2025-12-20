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
        errorMessage.includes('listener indicated an asynchronous response') ||
        errorMessage.includes('A listener indicated an asynchronous response') ||
        errorSource.includes('extension://') ||
        errorSource.includes('solanaActionsContentScript') ||
        errorSource.includes('chrome-extension://') ||
        errorSource.includes('moz-extension://') ||
        errorSource.includes('extension')) {
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    return false;
}, true);

window.addEventListener('unhandledrejection', (event) => {
    const errorMessage = event.reason?.message || event.reason?.toString() || '';
    if (errorMessage.includes('message channel closed') || 
        errorMessage.includes('asynchronous response') ||
        errorMessage.includes('listener indicated an asynchronous response') ||
        errorMessage.includes('A listener indicated an asynchronous response')) {
        event.preventDefault();
        event.stopPropagation();
    }
}, true);

// Suppress browser extension errors in console
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
console.error = function(...args) {
    const message = args.join(' ');
    if (message.includes('message channel closed') || 
        message.includes('asynchronous response') ||
        message.includes('listener indicated an asynchronous response') ||
        message.includes('A listener indicated an asynchronous response') ||
        message.includes('solanaActionsContentScript') ||
        message.includes('extension://') ||
        message.includes('chrome-extension://') ||
        message.includes('moz-extension://')) {
        return;
    }
    originalConsoleError.apply(console, args);
};
console.warn = function(...args) {
    const message = args.join(' ');
    if (message.includes('message channel closed') || 
        message.includes('asynchronous response') ||
        message.includes('listener indicated an asynchronous response') ||
        message.includes('A listener indicated an asynchronous response') ||
        message.includes('extension://')) {
        return;
    }
    originalConsoleWarn.apply(console, args);
};

// ============================================
// MODULE IMPORTS
// ============================================
import * as THREE from 'three';
import { scene, camera, renderer, setupScene, handleResize } from './sceneSetup.js';
import { gunGroup, opponentGroup, loadGunModel, loadOpponentModel, opponentMixer, opponentModel } from './gameObjects.js';
import * as gameState from './gameState.js';
import { weapons, opponents, MESSAGE_DISPLAY_TIME, STAMINA_REGEN_RATE, MAX_STAMINA } from './config.js';
import { updateHealthBar, updateDirectionIndicator, updateOpponentHealthBar, updateStaminaBar, updateOpponentStaminaBar, updateHUD, updateOpponentAttackIndicator } from './ui.js';
import { combatController, setupAttackButtons, recalibrateCombatController } from './controls.js';
import { handlePlayerAttack, opponentAttack, updateOpponentAnimation, endGame, TWEEN } from './gameLogic.js';
import { checkSession, loginAccount, createAccount, logout, saveUserStats, loadUserStats, updateRank } from './auth.js';
import { initializeMenu, updateUserProfile, initializeCustomization, showCustomization, hideCustomization, showCharacterCustomization, hideCharacterCustomization, initializeCharacterCustomization } from './menu.js';
import { initializeNetworking, challengePlayer, calculatePlayerReward, fetchOnlinePlayers, addOnlinePlayersToGrid, sendPlayerAction, sendPlayerHit, showMatchmakingUI, hideMatchmakingUI } from './networking.js';
import { setGyroEnabled, setGyroscopePermissionGranted, setGyroCalibration, setLastGyroValues, setCurrentOpponentData, setGameStarted, setOpponentHealth, setPlayerHealth, setOrientationEnabled, setOPPONENT_ATTACK_INTERVAL, setEnemyAttackPhase, setEnemyPatternAttackCount, setEnemyPatternType, setEnemyNextPatternTime, setSocket, setCurrentDirection, setPlayerStamina, setOpponentStamina } from './gameState.js';

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
                combatController.addListeners();
                setGyroEnabled(true);
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    } else {
        combatController.addListeners();
        setGyroEnabled(true);
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
                setGyroscopePermissionGranted(true);
                updateHUD('COMBAT CONTROLS ENABLED - Tilt device to select direction!', '#00ff00');
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
        const granted = await showGyroscopePermissionModal();
        if (granted) {
            setGyroscopePermissionGranted(true);
        }
        return granted;
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
            // setGyroscopePermissionGranted is already called in initializeGyroscopePermission
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
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const btnLogin = document.getElementById('btn-login');
    const btnRegister = document.getElementById('btn-register');
    
    if (!tabLogin || !tabRegister || !btnLogin || !btnRegister) {
        console.error('Login form elements not found:', { tabLogin, tabRegister, btnLogin, btnRegister });
        return;
    }
    
    tabLogin.addEventListener('click', switchToLogin);
    tabRegister.addEventListener('click', switchToRegister);
    
    btnLogin.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('Login button clicked');
        
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');
        
        if (!errorDiv) {
            console.error('login-error element not found');
            return;
        }
        
        if (!username || !password) {
            errorDiv.textContent = 'Please enter username and password';
            return;
        }
        
        console.log('Attempting login for:', username);
        const result = loginAccount(username, password);
        console.log('Login result:', result);
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
    
    btnRegister.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('Register button clicked');
        
        const username = document.getElementById('register-username').value.trim();
        const password = document.getElementById('register-password').value;
        const confirm = document.getElementById('register-confirm').value;
        const errorDiv = document.getElementById('register-error');
        
        if (!errorDiv) {
            console.error('register-error element not found');
            return;
        }
        
        if (!username || !password || !confirm) {
            errorDiv.textContent = 'Please fill in all fields';
            return;
        }
        
        if (password !== confirm) {
            errorDiv.textContent = 'Passwords do not match';
            return;
        }
        
        console.log('Creating account for:', username);
        const result = createAccount(username, password);
        console.log('Create account result:', result);
        
        if (result.success) {
            errorDiv.textContent = '';
            const loginResult = loginAccount(username, password);
            console.log('Login result:', loginResult);
            
            if (loginResult.success) {
                loadUserStats();
                hideLoginScreen();
                initializeMenu();
                initializeCustomization();
                initializeNetworking();
                setTimeout(() => {
                    setupMenuButtons();
                }, 100);
            } else {
                errorDiv.textContent = 'Account created but login failed: ' + loginResult.error;
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
            setSocket(null);
        }
        hideMatchmakingUI();
        initializeNetworking();
    });
}

// ============================================
// GAME INITIALIZATION
// ============================================
function initializeAuth() {
    console.log('Initializing auth...');
    
    // Check if login screen elements exist
    const loginScreen = document.getElementById('login-screen');
    if (!loginScreen) {
        console.error('Login screen element not found!');
        setTimeout(initializeAuth, 100); // Retry after 100ms
        return;
    }
    
    if (checkSession()) {
        console.log('Session found, loading user...');
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
        console.log('No session, showing login screen...');
        showLoginScreen();
        
        // Small delay to ensure DOM is fully ready
        setTimeout(() => {
            setupLoginHandlers();
        }, 50);
    }
}

// ============================================
// START GAME FUNCTION
// ============================================
async function startGame(opponentData) {
    let success = false;
    const isMobile = isMobileDevice();
    
    // Only try to enable gyro on mobile devices
    if (isMobile) {
        if (gameState.gyroscopePermissionGranted) {
            combatController.addListeners();
            setGyroEnabled(true);
            success = true;
        } else {
            success = await combatController.initialize();
            if (success) {
                setGyroEnabled(true);
                setGyroscopePermissionGranted(true);
            }
        }
        
        if (success) {
            // Auto-calibrate on first reading
            combatController.calibrated = false;
        } else {
            setGyroEnabled(false);
        }
    } else {
        // Desktop: disable gyro, use keyboard controls
        setGyroEnabled(false);
    }
    
    document.getElementById('ui-layer').style.background = 'none';
    document.getElementById('ui-layer').style.pointerEvents = 'none';
    
    setOpponentHealth(opponentData.health);
    setCurrentOpponentData(opponentData);
    setOPPONENT_ATTACK_INTERVAL(12000 / opponentData.speed); // Very slow attacks (4x slower)
    
    setEnemyAttackPhase('normal');
    setEnemyPatternAttackCount(0);
    setEnemyPatternType('single');
    setEnemyNextPatternTime(0);
    
    setPlayerHealth(100);
    setPlayerStamina(MAX_STAMINA);
    setOpponentStamina(MAX_STAMINA);
    
    // Load models before setting visibility
    if (!opponentModel) {
        await loadOpponentModel();
    }
    const selectedWeapon = weapons.find(w => w.id === gameState.userStats.selectedWeapon) || weapons[0];
    await loadGunModel(selectedWeapon.model);
    
    setGameStarted(true);
    opponentGroup.visible = true;
    gunGroup.visible = true;
    
    camera.position.set(0, 1.7, 0);
    camera.quaternion.set(0, 0, 0, 1);
    camera.lookAt(0, 1.7, -9); // Updated to match new opponent position
    
    setTimeout(() => {
        setOrientationEnabled(true);
    }, 100);
    
    setupAttackButtons();
    
    updateHUD("STATUS: READY - Tilt phone to select direction", "");
    document.getElementById('health-bar-container').classList.add('visible');
    document.getElementById('stamina-bar-container').classList.add('visible');
    document.getElementById('direction-indicator').classList.add('visible');
    document.getElementById('light-attack-button').classList.add('visible');
    document.getElementById('heavy-attack-button').classList.add('visible');
    
    updateHealthBar();
    updateStaminaBar();
    updateDirectionIndicator();
    updateOpponentHealthBar();
    updateOpponentStaminaBar();
    
    // Initialize direction to null
    setCurrentDirection(null);
    updateDirectionIndicator();
}

async function startPvPGame(data) {
    let success = false;
    const isMobile = isMobileDevice();
    
    // Only try to enable gyro on mobile devices
    if (isMobile) {
        if (gameState.gyroscopePermissionGranted) {
            combatController.addListeners();
            setGyroEnabled(true);
            success = true;
        } else {
            success = await combatController.initialize();
            if (success) {
                setGyroEnabled(true);
                setGyroscopePermissionGranted(true);
            }
        }
        
        if (success) {
            combatController.calibrated = false;
        } else {
            setGyroEnabled(false);
        }
    } else {
        // Desktop: disable gyro, use keyboard controls
        setGyroEnabled(false);
    }
    
    document.getElementById('ui-layer').style.background = 'none';
    document.getElementById('ui-layer').style.pointerEvents = 'none';
    
    setOpponentHealth(100);
    setPlayerHealth(100);
    setPlayerStamina(MAX_STAMINA); // Initialize stamina
    setOpponentStamina(MAX_STAMINA);
    
    // Load models before setting visibility
    if (!opponentModel) {
        await loadOpponentModel();
    }
    const selectedWeapon = weapons.find(w => w.id === gameState.userStats.selectedWeapon) || weapons[0];
    await loadGunModel(selectedWeapon.model);
    
    setGameStarted(true);
    opponentGroup.visible = true;
    gunGroup.visible = true;
    
    camera.position.set(0, 1.7, 0);
    camera.quaternion.set(0, 0, 0, 1);
    camera.lookAt(0, 1.7, -9); // Updated to match new opponent position
    
    setTimeout(() => {
        setOrientationEnabled(true);
    }, 100);
    
    opponentGroup.position.set(0, 0, -12); // Moved back so health bar and arrow direction are visible
    
    setupAttackButtons();
    
    document.getElementById('health-bar-container').classList.add('visible');
    document.getElementById('stamina-bar-container').classList.add('visible');
    document.getElementById('direction-indicator').classList.add('visible');
    document.getElementById('light-attack-button').classList.add('visible');
    document.getElementById('heavy-attack-button').classList.add('visible');
    
    updateHUD("STATUS: READY - Tilt phone to select direction", "");
    updateHealthBar();
    updateStaminaBar();
    
    // Initialize direction to null
    setCurrentDirection(null);
    updateDirectionIndicator();
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
        
        // Update direction indicator
        updateDirectionIndicator();
        
        // Keep weapon facing opponent
        const opponentPos = opponentGroup.position.clone();
        opponentPos.y += 1.5;
        gunGroup.lookAt(opponentPos);
    }
    
    if (gameState.opponentHealth > 0 && gameState.gameStarted && gameState.playerHealth > 0) {
        // Opponent stays in center, no movement
        opponentGroup.position.set(0, 0, -12); // Moved back so health bar and arrow direction are visible
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
        
        // Make stamina bar always face camera
        if (opponentGroup.userData.staminaBarFill) {
            opponentGroup.userData.staminaBarFill.lookAt(camera.position);
            if (opponentGroup.userData.staminaBarBg) {
                opponentGroup.userData.staminaBarBg.lookAt(camera.position);
            }
        }
        
        // Make guard indicator always face camera
        if (opponentGroup.userData.guardIndicator) {
            opponentGroup.userData.guardIndicator.lookAt(camera.position);
        }
        
        if (!gameState.isPvPMode) {
            opponentAttack();
        }
        
        // Regenerate stamina (For Honor style)
        if (gameState.gameStarted && gameState.playerStamina < MAX_STAMINA) {
            const regenAmount = (STAMINA_REGEN_RATE / 60); // Per frame at 60fps
            const newStamina = Math.min(MAX_STAMINA, (gameState.playerStamina || MAX_STAMINA) + regenAmount);
            setPlayerStamina(newStamina);
            updateStaminaBar();
        }
        
        // Update opponent stamina bar (3D)
        if (opponentGroup.userData.staminaBarFill) {
            updateOpponentStaminaBar();
        }
    }
    
    renderer.render(scene, camera);
}
animate();

// ============================================
// INITIALIZATION
// ============================================
// Wait for DOM to be ready before initializing
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGame);
} else {
    // DOM is already ready
    initializeGame();
}

function initializeGame() {
    console.log('Initializing game...');
    
    setupScene();
    loadOpponentModel().catch(err => console.error('Error loading opponent model:', err));
    updateHealthBar();
    updateDirectionIndicator();

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

    // Initialize authentication (this sets up login/register handlers)
    initializeAuth();

    console.log('Game initialized with modular structure');
}

