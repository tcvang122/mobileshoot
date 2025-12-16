import * as THREE from 'three';
import { GunController } from './GunController.js';

// --- 1. Three.js Setup (The World) ---
const scene = new THREE.Scene();
// Set a neutral background color (will be covered by background plane)
scene.background = new THREE.Color(0x000000);
scene.fog = null; // Remove fog so background is clear

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// Start at head height, looking forward
camera.position.set(0, 1.7, 0);
camera.lookAt(0, 1.7, -10); // Look forward into the arena 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; // Enable shadows for realism
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game-container').appendChild(renderer.domElement);

// --- Materials ---
const materialWhite = new THREE.MeshStandardMaterial({ 
    color: 0xffffff, 
    roughness: 0.2, 
    metalness: 0.1 
});

const materialFloor = new THREE.MeshStandardMaterial({ 
    color: 0xf0f0f0, 
    roughness: 0.1, 
    metalness: 0.0 
});

const materialAccent = new THREE.MeshStandardMaterial({
    color: 0x00ffff,
    emissive: 0x00aaff,
    emissiveIntensity: 0.5,
    roughness: 0.2
});

const materialEnemy = new THREE.MeshStandardMaterial({
    color: 0xff4757,
    roughness: 0.2,
    metalness: 0.5
});

const materialGunBody = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.4,
    metalness: 0.8
});

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(20, 50, 20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
scene.add(dirLight);

// --- Background Image Plane ---
const textureLoader = new THREE.TextureLoader();
const backgroundTexture = textureLoader.load('./Assets/BG001.png', 
    // onLoad callback
    () => {
        console.log('Background image loaded');
    },
    // onProgress callback
    undefined,
    // onError callback
    (error) => {
        console.error('Error loading background image:', error);
    }
);

// Create a large plane for the background
// Calculate size based on camera FOV and distance to ensure full coverage
const backgroundDistance = 50; // Distance from camera
const fov = camera.fov * (Math.PI / 180); // Convert to radians
const height = 2 * Math.tan(fov / 2) * backgroundDistance;
const aspect = window.innerWidth / window.innerHeight;
const width = height * aspect;

// Make it extra large to ensure full coverage
const backgroundPlane = new THREE.PlaneGeometry(width * 1.5, height * 1.5);
const backgroundMaterial = new THREE.MeshBasicMaterial({
    map: backgroundTexture,
    side: THREE.DoubleSide
});
const backgroundMesh = new THREE.Mesh(backgroundPlane, backgroundMaterial);
// Position it far back, behind the opponent
backgroundMesh.position.set(0, 1.7, -backgroundDistance);
// Make sure it faces the camera
backgroundMesh.lookAt(camera.position);
scene.add(backgroundMesh);


// --- Gameplay Objects ---

// 1. The Gun Model (Follows Camera)
// Create a group that will follow camera position/rotation
const gunGroup = new THREE.Group();
gunGroup.visible = false; // Hide until game starts
scene.add(gunGroup);

// Gun Body
const bodyGeo = new THREE.BoxGeometry(0.1, 0.15, 0.4);
const gunBody = new THREE.Mesh(bodyGeo, materialGunBody);
gunBody.position.set(0.15, -0.15, -0.3); // Bottom right (relative to camera)
gunGroup.add(gunBody);

// Gun Barrel
const barrelGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 16);
const gunBarrel = new THREE.Mesh(barrelGeo, materialGunBody);
gunBarrel.rotation.x = Math.PI / 2;
gunBarrel.position.set(0.15, -0.1, -0.5);
gunGroup.add(gunBarrel);

// Muzzle Flash Light
const muzzleLight = new THREE.PointLight(0xffaa00, 0, 5);
muzzleLight.position.set(0.15, -0.1, -0.8);
gunGroup.add(muzzleLight);

// Gun will be positioned relative to camera in the animate loop


// 2. The Opponent
const opponentGroup = new THREE.Group();
opponentGroup.position.set(0, 0, -35); // Further away
opponentGroup.visible = false; // Hide initially
scene.add(opponentGroup);

