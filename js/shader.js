// ============================================================
// General vertex shader — used by night layer
// ============================================================
export const generalVS = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 sunDirection;
uniform vec3 sunPosition;

void main() {
    vUv = uv;
    vNormal = normalMatrix * normal;
    sunDirection = (modelViewMatrix * vec4(position, 1.)
        - viewMatrix * vec4(sunPosition, 1.)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// ============================================================
// Night layer fragment shader
// ============================================================
export const nightFS = `
uniform sampler2D nightTexture;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 sunDirection;

void main( void ) {
    vec4 nightColor = texture2D( nightTexture, vUv );
    vec3 nightRGB   = nightColor.rgb;

    float cosAngle = dot( normalize(vNormal), normalize(-sunDirection) );
    float nightBlend = 1.0 - smoothstep(-0.25, 0.25, cosAngle);

    gl_FragColor = vec4( nightRGB, nightBlend );
}
`;

// ============================================================
// Cloud vertex shader
// ============================================================
export const cloudVS = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vSunDir;
uniform vec3 sunPosition;

void main() {
    vUv     = uv;
    vNormal = normalMatrix * normal;
    vSunDir = normalize((viewMatrix * vec4(sunPosition, 1.0)).xyz
              - (modelViewMatrix * vec4(position, 1.0)).xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// ============================================================
// Cloud fragment shader
// ============================================================
export const cloudFS = `
uniform sampler2D cloudTexture;
uniform sampler2D nightTexture;
uniform vec3      sunPosition;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vSunDir;

void main() {
    vec4  cloudSample = texture2D( cloudTexture, vUv );
    float opacity     = pow(cloudSample.r, 2.5) * 0.40;
    float NdotL       = max( dot( normalize(vNormal), normalize(vSunDir) ), 0.0 );
    vec3  litColor    = mix( vec3(0.10, 0.13, 0.20), vec3(1.0, 0.98, 0.95), NdotL );
    float darkening   = smoothstep(-0.25, 0.35, NdotL);
    vec3  finalColor  = litColor * darkening;
    gl_FragColor = vec4( finalColor, opacity * 0.75 );
}
`;

// ============================================================
// Atmosphere vertex shader
// ============================================================
export const atmosphereVS = `
mat4 inverse(mat4 m) {
    float
        a00 = m[0][0], a01 = m[0][1], a02 = m[0][2], a03 = m[0][3],
        a10 = m[1][0], a11 = m[1][1], a12 = m[1][2], a13 = m[1][3],
        a20 = m[2][0], a21 = m[2][1], a22 = m[2][2], a23 = m[2][3],
        a30 = m[3][0], a31 = m[3][1], a32 = m[3][2], a33 = m[3][3],

        b00 = a00 * a11 - a01 * a10,
        b01 = a00 * a12 - a02 * a10,
        b02 = a00 * a13 - a03 * a10,
        b03 = a01 * a12 - a02 * a11,
        b04 = a01 * a13 - a03 * a11,
        b05 = a02 * a13 - a03 * a12,
        b06 = a20 * a31 - a21 * a30,
        b07 = a20 * a32 - a22 * a30,
        b08 = a20 * a33 - a23 * a30,
        b09 = a21 * a32 - a22 * a31,
        b10 = a21 * a33 - a23 * a31,
        b11 = a22 * a33 - a23 * a32,

        det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

    return mat4(
        a11 * b11 - a12 * b10 + a13 * b09,
        a02 * b10 - a01 * b11 - a03 * b09,
        a31 * b05 - a32 * b04 + a33 * b03,
        a22 * b04 - a21 * b05 - a23 * b03,
        a12 * b08 - a10 * b11 - a13 * b07,
        a00 * b11 - a02 * b08 + a03 * b07,
        a32 * b02 - a30 * b05 - a33 * b01,
        a20 * b05 - a22 * b02 + a23 * b01,
        a10 * b10 - a11 * b08 + a13 * b06,
        a01 * b08 - a00 * b10 - a03 * b06,
        a30 * b04 - a31 * b02 + a33 * b00,
        a21 * b02 - a20 * b04 - a23 * b00,
        a11 * b07 - a10 * b09 - a12 * b06,
        a00 * b09 - a01 * b07 + a02 * b06,
        a31 * b01 - a30 * b03 - a32 * b00,
        a20 * b03 - a21 * b01 + a22 * b00) / det;
}

struct PointLight {
    vec3 position;
    float distance;
    vec3 color;
};
uniform PointLight pointLights[NUM_POINT_LIGHTS];

varying float intensity1;
varying float intensity2;

const float PI = 3.14159265358979;

void main(void) {
    vec3 cameraDir = normalize(cameraPosition - (modelMatrix * vec4(0., 0., 0., 1.)).xyz);
    vec3 lightDir  = normalize((inverse(viewMatrix) * vec4(pointLights[0].position, 1.)).xyz);
    vec3 normalVec = (modelMatrix * vec4(normal, 0.)).xyz;

    intensity1 = 0.5*dot(lightDir, normalVec + 0.5 * lightDir)
               * dot(cameraDir + 0.5*lightDir, lightDir)
               * (1. - pow(dot(cameraDir, normalVec), 1.5))
               + 0.21*dot(lightDir, normalVec);

    intensity2 = 1.5*dot(lightDir, normalVec + lightDir)
               * (1. - dot(cameraDir + 1.5*lightDir, lightDir)/2.5)
               * (1. - dot(cameraDir, normalVec));

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// ============================================================
export const atmosphereFS = `
varying float intensity1;
varying float intensity2;

uniform vec3  atmosphereColor;
uniform vec3  sunsetColor;
uniform float atmosphereStrength;
uniform float sunsetStrength;

void main(void) {
    vec3  atmo   = atmosphereStrength   * intensity1      * atmosphereColor;
    vec3  sunset = sunsetStrength       * intensity2       * sunsetColor;
    float alpha  = intensity1 + intensity2;
    gl_FragColor = vec4(atmo + sunset, alpha);
}
`;

// ============================================================
// Limb halo shaders
// ============================================================
export const haloVS = `
varying float intensity;
const float PI = 3.14159265358979;

void main(void) {
    vec4 vertexPos     = modelMatrix * vec4(position, 1.0);
    vec3 vertexPos3    = vertexPos.xyz/vertexPos.w;
    vec4 modelViewPos  = modelViewMatrix * vec4(position, 1.0);
    float distance     = length(cameraPosition);
    vec4 centerPos4    = modelMatrix * vec4(0., 0., 0., 1.);
    vec3 centerPos3    = (centerPos4/centerPos4.w).xyz;
    vec3 cameraRelative = cameraPosition - centerPos3;

    vec3 cameraDir = normalize(cameraRelative);
    vec3 normalVec = (modelMatrix * vec4(normal, 0.)).xyz;

    intensity = pow(dot(normalVec, cameraDir), 4.) * min(distance / 2000., 1.);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const haloFS = `
varying float intensity;
uniform vec3 color;

void main(void) {
    gl_FragColor = vec4(intensity * color, intensity);
}
`;

// ============================================================
// Aurora vertex / fragment shaders
// ============================================================
export const auroraVS = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;
uniform float time;

void main() {
    vUv      = uv;
    vNormal  = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const auroraFS = `
uniform float time;
uniform vec3  sunPosition;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
               mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.1; a*=0.5; }
    return v;
}

void main() {
    float pole    = smoothstep(0.85, 1.0, abs(vNormal.y));
    float lat     = asin(clamp(vNormal.y, -1.0, 1.0));
    float lon     = atan(vNormal.z, vNormal.x);
    vec2  uv2     = vec2(lon * 2.0 + time * 0.04, lat * 4.0);
    float curtain = fbm(uv2) * fbm(uv2 * 0.7 + vec2(time*0.02, 0.));

    vec3  green   = vec3(0.1, 1.0, 0.4);
    vec3  teal    = vec3(0.0, 0.8, 0.9);
    vec3  violet  = vec3(0.5, 0.1, 1.0);
    vec3  auroraColor = mix(mix(green, teal, curtain), violet, curtain * curtain);

    float alpha = pole * curtain * 0.55;

    vec3  toSun    = normalize(sunPosition);
    float nightMask = smoothstep(0.1, -0.2, dot(vNormal, toSun));

    gl_FragColor = vec4(auroraColor, alpha * nightMask);
}
`;

// ============================================================
// Bathymetry (Deep Sea) shaders
// ============================================================
export const bathymetryVS = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vSunDir;
uniform vec3 sunPosition;

void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vSunDir = normalize((viewMatrix * vec4(sunPosition, 1.0)).xyz 
              - (modelViewMatrix * vec4(position, 1.0)).xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const bathymetryFS = `
uniform sampler2D dayTexture;
uniform sampler2D bumpTexture;
uniform float     transition; // 0.0 = Standard, 1.0 = Bathymetry
uniform vec3      sunPosition;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vSunDir;

void main() {
    vec4 dayColor = texture2D(dayTexture, vUv);
    float height  = texture2D(bumpTexture, vUv).r;
    
    // Create bathymetry color ramp
    vec3 deepOcean  = vec3(0.01, 0.02, 0.1);
    vec3 midOcean   = vec3(0.0, 0.3, 0.6);
    vec3 shelf      = vec3(0.0, 0.7, 0.8);
    vec3 landHigh   = vec3(0.1, 0.4, 0.1);
    vec3 landPeaks  = vec3(0.8, 0.8, 0.8);
    
    vec3 topoColor;
    if (height < 0.3) {
        topoColor = mix(deepOcean, midOcean, smoothstep(0.0, 0.3, height));
    } else if (height < 0.5) {
        topoColor = mix(midOcean, shelf, smoothstep(0.3, 0.5, height));
    } else {
        topoColor = mix(dayColor.rgb, landPeaks * dayColor.rgb, smoothstep(0.7, 1.0, height));
    }
    
    // Lighting
    float NdotL = max(dot(vNormal, vSunDir), 0.1);
    
    // Mix based on transition uniform
    vec3 finalRGB = mix(dayColor.rgb, topoColor, transition);
    gl_FragColor = vec4(finalRGB * (NdotL * 0.9 + 0.1), 1.0);
}
`;

// ============================================================
// Particle Trail shaders
// ============================================================
export const trailVS = `
attribute float life;
varying float vLife;

void main() {
    vLife = life;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = (1.0 + life * 2.0) * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
}
`;

export const trailFS = `
varying float vLife;
uniform vec3 color;

void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    if (d > 0.5) discard;
    float strength = (1.0 - d * 2.0);
    gl_FragColor = vec4(color, strength * vLife * 0.8);
}
`;
