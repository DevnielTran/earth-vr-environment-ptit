var vrMenuGroup = null;
var vrMenuCanvas = null;
var vrMenuContext = null;
var vrMenuTexture = null;

var menuState = {
  timeScale: 5000,
  isMenuVisible: false,
  lastButtonPress: 0,
};

function initVRMenu() {
  vrMenuGroup = new THREE.Group();

  // Create 3D Plane for Menu
  vrMenuCanvas = document.createElement("canvas");
  vrMenuCanvas.width = 512;
  vrMenuCanvas.height = 256;
  vrMenuContext = vrMenuCanvas.getContext("2d");

  vrMenuTexture = new THREE.CanvasTexture(vrMenuCanvas);
  var menuMaterial = new THREE.MeshBasicMaterial({
    map: vrMenuTexture,
    transparent: true,
  });
  var menuGeometry = new THREE.PlaneGeometry(10, 5); // Size in 3D space
  var menuMesh = new THREE.Mesh(menuGeometry, menuMaterial);

  // Position menu in front of user
  menuMesh.position.set(0, 0, -15);
  vrMenuGroup.add(menuMesh);

  // Attach menu to pose camera (headset) so it moves with user
  poseCamera.add(vrMenuGroup);

  // Initially hidden
  vrMenuGroup.visible = false;
  menuState.isMenuVisible = false;

  updateVRMenuCanvas();
}

function updateVRMenuCanvas() {
  vrMenuContext.clearRect(0, 0, 512, 256);
  vrMenuContext.fillStyle = "rgba(0, 0, 0, 0.7)";
  vrMenuContext.fillRect(0, 0, 512, 256);

  vrMenuContext.fillStyle = "#ffffff";
  vrMenuContext.font = "30px Arial";
  vrMenuContext.textAlign = "center";
  vrMenuContext.fillText("VR Settings Menu", 256, 50);

  vrMenuContext.font = "24px Arial";
  vrMenuContext.textAlign = "left";
  vrMenuContext.fillText("A/X: Reset | B/Y + ThumbClick: Giant Meteor", 30, 90);

  vrMenuContext.fillText(
    "Time Speed: " + timeScale + "x (Use Thumbstick)",
    30,
    130,
  );

  vrMenuContext.fillStyle = "#00ff00";
  vrMenuContext.fillText("Vietnam Time (UTC+7):", 30, 180);
  vrMenuContext.font = "32px Courier New";
  vrMenuContext.fillText(formatVietnamTime(), 30, 220);

  vrMenuTexture.needsUpdate = true;
}

function updateVRControllers() {
  var gamepads = navigator.getGamepads && navigator.getGamepads();
  if (!gamepads) return;

  var now = performance.now();
  var debounceTime = 300; // 300ms debounce for buttons

  for (var i = 0; i < gamepads.length; i++) {
    var gp = gamepads[i];
    if (!gp) continue;

    // Toggle Menu visibility (Trigger or Button B/Y depending on gamepad API index, usually button 1 or 5)
    if (gp.buttons[5] && gp.buttons[5].pressed) {
      if (now - menuState.lastButtonPress > debounceTime) {
        menuState.isMenuVisible = !menuState.isMenuVisible;
        vrMenuGroup.visible = menuState.isMenuVisible;
        menuState.lastButtonPress = now;
      }
    }

    // Only process changes if menu is visible
    if (menuState.isMenuVisible) {
      // Reset Earth (Button A/X, usually button 0 or 4)
      if (
        (gp.buttons[0] && gp.buttons[0].pressed) ||
        (gp.buttons[4] && gp.buttons[4].pressed)
      ) {
        if (now - menuState.lastButtonPress > debounceTime) {
          if (typeof resetEarth === "function") resetEarth();
          updateVRMenuCanvas();
          menuState.lastButtonPress = now;
        }
      }

      // Toggle Doomsday: Thumbstick Click (Usually Button 3 or 2 depending on standard mapping)
      if (
        (gp.buttons[2] && gp.buttons[2].pressed) ||
        (gp.buttons[3] && gp.buttons[3].pressed)
      ) {
        if (now - menuState.lastButtonPress > 1000) {
          // 1 second cooldown
          if (typeof toggleDoomsday === "function") toggleDoomsday();
          updateVRMenuCanvas();
          menuState.lastButtonPress = now;
        }
      }
      // Change Speed (Thumbstick X/Y, usually axes[2]/[3] or axes[0]/[1])
      var xAxe = gp.axes && gp.axes.length >= 3 ? gp.axes[2] : gp.axes[0] || 0;
      if (xAxe > 0.5) {
        // Right
        if (now - menuState.lastButtonPress > 100) {
          // Faster repeat for stick
          timeScale += 500;
          if (timeScale > 20000) timeScale = 20000;
          if (document.getElementById("hudTimeSlider")) {
            document.getElementById("hudTimeSlider").value = timeScale;
            document.getElementById("hud-time-val").innerText = timeScale + "x";
          }
          updateVRMenuCanvas();
          menuState.lastButtonPress = now;
        }
      } else if (xAxe < -0.5) {
        // Left
        if (now - menuState.lastButtonPress > 100) {
          timeScale -= 500;
          if (timeScale < 0) timeScale = 0;
          if (document.getElementById("hudTimeSlider")) {
            document.getElementById("hudTimeSlider").value = timeScale;
            document.getElementById("hud-time-val").innerText = timeScale + "x";
          }
          updateVRMenuCanvas();
          menuState.lastButtonPress = now;
        }
      }

      // Launch Meteor Strike: Grip Button (Usually Button 1 or 2)
      if (gp.buttons[1] && gp.buttons[1].pressed) {
        if (now - menuState.lastButtonPress > 1000) {
          // 1 second cooldown
          if (typeof launchMeteor === "function") launchMeteor();
          menuState.lastButtonPress = now;
        }
      }
    }
  }
}
