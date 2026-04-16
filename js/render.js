import * as THREE from 'three';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';
import { 
  generalVS, nightFS, cloudVS, cloudFS, 
  atmosphereVS, atmosphereFS, auroraVS, auroraFS,
  bathymetryVS, bathymetryFS, trailVS, trailFS
} from './shader.js';
import { createStarfield } from './starfield.js';
import { updateTime, nowInYear, nowInDay, nowInLunarMonth } from './time.js';
import { 
  updateEarthRotation, updateSunLocation, updateMoonRotation, updateMoonLocation,
  cameraTransform
} from './transform.js';

// ── Globals (exported so other modules can access them) ─────────────────────
export var earthObject;
export var moonObject;
export var sunLight;
export var auroraUniforms = null;
export var auroraElapsed = 0.0;

// Internal states
let textureLoader = new THREE.TextureLoader();
let isDoomsday = false;
let doomsdayMeteorGroup = null;
let doomsdayActive = false;
let earthShattered = false;
let doomsdayFlash = null;
let earthChunks = [];
let planetShockwave = null;
let earthDebris = null;

let meteorGroup = null;
let meteorActive = false;
let earthCraters = [];
let impactRingGroup = null;
let impactActive = false;

let isDeepSeaMode = false;
let deepSeaTransition = 0.0;
let bathymetryMat = null;
let originalEarthMat = null;

let meteorTrail = null;
let doomsdayTrail = null;

function createTrailSystem(scene, count, size, color) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const life = new Float32Array(count); 
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('life', new THREE.BufferAttribute(life, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) } },
    vertexShader: trailVS, fragmentShader: trailFS,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  return { points, positions: pos, lifetimes: life, nextIdx: 0 };
}

function updateTrailSystem(system, headPos, delta, spawnRate, spread) {
  const pos = system.positions;
  const life = system.lifetimes;
  for (let i = 0; i < life.length; i++) {
    if (life[i] > 0) life[i] -= 0.0015 * delta;
  }
  if (headPos) {
    for (let i = 0; i < spawnRate; i++) {
      const idx = system.nextIdx;
      pos[idx*3] = headPos.x + (Math.random() - 0.5) * spread;
      pos[idx*3+1] = headPos.y + (Math.random() - 0.5) * spread;
      pos[idx*3+2] = headPos.z + (Math.random() - 0.5) * spread;
      life[idx] = 1.0;
      system.nextIdx = (system.nextIdx + 1) % life.length;
    }
  }
  system.points.geometry.attributes.position.needsUpdate = true;
  system.points.geometry.attributes.life.needsUpdate = true;
}

export function initSkybox(scene) {
  var mwTexture = textureLoader.load("res/skybox/8k_stars_milky_way.jpg");
  mwTexture.wrapS = THREE.RepeatWrapping;
  mwTexture.wrapT = THREE.RepeatWrapping;

  // Optimized segments: 64 -> 32
  var mwGeometry = new THREE.SphereGeometry(4800, 32, 32);
  var mwMaterial = new THREE.MeshBasicMaterial({
    map: mwTexture,
    side: THREE.BackSide,
  });
  var milkyWay = new THREE.Mesh(mwGeometry, mwMaterial);
  milkyWay.rotateY(0.2);
  milkyWay.rotateZ(0.9);
  scene.add(milkyWay);

  var starfield = createStarfield();
  scene.add(starfield);
}

export function initLight(scene) {
  // Ambient light so dark side of Earth is still visible
  var ambientLight = new THREE.AmbientLight(0x334466, 0.35);
  scene.add(ambientLight);

  sunLight = new THREE.PointLight(0xffffff, 1.5);
  sunLight.decay = 0; // Maintain brightness in distance

  var textureFlare0 = textureLoader.load("res/effects/flare.jpg");
  var textureFlare1 = textureLoader.load("res/effects/halo.png");

  var lensflare = new Lensflare();
  lensflare.addElement(new LensflareElement(textureFlare0, 400, 0, sunLight.color));
  lensflare.addElement(new LensflareElement(textureFlare1, 100, 0.6));
  lensflare.addElement(new LensflareElement(textureFlare1, 30, 0.7));
  lensflare.addElement(new LensflareElement(textureFlare1, 240, 0.9));
  lensflare.addElement(new LensflareElement(textureFlare1, 70, 1));
  sunLight.add(lensflare);
  scene.add(sunLight);
}

