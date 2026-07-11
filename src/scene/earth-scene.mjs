import * as THREE from "three";
import ThreeGlobe from "https://esm.sh/three-globe";

const EARTH_IMAGE = "./assets/earth-blue-marble.jpg";
const EARTH_BUMP = "./assets/earth-topology.png";
const CLOUD_IMAGE = "./assets/clouds.png";
const GLOBE_RADIUS = 100;
const HOME_CAMERA = new THREE.Vector3(0, 42, 285);
const FOCUS_CAMERA = new THREE.Vector3(38, 18, 172);
const LOOK_AT = new THREE.Vector3(0, 0, 0);
const FOCUS_DURATION_MS = 1350;
const NIGHT_ROTATION_DELTA = Math.PI * 0.7;
const DAY_ATMOSPHERE_OPACITY = 0.29;
const NIGHT_ATMOSPHERE_OPACITY = 0.18;

const DAY_VISUAL_STATE = Object.freeze({
  exposure: 1.2,
  sun: 2.65,
  fill: 1.18,
  oceanFill: 1.25,
  emissive: 0.3,
});

const NIGHT_VISUAL_STATE = Object.freeze({
  exposure: 0.82,
  sun: 0.58,
  fill: 1.42,
  oceanFill: 0.5,
  emissive: 0.16,
});

const ORBIT_PLANES = Object.freeze([
  { radius: 145, tiltX: 1.08, tiltY: 0.06, tiltZ: 0.34, count: 18, phase: 0.15, speed: 0.21, opacity: 0.16 },
  { radius: 158, tiltX: 0.78, tiltY: -0.38, tiltZ: -0.72, count: 14, phase: 0.58, speed: -0.13, opacity: 0.11 },
  { radius: 172, tiltX: 1.28, tiltY: 0.44, tiltZ: 1.08, count: 10, phase: 0.04, speed: 0.1, opacity: 0.075 },
]);

const UPLINK_CITIES = Object.freeze([
  ["Tokyo", 35.68, 139.76],
  ["Shanghai", 31.23, 121.47],
  ["Singapore", 1.35, 103.82],
  ["London", 51.51, -0.13],
  ["New York", 40.71, -74.01],
  ["Los Angeles", 34.05, -118.24],
  ["Sao Paulo", -23.55, -46.63],
]);

const CITY_LIGHTS = [
  ["Tokyo", 35.68, 139.76, 0.82],
  ["Seoul", 37.57, 126.98, 0.58],
  ["Shanghai", 31.23, 121.47, 0.72],
  ["Beijing", 39.9, 116.4, 0.56],
  ["Guangzhou", 23.13, 113.26, 0.54],
  ["Singapore", 1.35, 103.82, 0.44],
  ["Delhi", 28.61, 77.2, 0.66],
  ["Mumbai", 19.08, 72.88, 0.5],
  ["Dubai", 25.2, 55.27, 0.42],
  ["Cairo", 30.04, 31.24, 0.5],
  ["Lagos", 6.52, 3.38, 0.48],
  ["Johannesburg", -26.2, 28.04, 0.42],
  ["Moscow", 55.76, 37.62, 0.5],
  ["Istanbul", 41.01, 28.98, 0.46],
  ["London", 51.51, -0.13, 0.5],
  ["Paris", 48.86, 2.35, 0.46],
  ["Berlin", 52.52, 13.4, 0.42],
  ["Madrid", 40.42, -3.7, 0.4],
  ["New York", 40.71, -74.01, 0.62],
  ["Chicago", 41.88, -87.63, 0.46],
  ["Los Angeles", 34.05, -118.24, 0.52],
  ["Mexico City", 19.43, -99.13, 0.5],
  ["Sao Paulo", -23.55, -46.63, 0.56],
  ["Buenos Aires", -34.6, -58.38, 0.44],
];

