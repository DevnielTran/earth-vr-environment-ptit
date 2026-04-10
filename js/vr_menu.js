import * as THREE from 'three';
import { formatVietnamTime, setTimeScale, timeScale } from './time.js';
import { resetEarth, launchMeteor, toggleDoomsday } from './render.js';
import { cameraTransform } from './transform.js';

export var vrMenuGroup = null;
var vrMenuCanvas = null;
var vrMenuContext = null;
var vrMenuTexture = null;

export var menuState = {
  timeScale: 5000,
  isMenuVisible: false,
  lastButtonPress: 0,
};

export function initVRMenu(scene, camera) {
  vrMenuGroup = new THREE.Group();

  vrMenuCanvas = document.createElement("canvas");
  vrMenuCanvas.width = 512;
  vrMenuCanvas.height = 256;
  vrMenuContext = vrMenuCanvas.getContext("2d");

  vrMenuTexture = new THREE.CanvasTexture(vrMenuCanvas);
  var menuMaterial = new THREE.MeshBasicMaterial({
    map: vrMenuTexture,
    transparent: true,
  });
  var menuGeometry = new THREE.PlaneGeometry(10, 5); 
  var menuMesh = new THREE.Mesh(menuGeometry, menuMaterial);

  // Position menu in front
  menuMesh.position.set(0, 0, -15);
  vrMenuGroup.add(menuMesh);

  // Instead of poseCamera, we will just add it to the scene 
  // and update its position/rotation to stay in front of the camera when opened
  scene.add(vrMenuGroup);

  vrMenuGroup.visible = false;
  menuState.isMenuVisible = false;

  updateVRMenuCanvas();
}

export function updateVRMenuCanvas() {
  if (!vrMenuContext) return;
  vrMenuContext.clearRect(0, 0, 512, 256);
  vrMenuContext.fillStyle = "rgba(0, 0, 0, 0.75)";
  vrMenuContext.fillRect(0, 0, 512, 256);

  vrMenuContext.fillStyle = "#00ffff";
  vrMenuContext.font = "bold 34px Arial";
  vrMenuContext.textAlign = "center";
  vrMenuContext.fillText("VR SETTINGS MENU", 256, 50);

  vrMenuContext.fillStyle = "#ffffff";
  vrMenuContext.font = "20px Arial";
  vrMenuContext.textAlign = "left";
  vrMenuContext.fillText("A/X: Reset Earth", 30, 95);
  vrMenuContext.fillText("B/Y: Toggle Menu", 30, 125);
  vrMenuContext.fillText("Grip: Launch Meteor", 30, 155);
  vrMenuContext.fillText("Stick Click: Doomsday", 30, 185);
  vrMenuContext.fillText("L-Stick: Orbit | R-Stick: Zoom", 30, 215);

  vrMenuContext.fillStyle = "#ffaa00";
  vrMenuContext.fillText(
    "Time: " + Math.round(timeScale) + "x (Stick L/R)",
    30,
    225,
  );

  vrMenuContext.fillStyle = "#00ff00";
  vrMenuContext.font = "bold 24px Courier New";
  vrMenuContext.textAlign = "right";
  vrMenuContext.fillText(formatVietnamTime().split(' ')[0], 480, 225);

  vrMenuTexture.needsUpdate = true;
}

export function updateVRControllers(renderer, scene, camera) {
  const session = renderer.xr.getSession();
  if (!session) return;

  const inputSources = session.inputSources;
  const now = performance.now();
  const debounceTime = 300; 

  inputSources.forEach((source) => {
    const gamepad = source.gamepad;
    if (!gamepad) return;

    // --- Global Actions (Outside Menu) ---
    
    // Toggle Menu (Button 5: B/Y)
    if (gamepad.buttons[5] && gamepad.buttons[5].pressed) {
      if (now - menuState.lastButtonPress > debounceTime) {
        menuState.isMenuVisible = !menuState.isMenuVisible;
        vrMenuGroup.visible = menuState.isMenuVisible;
        if (menuState.isMenuVisible) {
            const camWorldPos = new THREE.Vector3();
            const camWorldDir = new THREE.Vector3();
            camera.getWorldPosition(camWorldPos);
            camera.getWorldDirection(camWorldDir);
            const pos = camWorldPos.clone().add(camWorldDir.multiplyScalar(10));
            vrMenuGroup.position.copy(pos);
            vrMenuGroup.lookAt(camWorldPos);
        }
        menuState.lastButtonPress = now;
      }
    }

    // Reset (Button 4: A/X)
    if (gamepad.buttons[4] && gamepad.buttons[4].pressed) {
        if (now - menuState.lastButtonPress > debounceTime) {
            resetEarth();
            updateVRMenuCanvas();
            menuState.lastButtonPress = now;
        }
    }

    // Doomsday (Button 3: Stick Click)
    if (gamepad.buttons[3] && gamepad.buttons[3].pressed) {
        if (now - menuState.lastButtonPress > 1000) {
            toggleDoomsday(scene);
            updateVRMenuCanvas();
            menuState.lastButtonPress = now;
        }
    }

    // Meteor (Button 1: Grip)
    if (gamepad.buttons[1] && gamepad.buttons[1].pressed) {
        if (now - menuState.lastButtonPress > 800) {
            launchMeteor(scene);
            menuState.lastButtonPress = now;
        }
    }

    // --- Movement & Scaling (Sticks) ---
    
    // Left Controller (Index 0 typically) - Rotation
    if (source.handedness === 'left') {
        const stickX = gamepad.axes[2];
        const stickY = gamepad.axes[3];
        if (Math.abs(stickX) > 0.1) cameraTransform.moveTheta(stickX * 0.03);
        if (Math.abs(stickY) > 0.1) cameraTransform.movePhi(-stickY * 0.03);
    }

    // Right Controller (Index 1 typically) - Zoom & Time
    if (source.handedness === 'right') {
        const stickX = gamepad.axes[2];
        const stickY = gamepad.axes[3];
        
        // Horizontal: Time Scaling
        if (Math.abs(stickX) > 0.5) {
            if (now - menuState.lastButtonPress > 100) {
                let newScale = timeScale + (stickX > 0 ? 500 : -500);
                newScale = Math.max(0, Math.min(20000, newScale));
                setTimeScale(newScale);
                if (document.getElementById("hudTimeSlider")) {
                    document.getElementById("hudTimeSlider").value = newScale;
                    document.getElementById("hud-time-val").innerText = newScale + "x";
                }
                updateVRMenuCanvas();
                menuState.lastButtonPress = now;
            }
        }
        
        // Vertical: Zoom (Distance)
        if (Math.abs(stickY) > 0.1) {
            cameraTransform.moveDistance(stickY * 0.5);
        }
    }
  });
}
