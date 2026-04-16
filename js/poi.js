import * as THREE from 'three';

export var POIManager = function(scene, earthObject, camera, renderer) {
    this.poiData = [
        { name: "Hà Nội", country: "Vietnam", lat: 21.0285, lon: 105.8542, description: "Thủ đô của Việt Nam. Nổi tiếng với kiến trúc cổ kính và nền văn hóa phong phú." },
        { name: "TP. Hồ Chí Minh", country: "Vietnam", lat: 10.7627, lon: 106.6602, description: "Đô thị sầm uất ở miền Nam Việt Nam. Trước đây được gọi là Sài Gòn." },
        { name: "Paris", country: "France", lat: 48.8566, lon: 2.3522, description: "Kinh đô Ánh sáng. Trung tâm thế giới về nghệ thuật, thời trang và văn hóa." },
        { name: "New York", country: "United States of America", lat: 40.7128, lon: -74.0060, description: "Quả táo lớn. Trung tâm toàn cầu về tài chính, văn hóa và giải trí." },
        { name: "Tokyo", country: "Japan", lat: 35.6895, lon: 139.6917, description: "Thủ đô nhộn nhịp của Nhật Bản. Sự kết hợp giữa hiện đại và truyền thống." },
        { name: "London", country: "United Kingdom", lat: 51.5074, lon: -0.1278, description: "Thủ đô của Vương quốc Anh. Thành phố với lịch sử lâu đời từ thời La Mã." },
        { name: "Sydney", country: "Australia", lat: -33.8688, lon: 151.2093, description: "Nổi tiếng với Nhà hát Opera và Cầu Cảng tại Úc." },
        { name: "Rio de Janeiro", country: "Brazil", lat: -22.9068, lon: -43.1729, description: "Nơi có tượng Chúa Cứu Thế và bãi biển Copacabana nổi tiếng." },
        { name: "Cairo", country: "Egypt", lat: 30.0444, lon: 31.2357, description: "Cửa ngõ dẫn vào Đại kim tự tháp Giza và tượng Nhân sư ở Ai Cập." },
        { name: "Moscow", country: "Russia", lat: 55.7558, lon: 37.6173, description: "Được biết đến với Quảng trường Đỏ, Điện Kremlin và Nhà thờ Saint Basil." },
        { name: "Bắc Kinh", country: "China", lat: 39.9042, lon: 116.4074, description: "Thủ đô của Trung Quốc, quê hương của Tử Cấm Thành và Vạn Lý Trường Thành." },
        { name: "Rome", country: "Italy", lat: 41.9028, lon: 12.4964, description: "Thành phố vĩnh cửu, nơi có Đấu trường La Mã và Thành quốc Vatican." },
        { name: "Dubai", country: "United Arab Emirates", lat: 25.2048, lon: 55.2708, description: "Nổi tiếng với Burj Khalifa, tòa nhà cao nhất thế giới." },
        { name: "San Francisco", country: "United States of America", lat: 37.7749, lon: -122.4194, description: "Nổi tiếng với Cầu Cổng Vàng và những chiếc xe cáp biểu tượng." }
    ];

    this.markers = [];
    this.markerGroup = new THREE.Group();
    earthObject.add(this.markerGroup);

    this.countryBorders = {}; 
    this.countryGroup = new THREE.Group();
    earthObject.add(this.countryGroup);

    this.earthRadius = 6.3781;
    this.earthMesh = earthObject.children[0]; 
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hoveredPOI = null;
    this.activeCountry = null;
    this.renderer = renderer;

    // Create a simple info panel (3D Plane)
    this.infoPanel = new (function() {
        var width = 1024, height = 512;
        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
        var texture = new THREE.Texture(canvas);
        var material = new THREE.MeshBasicMaterial({map: texture, transparent: true, opacity: 0, depthTest: false, depthWrite: false});
        var geometry = new THREE.PlaneGeometry(8, 4);
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.scale.set(0.55, 0.55, 0.55);
        this.mesh.renderOrder = 999; 
        this.mesh.visible = false;
        this.targetOpacity = 0;
        scene.add(this.mesh);

        this.update = function(poi) {
            context.clearRect(0, 0, width, height);

            var padding = 20;
            var boxWidth = width - padding * 2;
            var boxHeight = height - padding * 2;
            var x = padding;
            var y = padding;
            var radius = 30;

            context.shadowColor = 'rgba(0, 255, 255, 0.4)';
            context.shadowBlur = 25;
            context.shadowOffsetX = 0;
            context.shadowOffsetY = 0;

            var grad = context.createLinearGradient(x, y, x, y + boxHeight);
            grad.addColorStop(0, 'rgba(10, 20, 30, 0.85)');
            grad.addColorStop(1, 'rgba(2, 5, 10, 0.95)');

            context.fillStyle = grad;

            context.beginPath();
            context.moveTo(x + radius, y);
            context.lineTo(x + boxWidth - radius, y);
            context.quadraticCurveTo(x + boxWidth, y, x + boxWidth, y + radius);
            context.lineTo(x + boxWidth, y + boxHeight - 60);
            context.lineTo(x + boxWidth - 60, y + boxHeight);
            context.lineTo(x + radius, y + boxHeight);
            context.quadraticCurveTo(x, y + boxHeight, x, y + boxHeight - radius);
            context.lineTo(x, y + 60);
            context.lineTo(x + 60, y);
            context.lineTo(x + radius, y);
            context.closePath();
            context.fill();

            context.shadowBlur = 0;
            context.lineWidth = 2;
            context.strokeStyle = 'rgba(0, 255, 255, 0.15)';
            context.stroke();

            context.lineWidth = 4;
            context.strokeStyle = '#00ffff';
            context.beginPath();
            context.moveTo(x, y + 60);
            context.lineTo(x + 60, y);
            context.lineTo(x + boxWidth * 0.4, y);
            context.stroke();

            context.beginPath();
            context.moveTo(x + boxWidth, y + boxHeight - 60);
            context.lineTo(x + boxWidth - 60, y + boxHeight);
            context.lineTo(x + boxWidth * 0.6, y + boxHeight);
            context.stroke();

            context.fillStyle = '#00ffff';
            context.beginPath();
            context.arc(x + 60, y + 85, 8, 0, Math.PI * 2);
            context.fill();

            context.fillStyle = '#ffffff';
            context.font = 'bold 64px sans-serif';
            context.textAlign = 'left';
            context.fillText(poi.name, x + 90, y + 105);
            
            context.fillStyle = 'rgba(255, 255, 255, 0.1)';
            context.fillRect(x + 50, y + 140, boxWidth - 100, 2);

            context.fillStyle = '#bbbbbb';
            context.font = '36px sans-serif';
            
            var words = poi.description.split(' ');
            var line = '';
            var textY = y + 210;
            for(var n = 0; n < words.length; n++) {
                var testLine = line + words[n] + ' ';
                var metrics = context.measureText(testLine);
                if (metrics.width > boxWidth - 120 && n > 0) {
                    context.fillText(line, x + 60, textY);
                    line = words[n] + ' ';
                    textY += 55;
                } else {
                    line = testLine;
                }
            }
            context.fillText(line, x + 60, textY);
            texture.needsUpdate = true;
        };
    })(scene);

    this.init = function() {
        for (var i = 0; i < this.poiData.length; i++) {
            var poi = this.poiData[i];
            var pos = this.latLonToVector3(poi.lat, poi.lon, this.earthRadius + 0.15);

            // Create a canvas-based sprite for each marker
            var canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 128;
            var ctx = canvas.getContext('2d');

            // Glow background
            var grd = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
            grd.addColorStop(0, 'rgba(0, 255, 255, 0.6)');
            grd.addColorStop(0.4, 'rgba(0, 255, 255, 0.15)');
            grd.addColorStop(1, 'rgba(0, 255, 255, 0)');
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, 128, 128);

            // Diamond shape in center
            ctx.fillStyle = '#00ffff';
            ctx.beginPath();
            ctx.moveTo(64, 40);
            ctx.lineTo(80, 64);
            ctx.lineTo(64, 88);
            ctx.lineTo(48, 64);
            ctx.closePath();
            ctx.fill();

            // Inner diamond
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(64, 50);
            ctx.lineTo(72, 64);
            ctx.lineTo(64, 78);
            ctx.lineTo(56, 64);
            ctx.closePath();
            ctx.fill();

            // City name label
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 28px sans-serif';
            ctx.textAlign = 'left';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 4;
            ctx.fillText(poi.name, 100, 72);

            var texture = new THREE.CanvasTexture(canvas);
            var spriteMat = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                depthTest: true,
                depthWrite: false,
                sizeAttenuation: true
            });
            var sprite = new THREE.Sprite(spriteMat);
            sprite.position.copy(pos);
            sprite.scale.set(1.8, 0.9, 1);
            sprite.userData = poi;
            sprite.renderOrder = 10;
            this.markerGroup.add(sprite);
            this.markers.push(sprite);
        }

        this.initGeoJSON();
    };

    this.initGeoJSON = function() {
        const geoUrl = 'https://raw.githubusercontent.com/datasets/geo-boundaries-world-110m/master/countries.geojson';
        console.log('[POI] Loading GeoJSON borders from:', geoUrl);
        fetch(geoUrl)
            .then(res => {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(data => {
                console.log('[POI] GeoJSON loaded:', data.features.length, 'countries');

                data.features.forEach(feature => {
                    const countryName = feature.properties.name;
                    const geometry = feature.geometry;
                    const linesGroup = new THREE.Group();
                    linesGroup.name = countryName;
                    linesGroup.visible = false; // Start hidden
                    
                    const processCoords = (coords) => {
                        const points = [];
                        coords.forEach(coord => {
                            const v = this.latLonToVector3(coord[1], coord[0], this.earthRadius + 0.06);
                            points.push(v);
                        });
                        const geo = new THREE.BufferGeometry().setFromPoints(points);
                        const borderMat = new THREE.LineBasicMaterial({
                            color: 0x00ffff,
                            transparent: true,
                            opacity: 0.9,
                            blending: THREE.AdditiveBlending,
                            depthWrite: false
                        });
                        const line = new THREE.Line(geo, borderMat);
                        linesGroup.add(line);
                    };

                    if (geometry.type === 'Polygon') {
                        geometry.coordinates.forEach(processCoords);
                    } else if (geometry.type === 'MultiPolygon') {
                        geometry.coordinates.forEach(poly => {
                            poly.forEach(processCoords);
                        });
                    }

                    this.countryGroup.add(linesGroup);
                    this.countryBorders[countryName] = linesGroup;
                });

                // Log which POI countries were matched
                const poiCountries = [...new Set(this.poiData.map(p => p.country))];
                poiCountries.forEach(c => {
                    console.log('[POI] Country "' + c + '":', this.countryBorders[c] ? 'FOUND' : 'NOT FOUND');
                });
            })
            .catch(err => console.error('[POI] Failed to load country borders:', err));
    };

    this.latLonToVector3 = function(lat, lon, radius) {
        var phi = (90 - lat) * (Math.PI / 180);
        var theta = (lon + 180) * (Math.PI / 180);
        var x = -(radius * Math.sin(phi) * Math.cos(theta));
        var z = (radius * Math.sin(phi) * Math.sin(theta));
        var y = (radius * Math.cos(phi));
        return new THREE.Vector3(x, y, z);
    };

    this.updateBuffer = new THREE.Vector3();
    this.update = function(camera, mouse) {
        if (!this.renderer.xr.isPresenting) {
            this.raycaster.setFromCamera(mouse, camera);
        } else {
            const controller = this.renderer.xr.getController(0);
            if (controller && controller.visible) {
                const tempMatrix = new THREE.Matrix4().extractRotation(controller.matrixWorld);
                this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
                this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
            } else {
                const camWorldPos = new THREE.Vector3();
                const camWorldDir = new THREE.Vector3();
                camera.getWorldPosition(camWorldPos);
                camera.getWorldDirection(camWorldDir);
                this.raycaster.set(camWorldPos, camWorldDir);
            }
        }

        var intersects = this.raycaster.intersectObjects([this.earthMesh].concat(this.markers));
        if (intersects.length > 0) {
            var firstHit = intersects[0].object;
            if (this.markers.includes(firstHit)) {
                var poi = firstHit.userData;
                if (this.hoveredPOI !== poi) {
                    // Reset previous marker
                    this.resetMarkerStyles();
                    
                    this.hoveredPOI = poi;
                    this.infoPanel.update(poi);
                    this.infoPanel.targetOpacity = 0.9;
                    
                    // Highlight hovered marker
                    firstHit.material.color.set(0xffff00);
                    firstHit.scale.set(2.4, 1.2, 1);
                    
                    // Trigger Country Border
                    this.showCountryBorder(poi.country);
                }
            } else if (firstHit === this.earthMesh) {
                this.resetHover();
            }
        } else {
            this.resetHover();
        }

        // Show/hide country borders based on active country
        if (this.prevActiveCountry !== this.activeCountry) {
            // Hide previous country border
            if (this.prevActiveCountry && this.countryBorders[this.prevActiveCountry]) {
                this.countryBorders[this.prevActiveCountry].visible = false;
            }
            // Show new country border
            if (this.activeCountry && this.countryBorders[this.activeCountry]) {
                this.countryBorders[this.activeCountry].visible = true;
            }
            this.prevActiveCountry = this.activeCountry;
        }
    };

    this.showCountryBorder = function(countryName) {
        this.activeCountry = countryName;
    };

    this.resetMarkerStyles = function() {
        for (var i = 0; i < this.markers.length; i++) {
            this.markers[i].material.color.set(0xffffff);
            this.markers[i].scale.set(1.8, 0.9, 1);
        }
    };

    this.resetHover = function() {
        if (this.hoveredPOI) {
            this.resetMarkerStyles();
            this.hoveredPOI = null;
            this.activeCountry = null; // Hide borders
            this.infoPanel.targetOpacity = 0;
        }
    };

    this.animatePanel = function(camera) {
        if (this.infoPanel.mesh.material.opacity < this.infoPanel.targetOpacity) {
            this.infoPanel.mesh.material.opacity += 0.05;
            this.infoPanel.mesh.visible = true;
        } else if (this.infoPanel.mesh.material.opacity > this.infoPanel.targetOpacity) {
            this.infoPanel.mesh.material.opacity -= 0.05;
            if (this.infoPanel.mesh.material.opacity <= 0) {
                this.infoPanel.mesh.visible = false;
            }
        }

        if (this.infoPanel.mesh.visible) {
            const camWorldPos = new THREE.Vector3();
            camera.getWorldPosition(camWorldPos);
            this.infoPanel.mesh.lookAt(camWorldPos);

            if (this.hoveredPOI) {
                for (var i = 0; i < this.markers.length; i++) {
                    if (this.markers[i].userData === this.hoveredPOI) {
                        var worldPos = new THREE.Vector3();
                        this.markers[i].getWorldPosition(worldPos);
                        var surfaceNormal = worldPos.clone().normalize();
                        var viewDir = new THREE.Vector3().subVectors(camWorldPos, worldPos).normalize();
                        var sideDir = new THREE.Vector3().crossVectors(viewDir, surfaceNormal);

                        if (sideDir.lengthSq() < 0.0001) {
                            sideDir.crossVectors(new THREE.Vector3(0, 1, 0), surfaceNormal);
                        }

                        if (sideDir.lengthSq() < 0.0001) {
                            sideDir.set(1, 0, 0);
                        }

                        sideDir.normalize();

                        var panelPos = worldPos.clone()
                            .add(surfaceNormal.multiplyScalar(1.5))
                            .add(sideDir.multiplyScalar(3.6))
                            .add(new THREE.Vector3(0, 0.45, 0));

                        this.infoPanel.mesh.position.copy(panelPos);
                        break;
                    }
                }
            }
        }
    };
};