// Enemy Body
// CapsuleGeometry: radius, length, capSubdivisions, radialSegments
// Total height = length + 2*radius = 1.8 + 2*0.5 = 2.8
const enemyGeo = new THREE.CapsuleGeometry(0.5, 1.8, 4, 8);
const enemyBody = new THREE.Mesh(enemyGeo, materialEnemy);
// Position opponent to align with blue line in background (ground level)
// Lowered significantly to match the blue line position
const capsuleHeight = 1.8 + (0.5 * 2); // length + 2*radius
enemyBody.position.y = (capsuleHeight / 2) - 5.0; // Lowered by 1.0 units to align with blue line
enemyBody.castShadow = true;
opponentGroup.add(enemyBody);

// Enemy Head (Visor) - Position relative to body top
const visorGeo = new THREE.BoxGeometry(0.4, 0.2, 0.3);
const visor = new THREE.Mesh(visorGeo, materialAccent); // Glowing eyes
// Position visor at top of capsule (body center + half height)
const bodyTopY = enemyBody.position.y + (capsuleHeight / 2);
visor.position.set(0, bodyTopY + 0.1, 0.25);
opponentGroup.add(visor);

// Health State
let opponentHealth = 100;
let playerHealth = 100; // Player health
let playerAmmo = 30; // Player ammo count
let maxAmmo = 30;
let gameStarted = false;
let lastImportantMessageTime = 0;
let lastFireTime = 0; // Fire rate limiting
let orientationEnabled = false; // Delay orientation control slightly after game starts
const MESSAGE_DISPLAY_TIME = 2000; // Show important messages for 2 seconds

// Reticle Position (normalized screen coordinates -1 to 1)
let reticleX = 0; // Horizontal position (-1 to 1)
let reticleY = 0; // Vertical position (-1 to 1)


// --- 2. Gun Controller Integration ---

const hud = document.getElementById('hud');
const healthBarFill = document.getElementById('health-bar-fill');
const ammoCount = document.getElementById('ammo-count');

// Function to update health bar
function updateHealthBar() {
    const percentage = Math.max(0, Math.min(100, playerHealth));
    healthBarFill.style.width = percentage + '%';
    
    // Change color based on health level
    if (percentage > 60) {
        healthBarFill.style.background = 'linear-gradient(90deg, #00ff00, #00cc00)';
    } else if (percentage > 30) {
        healthBarFill.style.background = 'linear-gradient(90deg, #ffaa00, #ff8800)';
    } else {
        healthBarFill.style.background = 'linear-gradient(90deg, #ff0000, #cc0000)';
    }
}

// Function to update ammo count
function updateAmmoCount() {
    ammoCount.textContent = playerAmmo;
    if (playerAmmo <= 5) {
        ammoCount.classList.add('low');
    } else {
        ammoCount.classList.remove('low');
    }
}

// Initialize UI
updateHealthBar();
updateAmmoCount();

