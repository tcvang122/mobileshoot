// Menu System

import * as gameState from './gameState.js';
import { setIsPvPMode, setGameMode } from './gameState.js';
import { opponents, weapons } from './config.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { saveUserStats } from './auth.js';

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
                    setGameMode('singleplayer');
                    setIsPvPMode(false);
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
                    <span>Light Damage:</span>
                    <span class="weapon-stat-value">${weapon.lightDamage}</span>
                </div>
                <div class="weapon-stat">
                    <span>Heavy Damage:</span>
                    <span class="weapon-stat-value">${weapon.heavyDamage}</span>
                </div>
                <div class="weapon-stat">
                    <span>Light Speed:</span>
                    <span class="weapon-stat-value">${weapon.lightAttackSpeed}ms</span>
                </div>
                <div class="weapon-stat">
                    <span>Heavy Speed:</span>
                    <span class="weapon-stat-value">${weapon.heavyAttackSpeed}ms</span>
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
    document.getElementById('status-weapon').textContent = selectedWeapon ? selectedWeapon.name : 'Sword';
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

// Character customization
let characterPreviewScene = null;
let characterPreviewCamera = null;
let characterPreviewRenderer = null;
let characterPreviewModel = null;
let characterPreviewLight = null;
let characterPreviewAnimationFrame = null;
let characterPreviewResizeHandler = null;

export function initializeCharacterCustomization() {
    const previewContainer = document.getElementById('character-preview-container');
    if (!previewContainer) return;
    
    // Clear any existing content
    previewContainer.innerHTML = '';
    
    // Create Three.js scene for character preview
    characterPreviewScene = new THREE.Scene();
    characterPreviewScene.background = new THREE.Color(0x1a1a2e);
    
    // Camera
    characterPreviewCamera = new THREE.PerspectiveCamera(
        50,
        previewContainer.clientWidth / previewContainer.clientHeight,
        0.1,
        1000
    );
    characterPreviewCamera.position.set(0, 1.5, 3);
    characterPreviewCamera.lookAt(0, 1, 0);
    
    // Renderer
    characterPreviewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    characterPreviewRenderer.setSize(previewContainer.clientWidth, previewContainer.clientHeight);
    characterPreviewRenderer.shadowMap.enabled = true;
    previewContainer.appendChild(characterPreviewRenderer.domElement);
    
    // Handle window resize
    if (characterPreviewResizeHandler) {
        window.removeEventListener('resize', characterPreviewResizeHandler);
    }
    characterPreviewResizeHandler = () => {
        if (characterPreviewRenderer && previewContainer) {
            const width = previewContainer.clientWidth;
            const height = previewContainer.clientHeight;
            characterPreviewCamera.aspect = width / height;
            characterPreviewCamera.updateProjectionMatrix();
            characterPreviewRenderer.setSize(width, height);
        }
    };
    window.addEventListener('resize', characterPreviewResizeHandler);
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    characterPreviewScene.add(ambientLight);
    
    characterPreviewLight = new THREE.DirectionalLight(0xffffff, 0.8);
    characterPreviewLight.position.set(5, 10, 5);
    characterPreviewLight.castShadow = true;
    characterPreviewScene.add(characterPreviewLight);
    
    const fillLight = new THREE.DirectionalLight(0x00ffff, 0.3);
    fillLight.position.set(-5, 5, -5);
    characterPreviewScene.add(fillLight);
    
    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(10, 10);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    characterPreviewScene.add(ground);
    
    // Load character model (using PFC model as player character)
    const loader = new GLTFLoader();
    loader.load(
        './Assets/PFC.glb',
        (gltf) => {
            characterPreviewModel = gltf.scene.clone();
            
            // Scale the model
            characterPreviewModel.scale.set(2.0, 2.0, 2.0);
            
            // Get bounding box to position model correctly
            const box = new THREE.Box3().setFromObject(characterPreviewModel);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            
            // Position so bottom of model is at ground level
            characterPreviewModel.position.set(0, size.y / 2 - center.y, 0);
            
            // Apply customization colors
            applyCharacterColors(characterPreviewModel);
            
            // Enable shadows
            characterPreviewModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            characterPreviewScene.add(characterPreviewModel);
            
            // Adjust camera to show the whole character
            // Calculate the distance needed to fit the character in view
            const maxDim = Math.max(size.x, size.y, size.z);
            const distance = maxDim * 2.5; // Distance multiplier to ensure full visibility
            
            // Position camera to show full character
            characterPreviewCamera.position.set(0, size.y * 0.6, distance);
            characterPreviewCamera.lookAt(0, size.y * 0.3, 0);
            characterPreviewCamera.updateProjectionMatrix();
            
            // Start animation loop
            animateCharacterPreview();
        },
        undefined,
        (error) => {
            console.error('Error loading character model:', error);
        }
    );
    
    // Set up color selection handlers
    setupColorHandlers();
    
    // Update selected colors in UI
    updateColorSelection();
}

