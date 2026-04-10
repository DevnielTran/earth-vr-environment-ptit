// ── aurora time uniform (updated each frame) ──────────────────────────────────
var auroraUniforms = null;
var auroraElapsed = 0.0;

function initSkybox() {
  // ── Milky Way sphere (8k texture) ──────────────────────────────────────────
  var mwTexture = textureLoader.load("res/skybox/8k_stars_milky_way.jpg");
  mwTexture.wrapS = THREE.RepeatWrapping;
  mwTexture.wrapT = THREE.RepeatWrapping;

  var mwGeometry = new THREE.SphereGeometry(4800, 64, 64);
  var mwMaterial = new THREE.MeshBasicMaterial({
    map: mwTexture,
    side: THREE.BackSide,
  });
  var milkyWay = new THREE.Mesh(mwGeometry, mwMaterial);
  milkyWay.rotateY(0.2);
  milkyWay.rotateZ(0.9);
  scene.add(milkyWay);

  // ── Procedural star overlay (sparse bright stars on top) ──────────────────
  var starfield = createStarfield();
  scene.add(starfield);
}

function initLight() {
  // Add light
  sunLight = new THREE.PointLight(0xffffff, 1.2);
  var textureLoader = new THREE.TextureLoader();

  var textureFlare0 = textureLoader.load("res/effects/flare.jpg");
  var textureFlare1 = textureLoader.load("res/effects/halo.png");

  var lensflare = new THREE.Lensflare();
  lensflare.addElement(
    new THREE.LensflareElement(textureFlare0, 400, 0, sunLight.color),
  );
  lensflare.addElement(new THREE.LensflareElement(textureFlare1, 100, 0.6));
  lensflare.addElement(new THREE.LensflareElement(textureFlare1, 30, 0.7));
  lensflare.addElement(new THREE.LensflareElement(textureFlare1, 240, 0.9));
  lensflare.addElement(new THREE.LensflareElement(textureFlare1, 70, 1));
  sunLight.add(lensflare);
  scene.add(sunLight);

  // Mouse for POI interaction
  window.addEventListener(
    "mousemove",
    function (event) {
      if (poiManager) {
        poiManager.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        poiManager.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      }
    },
    false,
  );
}

// ===== DOOMSDAY FEATURES =====
var isDoomsday = false;
var doomsdayMeteorGroup = null;
var doomsdayActive = false;
var earthShattered = false;
var doomsdayFlash = null;
var earthDebris = null;
var earthChunks = [];
var planetShockwave = null;

function createTailTexture() {
  var canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 256;
  var ctx = canvas.getContext("2d");
  // Top of canvas (y=0) maps to v=1 (Tip of cone), Bottom (y=256) maps to v=0 (Base of cone)
  var grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "rgba(0, 0, 0, 0.0)"); // Tip (tail end, transparent)
  grad.addColorStop(0.3, "rgba(200, 50, 0, 0.1)"); // Dim red
  grad.addColorStop(0.7, "rgba(255, 100, 0, 0.5)"); // Bright orange
  grad.addColorStop(0.9, "rgba(255, 200, 100, 0.8)"); // Yellow
  grad.addColorStop(1, "rgba(255, 255, 255, 1.0)"); // Base (hot white)
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 256);

  var tex = new THREE.CanvasTexture(canvas);
  return tex;
}
var sharedTailTexture = null;

