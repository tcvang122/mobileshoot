import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AnimationMixer } from 'three';
import { GunController } from './GunController.js';
import { io } from 'socket.io-client';

// Global error handler to catch browser extension errors (harmless)
window.addEventListener('error', (event) => {
    // Suppress known browser extension errors that don't affect functionality
    const errorMessage = event.message || event.error?.message || event.error?.toString() || '';
    const errorSource = event.filename || event.source || '';
    
    if (errorMessage.includes('message channel closed') || 
        errorMessage.includes('asynchronous response') ||
        errorMessage.includes('Extension context invalidated') ||
        errorMessage.includes('runtime.lastError') ||
        errorMessage.includes('Something went wrong') ||
        errorSource.includes('extension://') ||
        errorSource.includes('chrome-extension://') ||
        errorSource.includes('solanaActionsContentScript') ||
        errorSource.includes('contentScript')) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return true;
    }
    return false;
}, true); // Use capture phase

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    const errorMessage = event.reason?.message || event.reason?.toString() || '';
    const errorStack = event.reason?.stack || '';
    
    if (errorMessage.includes('message channel closed') || 
        errorMessage.includes('asynchronous response') ||
        errorMessage.includes('Extension context invalidated') ||
        errorMessage.includes('runtime.lastError') ||
        errorMessage.includes('Something went wrong') ||
        errorStack.includes('solanaActionsContentScript') ||
        errorStack.includes('contentScript')) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }
}, true); // Use capture phase

// Additional error suppression for console
const originalConsoleError = console.error;
console.error = function(...args) {
    const message = args.join(' ');
    if (message.includes('message channel closed') || 
        message.includes('asynchronous response') ||
        message.includes('Extension context invalidated') ||
        message.includes('runtime.lastError') ||
        message.includes('Unchecked runtime.lastError') ||
        message.includes('Something went wrong') ||
        message.includes('solanaActionsContentScript')) {
        return; // Suppress these errors
    }
    originalConsoleError.apply(console, args);
};

// --- 1. Three.js Setup (The World) ---
const scene = new THREE.Scene();
// Light blue sky
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.FogExp2(0x87ceeb, 0.01); // Light blue fog for depth

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// Start at head height, looking forward
camera.position.set(0, 1.7, 0);
camera.lookAt(0, 1.7, -10); // Look forward into the arena 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; // Enable shadows for realism
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game-container').appendChild(renderer.domElement);

// --- Materials (Futuristic/Sci-Fi Theme) ---
const materialMetal = new THREE.MeshStandardMaterial({ 
    color: 0x888888, // Metallic grey
    roughness: 0.2, 
    metalness: 0.9 
});

const materialMetalDark = new THREE.MeshStandardMaterial({ 
    color: 0x333333, // Dark metal
    roughness: 0.1, 
    metalness: 0.95 
});

const materialFloor = new THREE.MeshStandardMaterial({ 
    color: 0x1a1a2e, // Dark futuristic floor
    roughness: 0.3, 
    metalness: 0.8 
});

const materialBuilding = new THREE.MeshStandardMaterial({ 
    color: 0xffffff, // Clean white for buildings
    roughness: 0.1, 
    metalness: 0.7 
});

const materialAccent = new THREE.MeshStandardMaterial({
    color: 0x00ffff,
    emissive: 0x00aaff,
    emissiveIntensity: 0.8,
    roughness: 0.2,
    metalness: 0.5
});

const materialEnemy = new THREE.MeshStandardMaterial({
    color: 0xff4757, // Red/orange for robot
    roughness: 0.3,
    metalness: 0.8,
    emissive: 0x330000,
    emissiveIntensity: 0.2
});

const materialRobotHead = new THREE.MeshStandardMaterial({
    color: 0x00ffff, // Cyan visor/head
    emissive: 0x00aaff,
    emissiveIntensity: 0.6,
    roughness: 0.2,
    metalness: 0.9
});

const materialGunBody = new THREE.MeshStandardMaterial({
    color: 0x222222, // Dark futuristic gunmetal
    roughness: 0.2,
    metalness: 0.95,
    emissive: 0x001122,
    emissiveIntensity: 0.1
});

// --- Lighting (Futuristic) ---
const ambientLight = new THREE.AmbientLight(0x4444ff, 0.4); // Cool blue ambient
scene.add(ambientLight);

// Main directional light (cool, bright)
const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
dirLight.position.set(20, 50, 20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.left = -50;
dirLight.shadow.camera.right = 50;
dirLight.shadow.camera.top = 50;
dirLight.shadow.camera.bottom = -50;
scene.add(dirLight);

// Add colored accent lights for sci-fi feel
const accentLight1 = new THREE.PointLight(0x00ffff, 0.5, 30);
accentLight1.position.set(-20, 10, -30);
scene.add(accentLight1);

const accentLight2 = new THREE.PointLight(0xff00ff, 0.5, 30);
accentLight2.position.set(20, 10, -30);
scene.add(accentLight2);

// --- Redesigned Scene: Multi-Level Arena ---

// Main ground platform (larger, more interesting shape)
const mainPlatformGeo = new THREE.PlaneGeometry(100, 80);
const mainPlatform = new THREE.Mesh(mainPlatformGeo, materialFloor);
mainPlatform.rotation.x = -Math.PI / 2;
mainPlatform.position.set(0, 0, -15);
mainPlatform.receiveShadow = true;
scene.add(mainPlatform);

// Add subtle grid pattern to main platform
const gridHelper = new THREE.GridHelper(100, 20, 0x4a90e2, 0x2a5a8a);
gridHelper.position.set(0, 0.01, -15);
scene.add(gridHelper);

// Elevated side platforms (create depth and interest)
for (let i = 0; i < 2; i++) {
    const sidePlatformGeo = new THREE.PlaneGeometry(30, 40);
    const sidePlatform = new THREE.Mesh(sidePlatformGeo, materialMetalDark);
    sidePlatform.rotation.x = -Math.PI / 2;
    sidePlatform.position.set(
        (i === 0 ? -35 : 35),
        1.5,
        -20 - i * 10
    );
    sidePlatform.receiveShadow = true;
    scene.add(sidePlatform);
    
    // Add railings to platforms
    const railingGeo = new THREE.BoxGeometry(30, 0.3, 0.3);
    const railingMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.9, roughness: 0.2 });
    for (let j = 0; j < 2; j++) {
        const railing = new THREE.Mesh(railingGeo, railingMat);
        railing.position.set(
            (i === 0 ? -35 : 35),
            1.65,
            -20 - i * 10 + (j === 0 ? -20 : 20)
        );
        scene.add(railing);
    }
}

// --- Modern Industrial Structures ---

// Large support pillars/columns
for (let i = 0; i < 6; i++) {
    const pillarGeo = new THREE.CylinderGeometry(1.5, 1.5, 8, 16);
    const pillar = new THREE.Mesh(pillarGeo, materialMetal);
    pillar.position.set(
        -40 + (i % 3) * 40,
        4,
        -25 - Math.floor(i / 3) * 15
    );
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    scene.add(pillar);
    
    // Add glowing rings to pillars
    const ringGeo = new THREE.TorusGeometry(1.6, 0.1, 8, 16);
    const ringMat = new THREE.MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x00aaff,
        emissiveIntensity: 0.8
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(pillar.position);
    ring.position.y = pillar.position.y + 2;
    scene.add(ring);
}

// Overhead walkways/bridges
for (let i = 0; i < 3; i++) {
    const bridgeGeo = new THREE.BoxGeometry(25, 0.5, 3);
    const bridge = new THREE.Mesh(bridgeGeo, materialMetalDark);
    bridge.position.set(
        -30 + i * 30,
        6,
        -20 - i * 5
    );
    bridge.castShadow = true;
    bridge.receiveShadow = true;
    scene.add(bridge);
    
    // Add support cables
    const cableGeo = new THREE.CylinderGeometry(0.1, 0.1, 4, 8);
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
    for (let j = 0; j < 2; j++) {
        const cable = new THREE.Mesh(cableGeo, cableMat);
        cable.rotation.z = Math.PI / 2;
        cable.position.set(
            -30 + i * 30 + (j === 0 ? -12 : 12),
            4,
            -20 - i * 5
        );
        scene.add(cable);
    }
}

// --- Tech Props & Details ---

// Large circular platforms (landing pads style)
for (let i = 0; i < 4; i++) {
    const padGeo = new THREE.CylinderGeometry(4, 4, 0.2, 32);
    const padMat = new THREE.MeshStandardMaterial({
        color: 0x2a2a3a,
        metalness: 0.8,
        roughness: 0.3
    });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(
        -30 + (i % 2) * 60,
        0.1,
        -30 - Math.floor(i / 2) * 20
    );
    pad.receiveShadow = true;
    scene.add(pad);
    
    // Add glowing center
    const centerGeo = new THREE.CylinderGeometry(1, 1, 0.1, 16);
    const centerMat = new THREE.MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x00aaff,
        emissiveIntensity: 0.6
    });
    const center = new THREE.Mesh(centerGeo, centerMat);
    center.rotation.x = -Math.PI / 2;
    center.position.copy(pad.position);
    center.position.y = 0.15;
    scene.add(center);
}

// Tech panels on walls/structures
for (let i = 0; i < 8; i++) {
    const panelGeo = new THREE.BoxGeometry(3, 2, 0.2);
    const panelMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a2e,
        emissive: 0x003366,
        emissiveIntensity: 0.3
    });
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.position.set(
        -35 + (i % 4) * 23,
        2,
        -15 - Math.floor(i / 4) * 25
    );
    scene.add(panel);
    
    // Add glowing lines on panels
    const lineGeo = new THREE.BoxGeometry(2.5, 0.1, 0.05);
    const lineMat = new THREE.MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x00aaff,
        emissiveIntensity: 1.0
    });
    for (let j = 0; j < 3; j++) {
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.position.copy(panel.position);
        line.position.y = panel.position.y - 0.5 + j * 0.5;
        line.position.z = panel.position.z + 0.1;
        scene.add(line);
    }
}

// Decorative geometric shapes
for (let i = 0; i < 5; i++) {
    const shapeType = Math.floor(Math.random() * 3);
    let shape;
    
    if (shapeType === 0) {
        shape = new THREE.Mesh(
            new THREE.OctahedronGeometry(1, 0),
            materialAccent
        );
    } else if (shapeType === 1) {
        shape = new THREE.Mesh(
            new THREE.TetrahedronGeometry(1, 0),
            materialAccent
        );
    } else {
        shape = new THREE.Mesh(
            new THREE.IcosahedronGeometry(1, 0),
            materialAccent
        );
    }
    
    shape.position.set(
        -20 + Math.random() * 40,
        1 + Math.random() * 2,
        -25 - Math.random() * 20
    );
    shape.castShadow = true;
    scene.add(shape);
}


// --- Gameplay Objects ---

// 1. The Gun Model (Follows Camera)
// Create a group that will follow camera position/rotation
const gunGroup = new THREE.Group();
gunGroup.visible = false; // Hide until game starts
scene.add(gunGroup);

// Muzzle Flash Light (cyan for sci-fi) - will be positioned after gun loads
const muzzleLight = new THREE.PointLight(0x00ffff, 0, 5);
gunGroup.add(muzzleLight);

// Load the assault rifle GLB model
let gunModel = null;
let muzzlePosition = new THREE.Vector3(0, 0, -0.5); // Default position, will update after load