export function createEarthScene(stage) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x020611, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  if ("outputColorSpace" in renderer) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  stage.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x030812, 0.00046);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1200);
  camera.position.copy(HOME_CAMERA);
  camera.lookAt(LOOK_AT);

  const earthGroup = new THREE.Group();
  earthGroup.rotation.y = -0.58;
  scene.add(earthGroup);

  const globe = new ThreeGlobe({ waitForGlobeReady: false, animateIn: false })
    .globeImageUrl(EARTH_IMAGE)
    .bumpImageUrl(EARTH_BUMP)
    .showAtmosphere(false)
    .pointLat("lat")
    .pointLng("lng")
    .pointAltitude("altitude")
    .pointRadius("radius")
    .pointColor("color")
    .pointsMerge(true)
    .pointsData(
      CITY_LIGHTS.map(([, lat, lng, weight]) => ({
        lat,
        lng,
        altitude: 0.01,
        radius: 0.08 + weight * 0.2,
        color: `rgba(255, ${Math.round(190 + weight * 38)}, ${Math.round(150 + weight * 48)}, ${0.48 + weight * 0.24})`,
      })),
    );

  const globeMaterial = globe.globeMaterial();
  globeMaterial.color = new THREE.Color(0xf6fbff);
  globeMaterial.emissive = new THREE.Color(0x15385c);
  globeMaterial.emissiveIntensity = DAY_VISUAL_STATE.emissive;
  globeMaterial.shininess = 3;
  earthGroup.add(globe);

  const atmosphere = createAtmosphere();
  earthGroup.add(atmosphere);

  const clouds = createClouds();
  earthGroup.add(clouds);

  const orbitalNetwork = createOrbitalNetwork();
  earthGroup.add(orbitalNetwork);

  scene.add(createStars());
  const { sun, fill, oceanFill } = addLights(scene);

  let frameId = 0;
  let isRunning = false;
  let idleRotation = true;
  let activeTween = null;
  let activeVisualTween = null;
  let visualFactor = 0;
  let dayRotation = null;
  let nightRotation = null;
  let targetVisualMode = "day";
  let nightRotationLocked = false;

  const clock = new THREE.Clock();

  function resize() {
    const { width, height } = stage.getBoundingClientRect();
    const nextWidth = Math.max(1, width);
    const nextHeight = Math.max(1, height);
    camera.aspect = nextWidth / nextHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(nextWidth, nextHeight, false);
  }

  function render() {
    const delta = clock.getDelta();
    const elapsed = clock.elapsedTime;

    if (idleRotation && !nightRotationLocked) {
      earthGroup.rotation.y += delta * 0.045;
    }

    clouds.rotation.y += delta * 0.024;
    updateOrbitalNetwork(orbitalNetwork, delta, elapsed);
    updateTween();
    updateVisualTween();

    renderer.render(scene, camera);
    frameId = requestAnimationFrame(render);
  }

  function start() {
    if (isRunning) {
      return;
    }

    isRunning = true;
    stage.dataset.sceneReady = "true";
    resize();
    window.addEventListener("resize", resize);
    frameId = requestAnimationFrame(render);
  }

  function focus() {
    idleRotation = false;
    return tweenCamera(FOCUS_CAMERA, FOCUS_DURATION_MS);
  }

  function home() {
    idleRotation = true;
    tweenCamera(HOME_CAMERA, 900);
  }

  function toNight(duration = 1300) {
    validateTransitionDuration(duration);
    settleActiveVisualTween();

    if (dayRotation === null) {
      dayRotation = earthGroup.rotation.y;
    }

    if (nightRotation === null) {
      nightRotation = dayRotation + NIGHT_ROTATION_DELTA;
    }

    targetVisualMode = "night";
    nightRotationLocked = true;
    return startVisualTween(1, nightRotation, duration, () => {});
  }

  function toDay(duration = 700) {
    validateTransitionDuration(duration);
    settleActiveVisualTween();

    if (dayRotation === null) {
      return Promise.resolve();
    }

    targetVisualMode = "day";
    nightRotationLocked = true;
    return startVisualTween(0, dayRotation, duration, () => {
      if (targetVisualMode === "day") {
        nightRotationLocked = false;
        dayRotation = null;
        nightRotation = null;
      }
    });
  }

  function skipTransition() {
    if (!activeVisualTween) {
      return;
    }

    const tween = activeVisualTween;
    activeVisualTween = null;
    applyVisualState(tween.targetFactor, tween.targetRotation);
    tween.onComplete();
    tween.resolve();
  }

  function tweenCamera(target, duration) {
    const from = camera.position.clone();

    if (activeTween?.resolve) {
      activeTween.resolve();
    }

    return new Promise((resolve) => {
      activeTween = {
        from,
        target: target.clone(),
        startedAt: performance.now(),
        duration,
        resolve,
      };
    });
  }

  function updateTween() {
    if (!activeTween) {
      return;
    }

    const progress = Math.min((performance.now() - activeTween.startedAt) / activeTween.duration, 1);
    const eased = easeInOutCubic(progress);
    camera.position.lerpVectors(activeTween.from, activeTween.target, eased);
    camera.lookAt(LOOK_AT);

    if (progress >= 1) {
      const { resolve } = activeTween;
      activeTween = null;
      resolve();
    }
  }

  function startVisualTween(targetFactor, targetRotation, duration, onComplete) {
    if (duration === 0) {
      applyVisualState(targetFactor, targetRotation);
      onComplete();
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      activeVisualTween = {
        fromFactor: visualFactor,
        targetFactor,
        fromRotation: earthGroup.rotation.y,
        targetRotation,
        startedAt: performance.now(),
        duration,
        onComplete,
        resolve,
      };
    });
  }

  function settleActiveVisualTween() {
    if (!activeVisualTween) {
      return;
    }

    updateVisualTween();
    if (!activeVisualTween) {
      return;
    }

    const tween = activeVisualTween;
    activeVisualTween = null;
    tween.resolve();
  }

  function updateVisualTween() {
    if (!activeVisualTween) {
      return;
    }

    const tween = activeVisualTween;
    const progress = Math.min((performance.now() - tween.startedAt) / tween.duration, 1);
    const eased = easeInOutCubic(progress);
    const nextFactor = THREE.MathUtils.lerp(tween.fromFactor, tween.targetFactor, eased);
    const nextRotation = THREE.MathUtils.lerp(tween.fromRotation, tween.targetRotation, eased);
    applyVisualState(nextFactor, nextRotation);

    if (progress >= 1) {
      activeVisualTween = null;
      tween.onComplete();
      tween.resolve();
    }
  }

  function applyVisualState(factor, rotation) {
    visualFactor = factor;
    earthGroup.rotation.y = rotation;
    renderer.toneMappingExposure = interpolateVisualValue("exposure", factor);
    sun.intensity = interpolateVisualValue("sun", factor);
    fill.intensity = interpolateVisualValue("fill", factor);
    oceanFill.intensity = interpolateVisualValue("oceanFill", factor);
    globeMaterial.emissiveIntensity = interpolateVisualValue("emissive", factor);
    atmosphere.material.opacity = THREE.MathUtils.lerp(
      DAY_ATMOSPHERE_OPACITY,
      NIGHT_ATMOSPHERE_OPACITY,
      factor,
    );
  }

  function interpolateVisualValue(property, factor) {
    return THREE.MathUtils.lerp(DAY_VISUAL_STATE[property], NIGHT_VISUAL_STATE[property], factor);
  }

  return { start, focus, home, toNight, toDay, skipTransition };
}

