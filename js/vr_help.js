import * as THREE from 'three';

export var VRHelpPanel = function (scene, camera) {
  var width = 512,
    height = 384;
  var canvas = (this.canvas = document.createElement("canvas"));
  var context = (this.context = this.canvas.getContext("2d"));
  var texture = (this.texture = new THREE.Texture(canvas));
  var material = (this.material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
  }));
  material.depthTest = true;
  material.depthWrite = true;
  canvas.width = width;
  canvas.height = height;
  var geometry = new THREE.PlaneGeometry(8, 6);
  this.plane = new THREE.Mesh(geometry, material);
  this.plane.renderOrder = 0;

  // Position it further out and slightly higher
  this.plane.position.set(-10, 5, -18);
  scene.add(this.plane);

  this.draw = function () {
    context.clearRect(0, 0, width, height);

    // Background
    context.fillStyle = "rgba(0, 0, 0, 0.65)";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#00ffff";
    context.lineWidth = 4;
    context.strokeRect(0, 0, width, height);

    // Title
    context.fillStyle = "#00ffff";
    context.font = "bold 38px Arial";
    context.textAlign = "center";
    context.fillText("VR TUTORIAL", width / 2, 55);

    // Content
    context.fillStyle = "#ffffff";
    context.font = "24px Arial";
    context.textAlign = "left";

    var startY = 120;
    var step = 45;

    context.fillText("● B / Y: Mở/Tắt Menu", 45, startY);
    context.fillText("● Grip (Cạnh): Phóng Meteor", 45, startY + step);
    context.fillText("● A / X: Reset Earth", 45, startY + step * 2);
    context.fillText("● Stick Click: Tận thế", 45, startY + step * 3);
    context.fillText("● Left Stick: Bay quanh Trái Đất", 45, startY + step * 4);

    context.fillStyle = "#ffff00";
    context.font = "italic 19px Arial";
    context.fillText(
      "Right Stick: Zoom (Y) + Tốc độ (X)",
      45,
      startY + step * 5 + 15,
    );

    texture.needsUpdate = true;
  };

  this.update = function () {
    if (this.plane && this.plane.visible) {
      const camWorldPos = new THREE.Vector3();
      camera.getWorldPosition(camWorldPos);
      this.plane.lookAt(camWorldPos);
    }
  };

  this.draw();
};