const loader = new GLTFLoader();
loader.load(
    './Assets/pistol.glb',
    (gltf) => {
        gunModel = gltf.scene;
        
        // Scale and position the gun appropriately for FPV
        // Scale reduced by 20% (0.576 * 0.8 = 0.4608)
        gunModel.scale.set(0.4608, 0.4608, 0.4608);
        
        // Position gun closer and higher to show iron sight
        gunModel.position.set(0.15, -0.15, -0.1);
        
        // Rotate gun to proper FPS orientation
        // Try common rotations to fix sideways gun:
        // - If barrel points wrong way: rotate Y (yaw)
        // - If gun is tilted: rotate X (pitch) or Z (roll)
        // Try: -90° around X to tilt gun up, or 90° around Z if it's rolled
        gunModel.rotation.set(-2, 1.5, 2); // Rotate -90° around X axis (common for FPS guns)
        
        // Replace materials to remove strip colors and use clean material
        const cleanGunMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff, // White
            roughness: 0.3,
            metalness: 0.8
        });
        
        // Enable shadows and replace materials
        gunModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                // Replace material to remove strip colors
                child.material = cleanGunMaterial;
            }
        });
        
        gunGroup.add(gunModel);
        
        // Find muzzle position - look for barrel end or estimate from bounding box
        const box = new THREE.Box3().setFromObject(gunModel);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        // Muzzle is at the front of the gun (after rotation, front is now at negative Z)
        // Position at the front end of the gun model
        muzzlePosition.set(
            gunModel.position.x,
            gunModel.position.y,
            gunModel.position.z - size.z * 0.5 - 0.15
        );
        muzzleLight.position.copy(muzzlePosition);
        
        console.log('Pistol loaded successfully');
    },
    (progress) => {
        // Loading progress
        console.log('Loading gun model:', (progress.loaded / progress.total * 100) + '%');
    },
    (error) => {
        console.error('Error loading gun model:', error);
        // Fallback to simple gun if loading fails
        const gunBodyGeo = new THREE.BoxGeometry(0.12, 0.18, 0.45);
        const gunBody = new THREE.Mesh(gunBodyGeo, materialGunBody);
        gunBody.position.set(0.15, -0.15, -0.3);
        gunGroup.add(gunBody);
        
        const barrelGeo = new THREE.CylinderGeometry(0.035, 0.03, 0.45, 16);
        const gunBarrel = new THREE.Mesh(barrelGeo, materialGunBody);
        gunBarrel.rotation.x = Math.PI / 2;
        gunBarrel.position.set(0.15, -0.1, -0.55);
        gunGroup.add(gunBarrel);
        
        muzzleLight.position.set(0.15, -0.1, -0.8);
    }
);

// Gun will be positioned relative to camera in the animate loop


// 2. The Opponent (PFC Model)
const opponentGroup = new THREE.Group();
opponentGroup.position.set(0, 0, -20); // Closer to player
opponentGroup.visible = false; // Hide initially
scene.add(opponentGroup);

let opponentModel = null;
let opponentMixer = null;
let opponentActions = {}; // Changed to object to store by name

// Load the PFC model
loader.load(
    './Assets/PFC.glb',
    (gltf) => {
        opponentModel = gltf.scene;
        
        // Scale the PFC model bigger
        opponentModel.scale.set(3.0, 3.0, 3.0);
        
        // Get bounding box to position model correctly on ground
        const box = new THREE.Box3().setFromObject(opponentModel);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        // Position so bottom of model is at ground level (y: 0)
        // The center.y is relative to the model, so we need to offset by half the height
        opponentModel.position.set(0, size.y / 2 - center.y, 0);
        
        // Enable shadows
        opponentModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        opponentGroup.add(opponentModel);
        
        // Create 3D health bar above opponent
        const healthBarWidth = 2;
        const healthBarHeight = 0.3;
        const healthBarGeo = new THREE.PlaneGeometry(healthBarWidth, healthBarHeight);
        const healthBarBgMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x000000, 
            transparent: true, 
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        const healthBarBg = new THREE.Mesh(healthBarGeo, healthBarBgMaterial);
        healthBarBg.position.set(0, size.y + 1, 0); // Above the model
        opponentGroup.add(healthBarBg);
        
        // Health bar fill
        const healthBarFillGeo = new THREE.PlaneGeometry(healthBarWidth, healthBarHeight);
        const healthBarFillMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff0000, 
            transparent: true, 
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        const healthBarFill3D = new THREE.Mesh(healthBarFillGeo, healthBarFillMaterial);
        healthBarFill3D.position.set(0, size.y + 1, 0.01); // Slightly in front
        healthBarFill3D.scale.x = 1; // Will be updated based on health
        opponentGroup.add(healthBarFill3D);
        
        // Store reference for updating
        opponentGroup.userData.healthBarFill = healthBarFill3D;
        opponentGroup.userData.healthBarBg = healthBarBg;
        
        // Create opponent muzzle flash light (red for enemy)
        opponentMuzzleLight = new THREE.PointLight(0xff0000, 0, 5);
        // Position at opponent's front (approximate gun position - chest/head level)
        opponentMuzzleLight.position.set(0, size.y * 0.6, size.z * 0.3); // In front of opponent
        opponentGroup.add(opponentMuzzleLight);
        opponentGroup.userData.muzzlePosition = opponentMuzzleLight.position.clone();
        
        // Set up animations if the model has them
        if (gltf.animations && gltf.animations.length > 0) {
            opponentMixer = new AnimationMixer(opponentModel);
            
            // Create actions for all animations and store by name
            opponentActions = {};
            gltf.animations.forEach((clip) => {
                const action = opponentMixer.clipAction(clip);
                action.setLoop(THREE.LoopRepeat); // Loop animations by default
                opponentActions[clip.name] = action;
                console.log('Found animation:', clip.name);
            });
            
            // Play idle animation by default (or first animation if no idle)
            if (opponentActions['Idle'] || opponentActions['idle']) {
                const idleAction = opponentActions['Idle'] || opponentActions['idle'];
                idleAction.play();
                opponentGroup.userData.currentAnimation = idleAction;
            } else if (Object.keys(opponentActions).length > 0) {
                // Play first available animation
                const firstAction = Object.values(opponentActions)[0];
                firstAction.play();
                opponentGroup.userData.currentAnimation = firstAction;
            }
        } else {
            console.log('No animations found in PFC model');
        }
        
        console.log('PFC opponent loaded successfully');
    },
    (progress) => {
        // Loading progress
        console.log('Loading opponent model:', (progress.loaded / progress.total * 100) + '%');
    },
    (error) => {
        console.error('Error loading opponent model:', error);
        // Fallback to simple opponent if loading fails
        const enemyBodyGeo = new THREE.CapsuleGeometry(0.5, 1.4, 4, 8);
        const enemyBody = new THREE.Mesh(enemyBodyGeo, materialEnemy);
        enemyBody.position.y = 0;
        enemyBody.castShadow = true;
        opponentGroup.add(enemyBody);
    }
);

// Health State
let opponentHealth = 100;
let playerHealth = 100; // Player health
let playerAmmo = 6; // Player ammo count
let maxAmmo = 6;
let isReloading = false; // Track if reload is in progress
let reloadSkillBarAnimationFrame = null; // Animation frame ID for reload bar
let reloadSliderPosition = 0; // Current position of reload slider (0-100)
let reloadSliderDirection = 1; // Direction: 1 = right, -1 = left
let reloadLastAnimationTime = 0; // For smooth reload animation timing
let reloadPerfectZoneStart = 45; // Perfect zone start (percentage) - will be randomized
let reloadPerfectZoneEnd = 55; // Perfect zone end (percentage) - 10% wide zone
const PERFECT_ZONE_WIDTH = 10; // Width of perfect zone in percentage
let gameStarted = false;
let lastImportantMessageTime = 0;
let lastFireTime = 0; // Fire rate limiting
let orientationEnabled = false; // Delay orientation control slightly after game starts
const MESSAGE_DISPLAY_TIME = 2000; // Show important messages for 2 seconds

// Opponent Shooting
let opponentLastShotTime = 0;
let OPPONENT_SHOOT_INTERVAL = 1500; // Shoot every 1.5 seconds (will be adjusted based on opponent)
let opponentMuzzleLight = null; // Light for opponent muzzle flash
let currentOpponentData = null; // Store selected opponent data
let currentPvPOpponentStats = null; // Store PvP opponent stats for reward calculation

// Enemy Attack Patterns
let enemyAttackPhase = 'normal'; // 'normal', 'aggressive', 'desperate'
let enemyPatternShotCount = 0; // Track shots in current pattern
let enemyPatternType = 'single'; // 'single', 'burst', 'rapid'
let enemyNextPatternTime = 0; // When to switch patterns

// Dodge Mechanics
let isDodging = false;
let dodgeCooldown = false;
let dodgeCooldownTime = 0;
const DODGE_COOLDOWN_DURATION = 2000; // 2 seconds
const DODGE_INVINCIBILITY_DURATION = 500; // 0.5 seconds of invincibility
let dodgeInvincibilityEnd = 0;
let originalCameraPosition = new THREE.Vector3();

// Authentication System
let currentUser = null; // Currently logged in user
let isAuthenticated = false;

// Account Storage (localStorage - can be migrated to server later)
const ACCOUNTS_KEY = 'gunBattleAccounts';
const CURRENT_USER_KEY = 'gunBattleCurrentUser';

// Menu System
let selectedOpponent = null;
let userStats = {
    name: "OPERATOR",
    rank: "Rookie",
    wins: 0,
    credits: 0,
    avatar: null, // Will store image URL or data
    selectedWeapon: 'pistol', // Default weapon
    characterCustomization: {
        primaryColor: '#ffffff',
        secondaryColor: '#333333'
    }
};

// PvP Networking
let socket = null;
let isPvPMode = false;
let currentRoomId = null;
let opponentPlayer = null;
let isPlayer1 = false;
let gameMode = 'singleplayer'; // 'singleplayer' or 'pvp'
let matchmakingActive = false;
// Auto-detect server URL based on hostname
// For local development: use localhost
// For phone testing: replace 'localhost' with your computer's IP (e.g., '192.168.12.187')
const getServerURL = () => {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3000';
    } else {
        // If accessing from phone, use the same hostname but port 3000
        return `http://${hostname}:3000`;
    }
};
const SERVER_URL = getServerURL();

// Available weapons
const weapons = [
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
        unlocked: false // Can be unlocked with credits
    }
];

const opponents = [
    { id: 'pfc-1', name: 'PFC Unit-001', type: 'Standard', health: 100, damage: 15, speed: 1.0, reward: 100 },
    { id: 'pfc-2', name: 'PFC Unit-002', type: 'Standard', health: 100, damage: 15, speed: 1.0, reward: 100 },
    { id: 'pfc-3', name: 'PFC Elite', type: 'Elite', health: 150, damage: 20, speed: 1.2, reward: 200, isBoss: false },
    { id: 'pfc-4', name: 'PFC Commander', type: 'Boss', health: 200, damage: 25, speed: 1.5, reward: 500, isBoss: true },
    { id: 'pfc-5', name: 'PFC Veteran', type: 'Veteran', health: 120, damage: 18, speed: 1.1, reward: 150 },
    { id: 'pfc-6', name: 'PFC Assassin', type: 'Assassin', health: 80, damage: 30, speed: 1.8, reward: 300 }
];

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

// Function to update ammo count (show individual bullets)
function updateAmmoCount() {
    const bullets = ammoCount.querySelectorAll('.bullet');
    bullets.forEach((bullet, index) => {
        if (index < playerAmmo) {
            bullet.classList.remove('empty');
        } else {
            bullet.classList.add('empty');
        }
    });
    
    // Add low ammo warning when 2 or fewer bullets remain
    if (playerAmmo <= 2) {
        ammoCount.classList.add('low');
    } else {
        ammoCount.classList.remove('low');
    }
    
    // Update reload button state
    const reloadBtn = document.getElementById('reload-button');
    if (reloadBtn) {
        if (playerAmmo >= maxAmmo) {
            reloadBtn.disabled = true;
            reloadBtn.style.opacity = '0.5';
            reloadBtn.style.pointerEvents = 'none';
        } else if (!isReloading) {
            reloadBtn.disabled = false;
            reloadBtn.style.opacity = '1';
            reloadBtn.style.pointerEvents = 'auto';
        }
    }
}