function addLights(scene) {
  const sun = new THREE.DirectionalLight(0xfff7ef, 2.65);
  sun.position.set(-145, 105, 170);
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x7fa8d8, 1.18);
  fill.position.set(180, -35, -105);
  scene.add(fill);

  const oceanFill = new THREE.DirectionalLight(0x5daaff, 1.25);
  oceanFill.position.set(18, 46, 260);
  scene.add(oceanFill);

  scene.add(new THREE.AmbientLight(0x8ca6c6, 1.04));

  return { sun, fill, oceanFill };
}

function createAtmosphere() {
  const geometry = new THREE.SphereGeometry(GLOBE_RADIUS * 1.028, 96, 96);
  const material = new THREE.MeshBasicMaterial({
    color: 0x8fdcff,
    transparent: true,
    opacity: DAY_ATMOSPHERE_OPACITY,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Mesh(geometry, material);
}

function createClouds() {
  const geometry = new THREE.SphereGeometry(GLOBE_RADIUS * 1.012, 96, 96);
  const material = new THREE.MeshPhongMaterial({
    color: 0xe9f0f3,
    transparent: true,
    opacity: 0.27,
    depthWrite: false,
  });

  new THREE.TextureLoader().load(
    CLOUD_IMAGE,
    (texture) => {
      material.map = texture;
      material.needsUpdate = true;
    },
    undefined,
    () => {
      material.opacity = 0.12;
      material.needsUpdate = true;
    },
  );

  return new THREE.Mesh(geometry, material);
}

function createStars() {
  const geometry = new THREE.BufferGeometry();
  const vertices = [];

  for (let index = 0; index < 900; index += 1) {
    const radius = 430 + Math.random() * 360;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
    vertices.push(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi),
    );
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xc7e8ff,
      size: 1.15,
      transparent: true,
      opacity: 0.74,
      depthWrite: false,
    }),
  );
}

