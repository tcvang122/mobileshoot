export class GunController {
    constructor(options) {
        this.onAim = options.onAim || (() => {});
        this.onFire = options.onFire || (() => {});
        this.onHolsterStatus = options.onHolsterStatus || (() => {});

        this.lastFireTime = 0;
        this.isHolstered = false;
        
        // Configuration
        this.fireThreshold = 15; // Acceleration threshold for firing
        this.holsterThreshold = 160; // Degrees for holster (upside down)
    }

    async initialize() {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const response = await DeviceOrientationEvent.requestPermission();
                if (response === 'granted') {
                    this.addListeners();
                    return true;
                }
                return false;
            } catch (e) {
                console.error(e);
                return false;
            }
        } else {
            this.addListeners();
            return true;
        }
    }

    addListeners() {
        window.addEventListener('deviceorientation', this.handleOrientation.bind(this));
        window.addEventListener('devicemotion', this.handleMotion.bind(this));
        
        // Debugging: Space to toggle holster
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                this.isHolstered = !this.isHolstered;
                this.onHolsterStatus(this.isHolstered);
            }
        });
    }

    handleOrientation(event) {
        const { alpha, beta, gamma } = event;
        
        // Pass orientation data to the aim callback
        this.onAim({ alpha, beta, gamma });

        // Holster detection (Phone pointed down)
        // Beta is front/back tilt [-180, 180]
        // Only run this logic if we have valid sensor data (prevents desktop override)
        if (beta !== null) {
            const absBeta = Math.abs(beta);
            const isNowHolstered = absBeta > this.holsterThreshold;

            if (this.isHolstered !== isNowHolstered) {
                this.isHolstered = isNowHolstered;
                this.onHolsterStatus(this.isHolstered);
            }
        }
    }

    handleMotion(event) {
        if (this.isHolstered) return;

        const acc = event.acceleration;
        if (!acc) return;

        // Simple shake/jerk detection for firing
        const totalAcc = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
        
        if (totalAcc > this.fireThreshold) {
            const now = Date.now();
            if (now - this.lastFireTime > 200) { // Debounce
                this.lastFireTime = now;
                this.fire();
            }
        }
    }
    
    // Public method to fire (for click/tap events)
    fire() {
        if (this.isHolstered) return;
        const now = Date.now();
        if (now - this.lastFireTime > 200) { // Debounce
            this.lastFireTime = now;
            this.onFire();
        }
    }
}
