import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

import { 
    initSkybox, initLight, initSceneObjects, 
    animateFrame, earthObject, moonObject, sunLight,
    resetEarth, launchMeteor, toggleDoomsday, setDeepSeaMode
} from './render.js';
import { cameraTransform, minDistance, maxDistance, setEarthRotationSpeed, setMoonRotationSpeed } from './transform.js';
import { EarthHUD, MoonHUD } from './hud.js';
import { POIManager } from './poi.js';
import { initVRMenu, updateVRMenuCanvas, updateVRControllers } from './vr_menu.js';
import { VRHelpPanel } from './vr_help.js';
import { setTimeScale } from './time.js';
import { updateGamepad } from './control.js';
import { TrafficManager } from './traffic.js';

// ── Application State ────────────────────────────────────────────────────────
let renderer, scene, camera, cameraGroup, controls;
let earthHUD, moonHUD, poiManager, trafficManager, vrHelp;

async function init() {
    // ── Renderer Setup ──
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true; 
    document.body.appendChild(renderer.domElement);

    // ── Scene & Camera ──
    scene = new THREE.Scene();
    
    // Create cameraGroup (dolly) to move user in VR
    cameraGroup = new THREE.Group();
    scene.add(cameraGroup);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 20000);
    cameraGroup.add(camera); // Camera is relative to group
    
    cameraTransform.init(camera);

    // ── Controls ──
    controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = minDistance;
    controls.maxDistance = maxDistance;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // ── VR Button ──
    document.getElementById('vr-button').appendChild(VRButton.createButton(renderer));

    // ── Initializations ──
    initSkybox(scene);
    initLight(scene);
    initSceneObjects(scene);

    earthHUD = new EarthHUD(camera);
    scene.add(earthHUD.plane);
    moonHUD = new MoonHUD(camera);
    scene.add(moonHUD.plane);

    poiManager = new POIManager(scene, earthObject, camera, renderer);
    poiManager.init();

    trafficManager = new TrafficManager(scene, earthObject, poiManager.poiData);
    trafficManager.init();

    vrHelp = new VRHelpPanel(scene, camera);
    initVRMenu(scene, camera);

    // ── Global Exposures ──
    window.launchMeteor = () => launchMeteor(scene);
    window.toggleDoomsday = () => toggleDoomsday(scene);
    window.resetEarth = resetEarth;
    window.syncTimeSpeed = (val) => setTimeScale(parseFloat(val));
    window.syncEarthSpeed = (val) => setEarthRotationSpeed(parseFloat(val));
    window.syncMoonSpeed = (val) => setMoonRotationSpeed(parseFloat(val));
    window.toggleDeepSea = (active) => setDeepSeaMode(active);
    window.earthHUD = earthHUD;
    window.moonHUD = moonHUD;
    window.renderer = renderer;

    // ── Event Listeners ──
    window.addEventListener('resize', onWindowResize);
    
    // VR Session Management
    renderer.xr.addEventListener('sessionstart', () => {
        // Disable OrbitControls in VR — stick movement handles everything
        controls.enabled = false;
        
        // Position the cameraGroup where the camera was in 2D view
        // so the user starts at the same vantage point
        cameraTransform.update(cameraGroup);
        
        // Reset camera LOCAL pose to origin (XR tracking will handle head position)
        camera.position.set(0, 0, 0);
        camera.quaternion.set(0, 0, 0, 1);
    });

    renderer.xr.addEventListener('sessionend', () => {
        // Re-enable OrbitControls for 2D
        controls.enabled = true;
        
        // Restore camera position from cameraTransform state
        cameraTransform.update(camera);
        
        // Reset cameraGroup to origin (not needed in 2D)
        cameraGroup.position.set(0, 0, 0);
        cameraGroup.quaternion.set(0, 0, 0, 1);
    });

    // Mouse/Touch Interaction for POI
    const updateMouse = (x, y) => {
        if (poiManager) {
            poiManager.mouse.x = (x / window.innerWidth) * 2 - 1;
            poiManager.mouse.y = -(y / window.innerHeight) * 2 + 1;
        }
    };
    window.addEventListener('mousemove', (e) => updateMouse(e.clientX, e.clientY));
    window.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) updateMouse(e.touches[0].clientX, e.touches[0].clientY);
    });

    renderer.setAnimationLoop(animate);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

let lastTime = 0;
function animate(time) {
    const delta = Math.min(time - lastTime, 100);
    lastTime = time;

    if (!renderer.xr.isPresenting) {
        // Sync OrbitControls to camera instead of cameraGroup during 2D
        controls.update();
        
        // Synchronize cameraTransform state WITH OrbitControls
        const pos = camera.position;
        const r = pos.length();
        if (r > 0) {
            cameraTransform.cameraDistance = r;
            cameraTransform.cameraPhi = Math.asin(pos.y / r);
            cameraTransform.cameraTheta = Math.atan2(pos.x, pos.z);
        }
    } else {
        // In VR, apply transformation to cameraGroup
        cameraTransform.update(cameraGroup);
    }

    updateGamepad(earthHUD, moonHUD);

    animateFrame(
        delta, scene, camera, renderer, 
        [earthHUD, moonHUD], poiManager, trafficManager,
        updateVRMenuCanvas, 
        () => updateVRControllers(renderer, scene, camera)
    );

    if (vrHelp) vrHelp.update();

    renderer.render(scene, camera);
}

// Ensure DOM is ready
if (document.readyState === 'complete') {
    init();
} else {
    window.addEventListener('load', init);
}