function createOrbitalNetwork() {
  const network = new THREE.Group();
  network.userData.orbitPlanes = [];

  const satelliteBodyGeometry = new THREE.SphereGeometry(0.48, 12, 12);
  const satellitePanelGeometry = new THREE.BoxGeometry(0.045, 0.28, 1.05);
  const pulseGeometry = new THREE.SphereGeometry(0.58, 16, 16);

  const satelliteBodyMaterial = new THREE.MeshBasicMaterial({
    color: 0xbfeeff,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const satellitePanelMaterial = new THREE.MeshBasicMaterial({
    color: 0x7fd6ef,
    transparent: true,
    opacity: 0.36,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const pulseMaterial = new THREE.MeshBasicMaterial({
    color: 0xa9efff,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  ORBIT_PLANES.forEach((plane, planeIndex) => {
    const planeGroup = new THREE.Group();
    planeGroup.rotation.set(plane.tiltX, plane.tiltY, plane.tiltZ);
    planeGroup.userData.speed = plane.speed;
    planeGroup.userData.phase = plane.phase;

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(plane.radius, 0.045, 8, 256),
      new THREE.MeshBasicMaterial({
        color: planeIndex < 2 ? 0xa7e8ff : 0x72d8ff,
        transparent: true,
        opacity: plane.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    planeGroup.add(ring);

    for (let index = 0; index < plane.count; index += 1) {
      const angle = plane.phase * Math.PI * 2 + (index / plane.count) * Math.PI * 2;
      const satellite = createSatelliteNode(satelliteBodyGeometry, satellitePanelGeometry, satelliteBodyMaterial, satellitePanelMaterial);
      const sizePulse = index % 6 === 0 ? 1.05 : 0.78;
      satellite.scale.setScalar(sizePulse);
      satellite.position.set(Math.cos(angle) * plane.radius, Math.sin(angle) * plane.radius, 0);
      satellite.rotation.z = angle + Math.PI / 2;
      planeGroup.add(satellite);
    }

    for (let index = 0; index < 3; index += 1) {
      const angle = plane.phase * Math.PI * 2 + index * 1.62;
      const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
      pulse.position.set(Math.cos(angle) * plane.radius, Math.sin(angle) * plane.radius, 0);
      pulse.userData.angle = angle;
      pulse.userData.radius = plane.radius;
      pulse.userData.speed = plane.speed * 2.6 + (index + 1) * 0.12;
      pulse.scale.setScalar(0.78 + index * 0.1);
      planeGroup.add(pulse);
    }

    network.userData.orbitPlanes.push(planeGroup);
    network.add(planeGroup);
  });

  network.add(createUplinkNetwork());

  return network;
}

function createSatelliteNode(bodyGeometry, panelGeometry, bodyMaterial, panelMaterial) {
  const satellite = new THREE.Group();
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  const leftPanel = new THREE.Mesh(panelGeometry, panelMaterial);
  const rightPanel = new THREE.Mesh(panelGeometry, panelMaterial);

  leftPanel.position.x = -0.92;
  rightPanel.position.x = 0.92;
  satellite.add(leftPanel, body, rightPanel);

  return satellite;
}

function createUplinkNetwork() {
  const uplinks = new THREE.Group();
  const uplinkMaterial = new THREE.LineBasicMaterial({
    color: 0x9eeeff,
    transparent: true,
    opacity: 0.075,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  UPLINK_CITIES.forEach(([, lat, lng], index) => {
    const start = latLngToVector(lat, lng, GLOBE_RADIUS * 1.018);
    const end = latLngToVector(lat + Math.sin(index) * 7, lng + 15 + index * 8, GLOBE_RADIUS * 1.48);
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    uplinks.add(new THREE.Line(geometry, uplinkMaterial));
  });

  return uplinks;
}

function updateOrbitalNetwork(network, delta, elapsed) {
  network.rotation.y += delta * 0.08;
  network.rotation.z = Math.sin(elapsed * 0.25) * 0.025;

  for (const planeGroup of network.userData.orbitPlanes) {
    planeGroup.rotation.z += delta * planeGroup.userData.speed;

    for (const child of planeGroup.children) {
      if (!Number.isFinite(child.userData.speed)) {
        continue;
      }

      child.userData.angle += delta * child.userData.speed;
      child.position.set(
        Math.cos(child.userData.angle) * child.userData.radius,
        Math.sin(child.userData.angle) * child.userData.radius,
        0,
      );
    }
  }
}

function latLngToVector(lat, lng, radius) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lng + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function easeInOutCubic(value) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function validateTransitionDuration(duration) {
  if (!Number.isFinite(duration) || duration < 0) {
    throw new RangeError("Transition duration must be finite and nonnegative");
  }
}
