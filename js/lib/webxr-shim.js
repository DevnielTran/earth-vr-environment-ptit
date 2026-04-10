/**
 * A basic WebXR to WebVR polyfill shim to allow older WebVR apps
 * to work on newer WebXR-only browsers like Meta Quest 3.
 *
 * This shim OVERRIDES any existing navigator.getVRDisplays (including
 * the WebVR polyfill) when native WebXR is available, since the native
 * WebXR path gives true headset tracking and stereo rendering.
 */
(function () {
  // Only activate on browsers with native WebXR support
  if (!navigator.xr) {
    console.log("WebXR not available, using polyfill/native WebVR.");
    return;
  }

  console.log("WebXR detected, applying WebVR shim (overriding polyfill)...");

  var currentSession = null;
  var currentReferenceSpace = null;
  var currentWebGLLayer = null;
  var lastFrame = null;
  var shimCanvas = null;
  var shimGL = null;

  // Simulated VRDisplay backed by WebXR
  function XRVRDisplay() {
    this.isPresenting = false;
    this.capabilities = {
      canPresent: true,
      hasExternalDisplay: false,
      hasPosition: true,
      hasOrientation: true,
      maxLayers: 1,
    };
    this._layers = [];
  }

  XRVRDisplay.prototype.getEyeParameters = function (eye) {
    if (currentSession && currentSession.renderState.baseLayer) {
      var layer = currentSession.renderState.baseLayer;
      return {
        renderWidth: layer.framebufferWidth / 2,
        renderHeight: layer.framebufferHeight,
        offset: [eye === "left" ? -0.032 : 0.032, 0, 0],
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
      offset: [eye === "left" ? -0.032 : 0.032, 0, 0],
      fieldOfView: {
        upDegrees: 45,
        downDegrees: 45,
        leftDegrees: 45,
        rightDegrees: 45,
      },
    };
  };

  XRVRDisplay.prototype.getLayers = function () {
    return this._layers;
  };

  XRVRDisplay.prototype.requestPresent = function (layers) {
    var self = this;
    self._layers = layers || [];

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
        shimCanvas = canvas;

        // Get or create a WebGL context compatible with WebXR
        var gl = canvas.getContext("webgl", { xrCompatible: true });
        if (!gl) {
          gl = canvas.getContext("experimental-webgl", { xrCompatible: true });
        }
        shimGL = gl;

        currentWebGLLayer = new XRWebGLLayer(session, gl);
        session.updateRenderState({ baseLayer: currentWebGLLayer });

        // CRITICAL: Redirect Three.js default framebuffer (null) to XR framebuffer
        if (!gl._xrShimmed) {
          var originalBind = gl.bindFramebuffer.bind(gl);
          gl.bindFramebuffer = function (target, fbo) {
            if (fbo === null && self.isPresenting && currentWebGLLayer) {
              fbo = currentWebGLLayer.framebuffer;
            }
            originalBind(target, fbo);
          };
          gl._xrShimmed = true;
        }

        return session
          .requestReferenceSpace("local")
          .then(function (refSpace) {
            currentReferenceSpace = refSpace;
          })
          .catch(function () {
            // Fallback to viewer reference space
            return session
              .requestReferenceSpace("viewer")
              .then(function (refSpace) {
                currentReferenceSpace = refSpace;
              });
          })
          .then(function () {
            session.addEventListener("end", function () {
              self.isPresenting = false;
              self._layers = [];
              currentSession = null;
              currentReferenceSpace = null;
              currentWebGLLayer = null;
              lastFrame = null;
              window.dispatchEvent(
                new CustomEvent("vrdisplaypresentchange")
              );
            });

            window.dispatchEvent(new CustomEvent("vrdisplaypresentchange"));
            return Promise.resolve();
          });
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

    try {
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
    } catch (e) {
      console.warn("WebXR shim getFrameData error:", e);
      return false;
    }
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

  XRVRDisplay.prototype.submitFrame = function () {
    // WebXR handles frame submission automatically
  };

  // Override navigator.getVRDisplays (even if polyfill set it)
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

  // Ensure VRFrameData exists
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
})();
