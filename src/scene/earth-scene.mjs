import * as THREE from "three";
import ThreeGlobe from "three-globe";
import {
  isProjectedPointVisible,
  isWorldPointVisible,
  latLngToCartesian,
} from "./geo-projection.mjs";
import { PlayerSignalAnchor } from "./player-signal-anchor.mjs";
import { createSatelliteHandshake } from "./satellite-handshake.mjs";
import {
  getSubsolarPoint,
  getViewPreset,
  selectBestLitInitialPreset,
} from "./view-presets.mjs";

const EARTH_IMAGE = "./assets/earth-blue-marble.jpg";
const EARTH_BUMP = "./assets/earth-topology.png";
const CLOUD_IMAGE = "./assets/clouds.png";
const GLOBE_RADIUS = 100;
const ANCHOR_PROJECTION_RADIUS = 101.8;
const LOOK_AT = new THREE.Vector3(0, 0, 0);
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const REDUCED_CAMERA_DURATION = 600;
const INITIAL_EARTH_ROTATION = -0.58;
const HOME_ROTATION_SPEED = 0.045;
const NIGHT_ROTATION_DELTA = Math.PI * 0.7;
const DAY_ATMOSPHERE_OPACITY = 0.29;
const NIGHT_ATMOSPHERE_OPACITY = 0.18;

const DAY_VISUAL_STATE = Object.freeze({
  exposure: 1.28,
  sun: 2.45,
  fill: 1.5,
  oceanFill: 1.65,
  emissive: 0.32,
});

