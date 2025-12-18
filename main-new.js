// Main Entry Point - Clean Modular Structure
// This file imports and coordinates all game modules

// Error handlers (suppress browser extension errors)
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

// Import all modules
import * as THREE from 'three';
import { scene, camera, renderer, setupScene, handleResize } from './src/sceneSetup.js';
import { gunGroup, opponentGroup, loadGunModel, loadOpponentModel, opponentMixer, opponentModel } from './src/gameObjects.js';
import * as gameState from './src/gameState.js';
import { weapons, opponents } from './src/config.js';
import { updateHealthBar, updateAmmoCount, updateOpponentHealthBar, updateHUD } from './src/ui.js';
import { gun, setupMouseLook, recalibrateGyroscope } from './src/controls.js';
import { handlePlayerFire, opponentShoot, updateOpponentAnimation, endGame, TWEEN } from './src/gameLogic.js';
import { startReloadSkillGame, setupReloadButton } from './src/reload.js';
import { checkSession, loginAccount, createAccount, logout, saveUserStats, loadUserStats, updateRank } from './src/auth.js';

// Note: menu.js and networking.js will be created separately
// For now, we'll keep those functions in this file temporarily
// TODO: Extract to menu.js and networking.js

// Initialize scene
setupScene();

// Load models
loadOpponentModel();

// Animation loop
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

// Start game function
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

// Initialize UI
updateHealthBar();
updateAmmoCount();

// Setup reload button
setupReloadButton();

// Initialize authentication
if (checkSession()) {
    loadUserStats();
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
} else {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('main-menu').classList.add('hidden');
}

// Export functions for menu.js and networking.js to use
window.startGame = startGame;
window.endGame = endGame;
window.updateUserProfile = () => {
    document.getElementById('user-name').textContent = gameState.userStats.name;
    document.getElementById('user-rank').textContent = gameState.userStats.rank;
    document.getElementById('user-wins').textContent = gameState.userStats.wins;
    document.getElementById('user-credits').textContent = gameState.userStats.credits.toLocaleString();
};

console.log('Game initialized with modular structure');

