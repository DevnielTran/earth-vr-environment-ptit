import * as THREE from 'three';

export var TrafficManager = function(scene, earthObject, poiData) {
    this.scene = scene;
    this.earthObject = earthObject;
    this.poiData = poiData;
    this.earthRadius = 6.3781;
    
    this.paths = [];
    this.trafficGroup = new THREE.Group();
    // Add to earthObject so it rotates with the Earth
    this.earthObject.add(this.trafficGroup);

    this.latLonToVector3 = function(lat, lon, radius) {
        var phi = (90 - lat) * (Math.PI / 180);
        var theta = (lon + 180) * (Math.PI / 180);
        var x = -(radius * Math.sin(phi) * Math.cos(theta));
        var z = (radius * Math.sin(phi) * Math.sin(theta));
        var y = (radius * Math.cos(phi));
        return new THREE.Vector3(x, y, z);
    };

    this.getPointByCityName = function(name) {
        var poi = this.poiData.find(p => p.name === name);
        if (poi) {
            return this.latLonToVector3(poi.lat, poi.lon, this.earthRadius);
        }
        return null;
    };

    this.init = function() {
        // Define some beautiful routes between major cities
        const cityPairs = [
            ["Hà Nội", "Paris"],
            ["Hà Nội", "Tokyo"],
            ["TP. Hồ Chí Minh", "Sydney"],
            ["Paris", "New York"],
            ["New York", "London"],
            ["London", "Cairo"],
            ["Cairo", "Dubai"],
            ["Dubai", "Bắc Kinh"],
            ["Bắc Kinh", "Moscow"],
            ["Moscow", "Rome"],
            ["Rome", "Rio de Janeiro"],
            ["Rio de Janeiro", "Sydney"],
            ["Sydney", "Tokyo"],
            ["San Francisco", "Tokyo"],
            ["New York", "San Francisco"],
            ["London", "Bắc Kinh"],
            ["Paris", "Dubai"],
            ["Hà Nội", "Moscow"]
        ];

        cityPairs.forEach(pair => {
            const start = this.getPointByCityName(pair[0]);
            const end = this.getPointByCityName(pair[1]);
            if (start && end) {
                this.createFlightPath(start, end);
            }
        });
    };

    this.createFlightPath = function(start, end) {
        const distance = start.distanceTo(end);
        // Altitude proportional to distance for better arc looks
        const altitude = Math.min(distance * 0.35, 3.0); 
        
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        // Push the control point outwards along the normal
        const control = mid.clone().normalize().multiplyScalar(this.earthRadius + altitude);

        const curve = new THREE.QuadraticBezierCurve3(start, control, end);
        
        // 1. Create the arc line
        const points = curve.getPoints(64);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.2, // Subtle line
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const line = new THREE.Line(geometry, material);
        this.trafficGroup.add(line);

        // 2. Create the pulse (flying point)
        // We use a small glowing mesh for the "plane"
        const pulseGeo = new THREE.SphereGeometry(0.025, 8, 8);
        const pulseMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        const pulse = new THREE.Mesh(pulseGeo, pulseMat);
        
        this.paths.push({
            curve: curve,
            pulse: pulse,
            progress: Math.random(), // Random start phase
            speed: 0.00008 + Math.random() * 0.00015 
        });
        this.trafficGroup.add(pulse);
    };

    this.update = function(delta) {
        this.paths.forEach(path => {
            path.progress += path.speed * delta;
            if (path.progress > 1) {
                path.progress = 0;
                // Slightly randomize speed for variety
                path.speed = 0.00008 + Math.random() * 0.00015;
            }
            
            const point = path.curve.getPointAt(path.progress);
            path.pulse.position.copy(point);
            
            // Fading at start/end and pulsing size
            const alpha = Math.sin(path.progress * Math.PI);
            path.pulse.material.opacity = alpha * 0.95;
            
            const scale = 0.6 + alpha * 0.4;
            path.pulse.scale.set(scale, scale, scale);
        });
    };
};