// Function to update opponent health bar (3D only)
function updateOpponentHealthBar() {
    const percentage = Math.max(0, Math.min(100, opponentHealth));
    
    // Update 3D health bar above opponent
    if (opponentGroup.userData.healthBarFill) {
        const healthBarFill3D = opponentGroup.userData.healthBarFill;
        healthBarFill3D.scale.x = percentage / 100;
        
        // Update color based on health
        if (percentage > 60) {
            healthBarFill3D.material.color.setHex(0xff0000);
        } else if (percentage > 30) {
            healthBarFill3D.material.color.setHex(0xff6600);
        } else {
            healthBarFill3D.material.color.setHex(0xff3333);
        }
        
        // Make health bar face camera (billboard effect)
        healthBarFill3D.lookAt(camera.position);
        if (opponentGroup.userData.healthBarBg) {
            opponentGroup.userData.healthBarBg.lookAt(camera.position);
        }
    }
}

// Determine enemy attack phase based on health
function getEnemyAttackPhase() {
    const healthPercent = (opponentHealth / (currentOpponentData?.health || 100)) * 100;
    if (healthPercent <= 30) {
        return 'desperate'; // Very aggressive when low health
    } else if (healthPercent <= 60) {
        return 'aggressive'; // More aggressive at mid health
    }
    return 'normal'; // Standard behavior
}

// Get attack pattern based on phase
function getEnemyAttackPattern(phase) {
    const now = Date.now();
    
    // Switch patterns periodically
    if (now > enemyNextPatternTime) {
        const patterns = {
            'normal': ['single', 'single', 'burst'], // Mostly single shots, occasional burst
            'aggressive': ['burst', 'single', 'rapid', 'burst'], // More bursts and rapid fire
            'desperate': ['rapid', 'rapid', 'burst', 'rapid'] // Mostly rapid fire with bursts
        };
        
        const availablePatterns = patterns[phase] || ['single'];
        enemyPatternType = availablePatterns[Math.floor(Math.random() * availablePatterns.length)];
        enemyPatternShotCount = 0;
        
        // Set next pattern switch time
        const patternDurations = {
            'single': 2000,
            'burst': 3000,
            'rapid': 4000
        };
        enemyNextPatternTime = now + (patternDurations[enemyPatternType] || 2000);
    }
    
    return enemyPatternType;
}

// ============================================
// CHARACTER ANIMATION SYSTEM
// ============================================

/**
 * Play an animation on the opponent character
 * @param {string} animationName - Name of the animation (e.g., 'Idle', 'Walk', 'Shoot', 'Death')
 * @param {boolean} loop - Whether to loop the animation (default: true)
 * @param {number} fadeIn - Fade in duration in seconds (default: 0.3)
 */
function playOpponentAnimation(animationName, loop = true, fadeIn = 0.3) {
    if (!opponentMixer || !opponentActions[animationName]) {
        console.warn(`Animation "${animationName}" not found. Available:`, Object.keys(opponentActions));
        return;
    }
    
    const newAction = opponentActions[animationName];
    const currentAction = opponentGroup.userData.currentAnimation;
    
    // If same animation is already playing, do nothing
    if (currentAction === newAction && newAction.isRunning()) {
        return;
    }
    
    // Fade out current animation
    if (currentAction) {
        currentAction.fadeOut(fadeIn);
    }
    
    // Set loop mode
    if (loop) {
        newAction.setLoop(THREE.LoopRepeat);
    } else {
        newAction.setLoop(THREE.LoopOnce);
        newAction.clampWhenFinished = true;
    }
    
    // Fade in and play new animation
    newAction.reset().fadeIn(fadeIn).play();
    opponentGroup.userData.currentAnimation = newAction;
}

/**
 * Update opponent animation based on game state
 * Automatically switches between Idle, Walk, Shoot, and Death animations
 */
function updateOpponentAnimation() {
    if (!opponentMixer || opponentHealth <= 0) return;
    
    // Check if opponent is moving (has lateral movement)
    const isMoving = Math.abs(opponentGroup.position.x - (Math.sin(Date.now() * 0.001) * 8)) < 0.1;
    
    // Play appropriate animation based on state
    if (opponentHealth <= 0) {
        playOpponentAnimation('Death', false);
    } else if (isMoving && (opponentActions['Walk'] || opponentActions['walk'] || opponentActions['Running'])) {
        const walkAnim = opponentActions['Walk'] || opponentActions['walk'] || opponentActions['Running'];
        if (opponentGroup.userData.currentAnimation !== walkAnim) {
            playOpponentAnimation('Walk', true);
        }
    } else if (opponentActions['Idle'] || opponentActions['idle']) {
        const idleAnim = opponentActions['Idle'] || opponentActions['idle'];
        if (opponentGroup.userData.currentAnimation !== idleAnim) {
            playOpponentAnimation('Idle', true);
        }
    }
}

// Opponent Shooting Function (Raycast-based, instant hit)
function opponentShoot() {
    if (!gameStarted || opponentHealth <= 0 || playerHealth <= 0) return;
    
    const now = Date.now();
    
    // Update attack phase
    enemyAttackPhase = getEnemyAttackPhase();
    const pattern = getEnemyAttackPattern(enemyAttackPhase);
    
    // Calculate base interval based on phase and pattern
    let baseInterval = OPPONENT_SHOOT_INTERVAL;
    const phaseMultipliers = {
        'normal': 1.0,
        'aggressive': 0.7, // 30% faster
        'desperate': 0.5 // 50% faster
    };
    baseInterval *= (phaseMultipliers[enemyAttackPhase] || 1.0);
    
    // Pattern-specific intervals
    const patternIntervals = {
        'single': baseInterval,
        'burst': baseInterval * 0.3, // Very fast for burst
        'rapid': baseInterval * 0.2 // Extremely fast for rapid
    };
    const currentInterval = patternIntervals[pattern] || baseInterval;
    
    // Check if enough time has passed
    if (now - opponentLastShotTime < currentInterval) return;
    
    // Handle pattern-specific shot counts
    if (pattern === 'burst') {
        if (enemyPatternShotCount >= 3) {
            // End burst, wait longer before next pattern
            enemyPatternShotCount = 0;
            opponentLastShotTime = now;
            enemyNextPatternTime = now + 1000; // Pause after burst
            return;
        }
        enemyPatternShotCount++;
    } else if (pattern === 'rapid') {
        if (enemyPatternShotCount >= 5) {
            // End rapid fire sequence
            enemyPatternShotCount = 0;
            opponentLastShotTime = now;
            enemyNextPatternTime = now + 800; // Brief pause
            return;
        }
        enemyPatternShotCount++;
    } else {
        enemyPatternShotCount = 0; // Reset for single shots
    }
    
    opponentLastShotTime = now;
    
    // Calculate opponent muzzle position in world space
    const muzzleWorldPos = new THREE.Vector3();
    muzzleWorldPos.copy(opponentGroup.position);
    muzzleWorldPos.y += 1.5; // Chest/head level
    
    // Calculate direction to player (camera position)
    const playerPos = camera.position.clone();
    const direction = new THREE.Vector3()
        .subVectors(playerPos, muzzleWorldPos)
        .normalize();
    
    // Add some inaccuracy (spread) to make it more fair
    const spread = 0.15; // 0.15 radians = ~8.6 degrees
    direction.x += (Math.random() - 0.5) * spread;
    direction.y += (Math.random() - 0.5) * spread;
    direction.normalize();
    
    // Create raycaster from opponent toward player
    const raycaster = new THREE.Raycaster();
    raycaster.set(muzzleWorldPos, direction);
    
    // Check if ray hits player (camera position)
    // Create a small invisible sphere at player position for hit detection
    const playerHitSphere = new THREE.Sphere(camera.position, 0.5);
    const hitPoint = new THREE.Vector3();
    const hitDistance = raycaster.ray.distanceToPoint(camera.position);
    
    // Check if hit (within reasonable range and close enough to center)
    if (hitDistance < 30) { // Max range
        // Check if player is dodging (invincibility frames)
        const now = Date.now();
        if (now < dodgeInvincibilityEnd) {
            // Player dodged! Show dodge effect
            const dodgeGeometry = new THREE.RingGeometry(0.3, 0.5, 16);
            const dodgeMaterial = new THREE.MeshBasicMaterial({ 
                color: 0x00ffff, 
                transparent: true, 
                opacity: 0.7,
                side: THREE.DoubleSide
            });
            const dodgeEffect = new THREE.Mesh(dodgeGeometry, dodgeMaterial);
            dodgeEffect.position.copy(camera.position);
            dodgeEffect.lookAt(camera.position.clone().add(direction));
            scene.add(dodgeEffect);
            
            // Animate dodge effect
            new TWEEN.Tween(dodgeEffect.scale)
                .to({ x: 2, y: 2, z: 2 }, 200)
                .onComplete(() => {
                    scene.remove(dodgeEffect);
                    dodgeEffect.geometry.dispose();
                    dodgeEffect.material.dispose();
                })
                .start();
            
            new TWEEN.Tween(dodgeEffect.material)
                .to({ opacity: 0 }, 200)
                .start();
            
            return; // No damage taken
        }
        
        // Hit player! Use opponent's damage if available
        const damage = currentOpponentData ? currentOpponentData.damage : 15;
        playerHealth -= damage;
        updateHealthBar();
        
        // Create hit effect at player position (red flash)
        const hitGeometry = new THREE.SphereGeometry(0.5, 8, 8);
        const hitMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff0000, 
            transparent: true, 
            opacity: 0.8,
            emissive: 0xff4400,
            emissiveIntensity: 0.6
        });
        const hitEffect = new THREE.Mesh(hitGeometry, hitMaterial);
        hitEffect.position.copy(camera.position);
        scene.add(hitEffect);
        
        // Animate hit effect
        new TWEEN.Tween(hitEffect.scale)
            .to({ x: 0, y: 0, z: 0 }, 300)
            .onComplete(() => {
                scene.remove(hitEffect);
                hitEffect.geometry.dispose();
                hitEffect.material.dispose();
            })
            .start();
        
        new TWEEN.Tween(hitEffect.material)
            .to({ opacity: 0 }, 300)
            .start();
        
        // Screen flash effect (red tint)
        const hud = document.getElementById('hud');
        hud.style.color = "#ff0000";
        hud.innerText = `TAKEN DAMAGE! HEALTH: ${playerHealth}%`;
        setTimeout(() => {
            hud.style.color = "";
            if (playerHealth > 0) {
                // Show appropriate status based on holster state
                if (gun.isHolstered) {
                    hud.innerText = "STATUS: READY";
                } else {
                    hud.innerText = "STATUS: AIMING (Ready)";
                }
            }
        }, 500);
        
        // Check for player death
        if (playerHealth <= 0) {
            lastImportantMessageTime = Date.now();
            hud.innerText = "DEFEAT! MISSION FAILED";
            hud.style.color = "#ff0000";
            // End game and return to menu
            endGame(false);
        }
    }
    
    // Muzzle flash effect
    if (opponentMuzzleLight) {
        opponentMuzzleLight.intensity = 3;
        opponentMuzzleLight.color.setHex(0xff0000);
        
        // Create muzzle flash sprite
        const flashGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const flashMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff0000, 
            transparent: true, 
            opacity: 0.9 
        });
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.copy(muzzleWorldPos);
        scene.add(flash);
        
        // Remove flash after short time
        setTimeout(() => {
            opponentMuzzleLight.intensity = 0;
            scene.remove(flash);
            flash.geometry.dispose();
            flash.material.dispose();
        }, 100);
    }
}