// ── Doomsday Logic ───────────────────────────────────────────────────────────

export function shatterEarth(scene) {
  if (earthObject) {
    earthObject.visible = false;
  }
  earthShattered = true;

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
    planetShockwave.rotation.x = Math.PI / 2;
    scene.add(planetShockwave);
  }
  planetShockwave.scale.set(1, 1, 1);
  planetShockwave.material.opacity = 0.9;
  planetShockwave.visible = true;

  var impactNorm = doomsdayMeteorGroup
    ? doomsdayMeteorGroup.position.clone().normalize()
    : new THREE.Vector3(0, 1, 0);

  if (earthChunks.length === 0) {
    var chunkGeo = new THREE.IcosahedronGeometry(0.5, 0);
    var colors = [0x555555, 0xff3300, 0x113355, 0x332211, 0xffaa00, 0x222222, 0x004400];

    // Reduced count: 200 -> 80
    for (var i = 0; i < 80; i++) {
      var cMat = new THREE.MeshLambertMaterial({
        color: colors[Math.floor(Math.random() * colors.length)],
        transparent: true,
        opacity: 1.0,
      });
      var chunk = new THREE.Mesh(chunkGeo, cMat);
      chunk.velocity = new THREE.Vector3();
      chunk.rotVelocity = new THREE.Vector3();
      earthChunks.push(chunk);
      scene.add(chunk);
    }
  }

  for (var i = 0; i < earthChunks.length; i++) {
    var chunk = earthChunks[i];
    var randomPos = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    chunk.position.copy(randomPos).multiplyScalar(Math.random() * 6.3);
    var sc = Math.random() * 2.2 + 0.5;
    chunk.scale.set(sc, sc, sc);
    var outwardVelocity = randomPos.clone().addScaledVector(impactNorm, -0.3).normalize();
    chunk.velocity.copy(outwardVelocity.multiplyScalar(Math.random() * 0.15 + 0.05));
    chunk.rotVelocity.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.1);
    chunk.material.opacity = 1.0;
    chunk.visible = true;
  }

  // ── DEBRIS (BufferGeometry) ──
  if (!earthDebris) {
    var particleCount = 2000; // Reduced from 5000
    var debrisGeo = new THREE.BufferGeometry();
    var positions = new Float32Array(particleCount * 3);
    var velocities = new Float32Array(particleCount * 3);
    
    debrisGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    var debrisMat = new THREE.PointsMaterial({
      color: 0xff6611,
      size: 0.2,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    earthDebris = new THREE.Points(debrisGeo, debrisMat);
    earthDebris.userData.velocities = velocities;
    scene.add(earthDebris);
  }

  var posAttr = earthDebris.geometry.attributes.position;
  var vels = earthDebris.userData.velocities;
  for (var i = 0; i < posAttr.count; i++) {
    var rPos = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(Math.random() * 6.3);
    posAttr.setXYZ(i, rPos.x, rPos.y, rPos.z);
    var away = rPos.clone().normalize().multiplyScalar(Math.random() * 0.12 + 0.02);
    vels[i*3] = away.x;
    vels[i*3+1] = away.y;
    vels[i*3+2] = away.z;
  }
  posAttr.needsUpdate = true;
  earthDebris.material.opacity = 0.8;
  earthDebris.visible = true;
}

export function toggleDoomsday(scene) {
  resetEarth();
  isDoomsday = !isDoomsday;

  if (isDoomsday && !doomsdayActive) {
    if (!doomsdayMeteorGroup) {
      doomsdayMeteorGroup = new THREE.Group();
      var rockGeo = new THREE.SphereGeometry(2.5, 32, 32);
      var rockMat = new THREE.MeshPhongMaterial({ shininess: 5, bumpScale: 0.2 });
      rockMat.map = textureLoader.load("res/moon/moon-map.jpg");
      rockMat.bumpMap = textureLoader.load("res/moon/bump.jpg");
      var rock = new THREE.Mesh(rockGeo, rockMat);
      doomsdayMeteorGroup.add(rock);
      scene.add(doomsdayMeteorGroup);
    }
    var spawn = new THREE.Vector3((Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100);
    spawn.setLength(60);
    doomsdayMeteorGroup.position.copy(spawn);
    doomsdayMeteorGroup.lookAt(0, 0, 0);
    doomsdayMeteorGroup.visible = true;
    doomsdayActive = true;

    if (!doomsdayTrail) doomsdayTrail = createTrailSystem(scene, 150, 4.0, 0xffaa00);
    // Clear trail
    for (let i = 0; i < doomsdayTrail.lifetimes.length; i++) doomsdayTrail.lifetimes[i] = 0;
  }
}

export function updateDoomsdayLogic(delta, scene) {
  if (doomsdayActive && doomsdayMeteorGroup) {
    var headPos = new THREE.Vector3();
    doomsdayMeteorGroup.getWorldPosition(headPos);
    updateTrailSystem(doomsdayTrail, headPos, delta, 3, 1.5);

    var dir = new THREE.Vector3().copy(doomsdayMeteorGroup.position).normalize().multiplyScalar(-1);
    var speed = 0.01;
    doomsdayMeteorGroup.position.addScaledVector(dir, speed * delta);

    if (doomsdayMeteorGroup.position.length() <= 6.3781) {
      doomsdayActive = false;
      doomsdayMeteorGroup.visible = false;
      shatterEarth(scene);
      // Fade out trail
      updateTrailSystem(doomsdayTrail, null, delta, 0, 0);
    }
  } else if (doomsdayTrail) {
    updateTrailSystem(doomsdayTrail, null, delta, 0, 0);
  }

  if (earthShattered) {
    if (doomsdayFlash && doomsdayFlash.visible) {
      doomsdayFlash.scale.addScalar(0.012 * delta);
      doomsdayFlash.material.opacity -= 0.0015 * delta;
      if (doomsdayFlash.material.opacity <= 0) doomsdayFlash.visible = false;
    }
    if (planetShockwave && planetShockwave.visible) {
      planetShockwave.scale.addScalar(0.08 * delta);
      planetShockwave.material.opacity -= 0.001 * delta;
      if (planetShockwave.material.opacity <= 0) planetShockwave.visible = false;
    }
    for (var i = 0; i < earthChunks.length; i++) {
        var chunk = earthChunks[i];
        if (chunk.visible) {
          chunk.position.addScaledVector(chunk.velocity, delta);
          chunk.rotation.x += chunk.rotVelocity.x * delta;
          chunk.rotation.y += chunk.rotVelocity.y * delta;
          chunk.rotation.z += chunk.rotVelocity.z * delta;
          chunk.material.opacity -= 0.0001 * delta;
          if (chunk.material.opacity <= 0) chunk.visible = false;
        }
      }
    if (earthDebris && earthDebris.visible) {
      var posAttr = earthDebris.geometry.attributes.position;
      var vels = earthDebris.userData.velocities;
      for (var i = 0; i < posAttr.count; i++) {
        posAttr.setX(i, posAttr.getX(i) + vels[i*3] * delta);
        posAttr.setY(i, posAttr.getY(i) + vels[i*3+1] * delta);
        posAttr.setZ(i, posAttr.getZ(i) + vels[i*3+2] * delta);
      }
      posAttr.needsUpdate = true;
      earthDebris.material.opacity -= 0.00015 * delta;
      if (earthDebris.material.opacity <= 0) earthDebris.visible = false;
    }
  }
}

// ── Meteor Logic ─────────────────────────────────────────────────────────────

export function launchMeteor(scene) {
  if (!meteorGroup) {
    meteorGroup = new THREE.Group();
    var rockGeo = new THREE.SphereGeometry(0.2, 16, 16);
    var rockMat = new THREE.MeshPhongMaterial({ shininess: 5, bumpScale: 0.1 });
    rockMat.map = textureLoader.load("res/moon/moon-map.jpg");
    rockMat.bumpMap = textureLoader.load("res/moon/bump.jpg");
    var rock = new THREE.Mesh(rockGeo, rockMat);
    meteorGroup.add(rock);
    scene.add(meteorGroup);

    impactRingGroup = new THREE.Group();
    var ringGeo = new THREE.RingGeometry(0.1, 1.2, 32);
    var ringMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    var ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.name = "shockwave";
    impactRingGroup.add(ringMesh);

    var flashCanvas = document.createElement("canvas");
    flashCanvas.width = 64; flashCanvas.height = 64;
    var fCtx = flashCanvas.getContext("2d");
    var grad = fCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.3, "rgba(255,150,50,0.8)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    fCtx.fillStyle = grad; fCtx.fillRect(0, 0, 64, 64);
    var flashMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(flashCanvas), transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    var flashPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), flashMat);
    flashPlane.name = "flash";
    impactRingGroup.add(flashPlane);
    scene.add(impactRingGroup);
  }
  var spawn = new THREE.Vector3((Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50).setLength(25);
  meteorGroup.position.copy(spawn);
  meteorGroup.lookAt(0, 0, 0);
  meteorGroup.visible = true;
  meteorActive = true;

  if (!meteorTrail) meteorTrail = createTrailSystem(scene, 80, 1.5, 0xff6600);
  // Reset trail
  for (let i = 0; i < meteorTrail.lifetimes.length; i++) meteorTrail.lifetimes[i] = 0;
}

export function createCrater(impactPos, earthObject) {
    var cCanvas = document.createElement("canvas");
    cCanvas.width = 128; cCanvas.height = 128;
    var cCtx = cCanvas.getContext("2d");
    var grad = cCtx.createRadialGradient(64, 64, 5, 64, 64, 60);
    grad.addColorStop(0, "rgba(0, 0, 0, 0.9)");
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    cCtx.fillStyle = grad; cCtx.fillRect(0, 0, 128, 128);
    cCtx.strokeStyle = "rgba(255, 60, 0, 0.8)";
    cCtx.lineWidth = 2;
    for (var i = 0; i < 6; i++) {
      cCtx.beginPath(); cCtx.moveTo(64, 64);
      var length = 20 + Math.random() * 30; var angle = Math.random() * Math.PI * 2;
      cCtx.lineTo(64 + Math.cos(angle)*length, 64 + Math.sin(angle)*length);
      cCtx.stroke();
    }
    var craterTex = new THREE.CanvasTexture(cCanvas);
    var craterMat = new THREE.MeshBasicMaterial({ map: craterTex, transparent: true, depthWrite: false });
    var craterMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), craterMat);
    var localPos = earthObject.worldToLocal(impactPos.clone()).normalize().multiplyScalar(6.3781 + 0.015);
    craterMesh.position.copy(localPos);
    craterMesh.lookAt(localPos.clone().multiplyScalar(2));
    earthObject.add(craterMesh);
    earthCraters.push(craterMesh);
}

