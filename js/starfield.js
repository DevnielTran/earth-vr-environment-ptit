// Procedural Starfield Generator
// Creates a realistic star field in the background

function createStarfield() {
  // Create star field using Points geometry
  var starsGeometry = new THREE.BufferGeometry();
  var starCount = 2000; // Number of stars

  var positions = new Float32Array(starCount * 3);
  var colors = new Float32Array(starCount * 3);
  var sizes = new Float32Array(starCount);

  for (var i = 0; i < starCount * 3; i += 3) {
    // Random position in a sphere
    var theta = Math.random() * Math.PI * 2;
    var phi = Math.random() * Math.PI;
    var radius = 4500 + Math.random() * 500; // Far away

    positions[i] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i + 1] = radius * Math.cos(phi);
    positions[i + 2] = radius * Math.sin(phi) * Math.sin(theta);

    // Star color variation (white to blue-white to yellow-white)
    var colorVariation = Math.random();
    if (colorVariation < 0.1) {
      // Blue stars (10%)
      colors[i] = 0.7;
      colors[i + 1] = 0.8;
      colors[i + 2] = 1.0;
    } else if (colorVariation < 0.2) {
      // Yellow-white stars (10%)
      colors[i] = 1.0;
      colors[i + 1] = 0.95;
      colors[i + 2] = 0.8;
    } else {
      // White stars (80%)
      var brightness = 0.7 + Math.random() * 0.3;
      colors[i] = brightness;
      colors[i + 1] = brightness;
      colors[i + 2] = brightness;
    }

    // Size variation - smaller stars are farther away
    sizes[i / 3] = Math.random() * 2.5 + 0.5;
  }

  starsGeometry.addAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3),
  );
  starsGeometry.addAttribute("color", new THREE.BufferAttribute(colors, 3));
  starsGeometry.addAttribute("size", new THREE.BufferAttribute(sizes, 1));

  // Create material for stars
  var starsMaterial = new THREE.PointsMaterial({
    size: 20,
    sizeAttenuation: true,
    vertexColors: THREE.VertexColors,
    transparent: true,
    opacity: 0.9,
  });

  var stars = new THREE.Points(starsGeometry, starsMaterial);
  return stars;
}

// Alternative: Enhanced skybox with more detail
function enhanceSkyboxWithStars() {
  var stars = createStarfield();
  return stars;
}