function shatterEarth() {
  if (typeof earthObject !== "undefined") {
    earthObject.visible = false; // Hide earth instantly
  }
  earthShattered = true;

  // 1. Create a massive blinding flash
  if (!doomsdayFlash) {
    var flashGeo = new THREE.SphereGeometry(6.5, 32, 32);
    var flashMat = new THREE.MeshBasicMaterial({
      color: 0xffddaa,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
    });
    doomsdayFlash = new THREE.Mesh(flashGeo, flashMat);
    scene.add(doomsdayFlash);
  }
  doomsdayFlash.scale.set(1, 1, 1);
  doomsdayFlash.material.opacity = 1.0;
  doomsdayFlash.visible = true;

  // 2. Create the planet shockwave ring (horizontal)
  if (!planetShockwave) {
    var ringGeo = new THREE.RingGeometry(6.0, 7.0, 64);
    var ringMat = new THREE.MeshBasicMaterial({
      color: 0xff8822,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    planetShockwave = new THREE.Mesh(ringGeo, ringMat);
    // Face the camera or roughly equatorial
    planetShockwave.rotation.x = Math.PI / 2;
    scene.add(planetShockwave);
  }
  planetShockwave.scale.set(1, 1, 1);
  planetShockwave.material.opacity = 0.9;
  planetShockwave.visible = true;

  // 3. Create actual 3D chunks of crust/magma
  var impactNorm = doomsdayMeteorGroup
    ? doomsdayMeteorGroup.position.clone().normalize()
    : new THREE.Vector3(0, 1, 0);
  if (earthChunks.length === 0) {
    var chunkGeo = new THREE.IcosahedronGeometry(0.5, 0); // Rough, low-poly rocks
    var colors = [
      0x555555, 0xff3300, 0x113355, 0x332211, 0xffaa00, 0x222222, 0x004400,
    ]; // Multi-biome fragment colors

    for (var i = 0; i < 200; i++) {
      var cMat = new THREE.MeshLambertMaterial({
        color: colors[Math.floor(Math.random() * colors.length)],
        transparent: true,
        opacity: 1.0,
      });
      var chunk = new THREE.Mesh(chunkGeo, cMat);
      // Give custom properties
      chunk.velocity = new THREE.Vector3();
      chunk.rotVelocity = new THREE.Vector3();
      earthChunks.push(chunk);
      scene.add(chunk);
    }
  }

  for (var i = 0; i < earthChunks.length; i++) {
    var chunk = earthChunks[i];
    var randomPos = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5,
    ).normalize();
    chunk.position.copy(randomPos).multiplyScalar(Math.random() * 6.3); // place on or inside sphere

    // Scale chunks varying from small pieces to giant fragments
    var sc = Math.random() * 2.2 + 0.5;
    chunk.scale.set(sc, sc, sc);

    // Velocity: mainly outwards, pushed away from the meteor
    var outwardVelocity = randomPos
      .clone()
      .addScaledVector(impactNorm, -0.3)
      .normalize();
    chunk.velocity.copy(
      outwardVelocity.multiplyScalar(Math.random() * 0.15 + 0.05),
    );
    // Random spin axis/speed
    chunk.rotVelocity
      .set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
      .multiplyScalar(0.1);

    chunk.material.opacity = 1.0;
    chunk.visible = true;
  }

  // 4. Create fine particle debris (dust/magma mist)
  if (!earthDebris) {
    var debrisGeo = new THREE.Geometry();
    for (var i = 0; i < 5000; i++) {
      var p = new THREE.Vector3();
      debrisGeo.vertices.push(p);
    }
    var debrisMat = new THREE.PointsMaterial({
      color: 0xff6611,
      size: 0.2,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    earthDebris = new THREE.Points(debrisGeo, debrisMat);
    scene.add(earthDebris);
  }

  for (var i = 0; i < earthDebris.geometry.vertices.length; i++) {
    var p = earthDebris.geometry.vertices[i];
    p.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
      .normalize()
      .multiplyScalar(Math.random() * 6.3);
    var away = p.clone().normalize();
    // Fine dust flies a bit slower and radially
    p.velocity = away.multiplyScalar(Math.random() * 0.12 + 0.02);
  }
  earthDebris.geometry.verticesNeedUpdate = true;
  earthDebris.material.opacity = 0.8;
  earthDebris.visible = true;
}

function toggleDoomsday() {
  // Always reset before starting again
  resetEarth();
  isDoomsday = !isDoomsday;

  if (isDoomsday && !doomsdayActive) {
    if (!doomsdayMeteorGroup) {
      doomsdayMeteorGroup = new THREE.Group();

      // Massive rock
      var rockGeo = new THREE.SphereGeometry(2.5, 32, 32);
      var rockMat = new THREE.MeshPhongMaterial({
        shininess: 5,
        bumpScale: 0.2,
      });
      rockMat.map = textureLoader.load("res/moon/moon-map.jpg");
      rockMat.bumpMap = textureLoader.load("res/moon/bump.jpg");
      var rock = new THREE.Mesh(rockGeo, rockMat);

      doomsdayMeteorGroup.add(rock);
      scene.add(doomsdayMeteorGroup);
    }

    // Spawn far away
    var spawn = new THREE.Vector3(
      (Math.random() - 0.5) * 100,
      (Math.random() - 0.5) * 100,
      (Math.random() - 0.5) * 100,
    );
    spawn.setLength(60);

    doomsdayMeteorGroup.position.copy(spawn);
    doomsdayMeteorGroup.lookAt(0, 0, 0);
    doomsdayMeteorGroup.visible = true;
    doomsdayActive = true;
  }
}

function updateDoomsday(delta) {
  if (doomsdayActive && doomsdayMeteorGroup) {
    var dir = new THREE.Vector3()
      .copy(doomsdayMeteorGroup.position)
      .normalize()
      .multiplyScalar(-1);
    var speed = 0.01; // Travel speed for giant meteor (Slower, heavy feel)
    doomsdayMeteorGroup.position.addScaledVector(dir, speed * delta);

    if (doomsdayMeteorGroup.position.length() <= 6.3781) {
      doomsdayActive = false;
      doomsdayMeteorGroup.visible = false;
      shatterEarth();
    }
  }

  if (earthShattered) {
    if (doomsdayFlash && doomsdayFlash.visible) {
      doomsdayFlash.scale.addScalar(0.012 * delta);
      doomsdayFlash.material.opacity -= 0.0015 * delta; // Faster flash fade
      if (doomsdayFlash.material.opacity <= 0) doomsdayFlash.visible = false;
    }

    if (planetShockwave && planetShockwave.visible) {
      planetShockwave.scale.addScalar(0.08 * delta); // Expand ring very fast
      planetShockwave.material.opacity -= 0.001 * delta;
      if (planetShockwave.material.opacity <= 0)
        planetShockwave.visible = false;
    }

    // Update the large geological fragments
    if (earthChunks && earthChunks.length > 0) {
      for (var i = 0; i < earthChunks.length; i++) {
        var chunk = earthChunks[i];
        if (chunk.visible) {
          chunk.position.addScaledVector(chunk.velocity, delta);
          chunk.rotation.x += chunk.rotVelocity.x * delta;
          chunk.rotation.y += chunk.rotVelocity.y * delta;
          chunk.rotation.z += chunk.rotVelocity.z * delta;

          chunk.material.opacity -= 0.0001 * delta; // Slow fade for chunks
          if (chunk.material.opacity <= 0) chunk.visible = false;
        }
      }
    }

    // Update the magma/dust mist
    if (earthDebris && earthDebris.visible) {
      var verts = earthDebris.geometry.vertices;
      for (var i = 0; i < verts.length; i++) {
        verts[i].addScaledVector(verts[i].velocity, delta);
      }
      earthDebris.geometry.verticesNeedUpdate = true;
      // Slowly cool down the small debris mist
      earthDebris.material.opacity -= 0.00015 * delta;
      if (earthDebris.material.opacity <= 0) earthDebris.visible = false;
    }
  }
}

// ===== METEOR FEATURES =====
var meteorGroup = null;
var meteorActive = false;
var earthCraters = [];
var impactRingGroup = null;
var impactActive = false;

function resetEarth() {
  if (typeof earthObject !== "undefined") {
    earthObject.visible = true; // Restore earth
    if (earthCraters.length > 0) {
      for (var i = 0; i < earthCraters.length; i++) {
        earthObject.remove(earthCraters[i]);
        if (earthCraters[i].material.map)
          earthCraters[i].material.map.dispose();
        earthCraters[i].material.dispose();
        earthCraters[i].geometry.dispose();
      }
      earthCraters = [];
    }

    // Reset Doomsday variables
    isDoomsday = false;
    doomsdayActive = false;
    earthShattered = false;

    if (doomsdayMeteorGroup) doomsdayMeteorGroup.visible = false;
    if (earthDebris) earthDebris.visible = false;
    if (doomsdayFlash) doomsdayFlash.visible = false;
    if (planetShockwave) planetShockwave.visible = false;

    if (earthChunks && earthChunks.length > 0) {
      for (var i = 0; i < earthChunks.length; i++) {
        earthChunks[i].visible = false;
      }
    }
  }
}

function createMushroomCloudTexture() {
  var canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 1024;
  var ctx = canvas.getContext("2d");

  // Stalk (column of smoke/fire)
  var stalkGrad = ctx.createLinearGradient(0, 400, 0, 1024);
  stalkGrad.addColorStop(0, "rgba(50, 40, 40, 0.9)"); // Dark smoke top of stalk
  stalkGrad.addColorStop(0.7, "rgba(255, 100, 0, 0.9)"); // Fire middle
  stalkGrad.addColorStop(1, "rgba(255, 255, 200, 1)"); // Bright base

  ctx.fillStyle = stalkGrad;
  ctx.beginPath();
  ctx.moveTo(256 - 40, 1024);
  ctx.quadraticCurveTo(256 - 80, 600, 256 - 100, 350);
  ctx.lineTo(256 + 100, 350);
  ctx.quadraticCurveTo(256 + 80, 600, 256 + 40, 1024);
  ctx.fill();

  // Mushroom cap (giant dome of smoke and fire)
  var capGrad = ctx.createRadialGradient(256, 300, 20, 256, 300, 250);
  capGrad.addColorStop(0, "rgba(255, 255, 255, 1)");
  capGrad.addColorStop(0.2, "rgba(255, 180, 20, 0.9)");
  capGrad.addColorStop(0.6, "rgba(60, 20, 10, 0.8)");
  capGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = capGrad;
  ctx.beginPath();
  ctx.arc(256, 300, 250, 0, Math.PI * 2);
  ctx.fill();

  // Add some noisy puffy clouds to the cap
  for (var i = 0; i < 15; i++) {
    var cx = 256 + (Math.random() - 0.5) * 300;
    var cy = 300 + (Math.random() - 0.5) * 150;
    var cr = 50 + Math.random() * 80;
    var puffGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
    puffGrad.addColorStop(
      0,
      Math.random() > 0.5 ? "rgba(255,100,0,0.6)" : "rgba(50,50,50,0.8)",
    );
    puffGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = puffGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fill();
  }

  return new THREE.CanvasTexture(canvas);
}

function createCrater(impactPos) {
  // Generate a procedural crater/crack texture using Canvas API
  var cCanvas = document.createElement("canvas");
  cCanvas.width = 256;
  cCanvas.height = 256;
  var cCtx = cCanvas.getContext("2d");

  // Base dark burn ring
  var grad = cCtx.createRadialGradient(128, 128, 10, 128, 128, 120);
  grad.addColorStop(0, "rgba(0, 0, 0, 0.9)");
  grad.addColorStop(0.2, "rgba(50, 10, 0, 0.8)");
  grad.addColorStop(0.5, "rgba(10, 5, 0, 0.6)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");
  cCtx.fillStyle = grad;
  cCtx.fillRect(0, 0, 256, 256);

  // Glowing lava cracks radiating from center
  cCtx.strokeStyle = "rgba(255, 60, 0, 0.8)";
  cCtx.lineWidth = 3;
  for (var i = 0; i < 8; i++) {
    cCtx.beginPath();
    cCtx.moveTo(128, 128);
    var length = 40 + Math.random() * 60;
    var angle = Math.random() * Math.PI * 2;
    var endX = 128 + Math.cos(angle) * length;
    var endY = 128 + Math.sin(angle) * length;

    // Draw crack with some jaggedness
    cCtx.lineTo(
      128 + (endX - 128) * 0.5 + (Math.random() - 0.5) * 20,
      128 + (endY - 128) * 0.5 + (Math.random() - 0.5) * 20,
    );
    cCtx.lineTo(endX, endY);
    cCtx.stroke();
  }

  var craterTex = new THREE.CanvasTexture(cCanvas);
  var craterMat = new THREE.MeshBasicMaterial({
    map: craterTex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // Crater mesh
  var craterMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), craterMat);

  if (typeof earthObject !== "undefined") {
    // Convert world impact position to earth's local space so it sticks and rotates with Earth
    var localPos = earthObject.worldToLocal(impactPos.clone());
    localPos.normalize().multiplyScalar(6.3781 + 0.015); // Place directly on crust
    craterMesh.position.copy(localPos);
    // Orient the 2D crater plane outwards
    craterMesh.lookAt(localPos.clone().multiplyScalar(2));
    earthObject.add(craterMesh);
    earthCraters.push(craterMesh);
  }
}

function launchMeteor() {
  if (!meteorGroup) {
    meteorGroup = new THREE.Group();

    // Meteor rock (Realistic texture using moon map as asteroid surface)
    var rockGeo = new THREE.SphereGeometry(0.2, 32, 32);
    var rockMat = new THREE.MeshPhongMaterial({ shininess: 5, bumpScale: 0.1 });
    rockMat.map = textureLoader.load("res/moon/moon-map.jpg");
    rockMat.bumpMap = textureLoader.load("res/moon/bump.jpg");
    var rock = new THREE.Mesh(rockGeo, rockMat);

    meteorGroup.add(rock);
    scene.add(meteorGroup);

    // Create Immersive Surface Contact Effect
    impactRingGroup = new THREE.Group();

    // Shockwave Ring
    var ringGeo = new THREE.RingGeometry(0.1, 1.2, 64);
    var ringMat = new THREE.MeshBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    var ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.name = "shockwave";
    impactRingGroup.add(ringMesh);

    // Bright flash at contact point
    var flashCanvas = document.createElement("canvas");
    flashCanvas.width = 128;
    flashCanvas.height = 128;
    var fCtx = flashCanvas.getContext("2d");
    var grad = fCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.3, "rgba(255,150,50,0.8)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    fCtx.fillStyle = grad;
    fCtx.fillRect(0, 0, 128, 128);
    var flashMat = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(flashCanvas),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    var flashPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.5),
      flashMat,
    );
    flashPlane.name = "flash";
    impactRingGroup.add(flashPlane);

    impactRingGroup.visible = false;
    scene.add(impactRingGroup);
  }

  // Spawn random location in space towards earth
  var spawn = new THREE.Vector3(
    (Math.random() - 0.5) * 50,
    (Math.random() - 0.5) * 50,
    (Math.random() - 0.5) * 50,
  );
  spawn.setLength(25);

  meteorGroup.position.copy(spawn);
  meteorGroup.lookAt(0, 0, 0); // Always aim directly at Earth
  meteorGroup.visible = true;
  meteorActive = true;
}

function updateMeteor(delta) {
  if (meteorActive && meteorGroup) {
    var dir = new THREE.Vector3()
      .copy(meteorGroup.position)
      .normalize()
      .multiplyScalar(-1);
    var speed = 0.007; // Travel speed (slower for dramatic trailing effect)
    meteorGroup.position.addScaledVector(dir, speed * delta);

    // Collision Check with Earth's Crust
    if (meteorGroup.position.length() <= 6.3781 + 0.1) {
      meteorActive = false;
      meteorGroup.visible = false;

      // Trigger Surface Contact Effect
      if (impactRingGroup) {
        impactRingGroup.position.copy(meteorGroup.position);
        impactRingGroup.lookAt(0, 0, 0); // Flat tangent against the earth's surface

        var shockwave = impactRingGroup.getObjectByName("shockwave");
        shockwave.scale.set(1, 1, 1);
        shockwave.material.opacity = 1.0;

        var flash = impactRingGroup.getObjectByName("flash");
        flash.scale.set(1, 1, 1);
        flash.material.opacity = 1.0;

        impactRingGroup.visible = true;
        impactActive = true;
      }

      // Spawn ground crater/crack
      createCrater(meteorGroup.position);
    }
  }

  // Animate Surface Contact Effect
  if (impactActive && impactRingGroup && impactRingGroup.visible) {
    var shockwave = impactRingGroup.getObjectByName("shockwave");
    var flash = impactRingGroup.getObjectByName("flash");

    shockwave.scale.addScalar(0.03 * delta); // Rapidly expand
    shockwave.material.opacity -= 0.0025 * delta; // Fade out

    flash.scale.addScalar(0.01 * delta);
    flash.material.opacity -= 0.005 * delta; // Flash fades fast

    if (shockwave.material.opacity <= 0) {
      impactActive = false;
      impactRingGroup.visible = false;
    }
  }
}

// ============================================

var lastRender = 0;
function animate(timestamp) {
  var delta = Math.min(timestamp - lastRender, 500);
  lastRender = timestamp;
  auroraElapsed += delta * 0.001; // seconds

  if (poiManager) {
    poiManager.update(camera, poiManager.mouse);
    poiManager.animatePanel(camera);
  }

  if (!poiManager || !poiManager.hoveredPOI) {
    updateTime(delta);
  }

  // Update aurora time uniform
  if (auroraUniforms) {
    auroraUniforms.time.value = auroraElapsed;
    auroraUniforms.sunPosition.value.copy(sunLight.position);
  }

  updateEarthRotation(delta);
  if (typeof updateMeteor === "function") updateMeteor(delta);
  if (typeof updateDoomsday === "function") updateDoomsday(delta);

  updateSunLocation();
  updateMoonRotation();
  updateMoonLocation();

  if (earthHUD) earthHUD.update();
  if (typeof menuState !== "undefined" && menuState.isMenuVisible && typeof updateVRMenuCanvas === "function") {
    updateVRMenuCanvas();
  }

  if (typeof updateVRControllers === "function") {
    updateVRControllers();
  }

  if (vrDisplay) cameraTransform.update();
  if (vrDisplay) {
    vrDisplay.requestAnimationFrame(animate);
    if (controls) controls.update();
    var cameraPosition = camera.position.clone();
    var cameraQuaterion = camera.quaternion.clone();
    // IMPORTANT: clone poseCamera.position to avoid corrupting it in-place
    var rotatedPosition = poseCamera.position.clone().applyQuaternion(
      camera.quaternion,
    );
    camera.position.add(rotatedPosition);
    camera.quaternion.multiply(poseCamera.quaternion);
    effect.render(scene, camera);
    camera.position.copy(cameraPosition);
    camera.quaternion.copy(cameraQuaterion);
  } else {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    effect.render(scene, camera);
  }
}

var earthObject;
var moonObject;

function initSceneObjects() {
  var earthRadius = 6.3781;
  earthObject = new THREE.Group();

  // ── 1. Day surface (Phong with bump + specular) ────────────────────────────
  var bodySphereGeometry = new THREE.SphereGeometry(earthRadius, 128, 128);
  var bodySphereMaterial = new THREE.MeshPhongMaterial({
    color: new THREE.Color(0xffffff),
    specular: new THREE.Color(0x3a3520),
    shininess: 40,
    bumpScale: 0.08,
  });
  bodySphereMaterial.map = textureLoader.load("res/earth/day-map.jpg");
  bodySphereMaterial.specularMap = textureLoader.load("res/earth/spec.jpg");
  bodySphereMaterial.bumpMap = textureLoader.load("res/earth/bump.jpg");
  var bodySphereMesh = new THREE.Mesh(bodySphereGeometry, bodySphereMaterial);
  bodySphereMesh.name = "EarthBody";
  earthObject.add(bodySphereMesh);

  // ── 2. Night layer (realistic terminator) ─────────────────────────────────
  var nightSphereGeometry = new THREE.SphereGeometry(
    earthRadius + 0.01,
    128,
    128,
  );
  var nightSphereMaterial = new THREE.ShaderMaterial({
    uniforms: {
      sunPosition: { value: sunLight.position },
      nightTexture: { value: textureLoader.load("res/earth/night-map.jpg") },
    },
    vertexShader: generalVS,
    fragmentShader: nightFS,
    transparent: true,
    depthWrite: false,
    renderOrder: 1,
    blendEquation: THREE.AddEquation,
  });
  var nightSphereMesh = new THREE.Mesh(
    nightSphereGeometry,
    nightSphereMaterial,
  );
  nightSphereMesh.name = "NightLayer";
  earthObject.add(nightSphereMesh);

  // ── 3. Cloud layer with depth/shadow ──────────────────────────────────────
  var cloudGeometry = new THREE.SphereGeometry(earthRadius + 0.05, 64, 64);
  var cloudUniforms = {
    cloudTexture: { value: textureLoader.load("res/earth/clouds.png") },
    nightTexture: { value: textureLoader.load("res/earth/night-map.jpg") },
    sunPosition: { value: sunLight.position },
  };
  var cloudMaterial = new THREE.ShaderMaterial({
    uniforms: cloudUniforms,
    vertexShader: cloudVS,
    fragmentShader: cloudFS,
    transparent: true,
    depthWrite: false,
    renderOrder: 3,
    blendEquation: THREE.AddEquation,
  });
  var cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
  cloudMesh.name = "CloudLayer";
  earthObject.add(cloudMesh);

  // ── 4. Atmosphere (Rayleigh-like + terminator glow) ───────────────────────
  var atmosphereGeometry = new THREE.SphereGeometry(
    earthRadius + 0.12,
    128,
    128,
  );
  var atmosphereMaterial = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.lights,
      {
        atmosphereColor: { value: new THREE.Vector3(0.35, 0.6, 1.0) },
        sunsetColor: { value: new THREE.Vector3(0.9, 0.55, 0.25) },
        atmosphereStrength: { value: 1.8 },
        sunsetStrength: { value: 1.2 },
      },
    ]),
    vertexShader: atmosphereVS,
    fragmentShader: atmosphereFS,
    transparent: true,
    depthWrite: false,
    renderOrder: 2,
    blendEquation: THREE.AddEquation,
    lights: true,
  });
  var atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
  atmosphereMesh.name = "AtmosphereLayer";
  earthObject.add(atmosphereMesh);

  // ── 5. Aurora layer (poles, night-side) ───────────────────────────────────
  var auroraGeometry = new THREE.SphereGeometry(earthRadius + 0.22, 128, 128);
  auroraUniforms = {
    time: { value: 0.0 },
    sunPosition: { value: sunLight.position.clone() },
  };
  var auroraMaterial = new THREE.ShaderMaterial({
    uniforms: auroraUniforms,
    vertexShader: auroraVS,
    fragmentShader: auroraFS,
    transparent: true,
    depthWrite: false,
    renderOrder: 4,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
  });
  earthObject.add(new THREE.Mesh(auroraGeometry, auroraMaterial));

  earthObject.position.set(0, 0, 0);
  scene.add(earthObject);

  // ── Moon ──────────────────────────────────────────────────────────────────
  var moonRadius = 1.7371 * 1.2;
  var moonGeometry = new THREE.SphereGeometry(moonRadius, 64, 64);
  var moonMaterial = new THREE.MeshPhongMaterial({
    color: new THREE.Color(0xffffff),
    specular: new THREE.Color(0x050505),
    shininess: 8,
    bumpScale: 0.06,
  });
  moonMaterial.map = textureLoader.load("res/moon/moon-map.jpg");
  moonMaterial.bumpMap = textureLoader.load("res/moon/bump.jpg");
  moonObject = new THREE.Mesh(moonGeometry, moonMaterial);
  scene.add(moonObject);
}