export function updateMeteorLogic(delta, earthObject, scene) {
  if (meteorActive && meteorGroup) {
    var headPos = new THREE.Vector3();
    meteorGroup.getWorldPosition(headPos);
    updateTrailSystem(meteorTrail, headPos, delta, 2, 0.4);

    var dir = new THREE.Vector3().copy(meteorGroup.position).normalize().multiplyScalar(-1);
    var speed = 0.007;
    meteorGroup.position.addScaledVector(dir, speed * delta);
    if (meteorGroup.position.length() <= 6.3781 + 0.1) {
      meteorActive = false; meteorGroup.visible = false;
      // Fade out trail
      updateTrailSystem(meteorTrail, null, delta, 0, 0);
      
      impactRingGroup.position.copy(meteorGroup.position);
      impactRingGroup.lookAt(0, 0, 0);
      impactRingGroup.getObjectByName("shockwave").scale.set(1, 1, 1);
      impactRingGroup.getObjectByName("shockwave").material.opacity = 1.0;
      impactRingGroup.getObjectByName("flash").material.opacity = 1.0;
      impactRingGroup.visible = true; impactActive = true;
      createCrater(meteorGroup.position, earthObject);
    }
  } else if (meteorTrail) {
    updateTrailSystem(meteorTrail, null, delta, 0, 0);
  }
  
  if (impactActive && impactRingGroup && impactRingGroup.visible) {
    var sw = impactRingGroup.getObjectByName("shockwave");
    var fl = impactRingGroup.getObjectByName("flash");
    sw.scale.addScalar(0.03 * delta); sw.material.opacity -= 0.0025 * delta;
    fl.material.opacity -= 0.005 * delta;
    if (sw.material.opacity <= 0) impactActive = false;
  }
}