const gun = new GunController({
    // A. AIMING
    onAim: ({ alpha, beta, gamma }) => {
        // Device orientation now only affects reticle position, not camera rotation
        // Camera stays fixed - only reticle moves
        if (!gameStarted || !orientationEnabled) return;
        
        // Check for valid orientation values
        if (alpha === null || beta === null || gamma === null) return;
        
        // Convert device orientation to reticle position
        // Map orientation angles to screen coordinates
        const normalizedAlpha = (alpha / 360) * 2 - 1; // -1 to 1
        const normalizedBeta = (beta / 180); // -1 to 1
        
        reticleX = THREE.MathUtils.clamp(normalizedAlpha, -1, 1);
        reticleY = THREE.MathUtils.clamp(-normalizedBeta, -1, 1);
        
        // Update crosshair visual position based on reticle
        const crosshair = document.getElementById('crosshair');
        const rect = renderer.domElement.getBoundingClientRect();
        const screenX = ((reticleX + 1) / 2) * rect.width;
        const screenY = ((1 - reticleY) / 2) * rect.height;
        crosshair.style.left = screenX + 'px';
        crosshair.style.top = screenY + 'px';
    },

    // B. HOLSTERING
    onHolsterStatus: (isHolstered) => {
        // Don't update HUD if we just showed an important message
        const timeSinceLastMessage = Date.now() - lastImportantMessageTime;
        if (timeSinceLastMessage < MESSAGE_DISPLAY_TIME && !isHolstered) {
            return; // Keep the important message visible
        }
        
        if (isHolstered) {
            hud.innerText = "STATUS: HOLSTERED (Safe)";
            hud.classList.add('holstered');
            document.getElementById('crosshair').classList.remove('visible');
            // Lower the gun out of view
            new TWEEN.Tween(gunGroup.position)
                .to({ y: -0.5, x: 0.1 }, 300)
                .easing(TWEEN.Easing.Quadratic.Out)
                .start();
        } else if (gameStarted) {
            // Only show "AIMING" if game has started and no important message is showing
            hud.innerText = "STATUS: AIMING (Ready)";
            hud.classList.remove('holstered');
            document.getElementById('crosshair').classList.add('visible');
            // Bring gun back up
            new TWEEN.Tween(gunGroup.position)
                .to({ y: 0, x: 0 }, 300)
                .easing(TWEEN.Easing.Quadratic.Out)
                .start();
        }
    },

    // C. FIRING
    onFire: () => {
        if (!gameStarted || opponentHealth <= 0) return; // Only fire if game started
        
        // Check ammo
        if (playerAmmo <= 0) {
            hud.innerText = "OUT OF AMMO!";
            return;
        }
        
        // Fire rate limiting
        const now = Date.now();
        if (now - lastFireTime < 300) return; // Max 3 shots per second
        lastFireTime = now;
        
        // Decrease ammo
        playerAmmo--;
        updateAmmoCount();

        hud.innerText = "STATUS: 🔥 FIRE! 🔥";
        hud.classList.add('firing');
        
        // 1. Visual Recoil (Kickback) - More pronounced
        const originalZ = gunGroup.position.z;
        const originalRotX = gunGroup.rotation.x;
        gunGroup.position.z += 0.15;
        gunGroup.rotation.x += 0.15;
        gunGroup.position.y -= 0.05;
        
        // 2. Enhanced Muzzle Flash
        muzzleLight.intensity = 3;
        muzzleLight.color.setHex(0xffff00);
        
        // Create muzzle flash sprite
        const flashGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const flashMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffff00, 
            transparent: true, 
            opacity: 0.9 
        });
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.copy(muzzleLight.position);
        gunGroup.add(flash);
        
        // Return to normal after recoil
        setTimeout(() => {
            gunGroup.position.z = originalZ;
            gunGroup.rotation.x = originalRotX;
            gunGroup.position.y += 0.05;
            muzzleLight.intensity = 0;
            gunGroup.remove(flash);
            flash.geometry.dispose();
            flash.material.dispose();
            hud.classList.remove('firing');
        }, 150);
        
        // 3. Shoot raycast using reticle position
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(reticleX, reticleY), camera); 
        
        // Check collision with opponent (body and visor)
        const intersects = raycaster.intersectObjects([enemyBody, visor], true);
        
        if (intersects.length > 0) {
            const hitPoint = intersects[0].point;
            
            // Create hit effect (spark/particle)
            const hitGeometry = new THREE.SphereGeometry(0.2, 8, 8);
            const hitMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xffffff, 
                transparent: true, 
                opacity: 0.8 
            });
            const hitEffect = new THREE.Mesh(hitGeometry, hitMaterial);
            hitEffect.position.copy(hitPoint);
            scene.add(hitEffect);
            
            // Animate hit effect
            new TWEEN.Tween(hitEffect.scale)
                .to({ x: 0, y: 0, z: 0 }, 200)
                .onComplete(() => {
                    scene.remove(hitEffect);
                    hitEffect.geometry.dispose();
                    hitEffect.material.dispose();
                })
                .start();
            
            new TWEEN.Tween(hitEffect.material)
                .to({ opacity: 0 }, 200)
                .start();
            
            // Hit!
            opponentHealth -= 20; // 5 shots to kill
            
            // Visual hit reaction - flash red
            enemyBody.material.color.setHex(0xff0000);
            setTimeout(() => enemyBody.material.color.setHex(0xff4757), 150);
            
            if (opponentHealth <= 0) {
                // Death sequence
                lastImportantMessageTime = Date.now();
                hud.innerText = "VICTORY! TARGET NEUTRALIZED";
                hud.style.color = "#00ffff";
                
                // Fall over
                new TWEEN.Tween(opponentGroup.rotation)
                    .to({ x: -Math.PI / 2 }, 500)
                    .easing(TWEEN.Easing.Bounce.Out)
                    .start();
            } else {
                lastImportantMessageTime = Date.now();
                hud.innerText = `HIT! ENEMY HEALTH: ${opponentHealth}%`;
            }
        } else {
            // Miss - show feedback
            lastImportantMessageTime = Date.now();
            hud.innerText = "MISS!";
            setTimeout(() => {
                if (Date.now() - lastImportantMessageTime >= 500) {
                    hud.innerText = "STATUS: AIMING (Ready)";
                }
            }, 500);
        }
    }
});

