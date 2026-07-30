import * as THREE from "three";
import { latLngToCartesian } from "./geo-projection.mjs";

const ANCHOR_RADIUS = 101.8;
const ANCHOR_STATES = new Set(["hidden", "acquiring", "awake"]);
const WARM_WHITE = 0xfff7df;
const MICRO_GOLD = 0xffd991;

export class PlayerSignalAnchor {
  constructor(parent) {
    this.group = new THREE.Group();
    this.group.name = "player-signal-anchor";
    this.group.visible = false;
    this.state = "hidden";
    this.activePulse = null;

    this.coreMaterial = new THREE.MeshBasicMaterial({
      color: WARM_WHITE,
      transparent: true,
      opacity: 1,
      depthTest: true,
    });
    this.core = new THREE.Mesh(new THREE.SphereGeometry(0.52, 20, 20), this.coreMaterial);
    this.glowMaterial = new THREE.MeshBasicMaterial({
      color: MICRO_GOLD,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });
    this.glow = new THREE.Mesh(
      new THREE.SphereGeometry(1.35, 24, 24),
      this.glowMaterial,
    );
    const hitTarget = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 16, 16),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    hitTarget.name = "player-signal-hit-target";
    hitTarget.userData.playerSignalTarget = true;
    this.group.add(this.core, this.glow, hitTarget);
    parent.add(this.group);
  }

  setLocation(location) {
    const point = latLngToCartesian(location.latitude, location.longitude, ANCHOR_RADIUS);
    const normal = new THREE.Vector3(point.x, point.y, point.z).normalize();
    this.group.position.set(point.x, point.y, point.z);
    this.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    if (this.state === "hidden") {
      this.setState("awake");
    }
  }

  setState(state, location) {
    if (!ANCHOR_STATES.has(state)) {
      throw new RangeError(`unknown player signal state: ${state}`);
    }
    if (location) {
      const point = latLngToCartesian(location.latitude, location.longitude, ANCHOR_RADIUS);
      const normal = new THREE.Vector3(point.x, point.y, point.z).normalize();
      this.group.position.set(point.x, point.y, point.z);
      this.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    }

    this.state = state;
    this.group.visible = state !== "hidden";
    this.coreMaterial.opacity = state === "acquiring" ? 0.34 : 1;
    this.glowMaterial.opacity = state === "acquiring" ? 0.08 : 0.18;
    if (state === "hidden") {
      this.clearPulse();
    }
  }

  clear() {
    this.setState("hidden");
  }

  pulseOnce({ duration = 900, reducedMotion = false, variant = "location" } = {}) {
    this.clearPulse();
    if (!this.group.visible || reducedMotion) {
      return;
    }

    const material = new THREE.MeshBasicMaterial({
      color: variant === "identity" ? WARM_WHITE : MICRO_GOLD,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.08, 48), material);
    const secondMesh = new THREE.Mesh(mesh.geometry.clone(), material.clone());
    secondMesh.material.color.set(MICRO_GOLD);
    mesh.position.z = 0.05;
    secondMesh.position.z = 0.045;
    this.group.add(mesh, secondMesh);
    this.activePulse = {
      mesh,
      secondMesh,
      startedAt: performance.now(),
      duration: Math.max(1, duration),
    };
  }

  update(now = performance.now()) {
    if (this.state === "awake") {
      this.glowMaterial.opacity = 0.17 + Math.sin(now * 0.0024) * 0.035;
    }
    if (!this.activePulse) {
      return;
    }

    const progress = Math.min((now - this.activePulse.startedAt) / this.activePulse.duration, 1);
    updateRing(this.activePulse.mesh, progress);
    updateRing(this.activePulse.secondMesh, (progress - 0.16) / 0.84);
    if (progress >= 1) {
      this.clearPulse();
    }
  }

  getWorldPosition(target = new THREE.Vector3()) {
    return this.group.getWorldPosition(target);
  }

  clearPulse() {
    if (!this.activePulse) {
      return;
    }
    const activePulse = this.activePulse;
    this.group.remove(activePulse.mesh);
    this.group.remove(activePulse.secondMesh);
    activePulse.mesh.geometry.dispose();
    activePulse.mesh.material.dispose();
    activePulse.secondMesh.geometry.dispose();
    activePulse.secondMesh.material.dispose();
    this.activePulse = null;
  }

  dispose() {
    this.clearPulse();
    for (const child of this.group.children) {
      child.geometry?.dispose();
      child.material?.dispose();
    }
    this.group.removeFromParent();
  }
}

function updateRing(mesh, progress) {
  const boundedProgress = Math.min(Math.max(progress, 0), 1);
  mesh.visible = progress >= 0;
  mesh.scale.setScalar(1 + boundedProgress * 4.2);
  mesh.material.opacity = 0.68 * (1 - boundedProgress);
}