export function resetEarth() {
  if (earthObject) {
    earthObject.visible = true;
    earthCraters.forEach(c => { earthObject.remove(c); c.geometry.dispose(); c.material.dispose(); });
    earthCraters = [];
    isDoomsday = false; doomsdayActive = false; earthShattered = false;
    if (doomsdayMeteorGroup) doomsdayMeteorGroup.visible = false;
    if (earthDebris) earthDebris.visible = false;
    if (doomsdayFlash) doomsdayFlash.visible = false;
    if (planetShockwave) planetShockwave.visible = false;
    earthChunks.forEach(c => c.visible = false);
  }
}

export function setDeepSeaMode(active) {
  isDeepSeaMode = active;
  
  if (!bathymetryMat && earthObject) {
    // Main mesh is the first child added to earthObject
    var mainMesh = earthObject.children[0];
    originalEarthMat = mainMesh.material;
    
    bathymetryMat = new THREE.ShaderMaterial({
      uniforms: {
        dayTexture: { value: textureLoader.load("res/earth/day-map.jpg") },
        bumpTexture: { value: textureLoader.load("res/earth/bump.jpg") },
        sunPosition: { value: sunLight.position },
        transition: { value: 0.0 }
      },
      vertexShader: bathymetryVS,
      fragmentShader: bathymetryFS
    });
  }
}