// Dodge Function
function performDodge() {
    if (!gameStarted || dodgeCooldown || isDodging) return;
    
    const now = Date.now();
    
    // Start dodge
    isDodging = true;
    dodgeCooldown = true;
    dodgeCooldownTime = now + DODGE_COOLDOWN_DURATION;
    dodgeInvincibilityEnd = now + DODGE_INVINCIBILITY_DURATION;
    
    // Store original camera position
    originalCameraPosition.copy(camera.position);
    
    // Random dodge direction (left or right)
    const dodgeDirection = Math.random() > 0.5 ? 1 : -1;
    const dodgeDistance = 0.3; // How far to dodge
    
    // Shift camera position (visual dodge effect)
    const dodgeTarget = new THREE.Vector3(
        camera.position.x + (dodgeDirection * dodgeDistance),
        camera.position.y,
        camera.position.z
    );
    
    // Animate camera dodge
    new TWEEN.Tween(camera.position)
        .to({ x: dodgeTarget.x, y: dodgeTarget.y, z: dodgeTarget.z }, 150)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onComplete(() => {
            // Return camera to original position
            new TWEEN.Tween(camera.position)
                .to({ x: originalCameraPosition.x, y: originalCameraPosition.y, z: originalCameraPosition.z }, 200)
                .easing(TWEEN.Easing.Quadratic.In)
                .onComplete(() => {
                    isDodging = false;
                })
                .start();
        })
        .start();
    
    // Visual feedback
    const hud = document.getElementById('hud');
    const originalText = hud.innerText;
    hud.innerText = "DODGED!";
    hud.style.color = "#00ffff";
    setTimeout(() => {
        hud.style.color = "";
        hud.innerText = originalText;
    }, 300);
    
    // Send dodge action to server in PvP mode
    if (isPvPMode) {
        sendPlayerAction({ type: 'dodge', timestamp: now });
    }
    
    // Update dodge button UI
    const dodgeButton = document.getElementById('dodge-button');
    if (dodgeButton) {
        dodgeButton.classList.add('cooldown');
        dodgeButton.disabled = true;
        
        // Remove cooldown class and re-enable after cooldown
        setTimeout(() => {
            dodgeButton.classList.remove('cooldown');
            dodgeButton.disabled = false;
            dodgeCooldown = false;
        }, DODGE_COOLDOWN_DURATION);
    }
}

// Initialize UI
updateHealthBar();
updateAmmoCount();

