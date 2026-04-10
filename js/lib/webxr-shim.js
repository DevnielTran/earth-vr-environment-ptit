/**
 * A basic WebXR to WebVR polyfill shim to allow older WebVR apps
 * to work on newer WebXR-only browsers like Meta Quest 3.
 */
(function () {
  if (navigator.xr && !navigator.getVRDisplays) {
    console.log("WebXR detected, applying WebVR shim...");

    var currentSession = null;
    var currentReferenceSpace = null;
    var currentWebGLLayer = null;
    var lastFrame = null;

    // Simulated VRDisplay
    function XRVRDisplay() {
      this.isPresenting = false;
      this.capabilities = {
        canPresent: true,
        hasExternalDisplay: false,
        hasPosition: true,
        hasOrientation: true,
        maxLayers: 1,
      };
    }

    XRVRDisplay.prototype.getEyeParameters = function (eye) {
      if (currentSession && currentSession.renderState.baseLayer) {
        var layer = currentSession.renderState.baseLayer;
        return {
          renderWidth: layer.framebufferWidth / 2,
          renderHeight: layer.framebufferHeight,
          offset: [eye === "left" ? -0.03 : 0.03, 0, 0],
          fieldOfView: {
            upDegrees: 45,
            downDegrees: 45,
            leftDegrees: 45,
            rightDegrees: 45,
          },
        };
      }
      return {
        renderWidth: window.innerWidth / 2,
        renderHeight: window.innerHeight,
        offset: [eye === "left" ? -0.03 : 0.03, 0, 0],
        fieldOfView: {
          upDegrees: 45,
          downDegrees: 45,
          leftDegrees: 45,
          rightDegrees: 45,
        },
      };
    };

    XRVRDisplay.prototype.requestPresent = function (layers) {
      var self = this;
      return navigator.xr
        .requestSession("immersive-vr", {
          optionalFeatures: ["local-floor", "bounded-floor"],
        })
        .then(function (session) {
          currentSession = session;
          self.isPresenting = true;

          var canvas =
            (layers && layers[0] && layers[0].source) ||
            document.querySelector("canvas");
          var gl =
            canvas.getContext("webgl", { xrCompatible: true }) ||
            canvas.getContext("experimental-webgl", { xrCompatible: true });

          currentWebGLLayer = new XRWebGLLayer(session, gl);
          session.updateRenderState({ baseLayer: currentWebGLLayer });

          session.requestReferenceSpace("local").then(function (refSpace) {
            currentReferenceSpace = refSpace;
          });

          session.addEventListener("end", function () {
            self.isPresenting = false;
            currentSession = null;
            window.dispatchEvent(new CustomEvent("vrdisplaypresentchange"));
          });

          window.dispatchEvent(new CustomEvent("vrdisplaypresentchange"));
          return Promise.resolve();
        });
    };

    XRVRDisplay.prototype.exitPresent = function () {
      if (currentSession) {
        return currentSession.end();
      }
      return Promise.resolve();
    };

    XRVRDisplay.prototype.getFrameData = function (frameData) {
      if (!frameData || !lastFrame || !currentReferenceSpace) return false;

      var pose = lastFrame.getViewerPose(currentReferenceSpace);
      if (!pose) return false;

      for (var i = 0; i < pose.views.length; i++) {
        var view = pose.views[i];
        var eye = view.eye === "left" ? "left" : "right";
        var matrixAttr = eye + "ProjectionMatrix";
        var viewAttr = eye + "ViewMatrix";

        if (frameData[matrixAttr])
          frameData[matrixAttr].set(view.projectionMatrix);
        if (frameData[viewAttr])
          frameData[viewAttr].set(view.transform.inverse.matrix);
      }

      var transform = pose.transform;
      if (frameData.pose) {
        frameData.pose.position[0] = transform.position.x;
        frameData.pose.position[1] = transform.position.y;
        frameData.pose.position[2] = transform.position.z;
        frameData.pose.orientation[0] = transform.orientation.x;
        frameData.pose.orientation[1] = transform.orientation.y;
        frameData.pose.orientation[2] = transform.orientation.z;
        frameData.pose.orientation[3] = transform.orientation.w;
      }

      return true;
    };

    XRVRDisplay.prototype.requestAnimationFrame = function (callback) {
      if (currentSession) {
        return currentSession.requestAnimationFrame(function (time, frame) {
          lastFrame = frame;
          callback(time);
        });
      }
      return window.requestAnimationFrame(callback);
    };

    XRVRDisplay.prototype.submitFrame = function () {};

    navigator.getVRDisplays = function () {
      return navigator.xr
        .isSessionSupported("immersive-vr")
        .then(function (supported) {
          if (supported) {
            return [new XRVRDisplay()];
          }
          return [];
        });
    };

    if (!window.VRFrameData) {
      window.VRFrameData = function () {
        this.pose = {
          position: new Float32Array([0, 0, 0]),
          orientation: new Float32Array([0, 0, 0, 1]),
        };
        this.leftProjectionMatrix = new Float32Array(16);
        this.rightProjectionMatrix = new Float32Array(16);
        this.leftViewMatrix = new Float32Array(16);
        this.rightViewMatrix = new Float32Array(16);
      };
    }
  }
})();