// ── Scene Objects ────────────────────────────────────────────────────────────

export function initSceneObjects(scene) {
  var earthRadius = 6.3781;
  earthObject = new THREE.Group();

  // 1. Day surface (Optimized: 128 -> 64)
  var bodyGeo = new THREE.SphereGeometry(earthRadius, 64, 64);
  var bodyMat = new THREE.MeshPhongMaterial({ specular: 0x3a3520, shininess: 40, bumpScale: 0.08 });
  bodyMat.map = textureLoader.load("res/earth/day-map.jpg");
  bodyMat.specularMap = textureLoader.load("res/earth/spec.jpg");
  bodyMat.bumpMap = textureLoader.load("res/earth/bump.jpg");
  earthObject.add(new THREE.Mesh(bodyGeo, bodyMat));

  // 2. Night layer (Optimized)
  var nightGeo = new THREE.SphereGeometry(earthRadius + 0.01, 64, 64);
  var nightMat = new THREE.ShaderMaterial({
    uniforms: { sunPosition: { value: sunLight.position }, nightTexture: { value: textureLoader.load("res/earth/night-map.jpg") } },
    vertexShader: generalVS, fragmentShader: nightFS, transparent: true, depthWrite: false, renderOrder: 1
  });
  earthObject.add(new THREE.Mesh(nightGeo, nightMat));

  // 3. Cloud layer (Optimized: 64 -> 32)
  var cloudGeo = new THREE.SphereGeometry(earthRadius + 0.05, 32, 32);
  var cloudMat = new THREE.ShaderMaterial({
    uniforms: { cloudTexture: { value: textureLoader.load("res/earth/clouds.png") }, sunPosition: { value: sunLight.position } },
    vertexShader: cloudVS, fragmentShader: cloudFS, transparent: true, depthWrite: false, renderOrder: 3
  });
  var cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
  cloudMesh.name = "CloudLayer";
  earthObject.add(cloudMesh);

  // 4. Atmosphere (Optimized: 128 -> 48)
  var atmoGeo = new THREE.SphereGeometry(earthRadius + 0.12, 48, 48);
  var atmoMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.lights, {
        atmosphereColor: { value: new THREE.Vector3(0.35, 0.6, 1.0) }, sunsetColor: { value: new THREE.Vector3(0.9, 0.55, 0.25) },
        atmosphereStrength: { value: 1.8 }, sunsetStrength: { value: 1.2 }
    }]),
    vertexShader: atmosphereVS, fragmentShader: atmosphereFS, transparent: true, depthWrite: false, renderOrder: 2, lights: true
  });
  earthObject.add(new THREE.Mesh(atmoGeo, atmoMat));

  // 5. Aurora layer (Optimized)
  var auroraGeo = new THREE.SphereGeometry(earthRadius + 0.22, 48, 48);
  auroraUniforms = { time: { value: 0.0 }, sunPosition: { value: sunLight.position } };
  var auroraMat = new THREE.ShaderMaterial({
    uniforms: auroraUniforms, vertexShader: auroraVS, fragmentShader: auroraFS, transparent: true, depthWrite: false, renderOrder: 4, blending: THREE.AdditiveBlending
  });
  earthObject.add(new THREE.Mesh(auroraGeo, auroraMat));

  scene.add(earthObject);

  // ── Moon ───────────────────
  var moonRadius = 1.7371 * 1.2;
  var moonGeo = new THREE.SphereGeometry(moonRadius, 32, 32);
  var moonMat = new THREE.MeshPhongMaterial({ shininess: 8, bumpScale: 0.06 });
  moonMat.map = textureLoader.load("res/moon/moon-map.jpg");
  moonMat.bumpMap = textureLoader.load("res/moon/bump.jpg");
  moonObject = new THREE.Mesh(moonGeo, moonMat);
  scene.add(moonObject);
}