const NIGHT_VISUAL_STATE = Object.freeze({
  exposure: 0.9,
  sun: 0.68,
  fill: 1.12,
  oceanFill: 0.48,
  emissive: 0.17,
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
  renderer.setClearColor(0x020611, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = DAY_VISUAL_STATE.exposure;
  if ("outputColorSpace" in renderer) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  stage.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x030812, 0.00046);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1200);
  const initialBounds = stage.getBoundingClientRect();
  const initialAspect = Math.max(1, initialBounds.width) / Math.max(1, initialBounds.height);
  const initialFraming = selectBestLitInitialPreset(new Date(), { aspect: initialAspect });
  camera.position
    .set(...initialFraming.camera)
    .applyAxisAngle(WORLD_UP, INITIAL_EARTH_ROTATION);
  camera.lookAt(LOOK_AT);

  const earthGroup = new THREE.Group();
  earthGroup.rotation.y = INITIAL_EARTH_ROTATION;
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
  globeMaterial.color = new THREE.Color(0xf0f5f6);
  globeMaterial.emissive = new THREE.Color(0x102b40);
  globeMaterial.emissiveIntensity = DAY_VISUAL_STATE.emissive;
  globeMaterial.shininess = 0.7;
  earthGroup.add(globe);

  const atmosphere = createAtmosphere();
  earthGroup.add(atmosphere);

  const clouds = createClouds();
  earthGroup.add(clouds);

  const orbitalNetwork = createOrbitalNetwork();
  earthGroup.add(orbitalNetwork);
  const playerSignalAnchor = new PlayerSignalAnchor(earthGroup);
  let signalLiveliness = 0;
  let connectionLivelinessActive = false;
  let handshakeLivelinessActive = false;
  let signalLivelinessTarget = 0;
  const handshakeVisual = createHandshakeVisual(earthGroup, orbitalNetwork, {
    onActiveChange(active) {
      handshakeLivelinessActive = active;
      refreshSignalLivelinessTarget();
    },
  });

  const stars = createStars();
  scene.add(stars);
  const { sun, fill, oceanFill } = addLights(scene);
  applySolarLighting(sun, new Date(), earthGroup.rotation.y);

  let frameId = 0;
  let isRunning = false;
  let rotationSpeed = HOME_ROTATION_SPEED;
  let activeTween = null;
  let activeVisualTween = null;
  let visualFactor = 0;
  let dayRotation = null;
  let nightRotation = null;
  let targetVisualMode = "day";
  let nightRotationLocked = false;
  let locationRotationLocked = false;
  let activeEarthTween = null;
  let ambientMotionPaused = document.hidden;
  const projectionSubscribers = new Set();

  const satelliteHandshake = createSatelliteHandshake({
    focusLocation,
    onAcquireSatellite: ({ location }) => handshakeVisual.begin(location),
    onAnchorState: (state, location) => playerSignalAnchor.setState(state, location),
    onDownlink: () => handshakeVisual.showDownlink(),
    onReturnPulse: ({ animated }) => {
      handshakeVisual.hideDownlink();
      playerSignalAnchor.pulseOnce({
        duration: animated ? 760 : 0,
        reducedMotion: !animated,
        variant: "identity",
      });
    },
    onComplete: () => handshakeVisual.finish(),
    onCancel: () => {
      handshakeVisual.finish();
      playerSignalAnchor.clear();
    },
  });

  const clock = new THREE.Clock();

  function resize() {
    const { width, height } = stage.getBoundingClientRect();
    const nextWidth = Math.max(1, width);
    const nextHeight = Math.max(1, height);
    camera.aspect = nextWidth / nextHeight;
    camera.updateProjectionMatrix();
    const isNarrow = nextWidth < 680 || camera.aspect < 0.82;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isNarrow ? 1.25 : 1.6));
    renderer.setSize(nextWidth, nextHeight, false);
    setResponsiveComplexity({ orbitalNetwork, stars }, isNarrow);
  }

  function render() {
    const delta = clock.getDelta();
    const elapsed = clock.elapsedTime;
    const ambientDelta = ambientMotionPaused ? 0 : Math.min(delta, 0.05);

    if (!nightRotationLocked && !locationRotationLocked) {
      earthGroup.rotation.y += ambientDelta * rotationSpeed;
    }

    clouds.rotation.y += ambientDelta * 0.024;
    updateOrbitalNetwork(orbitalNetwork, ambientDelta, elapsed);
    handshakeVisual.update();
    updateTween();
    updateVisualTween();
    updateSignalLiveliness(ambientDelta);
    updateEarthTween();
    playerSignalAnchor.update(performance.now());
    notifyProjectionSubscribers();

    renderer.render(scene, camera);
    if (isRunning) {
      frameId = requestAnimationFrame(render);
    }
  }

  function start() {
    if (isRunning) {
      return;
    }

    isRunning = true;
    stage.dataset.sceneReady = "true";
    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    if (isRunning) {
      frameId = requestAnimationFrame(render);
    }
  }

  function stop() {
    if (!isRunning) {
      return;
    }
    isRunning = false;
    cancelAnimationFrame(frameId);
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    satelliteHandshake.abortPlayerSignalHandshake();
  }

  function handleVisibilityChange() {
    ambientMotionPaused = document.hidden;
    if (!ambientMotionPaused) {
      clock.getDelta();
    }
  }

  function focus(options = {}) {
    const reducedMotion = options.reducedMotion ?? prefersReducedMotion();
    setConnectionLiveliness(true);
    return applyViewPreset("connection", { reducedMotion });
  }

  function home(options = {}) {
    const reducedMotion = options.reducedMotion ?? prefersReducedMotion();
    setConnectionLiveliness(false);
    locationRotationLocked = false;
    return applyViewPreset("home", { reducedMotion });
  }

  function setConnectionLiveliness(active) {
    connectionLivelinessActive = Boolean(active);
    refreshSignalLivelinessTarget();
  }

  function refreshSignalLivelinessTarget() {
    signalLivelinessTarget = connectionLivelinessActive || handshakeLivelinessActive ? 1 : 0;
  }

  function applyViewPreset(name, { duration, reducedMotion = false } = {}) {
    const preset = getViewPreset(name, { aspect: camera.aspect });
    if (name !== "location-focus") {
      locationRotationLocked = false;
      if (activeEarthTween) {
        const { resolve } = activeEarthTween;
        activeEarthTween = null;
        resolve();
      }
    }
    const presetCamera = new THREE.Vector3(...preset.camera);
    const target = name === "connection"
      ? camera.position.clone().normalize().multiplyScalar(presetCamera.length())
      : presetCamera;
    return tweenCamera(
      target,
      reducedMotion
        ? Math.min(duration ?? preset.duration, REDUCED_CAMERA_DURATION)
        : (duration ?? preset.duration),
      preset.rotationSpeed,
    );
  }

  async function applyInitialFraming({
    date = new Date(),
    reducedMotion = prefersReducedMotion(),
    duration = 0,
  } = {}) {
    const framing = selectBestLitInitialPreset(date, { aspect: camera.aspect });
    const target = new THREE.Vector3(...framing.camera).applyAxisAngle(WORLD_UP, earthGroup.rotation.y);
    applySolarLighting(sun, date, earthGroup.rotation.y);
    await tweenCamera(target, reducedMotion ? 0 : duration);
    return framing;
  }

  async function focusLocation(location, { reducedMotion = false, duration } = {}) {
    const point = latLngToVector(location.latitude, location.longitude, GLOBE_RADIUS);
    locationRotationLocked = true;
    const locationPreset = getViewPreset("location-focus", { aspect: camera.aspect });
    const targetCamera = point
      .normalize()
      .multiplyScalar(new THREE.Vector3(...locationPreset.camera).length())
      .applyAxisAngle(WORLD_UP, earthGroup.rotation.y);
    await tweenCamera(
      targetCamera,
      reducedMotion
        ? Math.min(duration ?? locationPreset.duration, REDUCED_CAMERA_DURATION)
        : (duration ?? locationPreset.duration),
      locationPreset.rotationSpeed,
    );
  }

  function setPlayerLocation(location) {
    if (!location || !Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude))) {
      playerSignalAnchor.clear();
      return;
    }
    playerSignalAnchor.setLocation(location);
  }

  function pulsePlayerSignal(options) {
    playerSignalAnchor.pulseOnce(options);
  }

  function establishPlayerSignal(location, options = {}) {
    return satelliteHandshake.establishPlayerSignal(location, {
      ...options,
      reducedMotion: options.reducedMotion ?? prefersReducedMotion(),
    });
  }

  function subscribeLocationProjection(location, callback) {
    const subscription = { location, callback };
    projectionSubscribers.add(subscription);
    callback(projectLocation(location));
    return () => projectionSubscribers.delete(subscription);
  }

  function projectLocation(location) {
    const local = latLngToCartesian(location.latitude, location.longitude, ANCHOR_PROJECTION_RADIUS);
    const world = new THREE.Vector3(local.x, local.y, local.z).applyMatrix4(earthGroup.matrixWorld);
    const projected = world.clone().project(camera);
    const bounds = stage.getBoundingClientRect();
    return {
      x: (projected.x * 0.5 + 0.5) * bounds.width,
      y: (-projected.y * 0.5 + 0.5) * bounds.height,
      visible: isProjectedPointVisible(projected)
        && isWorldPointVisible(world, camera.position),
    };
  }

  function notifyProjectionSubscribers() {
    if (projectionSubscribers.size === 0) {
      return;
    }
    earthGroup.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    for (const { location, callback } of projectionSubscribers) {
      callback(projectLocation(location));
    }
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

  function resetToDay() {
    settleActiveVisualTween();
    targetVisualMode = "day";
    nightRotationLocked = false;
    applyVisualState(0, dayRotation ?? earthGroup.rotation.y);
    dayRotation = null;
    nightRotation = null;
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

  function tweenCamera(target, duration, targetRotationSpeed = rotationSpeed) {
    const from = camera.position.clone();
    const fromRotationSpeed = rotationSpeed;
    const fromDirection = from.clone().normalize();
    const targetDirection = target.clone().normalize();
    const turnQuaternion = new THREE.Quaternion().setFromUnitVectors(fromDirection, targetDirection);

    if (activeTween?.resolve) {
      activeTween.resolve();
    }

    if (duration === 0) {
      camera.position.copy(target);
      camera.lookAt(LOOK_AT);
      rotationSpeed = targetRotationSpeed;
      activeTween = null;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      activeTween = {
        from,
        target: target.clone(),
        fromDirection,
        turnQuaternion,
        fromDistance: from.length(),
        targetDistance: target.length(),
        fromRotationSpeed,
        targetRotationSpeed,
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
    const turn = new THREE.Quaternion().identity().slerp(activeTween.turnQuaternion, eased);
    const distance = THREE.MathUtils.lerp(
      activeTween.fromDistance,
      activeTween.targetDistance,
      eased,
    );
    camera.position
      .copy(activeTween.fromDirection)
      .applyQuaternion(turn)
      .multiplyScalar(distance);
    camera.lookAt(LOOK_AT);
    rotationSpeed = THREE.MathUtils.lerp(
      activeTween.fromRotationSpeed,
      activeTween.targetRotationSpeed,
      eased,
    );

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

  function tweenEarthRotation(target, duration) {
    if (activeEarthTween?.resolve) {
      activeEarthTween.resolve();
    }
    if (duration === 0) {
      earthGroup.rotation.y = target;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      activeEarthTween = {
        from: earthGroup.rotation.y,
        target,
        startedAt: performance.now(),
        duration,
        fromRotationSpeed,
        targetRotationSpeed,
        resolve,
      };
    });
  }

  function updateEarthTween() {
    if (!activeEarthTween) {
      return;
    }
    const progress = Math.min((performance.now() - activeEarthTween.startedAt) / activeEarthTween.duration, 1);
    earthGroup.rotation.y = THREE.MathUtils.lerp(activeEarthTween.from, activeEarthTween.target, easeInOutCubic(progress));
    if (progress >= 1) {
      const { resolve } = activeEarthTween;
      activeEarthTween = null;
      resolve();
    }
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

  function updateSignalLiveliness(delta) {
    const response = signalLivelinessTarget > signalLiveliness ? 7 : 4;
    const blend = 1 - Math.exp(-Math.max(0, delta) * response);
    signalLiveliness = THREE.MathUtils.lerp(
      signalLiveliness,
      signalLivelinessTarget,
      blend,
    );

    renderer.toneMappingExposure = interpolateVisualValue("exposure", visualFactor)
      + signalLiveliness * 0.045;
    fill.intensity = interpolateVisualValue("fill", visualFactor)
      + signalLiveliness * 0.14;
    oceanFill.intensity = interpolateVisualValue("oceanFill", visualFactor)
      + signalLiveliness * 0.42;
    globeMaterial.emissiveIntensity = interpolateVisualValue("emissive", visualFactor)
      + signalLiveliness * 0.072;
    atmosphere.material.opacity = THREE.MathUtils.lerp(
      DAY_ATMOSPHERE_OPACITY,
      NIGHT_ATMOSPHERE_OPACITY,
      visualFactor,
    ) + signalLiveliness * 0.045;
  }

  return {
    start,
    stop,
    focus,
    home,
    setConnectionLiveliness,
    toNight,
    toDay,
    resetToDay,
    skipTransition,
    applyInitialFraming,
    applyViewPreset,
    focusLocation,
    setPlayerLocation,
    pulsePlayerSignal,
    establishPlayerSignal,
    abortPlayerSignalHandshake: satelliteHandshake.abortPlayerSignalHandshake,
    subscribeLocationProjection,
  };
}

function addLights(scene) {
  const sun = new THREE.DirectionalLight(0xfff7ef, DAY_VISUAL_STATE.sun);
  sun.position.set(-145, 105, 170);
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x9bb1c2, DAY_VISUAL_STATE.fill);
  fill.position.set(180, -35, -105);
  scene.add(fill);

  const oceanFill = new THREE.DirectionalLight(0x6f9eb5, DAY_VISUAL_STATE.oceanFill);
  oceanFill.position.set(18, 46, 260);
  scene.add(oceanFill);

  scene.add(new THREE.AmbientLight(0xafbec5, 0.9));

  return { sun, fill, oceanFill };
}

function createAtmosphere() {
  const geometry = new THREE.SphereGeometry(GLOBE_RADIUS * 1.028, 96, 96);
  const material = new THREE.MeshBasicMaterial({
    color: 0x91d7e8,
    transparent: true,
    opacity: DAY_ATMOSPHERE_OPACITY,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const atmosphere = new THREE.Mesh(geometry, material);
  atmosphere.position.set(-0.9, 0.35, 0.5);
  atmosphere.scale.set(1.012, 1, 1.006);
  return atmosphere;
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
      if (planeIndex === 0 && index === 0) {
        network.userData.handshakeSatellite = satellite;
      }
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

  const uplinks = createUplinkNetwork();
  uplinks.name = "ambient-uplinks";
  network.add(uplinks);

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

function createHandshakeVisual(earthGroup, orbitalNetwork, { onActiveChange } = {}) {
  const satellite = orbitalNetwork.userData.handshakeSatellite;
  const baseScale = satellite.scale.clone();
  const materialStates = satellite.children.map((child) => {
    child.material = child.material.clone();
    return {
      material: child.material,
      color: child.material.color.clone(),
      opacity: child.material.opacity,
    };
  });
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(6), 3));
  const line = new THREE.Line(
    lineGeometry,
    new THREE.LineBasicMaterial({
      color: 0x9eeeff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  line.visible = false;
  earthGroup.add(line);

  const cityPoint = new THREE.Vector3();
  const satellitePoint = new THREE.Vector3();
  let active = false;
  let acquiredAt = 0;

  function begin(location) {
    const point = latLngToCartesian(location.latitude, location.longitude, ANCHOR_PROJECTION_RADIUS);
    cityPoint.set(point.x, point.y, point.z);
    active = true;
    onActiveChange?.(true);
    acquiredAt = performance.now();
    line.visible = false;
    materialStates.forEach(({ material }, index) => {
      material.color.set(index === 1 ? 0xd9fbff : 0x73dff5);
      material.opacity = index === 1 ? 1 : 0.78;
    });
  }

  function update() {
    if (!active) {
      return;
    }
    const pulse = 1 + Math.sin((performance.now() - acquiredAt) * 0.012) * 0.08;
    satellite.scale.copy(baseScale).multiplyScalar(pulse);
    satellite.getWorldPosition(satellitePoint);
    earthGroup.worldToLocal(satellitePoint);
    const positions = line.geometry.attributes.position;
    positions.setXYZ(0, cityPoint.x, cityPoint.y, cityPoint.z);
    positions.setXYZ(1, satellitePoint.x, satellitePoint.y, satellitePoint.z);
    positions.needsUpdate = true;
  }

  function showDownlink() {
    line.visible = true;
    line.material.opacity = 0.24;
  }

  function hideDownlink() {
    line.visible = false;
    line.material.opacity = 0;
  }

  function finish() {
    active = false;
    onActiveChange?.(false);
    hideDownlink();
    satellite.scale.copy(baseScale);
    materialStates.forEach(({ material, color, opacity }) => {
      material.color.copy(color);
      material.opacity = opacity;
    });
  }

  return Object.freeze({ begin, update, showDownlink, hideDownlink, finish });
}

function updateOrbitalNetwork(network, delta, elapsed) {
  if (delta === 0) {
    return;
  }
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
  const point = latLngToCartesian(lat, lng, radius);
  return new THREE.Vector3(point.x, point.y, point.z);
}

function easeInOutCubic(value) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function setResponsiveComplexity({ orbitalNetwork, stars }, isNarrow) {
  const planes = orbitalNetwork.userData.orbitPlanes;
  if (planes[2]) {
    planes[2].visible = !isNarrow;
  }
  const uplinks = orbitalNetwork.getObjectByName("ambient-uplinks");
  if (uplinks) {
    uplinks.visible = !isNarrow;
  }
  stars.geometry.setDrawRange(0, isNarrow ? 420 : 900);
}

function applySolarLighting(sun, date, earthRotation) {
  const subsolar = getSubsolarPoint(date);
  const local = latLngToCartesian(subsolar.latitude, subsolar.longitude, 1);
  sun.position
    .set(local.x, local.y, local.z)
    .applyAxisAngle(WORLD_UP, earthRotation)
    .multiplyScalar(300);
}

function nearestAngle(from, target) {
  const fullTurn = Math.PI * 2;
  const delta = ((target - from + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
  return from + delta;
}

function validateTransitionDuration(duration) {
  if (!Number.isFinite(duration) || duration < 0) {
    throw new RangeError("Transition duration must be finite and nonnegative");
  }
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}
