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
  stage.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020611, 0.00095);

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
        altitude: 0.012,
        radius: 0.18 + weight * 0.36,
        color: `rgba(255, ${Math.round(168 + weight * 72)}, 108, ${0.68 + weight * 0.22})`,
      })),
    );

  globe.globeMaterial().color = new THREE.Color(0x78b9ff);
  globe.globeMaterial().emissive = new THREE.Color(0x16385d);
  globe.globeMaterial().emissiveIntensity = 0.28;
  globe.globeMaterial().shininess = 8;
  earthGroup.add(globe);

  const atmosphere = createAtmosphere();
  earthGroup.add(atmosphere);

  const clouds = createClouds();
  earthGroup.add(clouds);

  const satelliteChain = createSatelliteChain();
  earthGroup.add(satelliteChain);

  scene.add(createStars());
  addLights(scene);

  let frameId = 0;
  let isRunning = false;
  let idleRotation = true;
  let activeTween = null;

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

    if (idleRotation) {
      earthGroup.rotation.y += delta * 0.045;
    }

    clouds.rotation.y += delta * 0.024;
    satelliteChain.rotation.y += delta * 0.34;
    satelliteChain.rotation.z = Math.sin(elapsed * 0.35) * 0.045 + 0.35;
    updateTween();

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

  return { start, focus, home };
}

function addLights(scene) {
  const sun = new THREE.DirectionalLight(0xffffff, 3.1);
  sun.position.set(-120, 85, 160);
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x79baff, 1.25);
  fill.position.set(180, -30, -90);
  scene.add(fill);

  scene.add(new THREE.AmbientLight(0xb9d7ff, 1.28));
}

function createAtmosphere() {
  const geometry = new THREE.SphereGeometry(GLOBE_RADIUS * 1.055, 96, 96);
  const material = new THREE.MeshBasicMaterial({
    color: 0x5ac8ff,
    transparent: true,
    opacity: 0.16,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Mesh(geometry, material);
}

function createClouds() {
  const geometry = new THREE.SphereGeometry(GLOBE_RADIUS * 1.012, 96, 96);
  const material = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.42,
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

function createSatelliteChain() {
  const chain = new THREE.Group();
  chain.rotation.x = 1.08;
  chain.rotation.z = 0.35;

  const orbit = new THREE.Mesh(
    new THREE.TorusGeometry(GLOBE_RADIUS * 1.43, 0.095, 8, 192),
    new THREE.MeshBasicMaterial({
      color: 0x73d7ff,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  chain.add(orbit);

  const satelliteMaterial = new THREE.MeshBasicMaterial({
    color: 0xdaf8ff,
    transparent: true,
    opacity: 0.86,
  });
  const trailMaterial = new THREE.MeshBasicMaterial({
    color: 0x5ac8ff,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
  });

  for (let index = 0; index < 7; index += 1) {
    const angle = index * 0.18;
    const satellite = new THREE.Mesh(new THREE.SphereGeometry(index === 0 ? 1.8 : 1.05, 16, 16), index === 0 ? satelliteMaterial : trailMaterial);
    satellite.position.set(Math.cos(angle) * GLOBE_RADIUS * 1.43, Math.sin(angle) * GLOBE_RADIUS * 1.43, 0);
    chain.add(satellite);
  }

  return chain;
}

function easeInOutCubic(value) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}