export function animateFrame(delta, scene, camera, renderer, hudObjects, poiManager, trafficManager, vrMenuUpdate, vrControllersUpdate) {
  auroraElapsed += delta * 0.001;
  
  if (poiManager) {
    poiManager.update(camera, poiManager.mouse);
    poiManager.animatePanel(camera);
  }

  if (trafficManager) {
    trafficManager.update(delta);
  }

  if (!poiManager || !poiManager.hoveredPOI) {
    updateTime(delta);
  }

  if (auroraUniforms) {
    auroraUniforms.time.value = auroraElapsed;
    auroraUniforms.sunPosition.value.copy(sunLight.position);
  }

  updateEarthRotation(earthObject, delta);
  updateMeteorLogic(delta, earthObject, scene);
  updateDoomsdayLogic(delta, scene);

  // Deep Sea Transition Logic
  if (earthObject && bathymetryMat) {
    var mainMesh = earthObject.children[0];
    var cloudLayer = earthObject.getObjectByName("CloudLayer");
    var nightMesh = earthObject.children[1];
    var atmoMesh = earthObject.children[3];
    var target = isDeepSeaMode ? 1.0 : 0.0;
    
    // Smooth transition
    if (Math.abs(deepSeaTransition - target) > 0.01) {
      deepSeaTransition += (target - deepSeaTransition) * 0.05;
      bathymetryMat.uniforms.transition.value = deepSeaTransition;
      
      // Swap material when transition starts
      if (deepSeaTransition > 0.01) {
        mainMesh.material = bathymetryMat;
      } else {
        mainMesh.material = originalEarthMat;
      }
      
      // Hide other layers as we go deeper
      if (cloudLayer) cloudLayer.visible = (deepSeaTransition < 0.5);
      if (nightMesh) nightMesh.visible = (deepSeaTransition < 0.3);
      if (atmoMesh) atmoMesh.visible = (deepSeaTransition < 0.7);
      if (trafficManager) trafficManager.trafficGroup.visible = (deepSeaTransition < 0.2);
    }
  }

  updateSunLocation(sunLight);
  updateMoonRotation(moonObject);
  updateMoonLocation(moonObject);

  hudObjects.forEach(hud => hud && hud.update());
  
  if (vrMenuUpdate) vrMenuUpdate();
  if (vrControllersUpdate) vrControllersUpdate();
}