const gun = new GunController({
    // A. AIMING
    onAim: ({ alpha, beta, gamma }) => {
        // Device orientation now only affects reticle position, not camera rotation
        // Camera stays fixed - only reticle moves (works even when holstered)
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
            // No longer auto-reloads when holstered - user must use reload button
            if (playerAmmo < maxAmmo) {
                hud.innerText = "STATUS: READY (Tap Reload)";
            } else {
                hud.innerText = "STATUS: READY";
            }
            
            hud.classList.remove('holstered'); // Remove holstered class styling
            document.getElementById('crosshair').classList.add('visible'); // Keep crosshair visible
            // Show the gun when status is READY (holstered)
            gunGroup.visible = true;
        } else if (gameStarted) {
            // Only show "AIMING" if game has started and no important message is showing
            hud.innerText = "STATUS: AIMING (Ready)";
            hud.classList.remove('holstered');
            document.getElementById('crosshair').classList.add('visible');
            // Show the gun when unholstered
            gunGroup.visible = true;
        }
    },

    // C. FIRING
    onFire: () => {
        if (!gameStarted || (isPvPMode ? playerHealth <= 0 : opponentHealth <= 0)) return; // Only fire if game started (can fire when holstered)
        
        // Prevent shooting while reloading
        if (isReloading) {
            hud.innerText = "RELOADING...";
            return;
        }
        
        // Check ammo
        if (playerAmmo <= 0) {
            hud.innerText = "OUT OF AMMO!";
            return;
        }
        
        // Fire rate limiting - use selected weapon's fire rate
        const selectedWeapon = weapons.find(w => w.id === userStats.selectedWeapon) || weapons[0];
        const now = Date.now();
        if (now - lastFireTime < selectedWeapon.fireRate) return;
        lastFireTime = now;
        
        // Decrease ammo
        playerAmmo--;
        updateAmmoCount();
        
        // Send shoot action to server in PvP mode
        if (isPvPMode) {
            sendPlayerAction({ type: 'shoot', timestamp: Date.now() });
        }

        hud.innerText = "STATUS: 🔥 FIRE! 🔥";
        hud.classList.add('firing');
        
        // 1. Visual Recoil (Kickback) - More pronounced
        const originalZ = gunGroup.position.z;
        const originalRotX = gunGroup.rotation.x;
        gunGroup.position.z += 0.15;
        gunGroup.rotation.x += 0.15;
        gunGroup.position.y -= 0.05;
        
        // 2. Enhanced Muzzle Flash (sci-fi cyan)
        muzzleLight.intensity = 4;
        muzzleLight.color.setHex(0x00ffff);
        
        // Create muzzle flash sprite (sci-fi energy burst)
        const flashGeometry = new THREE.SphereGeometry(0.15, 8, 8);
        const flashMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff, 
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
        
        // Check collision with opponent model (exclude health bar)
        // Get all meshes from opponent model, excluding health bar elements
        const opponentMeshes = [];
        if (opponentModel) {
            opponentModel.traverse((child) => {
                if (child.isMesh && child !== opponentGroup.userData.healthBarFill && child !== opponentGroup.userData.healthBarBg) {
                    opponentMeshes.push(child);
                }
            });
        }
        
        const intersects = raycaster.intersectObjects(opponentMeshes, false);
        
        // Debug: Log raycast info
        if (opponentMeshes.length === 0) {
            console.warn('No opponent meshes found for raycast!');
        }
        
        if (intersects.length > 0) {
            const hitPoint = intersects[0].point;
            console.log('HIT! Opponent health:', opponentHealth, '->', opponentHealth - 20);
            
            // Create hit effect (energy spark - sci-fi)
            const hitGeometry = new THREE.SphereGeometry(0.3, 8, 8);
            const hitMaterial = new THREE.MeshBasicMaterial({ 
                color: 0x00ffff, 
                transparent: true, 
                opacity: 0.9,
                emissive: 0x00aaff,
                emissiveIntensity: 0.5
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
            
            // Hit! Use selected weapon damage
            const selectedWeapon = weapons.find(w => w.id === userStats.selectedWeapon) || weapons[0];
            const damage = selectedWeapon.damage;
            opponentHealth -= damage;
            
            // Send hit to server in PvP mode
            if (isPvPMode) {
                sendPlayerHit(damage);
            }
            
            updateOpponentHealthBar(); // Update opponent health bar
            
            // Visual hit reaction - flash red on body
            const hitObj = intersects[0].object;
            if (hitObj.material && hitObj.material.color) {
                const originalColor = hitObj.material.color.getHex();
                hitObj.material.color.setHex(0xff0000);
                setTimeout(() => hitObj.material.color.setHex(originalColor), 150);
            }
            
            if (opponentHealth <= 0) {
                // Death sequence
                lastImportantMessageTime = Date.now();
                const reward = currentOpponentData ? currentOpponentData.reward : 0;
                hud.innerText = `VICTORY! TARGET NEUTRALIZED\n+${reward} CREDITS`;
                hud.style.color = "#00ffff";
                
                // Fall over
                new TWEEN.Tween(opponentGroup.rotation)
                    .to({ x: -Math.PI / 2 }, 500)
                    .easing(TWEEN.Easing.Bounce.Out)
                    .start();
                
                // End game and return to menu
                endGame(true);
            } else {
                lastImportantMessageTime = Date.now();
                hud.innerText = `HIT! ENEMY HEALTH: ${opponentHealth}%`;
                // After showing hit message, return to appropriate status
                setTimeout(() => {
                    if (Date.now() - lastImportantMessageTime >= 2000) {
                        if (gun.isHolstered) {
                            hud.innerText = "STATUS: READY";
                        } else {
                            hud.innerText = "STATUS: AIMING (Ready)";
                        }
                    }
                }, 2000);
            }
        } else {
            // Miss - show feedback
            lastImportantMessageTime = Date.now();
            hud.innerText = "MISS!";
            setTimeout(() => {
                if (Date.now() - lastImportantMessageTime >= 500) {
                    // Show appropriate status based on holster state
                    if (gun.isHolstered) {
                        hud.innerText = "STATUS: READY";
                    } else {
                        hud.innerText = "STATUS: AIMING (Ready)";
                    }
                }
            }, 500);
        }
    }
});

// Online Players Management
let onlinePlayersList = [];

function fetchOnlinePlayers() {
    if (socket && socket.connected) {
        console.log('Requesting online players from server...');
        socket.emit('request-online-players');
        // Also set up a timeout to check if we received a response
        setTimeout(() => {
            if (onlinePlayersList.length === 0) {
                console.warn('No players received after request. Current list:', onlinePlayersList);
                console.log('Socket still connected:', socket.connected);
            }
        }, 1000);
    } else {
        console.warn('Cannot fetch online players: socket not connected');
        console.log('Socket exists:', !!socket);
        console.log('Socket connected:', socket ? socket.connected : 'N/A');
    }
}

// --- Menu System ---
function initializeMenu() {
    // Update user profile display
    updateUserProfile();
    
    // Request online players when menu opens (if connected)
    if (socket && socket.connected) {
        console.log('Menu opened, fetching online players...');
        fetchOnlinePlayers();
    } else {
        console.warn('Socket not connected, cannot fetch online players');
        console.log('Socket exists:', !!socket);
        console.log('Socket connected:', socket ? socket.connected : 'N/A');
        onlinePlayersList = []; // Clear list if not connected
        // Try to initialize networking if not already done
        if (!socket) {
            console.log('No socket, initializing networking...');
            initializeNetworking();
        }
    }
    
    const opponentGrid = document.getElementById('opponent-grid');
    opponentGrid.innerHTML = '';
    
    // Add AI opponents
    opponents.forEach((opponent, index) => {
        const card = document.createElement('div');
        card.className = `opponent-card ${opponent.isBoss ? 'boss' : ''} ${opponent.type === 'Reward' ? 'reward' : ''}`;
        card.dataset.opponentId = opponent.id;
        
        card.innerHTML = `
            <div class="selected-badge">SELECTED</div>
            <div class="opponent-image-container">
                ${opponent.image ? 
                    `<img src="${opponent.image}" alt="${opponent.name}" onerror="this.style.display='none'; this.parentElement.querySelector('.opponent-image-placeholder').style.display='flex';" />` : 
                    ''
                }
                <div class="opponent-image-placeholder" ${opponent.image ? 'style="display: none;"' : ''}>🤖</div>
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
    
    // Add online players to the grid
    addOnlinePlayersToGrid();
    
    // Setup battle button handlers for AI opponents
    setTimeout(() => {
        document.querySelectorAll('.card-battle-button:not(.player-challenge-button)').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const opponentId = button.dataset.opponentId;
                const opponent = opponents.find(o => o.id === opponentId);
                if (opponent) {
                    gameMode = 'singleplayer';
                    isPvPMode = false;
                    document.getElementById('main-menu').classList.add('hidden');
                    await startGame(opponent);
                }
            });
        });
        
        // Setup challenge button handlers for online players
        document.querySelectorAll('.player-challenge-button').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const username = button.dataset.playerUsername;
                if (username) {
                    if (socket && socket.connected) {
                        challengePlayer(username);
                    } else {
                        alert('Not connected to server. Please make sure the server is running.');
                    }
                }
            });
        });
    }, 100);
}

function addOnlinePlayersToGrid() {
    const opponentGrid = document.getElementById('opponent-grid');
    
    if (!opponentGrid) {
        console.warn('Opponent grid not found');
        return;
    }
    
    // Remove existing player cards first
    const existingPlayerCards = opponentGrid.querySelectorAll('.player-card');
    existingPlayerCards.forEach(card => card.remove());
    
    console.log('=== Adding online players to grid ===');
    console.log('Current onlinePlayersList:', onlinePlayersList);
    console.log('List length:', onlinePlayersList.length);
    console.log('User stats name:', userStats.name);
    console.log('Socket connected:', socket && socket.connected);
    
    // Filter to only available players (not in battle)
    const availablePlayers = onlinePlayersList.filter(p => {
        console.log('Checking player:', p);
        if (!p || !p.username) {
            console.log('  - Filtered out: no username');
            return false;
        }
        if (p.status !== 'available') {
            console.log('  - Filtered out: status is', p.status, '(not available)');
            return false;
        }
        if (p.username.toLowerCase() === userStats.name.toLowerCase()) {
            console.log('  - Filtered out: same as current user');
            return false;
        }
        console.log('  - PASSED filter:', p.username);
        return true;
    });
    
    console.log('=== Available players after filter ===');
    console.log('Count:', availablePlayers.length);
    console.log('Players:', availablePlayers);
    
    if (availablePlayers.length === 0) {
        console.log('No available players to display');
        return;
    }
    
    availablePlayers.forEach((player) => {
        const card = document.createElement('div');
        card.className = 'opponent-card player-card'; // Add player-card class to distinguish
        card.dataset.playerUsername = player.username;
        card.dataset.isPlayer = 'true';
        
        // Calculate stats from player data
        const wins = player.stats?.wins || 0;
        const rank = player.stats?.rank || 'Rookie';
        const reward = calculatePlayerReward(player.stats || {});
        
        card.innerHTML = `
            <div class="selected-badge" style="background: rgba(255, 200, 0, 0.9);">ONLINE</div>
            <div class="opponent-image-container">
                <div class="opponent-image-placeholder" style="display: flex;">👤</div>
            </div>
            <div class="opponent-name">${player.username}</div>
            <div class="opponent-type" style="color: #00ff00;">PLAYER</div>
            <div class="opponent-stats">
                <div class="opponent-stat">
                    <div>Rank</div>
                    <div class="opponent-stat-value">${rank}</div>
                </div>
                <div class="opponent-stat">
                    <div>Wins</div>
                    <div class="opponent-stat-value">${wins}</div>
                </div>
            </div>
            <div style="text-align: center; margin-top: 8px; color: #ffaa00; font-weight: bold; font-size: 0.75rem;">
                Reward: ${reward} Credits
            </div>
            <button class="card-battle-button player-challenge-button" data-player-username="${player.username}" style="width: 100%; margin-top: 10px; padding: 10px; background: linear-gradient(135deg, rgba(255, 200, 0, 0.9) 0%, rgba(255, 150, 0, 0.9) 100%); color: #000; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; text-transform: uppercase; font-size: 0.9rem;">CHALLENGE</button>
        `;
        
        opponentGrid.appendChild(card);
    });
    
    // Setup challenge button handlers for newly added online players
    setTimeout(() => {
        document.querySelectorAll('.player-challenge-button').forEach(button => {
            // Remove old listeners by cloning
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            newButton.addEventListener('click', (e) => {
                e.stopPropagation();
                const username = newButton.dataset.playerUsername;
                if (username) {
                    if (socket && socket.connected) {
                        challengePlayer(username);
                    } else {
                        alert('Not connected to server. Please make sure the server is running.');
                    }
                }
            });
        });
    }, 50);
}

// Update user profile display
function updateUserProfile() {
    document.getElementById('user-name').textContent = userStats.name;
    document.getElementById('user-rank').textContent = userStats.rank;
    document.getElementById('user-wins').textContent = userStats.wins;
    document.getElementById('user-credits').textContent = userStats.credits.toLocaleString();
    
    // Update avatar if available
    const avatarContainer = document.getElementById('user-avatar-container');
    const placeholder = avatarContainer.querySelector('.user-avatar-placeholder');
    const avatarImg = avatarContainer.querySelector('#user-avatar-img');
    
    if (userStats.avatar && avatarImg) {
        avatarImg.src = userStats.avatar;
        avatarImg.style.display = 'block';
        placeholder.style.display = 'none';
    } else {
        if (avatarImg) avatarImg.style.display = 'none';
        placeholder.style.display = 'flex';
    }
}

// Function to set user avatar (can be called to update avatar)
function setUserAvatar(imageUrl) {
    userStats.avatar = imageUrl;
    updateUserProfile();
}

// Account Management Functions
function getAccounts() {
    try {
        const accountsJson = localStorage.getItem(ACCOUNTS_KEY);
        return accountsJson ? JSON.parse(accountsJson) : {};
    } catch (e) {
        console.warn('Failed to load accounts:', e);
        return {};
    }
}

function saveAccounts(accounts) {
    try {
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch (e) {
        console.warn('Failed to save accounts:', e);
    }
}

function createAccount(username, password) {
    const accounts = getAccounts();
    
    // Validate username
    if (username.length < 3 || username.length > 20) {
        return { success: false, error: 'Username must be 3-20 characters' };
    }
    
    // Check if username already exists
    if (accounts[username.toLowerCase()]) {
        return { success: false, error: 'Username already exists' };
    }
    
    // Validate password
    if (password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters' };
    }
    
    // Create new account with default stats
    accounts[username.toLowerCase()] = {
        username: username,
        password: btoa(password), // Simple base64 encoding (not secure, but works for localStorage)
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

function loginAccount(username, password) {
    const accounts = getAccounts();
    const account = accounts[username.toLowerCase()];
    
    if (!account) {
        return { success: false, error: 'Username not found' };
    }
    
    if (account.password !== btoa(password)) {
        return { success: false, error: 'Incorrect password' };
    }
    
    // Set current user
    currentUser = username.toLowerCase();
    userStats = { ...account.stats };
    isAuthenticated = true;
    
    // Save current user session
    try {
        localStorage.setItem(CURRENT_USER_KEY, currentUser);
    } catch (e) {
        console.warn('Failed to save session:', e);
    }
    
    return { success: true };
}

function checkSession() {
    try {
        const savedUser = localStorage.getItem(CURRENT_USER_KEY);
        if (savedUser) {
            const accounts = getAccounts();
            const account = accounts[savedUser];
            if (account) {
                currentUser = savedUser;
                userStats = { ...account.stats };
                isAuthenticated = true;
                return true;
            }
        }
    } catch (e) {
        console.warn('Failed to check session:', e);
    }
    return false;
}

function logout() {
    // Save current stats before logout
    if (isAuthenticated && currentUser) {
        saveUserStats();
    }
    
    // Disconnect from server if connected
    if (socket && socket.connected) {
        socket.disconnect();
        socket = null;
    }
    
    // Clear session
    currentUser = null;
    isAuthenticated = false;
    userStats = {
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
    onlinePlayersList = [];
    
    // Clear session storage
    try {
        localStorage.removeItem(CURRENT_USER_KEY);
    } catch (e) {
        console.warn('Failed to clear session:', e);
    }
    
    // Show login screen
    showLoginScreen();
}

// Save user stats to localStorage (per account)
function saveUserStats() {
    if (!isAuthenticated || !currentUser) return;
    
    try {
        const accounts = getAccounts();
        if (accounts[currentUser]) {
            accounts[currentUser].stats = { ...userStats };
            saveAccounts(accounts);
        }
    } catch (e) {
        console.warn('Failed to save user stats:', e);
    }
}

// Load user stats from localStorage (per account)
function loadUserStats() {
    if (!isAuthenticated || !currentUser) return;
    
    try {
        const accounts = getAccounts();
        const account = accounts[currentUser];
        if (account && account.stats) {
            userStats = { ...userStats, ...account.stats };
            // Ensure characterCustomization exists
            if (!userStats.characterCustomization) {
                userStats.characterCustomization = {
                    primaryColor: '#ffffff',
                    secondaryColor: '#333333'
                };
            }
            updateUserProfile();
        }
    } catch (e) {
        console.warn('Failed to load user stats:', e);
    }
}

// Update rank based on wins
function updateRank() {
    if (userStats.wins >= 50) {
        userStats.rank = "Legend";
    } else if (userStats.wins >= 30) {
        userStats.rank = "Master";
    } else if (userStats.wins >= 20) {
        userStats.rank = "Expert";
    } else if (userStats.wins >= 10) {
        userStats.rank = "Veteran";
    } else if (userStats.wins >= 5) {
        userStats.rank = "Soldier";
    } else {
        userStats.rank = "Rookie";
    }
}

// End game and return to menu
function endGame(victory) {
    // Stop the game
    gameStarted = false;
    orientationEnabled = false;
    
    // Hide game elements
    opponentGroup.visible = false;
    gunGroup.visible = false;
    document.getElementById('crosshair').classList.remove('visible');
    document.getElementById('health-bar-container').classList.remove('visible');
    document.getElementById('ammo-count').classList.remove('visible');
    document.getElementById('reload-button').classList.remove('visible');
    document.getElementById('reload-skill-bar').classList.remove('active');
    
    // Stop any active reload
    if (reloadSkillBarAnimationFrame) {
        cancelAnimationFrame(reloadSkillBarAnimationFrame);
        reloadSkillBarAnimationFrame = null;
    }
    isReloading = false;
    
    // Hide dodge button
    const dodgeButton = document.getElementById('dodge-button');
    if (dodgeButton) {
        dodgeButton.classList.remove('visible');
    }
    
    // Update user stats based on result
    if (victory) {
        if (isPvPMode && currentPvPOpponentStats) {
            // PvP victory: Calculate reward based on opponent's rank and wins
            const reward = calculatePlayerReward(currentPvPOpponentStats);
            userStats.wins++;
            userStats.credits += reward;
            hud.innerText = `VICTORY! TARGET NEUTRALIZED\n+${reward} CREDITS`;
            hud.style.color = "#00ffff";
            updateRank();
        } else if (currentOpponentData) {
            // Single-player victory: Use opponent's reward
            userStats.wins++;
            userStats.credits += currentOpponentData.reward;
            updateRank();
        }
    }
    // Defeat: No rewards, but stats are still saved
    
    // Save stats
    saveUserStats();
    
    // Show menu after a delay (to show victory/defeat message)
    setTimeout(() => {
        // Show menu
        document.getElementById('main-menu').classList.remove('hidden');
        
        // Update user profile display
        updateUserProfile();
        
        // Reset HUD
        hud.innerText = "STATUS: WAITING";
        hud.style.color = "";
        hud.classList.remove('holstered', 'firing');
        
        // Reset opponent for next game
        if (opponentModel) {
            opponentGroup.rotation.set(0, 0, 0);
        }
    }, 3000); // Wait 3 seconds to show victory/defeat message
}

// Character Preview Scene (for customization screen)
let characterPreviewScene = null;
let characterPreviewCamera = null;
let characterPreviewRenderer = null;
let characterPreviewModel = null;
let characterPreviewLight = null;

// --- Character Customization Screen ---
function initializeCharacterCustomization() {
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
    
    // Color selection handlers
    document.querySelectorAll('.color-option').forEach(option => {
        option.addEventListener('click', () => {
            // Remove selected class from all primary color options
            document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
            // Add selected class to clicked option
            option.classList.add('selected');
            
            const color = option.dataset.color;
            if (!userStats.characterCustomization) {
                userStats.characterCustomization = { primaryColor: '#ffffff', secondaryColor: '#333333' };
            }
            userStats.characterCustomization.primaryColor = color;
            saveUserStats();
            
            // Apply color to character model
            if (characterPreviewModel) {
                applyCharacterColors(characterPreviewModel);
            }
        });
    });
    
    document.querySelectorAll('.color-option-secondary').forEach(option => {
        option.addEventListener('click', () => {
            // Remove selected class from all secondary color options
            document.querySelectorAll('.color-option-secondary').forEach(o => o.classList.remove('selected'));
            // Add selected class to clicked option
            option.classList.add('selected');
            
            const color = option.dataset.color;
            if (!userStats.characterCustomization) {
                userStats.characterCustomization = { primaryColor: '#ffffff', secondaryColor: '#333333' };
            }
            userStats.characterCustomization.secondaryColor = color;
            saveUserStats();
            
            // Apply color to character model
            if (characterPreviewModel) {
                applyCharacterColors(characterPreviewModel);
            }
        });
    });
    
    // Set initial selected colors
    const primaryColor = userStats.characterCustomization?.primaryColor || '#ffffff';
    const secondaryColor = userStats.characterCustomization?.secondaryColor || '#333333';
    
    document.querySelectorAll('.color-option').forEach(option => {
        if (option.dataset.color === primaryColor) {
            option.classList.add('selected');
        }
    });
    
    document.querySelectorAll('.color-option-secondary').forEach(option => {
        if (option.dataset.color === secondaryColor) {
            option.classList.add('selected');
        }
    });
}

// Apply character colors to model
function applyCharacterColors(model) {
    if (!model) return;
    
    const primaryColor = new THREE.Color(userStats.characterCustomization?.primaryColor || '#ffffff');
    const secondaryColor = new THREE.Color(userStats.characterCustomization?.secondaryColor || '#333333');
    
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
    
    requestAnimationFrame(animateCharacterPreview);
    
    characterPreviewRenderer.render(characterPreviewScene, characterPreviewCamera);
}

// Show character customization screen
function showCharacterCustomization() {
    document.getElementById('player-customization').classList.remove('visible');
    document.getElementById('character-customization').classList.add('visible');
    
    // Initialize if not already done
    if (!characterPreviewScene) {
        setTimeout(() => {
            initializeCharacterCustomization();
        }, 100); // Small delay to ensure DOM is ready
    } else {
        // Update renderer size if already initialized
        const previewContainer = document.getElementById('character-preview-container');
        if (characterPreviewRenderer && previewContainer) {
            characterPreviewRenderer.setSize(previewContainer.clientWidth, previewContainer.clientHeight);
            characterPreviewCamera.aspect = previewContainer.clientWidth / previewContainer.clientHeight;
            characterPreviewCamera.updateProjectionMatrix();
        }
    }
}

// Hide character customization screen
function hideCharacterCustomization() {
    document.getElementById('character-customization').classList.remove('visible');
    document.getElementById('player-customization').classList.add('visible');
}

// --- Player Customization Screen ---
function initializeCustomization() {
    const weaponGrid = document.getElementById('weapon-grid');
    weaponGrid.innerHTML = '';
    
    weapons.forEach((weapon) => {
        const card = document.createElement('div');
        const isUnlocked = weapon.unlocked !== false; // Default to unlocked unless specified
        const isSelected = userStats.selectedWeapon === weapon.id;
        
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
                // Remove selected class from all cards
                document.querySelectorAll('.weapon-card').forEach(c => c.classList.remove('selected'));
                // Add selected class to clicked card
                card.classList.add('selected');
                userStats.selectedWeapon = weapon.id;
                saveUserStats();
                updateCustomizationStatus();
            });
        }
        
        weaponGrid.appendChild(card);
    });
    
    updateCustomizationStatus();
}

function updateCustomizationStatus() {
    document.getElementById('status-wins').textContent = userStats.wins;
    document.getElementById('status-credits').textContent = userStats.credits.toLocaleString();
    document.getElementById('status-rank').textContent = userStats.rank;
    
    const selectedWeapon = weapons.find(w => w.id === userStats.selectedWeapon);
    document.getElementById('status-weapon').textContent = selectedWeapon ? selectedWeapon.name : 'Pistol';
    
    // Show character customization status
    const charCustom = userStats.characterCustomization || { primaryColor: '#ffffff', secondaryColor: '#333333' };
    document.getElementById('status-character').textContent = 'Customized';
}

// Show customization screen
function showCustomization() {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('player-customization').classList.add('visible');
    updateCustomizationStatus();
}

// Hide customization screen
function hideCustomization() {
    document.getElementById('player-customization').classList.remove('visible');
    document.getElementById('main-menu').classList.remove('hidden');
}

// Login Screen Functions
function showLoginScreen() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('main-menu').classList.add('hidden');
    // Reset forms
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

// Initialize authentication and UI
function initializeAuth() {
    // Check for existing session
    if (checkSession()) {
        // User is already logged in
        loadUserStats();
        hideLoginScreen();
        initializeNetworking(); // Initialize networking first
        // Wait for socket connection before initializing menu
        const checkConnection = setInterval(() => {
            if (socket && socket.connected) {
                clearInterval(checkConnection);
                initializeMenu(); // Then initialize menu after connection
                initializeCustomization();
                setupLogoutButton();
                setupMenuButtons();
            }
        }, 100);
        // Timeout after 5 seconds
        setTimeout(() => {
            clearInterval(checkConnection);
            if (!socket || !socket.connected) {
                console.warn('Socket connection timeout, initializing menu anyway');
                initializeMenu();
                initializeCustomization();
                setupLogoutButton();
                setupMenuButtons();
            }
        }, 5000);
    } else {
        // Show login screen
        showLoginScreen();
        setupLoginHandlers();
    }
}

function setupLoginHandlers() {
    // Tab switching
    document.getElementById('tab-login').addEventListener('click', switchToLogin);
    document.getElementById('tab-register').addEventListener('click', switchToRegister);
    
    // Login button
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
            initializeNetworking(); // Initialize networking first
            // Wait for socket connection before initializing menu
            const checkConnection = setInterval(() => {
                if (socket && socket.connected) {
                    clearInterval(checkConnection);
                    initializeMenu(); // Then initialize menu after connection
                    initializeCustomization();
                    setupLogoutButton();
                    setupMenuButtons();
                }
            }, 100);
            // Timeout after 5 seconds
            setTimeout(() => {
                clearInterval(checkConnection);
                if (!socket || !socket.connected) {
                    console.warn('Socket connection timeout, initializing menu anyway');
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
    
    // Register button
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
            // Auto-login after registration
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
    
    // Allow Enter key to submit
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

// ============================================
// RELOAD SKILL SYSTEM
// ============================================

/**
 * Start the reload skill mini-game
 */
function startReloadSkillGame() {
    if (isReloading || playerAmmo >= maxAmmo) return;
    
    isReloading = true;
    reloadSliderPosition = 0;
    reloadSliderDirection = 1;
    
    // Show reload skill bar
    const skillBar = document.getElementById('reload-skill-bar');
    const slider = document.getElementById('reload-skill-bar-slider');
    const track = document.getElementById('reload-skill-bar-track');
    const label = document.getElementById('reload-skill-bar-label');
    
    if (!skillBar || !slider || !track || !label) {
        console.error('Reload skill bar elements not found!');
        isReloading = false;
        return;
    }
    
    skillBar.classList.add('active');
    label.textContent = 'TAP TO STOP';
    label.style.color = '#00ffff';
    
    // Disable reload button during reload
    const reloadBtn = document.getElementById('reload-button');
    if (reloadBtn) {
        reloadBtn.disabled = true;
    }
    
    // Reset slider position
    reloadSliderPosition = 0;
    reloadSliderDirection = 1;
    slider.style.transform = 'translateX(0%)';
    
    // Randomize perfect zone position (between 10% and 90% to keep it on screen)
    const minZoneStart = 10; // Minimum start position
    const maxZoneStart = 90 - PERFECT_ZONE_WIDTH; // Maximum start position (ensures zone stays within bounds)
    const randomZoneStart = Math.random() * (maxZoneStart - minZoneStart) + minZoneStart;
    reloadPerfectZoneStart = Math.round(randomZoneStart);
    reloadPerfectZoneEnd = reloadPerfectZoneStart + PERFECT_ZONE_WIDTH;
    
    // Update the visual perfect zone position
    const perfectZone = document.getElementById('reload-skill-bar-perfect-zone');
    if (perfectZone) {
        perfectZone.style.left = reloadPerfectZoneStart + '%';
        perfectZone.style.width = PERFECT_ZONE_WIDTH + '%';
    }
    
    // Animate slider using requestAnimationFrame for smooth performance
    const sliderSpeed = 2; // Percentage per frame (simpler calculation)
    reloadLastAnimationTime = performance.now();
    
    const animateSlider = (currentTime) => {
        if (!isReloading) {
            if (reloadSkillBarAnimationFrame) {
                cancelAnimationFrame(reloadSkillBarAnimationFrame);
                reloadSkillBarAnimationFrame = null;
            }
            return;
        }
        
        // Calculate delta time for consistent speed regardless of frame rate
        const deltaTime = currentTime - reloadLastAnimationTime;
        const frameMultiplier = Math.min(deltaTime / 16.67, 2); // Cap at 2x to prevent jumps
        
        reloadSliderPosition += sliderSpeed * reloadSliderDirection * frameMultiplier;
        
        // Bounce at edges
        if (reloadSliderPosition >= 100) {
            reloadSliderPosition = 100;
            reloadSliderDirection = -1;
        } else if (reloadSliderPosition <= 0) {
            reloadSliderPosition = 0;
            reloadSliderDirection = 1;
        }
        
        // Use transform instead of left for better performance (GPU-accelerated)
        // Calculate pixel position based on track width
        const trackWidth = track.offsetWidth;
        const sliderWidth = slider.offsetWidth;
        const maxPosition = trackWidth - sliderWidth;
        const pixelPosition = (reloadSliderPosition / 100) * maxPosition;
        
        slider.style.transform = `translateX(${pixelPosition}px)`;
        
        // Note: reloadSliderPosition is stored as percentage (0-100) for perfect zone checking
        
        reloadLastAnimationTime = currentTime;
        reloadSkillBarAnimationFrame = requestAnimationFrame(animateSlider);
    };
    
    reloadSkillBarAnimationFrame = requestAnimationFrame(animateSlider);
    
    // Handle tap/click to stop slider
    const stopSlider = () => {
        if (!isReloading) return;
        
        if (reloadSkillBarAnimationFrame) {
            cancelAnimationFrame(reloadSkillBarAnimationFrame);
            reloadSkillBarAnimationFrame = null;
        }
        
        // Check if slider is in perfect zone
        const inPerfectZone = reloadSliderPosition >= reloadPerfectZoneStart && 
                             reloadSliderPosition <= reloadPerfectZoneEnd;
        
        if (inPerfectZone) {
            // Perfect reload - fast reload (instant)
            label.textContent = 'PERFECT RELOAD!';
            label.style.color = '#00ff00';
            playerAmmo = maxAmmo;
            updateAmmoCount();
            hud.innerText = "PERFECT RELOAD!";
            hud.style.color = "#00ff00";
            
            // Send reload action to server in PvP
            if (isPvPMode) {
                sendPlayerAction({ type: 'reload', timestamp: Date.now(), perfect: true });
            }
            
            setTimeout(() => {
                skillBar.classList.remove('active');
                isReloading = false;
                label.style.color = '#00ffff';
                if (reloadBtn) reloadBtn.disabled = false;
                hud.style.color = "";
                hud.innerText = "STATUS: AIMING (Ready)";
            }, 500);
        } else {
            // Missed perfect zone - slow reload
            const distanceFromPerfect = Math.min(
                Math.abs(reloadSliderPosition - reloadPerfectZoneStart),
                Math.abs(reloadSliderPosition - reloadPerfectZoneEnd)
            );
            const reloadTime = 1000 + (distanceFromPerfect * 20); // 1-2 seconds based on distance
            
            label.textContent = 'RELOADING...';
            label.style.color = '#ffaa00';
            hud.innerText = "RELOADING...";
            hud.style.color = "#ffaa00";
            
            // Send reload action to server in PvP
            if (isPvPMode) {
                sendPlayerAction({ type: 'reload', timestamp: Date.now(), perfect: false });
            }
            
            setTimeout(() => {
                playerAmmo = maxAmmo;
                updateAmmoCount();
                skillBar.classList.remove('active');
                isReloading = false;
                label.style.color = '#00ffff';
                if (reloadBtn) reloadBtn.disabled = false;
                hud.style.color = "";
                hud.innerText = "RELOADED";
                setTimeout(() => {
                    hud.innerText = "STATUS: AIMING (Ready)";
                }, 500);
            }, reloadTime);
        }
    };
    
    // Add event listeners for tap/click (remove after use)
    const clickHandler = () => stopSlider();
    const touchHandler = (e) => {
        e.preventDefault();
        stopSlider();
    };
    
    skillBar.addEventListener('click', clickHandler, { once: true });
    skillBar.addEventListener('touchend', touchHandler, { once: true });
}

// Setup reload button handler
function setupReloadButton() {
    const reloadBtn = document.getElementById('reload-button');
    if (reloadBtn) {
        console.log('Setting up reload button...');
        
        // Remove old listeners by cloning
        const newBtn = reloadBtn.cloneNode(true);
        reloadBtn.parentNode.replaceChild(newBtn, reloadBtn);
        
        const handleReload = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Reload button clicked!', { isReloading, playerAmmo, maxAmmo, gameStarted });
            if (!isReloading && playerAmmo < maxAmmo && gameStarted) {
                console.log('Starting reload skill game...');
                startReloadSkillGame();
            } else {
                console.log('Reload blocked:', { isReloading, playerAmmo, maxAmmo, gameStarted });
            }
        };
        
        newBtn.addEventListener('click', handleReload);
        newBtn.addEventListener('touchend', handleReload);
        
        console.log('Reload button listeners attached');
    } else {
        console.error('Reload button not found!');
    }
}

// Setup reload button when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupReloadButton);
} else {
    setupReloadButton();
}

// Initialize on load
initializeAuth();

// Logout button handler (set up after menu is initialized)
function setupLogoutButton() {
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to logout?')) {
                logout();
            }
        });
    }
}

// User profile click handler (but not on edit button)
document.querySelector('.user-profile-section').addEventListener('click', (e) => {
    // Don't open customization if clicking the edit button
    if (e.target.id === 'btn-edit-username' || e.target.closest('#btn-edit-username')) {
        return;
    }
    showCustomization();
});

// Username editing
document.getElementById('btn-edit-username').addEventListener('click', (e) => {
    e.stopPropagation();
    showUsernameEditModal();
});

document.getElementById('btn-save-username').addEventListener('click', () => {
    const newUsername = document.getElementById('username-input').value.trim();
    if (newUsername && newUsername.length >= 3 && newUsername.length <= 20) {
        userStats.name = newUsername;
        saveUserStats();
        updateUserProfile();
        hideUsernameEditModal();
        
        // Update username on server if connected
        if (socket && socket.connected) {
            socket.emit('update-username', { username: newUsername });
        } else {
            // If not connected, initialize networking to register username
            initializeNetworking();
        }
    } else {
        alert('Username must be between 3 and 20 characters');
    }
});

document.getElementById('btn-cancel-username').addEventListener('click', () => {
    hideUsernameEditModal();
});

function showUsernameEditModal() {
    document.getElementById('username-edit-modal').classList.remove('hidden');
    document.getElementById('username-input').value = userStats.name;
    document.getElementById('username-input').focus();
}

function hideUsernameEditModal() {
    document.getElementById('username-edit-modal').classList.add('hidden');
}

// Back button handlers
document.getElementById('btn-back-to-menu').addEventListener('click', () => {
    hideCustomization();
});

document.getElementById('btn-back-from-character').addEventListener('click', () => {
    hideCharacterCustomization();
});

// Character customization button handler
document.getElementById('btn-customize-character').addEventListener('click', () => {
    showCharacterCustomization();
});

// Dodge button handler
// Dodge button removed

// Handle window resize for character preview
window.addEventListener('resize', () => {
    if (characterPreviewRenderer && characterPreviewCamera) {
        const previewContainer = document.getElementById('character-preview-container');
        if (previewContainer && previewContainer.offsetParent !== null) { // Check if visible
            characterPreviewRenderer.setSize(previewContainer.clientWidth, previewContainer.clientHeight);
            characterPreviewCamera.aspect = previewContainer.clientWidth / previewContainer.clientHeight;
            characterPreviewCamera.updateProjectionMatrix();
        }
    }
});

// Initialize Networking
function initializeNetworking() {
    try {
        socket = io(SERVER_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
            timeout: 20000
        });
        
        // Set up event handlers BEFORE connect (so they're ready immediately)
        // Receive online players list
        socket.on('online-players-list', (players) => {
            console.log('=== Received online players list ===');
            console.log('Players received:', players);
            console.log('Number of players:', players ? players.length : 0);
            onlinePlayersList = players || [];
            console.log('Updated onlinePlayersList:', onlinePlayersList);
            // Refresh opponent grid if menu is visible
            const mainMenu = document.getElementById('main-menu');
            if (mainMenu && !mainMenu.classList.contains('hidden')) {
                console.log('Menu visible, refreshing grid');
                addOnlinePlayersToGrid();
            } else {
                console.log('Menu not visible, will refresh when menu opens');
            }
        });
        
        socket.on('connect', () => {
            console.log('Connected to server');
            
            // Register username when connected
            if (userStats.name) {
                console.log('Registering username:', userStats.name, 'Stats:', userStats);
                socket.emit('update-username', { username: userStats.name, stats: userStats });
            } else {
                console.warn('No username in userStats, cannot register');
            }
            // Fetch online players list after a delay to ensure registration
            setTimeout(() => {
                console.log('Fetching online players after registration...');
                fetchOnlinePlayers();
            }, 500);
        });
        
        // Receive online players update (broadcast)
        socket.on('online-players-update', (players) => {
            console.log('=== Received online players update (broadcast) ===');
            console.log('Players received:', players);
            console.log('Number of players:', players ? players.length : 0);
            onlinePlayersList = players || [];
            console.log('Updated onlinePlayersList:', onlinePlayersList);
            // Refresh opponent grid if menu is visible
            const mainMenu = document.getElementById('main-menu');
            if (mainMenu && !mainMenu.classList.contains('hidden')) {
                console.log('Menu visible, refreshing grid from update');
                addOnlinePlayersToGrid();
            }
        });
        
        socket.on('connect_error', (error) => {
            console.warn('Connection error (server may not be running):', error.message);
            // Don't show error to user unless they try to use PvP
        });
        
        socket.on('disconnect', (reason) => {
            console.log('Disconnected from server:', reason);
            if (matchmakingActive) {
                showMatchmakingError('Connection lost. Please try again.');
            }
        });
    } catch (error) {
        console.error('Error initializing networking:', error);
        // Continue without networking - single player mode will still work
    }
    
    socket.on('matched', (data) => {
        console.log('Matched with opponent:', data);
        opponentPlayer = data.opponent;
        currentRoomId = data.roomId;
        isPlayer1 = data.isPlayer1;
        
        // For challenges, game starts immediately (no ready button needed)
        // The server will send 'game-start' event directly
        document.getElementById('matchmaking-status').textContent = `Matched with ${data.opponent.name}! Starting game...`;
    });
    
    socket.on('game-start', (data) => {
        console.log('Game starting:', data);
        hideMatchmakingUI();
        document.getElementById('main-menu').classList.add('hidden');
        
        // Store opponent stats for reward calculation
        if (data.opponent && data.opponent.stats) {
            currentPvPOpponentStats = data.opponent.stats;
        }
        
        // Start PvP game
        isPvPMode = true;
        gameMode = 'pvp';
        startPvPGame(data);
    });
    
    socket.on('opponent-action', (data) => {
        handleOpponentAction(data);
    });
    
    socket.on('opponent-position', (data) => {
        handleOpponentPosition(data);
    });
    
    socket.on('health-update', (data) => {
        playerHealth = data.health;
        updateHealthBar();
    });
    
    socket.on('opponent-health-update', (data) => {
        // Update opponent's health bar (if we have one)
        if (opponentGroup && opponentGroup.userData.healthBarFill) {
            const percentage = Math.max(0, Math.min(100, data.health));
            opponentGroup.userData.healthBarFill.scale.x = percentage / 100;
        }
    });
    
    socket.on('game-end', (data) => {
        const victory = data.victory;
        endGame(victory);
    });
    
    socket.on('opponent-disconnected', () => {
        alert('Opponent disconnected. Returning to menu...');
        endGame(true); // You win by default
    });
    
    // Challenge events
    socket.on('challenge-sent', (data) => {
        showMatchmakingUI();
        document.getElementById('matchmaking-status').textContent = `Challenge sent to ${data.targetUsername}. Waiting for response...`;
    });
    
    socket.on('challenge-received', (data) => {
        // Show in-game challenge popup
        const popup = document.getElementById('challenge-popup');
        const challengerNameEl = document.getElementById('challenge-challenger-name');
        challengerNameEl.textContent = data.challengerName;
        popup.classList.remove('hidden');
        
        // Set up button handlers
        const acceptBtn = document.getElementById('btn-accept-challenge');
        const rejectBtn = document.getElementById('btn-reject-challenge');
        
        // Remove old listeners by cloning
        const newAcceptBtn = acceptBtn.cloneNode(true);
        const newRejectBtn = rejectBtn.cloneNode(true);
        acceptBtn.parentNode.replaceChild(newAcceptBtn, acceptBtn);
        rejectBtn.parentNode.replaceChild(newRejectBtn, rejectBtn);
        
        newAcceptBtn.addEventListener('click', () => {
            popup.classList.add('hidden');
            socket.emit('accept-challenge');
            matchmakingActive = true;
            showMatchmakingUI();
            document.getElementById('matchmaking-status').textContent = `Challenge accepted! Starting game...`;
        });
        
        newRejectBtn.addEventListener('click', () => {
            popup.classList.add('hidden');
            socket.emit('reject-challenge');
        });
    });
    
    socket.on('challenge-failed', (data) => {
        hideMatchmakingUI();
        alert(`Challenge failed: ${data.reason}`);
    });
    
    socket.on('challenge-rejected', (data) => {
        hideMatchmakingUI();
        alert(`${data.targetUsername} rejected your challenge.`);
    });
}

// Challenge a specific player
function challengePlayer(targetUsername) {
    if (!socket || !socket.connected) {
        alert('Not connected to server. Please make sure the server is running.');
        return;
    }
    
    console.log('Challenging player:', targetUsername);
    socket.emit('challenge-player', {
        targetUsername: targetUsername,
        challengerName: userStats.name,
        challengerStats: userStats
    });
}

// Calculate reward based on opponent's rank and wins
function calculatePlayerReward(opponentStats) {
    const wins = opponentStats.wins || 0;
    const rank = opponentStats.rank || 'Rookie';
    
    // Base reward by rank
    const rankRewards = {
        'Rookie': 50,
        'Soldier': 100,
        'Veteran': 200,
        'Elite': 350,
        'Master': 500,
        'Legend': 750,
        'Champion': 1000
    };
    
    let baseReward = rankRewards[rank] || 50;
    
    // Bonus based on wins (more wins = higher reward)
    // Each 10 wins adds 10% to base reward, capped at +100%
    const winBonus = Math.min(wins / 10 * 0.1, 1.0); // Max 100% bonus
    const totalReward = Math.floor(baseReward * (1 + winBonus));
    
    return totalReward;
}

function startMatchmaking() {
    try {
        if (!socket) {
            // Try to initialize if not already done
            initializeNetworking();
            // Wait a moment for connection
            setTimeout(() => {
                if (!socket || !socket.connected) {
                    alert('Not connected to server. Please start the server first (npm run server).');
                    return;
                }
                proceedWithMatchmaking();
            }, 1000);
        } else if (!socket.connected) {
            alert('Not connected to server. Please check your connection and make sure the server is running (npm run server).');
            return;
        } else {
            proceedWithMatchmaking();
        }
    } catch (error) {
        console.error('Error starting matchmaking:', error);
        alert('Error connecting to server. Please make sure the server is running.');
    }
}

function proceedWithMatchmaking() {
    matchmakingActive = true;
    showMatchmakingUI();
    
    try {
        socket.emit('join-matchmaking', {
            name: userStats.name,
            stats: userStats
        });
    } catch (error) {
        console.error('Error joining matchmaking:', error);
        showMatchmakingError('Failed to join matchmaking. Please try again.');
    }
}

function showMatchmakingUI() {
    document.getElementById('matchmaking-ui').classList.remove('hidden');
    document.getElementById('matchmaking-status').textContent = 'Searching for opponent...';
}

function hideMatchmakingUI() {
    document.getElementById('matchmaking-ui').classList.add('hidden');
    matchmakingActive = false;
}

function showMatchmakingError(message) {
    document.getElementById('matchmaking-status').textContent = message;
    setTimeout(() => {
        hideMatchmakingUI();
    }, 2000);
}

async function startPvPGame(data) {
    // Initialize gun controller first (like single-player)
    const success = await gun.initialize();
    if (!success) {
        alert("Sensors not enabled. Check browser permissions.");
        document.getElementById('main-menu').classList.remove('hidden');
        return;
    }
    
    // Remove UI layer background (like single-player)
    document.getElementById('ui-layer').style.background = 'none';
    document.getElementById('ui-layer').style.pointerEvents = 'none';
    
    // Initialize PvP game state
    opponentHealth = 100;
    playerHealth = 100;
    
    // Get selected weapon
    const selectedWeapon = weapons.find(w => w.id === userStats.selectedWeapon) || weapons[0];
    playerAmmo = selectedWeapon.ammo;
    maxAmmo = selectedWeapon.ammo;
    gameStarted = true;
    
    // Make groups visible
    opponentGroup.visible = true;
    gunGroup.visible = true;
    
    // Reset camera to proper forward view (like single-player)
    // For PvP, use standard forward view instead of side positions
    camera.position.set(0, 1.7, 0);
    camera.quaternion.set(0, 0, 0, 1); // Reset rotation to identity (looking forward)
    camera.lookAt(0, 1.7, -10); // Look forward into the arena
    
    // Enable orientation control after a brief delay
    setTimeout(() => {
        orientationEnabled = true;
    }, 100);
    
    // Position opponent in front (like single-player)
    opponentGroup.position.set(0, 0, -20);
    
    // Setup mouse/touch look controls
    setupMouseLook();
    
    // Initialize reticle at center
    reticleX = 0;
    reticleY = 0;
    
    // Add click/tap to fire (like single-player)
    const fireOnClick = (e) => {
        if (gameStarted && !isReloading) {
            e.preventDefault();
            gun.fire();
        }
    };
    document.addEventListener('click', fireOnClick);
    document.addEventListener('touchend', fireOnClick);
    
    // Show UI elements
    document.getElementById('crosshair').classList.add('visible');
    document.getElementById('health-bar-container').classList.add('visible');
    document.getElementById('ammo-count').classList.add('visible');
    document.getElementById('reload-button').classList.add('visible');
    
    // Update ammo display to match weapon capacity
    const ammoCountEl = document.getElementById('ammo-count');
    ammoCountEl.innerHTML = ''; // Clear existing bullets
    for (let i = 0; i < maxAmmo; i++) {
        const bullet = document.createElement('div');
        bullet.className = 'bullet';
        ammoCountEl.appendChild(bullet);
    }
    
    // Set HUD status
    hud.innerText = "STATUS: AIMING (Ready)";
    hud.classList.remove('holstered');
    
    // Update UI
    updateHealthBar();
    updateAmmoCount();
}

function handleOpponentAction(data) {
    const action = data.action;
    
    switch (action.type) {
        case 'shoot':
            // Show opponent muzzle flash
            if (opponentMuzzleLight) {
                opponentMuzzleLight.intensity = 3;
                opponentMuzzleLight.color.setHex(0xff0000);
                setTimeout(() => {
                    opponentMuzzleLight.intensity = 0;
                }, 100);
            }
            break;
        case 'dodge':
            // Show opponent dodge effect
            const dodgePos = opponentGroup.position.clone();
            dodgePos.y += 1.5;
            const dodgeGeometry = new THREE.RingGeometry(0.3, 0.5, 16);
            const dodgeMaterial = new THREE.MeshBasicMaterial({ 
                color: 0x00ffff, 
                transparent: true, 
                opacity: 0.7 
            });
            const dodgeEffect = new THREE.Mesh(dodgeGeometry, dodgeMaterial);
            dodgeEffect.position.copy(dodgePos);
            scene.add(dodgeEffect);
            
            new TWEEN.Tween(dodgeEffect.scale)
                .to({ x: 2, y: 2, z: 2 }, 200)
                .onComplete(() => {
                    scene.remove(dodgeEffect);
                    dodgeEffect.geometry.dispose();
                    dodgeEffect.material.dispose();
                })
                .start();
            break;
    }
}

function handleOpponentPosition(data) {
    // Smoothly update opponent position
    const targetPos = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
    new TWEEN.Tween(opponentGroup.position)
        .to(targetPos, 100)
        .start();
}

// Send player action to server
function sendPlayerAction(action) {
    if (socket && socket.connected && isPvPMode) {
        socket.emit('player-action', action);
    }
}

// Send player hit to server
function sendPlayerHit(damage) {
    if (socket && socket.connected && isPvPMode) {
        socket.emit('player-hit', { damage: damage });
    }
}

// Setup menu button event listeners
function setupMenuButtons() {
    console.log('Setting up menu buttons...');
    
    // Battle buttons are now on each card, no separate buttons needed
    // Button handlers are set up in initializeMenu() after cards are created

    // Cancel Matchmaking Button
    const btnCancelMatchmaking = document.getElementById('btn-cancel-matchmaking');
    if (btnCancelMatchmaking) {
        // Remove any existing listeners by cloning the element
        const newBtn = btnCancelMatchmaking.cloneNode(true);
        btnCancelMatchmaking.parentNode.replaceChild(newBtn, btnCancelMatchmaking);
        
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Cancel Matchmaking button clicked');
            if (socket && socket.connected) {
                socket.disconnect();
                socket = null;
            }
            hideMatchmakingUI();
            initializeNetworking(); // Reconnect
        });
        console.log('Cancel Matchmaking button listener attached');
    } else {
        console.error('btn-cancel-matchmaking button not found');
    }

    // Challenge functionality is now handled by clicking on online player cards
    // No separate challenge button needed
}

// Initialize menu buttons when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMenuButtons);
} else {
    // DOM is already ready
    setupMenuButtons();
}

// --- 3. Start Sequence ---
async function startGame(opponentData) {
    const success = await gun.initialize();
    if (success) {
        document.getElementById('ui-layer').style.background = 'none';
        document.getElementById('ui-layer').style.pointerEvents = 'none';
        
        // Apply opponent stats
        opponentHealth = opponentData.health;
        currentOpponentData = opponentData;
        
        // Update opponent shooting interval based on speed (faster = shoots more often)
        const baseInterval = 1500;
        OPPONENT_SHOOT_INTERVAL = baseInterval / opponentData.speed;
        
        // Reset enemy attack patterns
        enemyAttackPhase = 'normal';
        enemyPatternShotCount = 0;
        enemyPatternType = 'single';
        enemyNextPatternTime = 0;
        
        // Dodge removed
        
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
        
        // Add click/tap to fire (can fire even when holstered, but not while reloading)
        const fireOnClick = (e) => {
            if (gameStarted && !isReloading) {
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
        document.getElementById('reload-button').classList.add('visible');
        
        // Dodge button removed
        
        // Reset player stats - use selected weapon's ammo
        playerHealth = 100;
        const selectedWeapon = weapons.find(w => w.id === userStats.selectedWeapon) || weapons[0];
        maxAmmo = selectedWeapon.ammo;
        playerAmmo = maxAmmo;
        
        // Update ammo display to match weapon capacity
        const ammoCount = document.getElementById('ammo-count');
        ammoCount.innerHTML = ''; // Clear existing bullets
        for (let i = 0; i < maxAmmo; i++) {
            const bullet = document.createElement('div');
            bullet.className = 'bullet';
            ammoCount.appendChild(bullet);
        }
        
        updateHealthBar();
        updateAmmoCount();
        updateOpponentHealthBar();
        
    } else {
        alert("Sensors not enabled. Check browser permissions.");
        // Show menu again if initialization fails
        document.getElementById('main-menu').classList.remove('hidden');
    }
}

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
            this.onCompleteCallback = null;
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
        onComplete(callback) { this.onCompleteCallback = callback; return this; }
        update(time) {
            let elapsed = (time || performance.now()) - this.startTime;
            const isComplete = elapsed >= this.duration;
            if (isComplete) elapsed = this.duration;
            const value = this.easingFunction(elapsed / this.duration);
            for (const property in this.valuesEnd) {
                const start = this.valuesStart[property];
                const end = this.valuesEnd[property];
                this.object[property] = start + (end - start) * value;
            }
            if (this.onUpdateCallback) this.onUpdateCallback(this.object);
            if (isComplete && this.onCompleteCallback) {
                this.onCompleteCallback();
            }
            return !isComplete;
        }
    }
};

let opponentAnimationTime = 0; // For opponent animation timing

function animate(time) {
    requestAnimationFrame(animate);
    TWEEN.update(time); // Update tweens
    
    // Update opponent animations
    if (opponentMixer && gameStarted) {
        const delta = opponentAnimationTime > 0 ? (time - opponentAnimationTime) / 1000 : 0.016; // Convert to seconds
        opponentAnimationTime = time;
        opponentMixer.update(delta);
    } else {
        opponentAnimationTime = time;
    }
    
    // Update gun position if game has started (works whether holstered or not)
    if (gameStarted) {
        // Update camera matrix before using it
        camera.updateMatrixWorld();
        
        // Make gun follow camera position
        // Use camera's world matrix to transform local offset
        // Closer and higher to show iron sight
        const localOffset = new THREE.Vector3(0.15, -0.15, -0.1);
        const worldOffset = localOffset.clone().applyMatrix4(camera.matrixWorld);
        gunGroup.position.copy(worldOffset);
        
        // Make gun rotate to follow the reticle
        // Create a raycaster from the reticle position to get the direction
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(reticleX, reticleY), camera);
        
        // Get the direction vector from the raycaster
        const direction = raycaster.ray.direction.clone();
        
        // Calculate a point far along the ray for lookAt
        const targetPoint = gunGroup.position.clone().add(direction.multiplyScalar(100));
        
        // Make gun look at the target point (where reticle is pointing)
        gunGroup.lookAt(targetPoint);
    }
    
    // Animate Enemy (Lateral Movement only - keep feet on ground)
    if (opponentHealth > 0 && gameStarted && playerHealth > 0) {
        // Move left and right (sine wave) - reduced range to keep on screen
        // Range: -8 to 8, Speed: 0.001
        opponentGroup.position.x = Math.sin(time * 0.001) * 8;
        
        // Keep opponent group at ground level (y: 0)
        opponentGroup.position.y = 0;
        
        // Update animation based on state
        updateOpponentAnimation();
        
        // Make opponent look at player (aim at camera)
        const playerPos = camera.position.clone();
        const opponentPos = opponentGroup.position.clone();
        opponentPos.y += 1.5; // Look from chest/head level
        const lookDirection = new THREE.Vector3()
            .subVectors(playerPos, opponentPos)
            .normalize();
        
        // Calculate rotation to look at player (only Y rotation for body)
        const angle = Math.atan2(lookDirection.x, lookDirection.z);
        opponentGroup.rotation.y = angle;
        
        // Update 3D health bar to face camera
        if (opponentGroup.userData.healthBarFill) {
            opponentGroup.userData.healthBarFill.lookAt(camera.position);
            if (opponentGroup.userData.healthBarBg) {
                opponentGroup.userData.healthBarBg.lookAt(camera.position);
            }
        }
        
        // Opponent shooting (only in single player mode)
        if (!isPvPMode) {
            opponentShoot();
        }
    }
    
    renderer.render(scene, camera);
}
animate();

// Mouse/Touch Reticle Setup (only moves reticle, not camera)
function setupMouseLook() {
    const crosshair = document.getElementById('crosshair');
    
    // Update reticle position based on mouse/touch (works even when holstered)
    const updateReticle = (clientX, clientY) => {
        if (!gameStarted) return;
        
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
        if (!gameStarted) return;
        if (e.touches.length === 1) {
            e.preventDefault();
            updateReticle(e.touches[0].clientX, e.touches[0].clientY);
        }
    };
    
    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
}

// Handle Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