// --- 3. Start Sequence ---
document.getElementById('btn-start').addEventListener('click', async (e) => {
    const success = await gun.initialize();
    if (success) {
        e.target.style.display = 'none';
        document.getElementById('ui-layer').style.background = 'none';
        document.getElementById('ui-layer').style.pointerEvents = 'none';
        
        // Start the match
        gameStarted = true;
        opponentGroup.visible = true;
        gunGroup.visible = true; // Show gun when game starts
        
        // Reset camera to proper forward view when game starts
        camera.position.set(0, 1.7, 0);
        camera.quaternion.set(0, 0, 0, 1); // Reset rotation to identity (looking forward)
        camera.lookAt(0, 1.7, -10); // Look forward into the arena
        
        // Enable orientation control after a brief delay to ensure camera is reset
        setTimeout(() => {
            orientationEnabled = true;
        }, 100);
        
        // Add click/tap to fire
        const fireOnClick = (e) => {
            if (gameStarted && !gun.isHolstered) {
                e.preventDefault();
                gun.fire(); // Call the fire method
            }
        };
        document.addEventListener('click', fireOnClick);
        document.addEventListener('touchend', fireOnClick);
        
        // Mouse/Touch Look Controls
        setupMouseLook();
        
        // Initialize reticle at center
        reticleX = 0;
        reticleY = 0;
        
        hud.innerText = "STATUS: AIMING (Ready)";
        hud.classList.remove('holstered');
        
        // Show crosshair
        document.getElementById('crosshair').classList.add('visible');
        
        // Show health bar and ammo count
        document.getElementById('health-bar-container').classList.add('visible');
        document.getElementById('ammo-count').classList.add('visible');
        
        // Reset player stats
        playerHealth = 100;
        playerAmmo = 30;
        updateHealthBar();
        updateAmmoCount();
    } else {
        alert("Sensors not enabled. Check browser permissions.");
    }
});

// --- 4. Render Loop & Tweening ---
// We need a simple Tween library or just lerp manually. 
// For simplicity, I'll include a minimal TWEEN shim here since we don't have the library installed via npm yet
// and I want to avoid external dependencies if possible.
const TWEEN = {
    tweens: [],
    getAll() { return this.tweens; },
    removeAll() { this.tweens = []; },
    add(tween) { this.tweens.push(tween); },
    remove(tween) {
        const i = this.tweens.indexOf(tween);
        if (i !== -1) this.tweens.splice(i, 1);
    },
    update(time) {
        if (this.tweens.length === 0) return false;
        let i = 0;
        while (i < this.tweens.length) {
            if (this.tweens[i].update(time)) {
                i++;
            } else {
                this.tweens.splice(i, 1);
            }
        }
        return true;
    },
    Easing: { 
        Quadratic: { Out: (k) => k * (2 - k) },
        Bounce: { Out: (k) => {
            if (k < (1 / 2.75)) { return 7.5625 * k * k; } 
            else if (k < (2 / 2.75)) { return 7.5625 * (k -= (1.5 / 2.75)) * k + 0.75; } 
            else if (k < (2.5 / 2.75)) { return 7.5625 * (k -= (2.25 / 2.75)) * k + 0.9375; } 
            else { return 7.5625 * (k -= (2.625 / 2.75)) * k + 0.984375; }
        }}
    },
    Tween: class {
        constructor(object) {
            this.object = object;
            this.valuesStart = {};
            this.valuesEnd = {};
            this.duration = 1000;
            this.startTime = null;
            this.easingFunction = TWEEN.Easing.Quadratic.Out;
            this.onUpdateCallback = null;
        }
        to(properties, duration) {
            this.valuesEnd = properties;
            if (duration !== undefined) this.duration = duration;
            return this;
        }
        start(time) {
            TWEEN.add(this);
            this.startTime = time !== undefined ? time : performance.now();
            for (const property in this.valuesEnd) {
                this.valuesStart[property] = parseFloat(this.object[property]);
            }
            return this;
        }
        easing(easing) { this.easingFunction = easing; return this; }
        onUpdate(callback) { this.onUpdateCallback = callback; return this; }
        update(time) {
            let elapsed = (time || performance.now()) - this.startTime;
            if (elapsed > this.duration) elapsed = this.duration;
            const value = this.easingFunction(elapsed / this.duration);
            for (const property in this.valuesEnd) {
                const start = this.valuesStart[property];
                const end = this.valuesEnd[property];
                this.object[property] = start + (end - start) * value;
            }
            if (this.onUpdateCallback) this.onUpdateCallback(this.object);
            return elapsed < this.duration;
        }
    }
};

