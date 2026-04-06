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

  updateEarthRotation();
  updateSunLocation();
  updateMoonRotation();
  updateMoonLocation();

  if (vrDisplay) cameraTransform.update();
  if (vrDisplay) {
    vrDisplay.requestAnimationFrame(animate);
    controls.update();
    var cameraPosition = camera.position.clone();
    var cameraQuaterion = camera.quaternion.clone();
    var rotatedPosition = poseCamera.position.applyQuaternion(
      camera.quaternion,
    );
    camera.position.add(rotatedPosition);
    camera.quaternion.multiply(poseCamera.quaternion);
    effect.render(scene, camera);
    camera.position.copy(cameraPosition);
    camera.quaternion.copy(cameraQuaterion);
  } else {
    requestAnimationFrame(animate);
    controls.update();
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
  earthObject.add(new THREE.Mesh(bodySphereGeometry, bodySphereMaterial));

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
  earthObject.add(new THREE.Mesh(nightSphereGeometry, nightSphereMaterial));

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
  earthObject.add(new THREE.Mesh(cloudGeometry, cloudMaterial));

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
  earthObject.add(new THREE.Mesh(atmosphereGeometry, atmosphereMaterial));

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
