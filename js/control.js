import { cameraTransform } from './transform.js';
import { fasterTime, slowerTime } from './time.js';

var fasterActioned = false;
var slowerActioned = false;
var toggleHUDActioned = false;

export function updateGamepad(earthHUD, moonHUD) {
    var gamepads = navigator.getGamepads();
    // We only care about the first one for standard desktop controls
    var gp = gamepads ? (gamepads[0] || gamepads[1] || gamepads[2]) : null;
    if (!gp) return;

    // Axis 0 & 1: Rotation
    if(Math.abs(gp.axes[0]) > 0.2) {
        cameraTransform.moveTheta(gp.axes[0] * 0.05);
    }

    // Button 5 (R1/RB) combo with Axis 1 for Zoom
    if(gp.buttons[5] && gp.buttons[5].pressed) {
        if(Math.abs(gp.axes[1]) > 0.2) {
            cameraTransform.moveDistance(gp.axes[1] * 0.5);
        }
    } else {
        // Axis 1: Phi rotation
        if(Math.abs(gp.axes[1]) > 0.2) {
            cameraTransform.movePhi(-gp.axes[1] * 0.05);
        }
    }

    // Direct buttons for zoom (A/B or similar)
    if(gp.buttons[0] && gp.buttons[0].pressed) {
        cameraTransform.moveDistance(-0.2);
    }
    if(gp.buttons[1] && gp.buttons[1].pressed) {
        cameraTransform.moveDistance(0.2);
    }

    // Time scaling (B3 / B2)
    if(gp.buttons[3] && gp.buttons[3].pressed) {
        if(!fasterActioned) fasterTime();
        fasterActioned = true;
    } else {
        fasterActioned = false;
    }
    if(gp.buttons[2] && gp.buttons[2].pressed) {
        if(!slowerActioned) slowerTime();
        slowerActioned = true;
    } else {
        slowerActioned = false;
    }

    // Toggle HUD (B4)
    if(gp.buttons[4] && gp.buttons[4].pressed) {
        if(!toggleHUDActioned) {
            if(earthHUD) {
                if(earthHUD.visibility) { earthHUD.hide(); } else { earthHUD.show(); }
            }
            if(moonHUD) {
                if(moonHUD.visibility) { moonHUD.hide(); } else { moonHUD.show(); }
            }
            toggleHUDActioned = true;
        }
    } else {
        toggleHUDActioned = false;
    }
}