import * as THREE from 'three';
import { nowInYear, nowInDay, nowInLunarMonth } from './time.js';

// Constants that will be shared or passed
export const minDistance = 15;
export const maxDistance = 200;

// Rotation speed multipliers
export let earthRotationSpeed = 1.0;
export let moonRotationSpeed = 1.0;

export function setEarthRotationSpeed(val) { earthRotationSpeed = val; }
export function setMoonRotationSpeed(val) { moonRotationSpeed = val; }

export const cameraTransform = new (function () {
  this.cameraDistance = minDistance * 2.0;
  // zOx
  this.cameraTheta = Math.PI / 2;
  this.zeroVector = new THREE.Vector3(0, 0, 0);
  this.cameraPhi = 0;
  this.camera = null;

  this.init = function (camera) {
    this.camera = camera;
    camera.position.set(this.cameraDistance, 0, 0);
    camera.lookAt(this.zeroVector);
  };

  this.goNearer = function (renderer) {
    let min = minDistance;
    // In new Three.js, we check renderer.xr.isPresenting
    if (this.cameraDistance > min) {
      this.cameraDistance -= 0.5;
    }
  };

  this.goFarther = function (renderer) {
    let max = maxDistance;
    if (this.cameraDistance < max) {
      this.cameraDistance += 0.5;
    }
  };

  this.increasePhi = function () {
    var offset = 0.01;
    if (this.cameraPhi < Math.PI / 2 - offset) {
      this.cameraPhi += offset;
    }
  };

  this.decreasePhi = function () {
    var offset = 0.01;
    if (this.cameraPhi > -Math.PI / 2 + offset) {
      this.cameraPhi -= offset;
    }
  };

  this.moveTheta = function (delta) {
    this.cameraTheta += delta;
    if (this.cameraTheta > 2 * Math.PI) this.cameraTheta -= 2 * Math.PI;
    if (this.cameraTheta < 0) this.cameraTheta += 2 * Math.PI;
  };

  this.movePhi = function (delta) {
    const offset = 0.01;
    this.cameraPhi += delta;
    // Clamp to avoid flipping over poles
    this.cameraPhi = Math.max(-Math.PI / 2 + offset, Math.min(Math.PI / 2 - offset, this.cameraPhi));
  };

  this.moveDistance = function (delta) {
    this.cameraDistance += delta;
    // Clamp to min/max
    this.cameraDistance = Math.max(minDistance, Math.min(maxDistance, this.cameraDistance));
  };

  this.update = function (target) {
    var obj = target || this.camera;
    if (!obj) return;
    
    obj.position.set(
      this.cameraDistance *
        Math.sin(this.cameraTheta) *
        Math.cos(this.cameraPhi),
      this.cameraDistance * Math.sin(this.cameraPhi),
      this.cameraDistance *
        Math.cos(this.cameraTheta) *
        Math.cos(this.cameraPhi),
    );
    obj.lookAt(this.zeroVector);
  };
})();

export function updateEarthRotation(earthObject, delta) {
  earthObject.quaternion.set(0, 0, 0, 1);
  earthObject.rotateX((-23.5 / 180) * Math.PI);
  var a = nowInYear(),
    b = nowInDay();
  earthObject.rotateY((a + b - 0.72) * 2 * Math.PI * earthRotationSpeed);

  // Dynamic Clouds rotation relative to Earth
  var cloudLayer = earthObject.getObjectByName("CloudLayer");
  if (cloudLayer) {
    cloudLayer.rotation.y += 0.00002 * delta; // Normalized by delta, significantly slowed down
  }
}

export function updateSunLocation(sunLight) {
  var a = nowInYear();
  sunLight.position.set(
    400 * Math.cos((a - 0.22) * 2 * Math.PI),
    0,
    400 * Math.sin((0.22 - a) * 2 * Math.PI),
  );
}

export function updateMoonRotation(moonObject) {
  var c = (nowInYear() + nowInLunarMonth()) * 5.0; // 5x faster orbit/rotation
  moonObject.quaternion.set(0, 0, 0, 1);
  moonObject.rotateY((c - 0.72) * 2 * Math.PI * moonRotationSpeed);
}

export function updateMoonLocation(moonObject) {
  var c = (nowInYear() + nowInLunarMonth()) * 5.0; // 5x faster orbit/rotation
  moonObject.position.set(
    60 * Math.cos((c - 0.22) * 2 * Math.PI),
    0,
    60 * Math.sin((0.22 - c) * 2 * Math.PI),
  );
}