function animate(time) {
    requestAnimationFrame(animate);
    TWEEN.update(time); // Update tweens
    
    // Only update gun position if game has started
    if (gameStarted) {
        // Update camera matrix before using it
        camera.updateMatrixWorld();
        
        // Make gun follow camera position and rotation
        // Use camera's world matrix to transform local offset
        const localOffset = new THREE.Vector3(0.15, -0.15, -0.3);
        const worldOffset = localOffset.clone().applyMatrix4(camera.matrixWorld);
        gunGroup.position.copy(worldOffset);
        gunGroup.quaternion.copy(camera.quaternion);
    }
    
    // Animate Enemy (Lateral Movement only - keep feet on ground)
    if (opponentHealth > 0 && gameStarted) {
        // Move left and right (sine wave) - reduced range to keep on screen
        // Range: -8 to 8, Speed: 0.001
        opponentGroup.position.x = Math.sin(time * 0.001) * 8;
        
        // Keep opponent group at ground level (y: 0)
        opponentGroup.position.y = 0;
    }
    
    renderer.render(scene, camera);
}
animate();

// Mouse/Touch Reticle Setup (only moves reticle, not camera)
function setupMouseLook() {
    const crosshair = document.getElementById('crosshair');
    
    // Update reticle position based on mouse/touch
    const updateReticle = (clientX, clientY) => {
        if (!gameStarted || gun.isHolstered) return;
        
        // Convert screen coordinates to normalized device coordinates (-1 to 1)
        const rect = renderer.domElement.getBoundingClientRect();
        const x = ((clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((clientY - rect.top) / rect.height) * 2 + 1;
        
        // Clamp to screen bounds (optional - remove if you want reticle to go off-screen)
        reticleX = THREE.MathUtils.clamp(x, -1, 1);
        reticleY = THREE.MathUtils.clamp(y, -1, 1);
        
        // Update crosshair visual position
        crosshair.style.left = clientX + 'px';
        crosshair.style.top = clientY + 'px';
    };
    
    // Mouse move handler
    const handleMouseMove = (e) => {
        updateReticle(e.clientX, e.clientY);
    };
    
    // Touch move handler
    const handleTouchMove = (e) => {
        if (!gameStarted || gun.isHolstered) return;
        if (e.touches.length === 1) {
            e.preventDefault();
            updateReticle(e.touches[0].clientX, e.touches[0].clientY);
        }
    };
    
    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
}

// Function to update background plane size
function updateBackgroundSize() {
    const backgroundDistance = 50;
    const fov = camera.fov * (Math.PI / 180);
    const height = 2 * Math.tan(fov / 2) * backgroundDistance;
    const aspect = window.innerWidth / window.innerHeight;
    const width = height * aspect;
    
    // Update background plane geometry
    backgroundMesh.geometry.dispose();
    backgroundMesh.geometry = new THREE.PlaneGeometry(width * 1.5, height * 1.5);
}

// Handle Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    updateBackgroundSize();
});