function setupColorHandlers() {
    // Primary color handlers
    document.querySelectorAll('.color-option').forEach(option => {
        option.addEventListener('click', () => {
            // Remove selected class from all primary color options
            document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
            // Add selected class to clicked option
            option.classList.add('selected');
            
            const color = option.dataset.color;
            if (!gameState.userStats.characterCustomization) {
                gameState.userStats.characterCustomization = { primaryColor: '#ffffff', secondaryColor: '#333333' };
            }
            gameState.userStats.characterCustomization.primaryColor = color;
            saveUserStats();
            
            // Apply color to character model
            if (characterPreviewModel) {
                applyCharacterColors(characterPreviewModel);
            }
        });
    });
    
    // Secondary color handlers
    document.querySelectorAll('.color-option-secondary').forEach(option => {
        option.addEventListener('click', () => {
            // Remove selected class from all secondary color options
            document.querySelectorAll('.color-option-secondary').forEach(o => o.classList.remove('selected'));
            // Add selected class to clicked option
            option.classList.add('selected');
            
            const color = option.dataset.color;
            if (!gameState.userStats.characterCustomization) {
                gameState.userStats.characterCustomization = { primaryColor: '#ffffff', secondaryColor: '#333333' };
            }
            gameState.userStats.characterCustomization.secondaryColor = color;
            saveUserStats();
            
            // Apply color to character model
            if (characterPreviewModel) {
                applyCharacterColors(characterPreviewModel);
            }
        });
    });
}

function updateColorSelection() {
    const primaryColor = gameState.userStats.characterCustomization?.primaryColor || '#ffffff';
    const secondaryColor = gameState.userStats.characterCustomization?.secondaryColor || '#333333';
    
    document.querySelectorAll('.color-option').forEach(option => {
        if (option.dataset.color === primaryColor) {
            option.classList.add('selected');
            option.style.border = '3px solid #00ffff';
            option.style.boxShadow = '0 0 10px rgba(0, 255, 255, 0.5)';
        } else {
            option.classList.remove('selected');
            option.style.border = '3px solid transparent';
            option.style.boxShadow = 'none';
        }
    });
    
    document.querySelectorAll('.color-option-secondary').forEach(option => {
        if (option.dataset.color === secondaryColor) {
            option.classList.add('selected');
            option.style.border = '3px solid #00ffff';
            option.style.boxShadow = '0 0 10px rgba(0, 255, 255, 0.5)';
        } else {
            option.classList.remove('selected');
            option.style.border = '3px solid transparent';
            option.style.boxShadow = 'none';
        }
    });
}

// Apply character colors to model
function applyCharacterColors(model) {
    if (!model) return;
    
    const primaryColor = new THREE.Color(gameState.userStats.characterCustomization?.primaryColor || '#ffffff');
    const secondaryColor = new THREE.Color(gameState.userStats.characterCustomization?.secondaryColor || '#333333');
    
    let meshCount = 0;
    model.traverse((child) => {
        if (child.isMesh) {
            // Alternate between primary and secondary colors
            if (meshCount % 2 === 0) {
                child.material = new THREE.MeshStandardMaterial({
                    color: primaryColor,
                    roughness: 0.7,
                    metalness: 0.3
                });
            } else {
                child.material = new THREE.MeshStandardMaterial({
                    color: secondaryColor,
                    roughness: 0.7,
                    metalness: 0.3
                });
            }
            meshCount++;
        }
    });
}

// Animate character preview
function animateCharacterPreview() {
    if (!characterPreviewRenderer || !characterPreviewScene || !characterPreviewCamera) return;
    
    characterPreviewAnimationFrame = requestAnimationFrame(animateCharacterPreview);
    
    // Rotate the character slowly
    if (characterPreviewModel) {
        characterPreviewModel.rotation.y += 0.005;
    }
    
    characterPreviewRenderer.render(characterPreviewScene, characterPreviewCamera);
}

export function showCharacterCustomization() {
    document.getElementById('player-customization').classList.remove('visible');
    document.getElementById('character-customization').classList.add('visible');
    
    // Initialize if not already done
    setTimeout(() => {
        if (!document.querySelector('#character-preview-container canvas')) {
            initializeCharacterCustomization();
        } else {
            // Update color selection when showing
            updateColorSelection();
        }
    }, 100);
}

export function hideCharacterCustomization() {
    document.getElementById('character-customization').classList.remove('visible');
    document.getElementById('player-customization').classList.add('visible');
    
    // Stop animation when hiding
    if (characterPreviewAnimationFrame) {
        cancelAnimationFrame(characterPreviewAnimationFrame);
        characterPreviewAnimationFrame = null;
    }
}

