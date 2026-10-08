import {
  Color,
  ConeGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type AnimationAction,
  type Material,
  type Object3D,
} from "three";
import type { CharacterVisual } from "@/lib/game/characters/types";
import { diamondheadClips } from "@/lib/game/characters/diamondhead/locomotion";

const RIG_KEY = "diamondheadCrystals";
const CLIP_FPS = 30;

type CrystalChip = {
  mesh: Mesh;
  direction: Vector3;
};

type CrystalRig = {
  forearm: Group;
  wrist: Group;
  fist: Group;
  charge: Group;
  chips: CrystalChip[];
};

const UP = new Vector3(0, 1, 0);
const scratchDir = new Vector3();
const scratchQuat = new Quaternion();

function smooth(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function animFrame(time: number): number {
  return time * CLIP_FPS + 1;
}

/**
 * 30 fps Crystal Punch. Frames 6–8 start the growth, 9–10 reach full size,
 * 11 is the impact pop, 12–13 hold, 14–20 retract.
 */
function punchGrowth(time: number): { body: number; fist: number } {
  const frame = animFrame(time);
  if (frame < 6) {
    return { body: 0, fist: 0 };
  }
  if (frame < 9) {
    const amount = smooth((frame - 6) / 3) * 0.55;
    return { body: amount, fist: amount };
  }
  if (frame < 11) {
    const amount = 0.55 + smooth((frame - 9) / 2) * 0.45;
    return { body: amount, fist: amount };
  }
  if (frame < 12) {
    return { body: 1, fist: 1.14 };
  }
  if (frame < 14) {
    return { body: 1, fist: 1 };
  }
  if (frame < 21) {
    const amount = 1 - smooth((frame - 14) / 7);
    return { body: amount, fist: amount };
  }
  return { body: 0, fist: 0 };
}

/** Frames 11–18 grow a small shard, 19–20 hold it, 21 hands off to the projectile. */
function chargeAmount(time: number): number {
  const frame = animFrame(time);
  if (frame < 11 || frame >= 21) {
    return 0;
  }
  if (frame < 19) {
    return smooth((frame - 11) / 8);
  }
  return 1;
}

/** 0 at the start of frame 21, 1 three frames later. Chips are gone after that. */
function burstUnit(time: number): number | null {
  const frame = animFrame(time);
  if (frame < 21 || frame >= 24) {
    return null;
  }
  return (frame - 21) / 3;
}

function crystalMaterial(color: string): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    color,
    roughness: 0.12,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    emissive: color,
    emissiveIntensity: 0.14,
    ior: 1.5,
    flatShading: true,
  });
}

/**
 * Crystal glTF materials are fully metallic, and their occlusion channel is a
 * flat 50%. With no environment map that combination renders as black and
 * hides the green base color. These are the crystal slots, not the body.
 */
const SHINY_CRYSTAL_MATERIALS = new Set([
  "Material.001",
  "Material.004",
  "Material.005",
  "Material.006",
  "Material.007",
]);

const CRYSTAL_COLOR = new Color("#49f0c0");
const CRYSTAL_EMISSIVE = new Color("#0f8f68");
const CRYSTAL_SPECULAR = new Color("#f3fffb");

function tuneMaterial(material: Material, tuned: WeakMap<Material, Material>): Material {
  const existing = tuned.get(material);
  if (existing) {
    return existing;
  }
  if (!(material instanceof MeshStandardMaterial) || material.userData.diamondheadTuned) {
    tuned.set(material, material);
    return material;
  }

  if (SHINY_CRYSTAL_MATERIALS.has(material.name)) {
    const crystal = new MeshPhysicalMaterial({
      name: material.name,
      color: CRYSTAL_COLOR,
      roughness: 0.05,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      emissive: CRYSTAL_EMISSIVE,
      emissiveIntensity: 0.28,
      ior: 2.1,
      specularIntensity: 1,
      specularColor: CRYSTAL_SPECULAR,
    });
    crystal.userData.diamondheadTuned = true;
    tuned.set(material, crystal);
    return crystal;
  }

  if (material.name === "green1") {
    material.metalness = 0;
    material.metalnessMap = null;
    material.aoMap = null;
    material.aoMapIntensity = 0;
    material.userData.diamondheadTuned = true;
    material.needsUpdate = true;
  }

  tuned.set(material, material);
  return material;
}

function polishCrystals(model: Object3D): void {
  const tuned = new WeakMap<Material, Material>();
  model.traverse((object) => {
    if (!(object instanceof Mesh) || object.name === "DH_RuntimeCrystal") {
      return;
    }
    const source = Array.isArray(object.material) ? object.material : [object.material];
    const next = source.map((material) => tuneMaterial(material, tuned));
    object.material = Array.isArray(object.material) ? next : next[0];
  });
}

function addSpike(
  parent: Object3D,
  direction: readonly [number, number, number],
  height: number,
  radius: number,
  color: string,
): Mesh {
  const mesh = new Mesh(new ConeGeometry(radius, height, 5), crystalMaterial(color));
  mesh.name = "DH_RuntimeCrystal";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  scratchDir.set(direction[0], direction[1], direction[2]);
  if (scratchDir.lengthSq() < 1e-8) {
    scratchDir.set(0, 1, 0);
  } else {
    scratchDir.normalize();
  }
  mesh.quaternion.setFromUnitVectors(UP, scratchDir);
  mesh.position.copy(scratchDir).multiplyScalar(height * 0.5);
  parent.add(mesh);
  return mesh;
}

function findNamed(model: Object3D, name: string): Object3D | null {
  let found: Object3D | null = null;
  model.traverse((object) => {
    if (!found && object.name === name) {
      found = object;
    }
  });
  return found;
}

function makeGroup(parent: Object3D, name: string): Group {
  const group = new Group();
  group.name = name;
  group.scale.setScalar(0);
  group.visible = false;
  parent.add(group);
  return group;
}

function setGrowth(group: Object3D, amount: number): void {
  const live = amount > 0.02;
  group.visible = live;
  group.scale.setScalar(live ? amount : 0);
}

function buildRig(model: Object3D): CrystalRig | null {
  const forearmBone = findNamed(model, "Forearm_R");
  const handBone = findNamed(model, "Hand_R");
  const spawnBone = findNamed(model, "ShardSpawn");
  if (!forearmBone || !handBone || !spawnBone) {
    return null;
  }

  const forearm = makeGroup(forearmBone, "dh-crystal-forearm");
  forearm.position.set(0, 0.24, 0);
  addSpike(forearm, [1, 0.2, 0.05], 0.36, 0.078, "#7ee8bc");
  addSpike(forearm, [0.85, 0.35, 0.15], 0.26, 0.058, "#d8fff0");
  addSpike(forearm, [0.25, 0.15, 1], 0.3, 0.064, "#4eae82");
  addSpike(forearm, [0.2, 0.05, -1], 0.32, 0.068, "#9af3d0");
  addSpike(forearm, [0.55, -0.15, -0.35], 0.22, 0.05, "#6ed9ae");

  const wrist = makeGroup(handBone, "dh-crystal-wrist");
  addSpike(wrist, [1, 0.2, 0.08], 0.26, 0.072, "#c9ffea");
  addSpike(wrist, [-0.75, 0.22, 0.45], 0.24, 0.066, "#5fbf90");
  addSpike(wrist, [0.12, 0.18, -1], 0.28, 0.074, "#8ef0c4");
  addSpike(wrist, [-0.08, 0.28, 1], 0.24, 0.064, "#d7fff1");
  addSpike(wrist, [0.15, -0.4, 0.2], 0.2, 0.056, "#6ed9ae");

  const fist = makeGroup(handBone, "dh-crystal-fist");
  fist.position.set(0, 0.28, 0.02);
  addSpike(fist, [0, 1, 0.06], 0.52, 0.13, "#b6ffe2");
  addSpike(fist, [0.62, 0.85, 0.04], 0.4, 0.1, "#6edfb0");
  addSpike(fist, [-0.58, 0.88, 0.1], 0.38, 0.096, "#e7fff6");
  addSpike(fist, [1, 0.32, 0.08], 0.3, 0.086, "#9af3d0");
  addSpike(fist, [-1, 0.28, 0.12], 0.28, 0.08, "#4eae82");
  addSpike(fist, [0.08, 0.42, -1], 0.32, 0.098, "#3f9e74");
  addSpike(fist, [-0.16, 0.5, 0.9], 0.26, 0.078, "#d8fff0");

  const charge = makeGroup(spawnBone, "dh-crystal-charge");
  addSpike(charge, [0, 1, 0], 0.36, 0.09, "#d5fff0");
  addSpike(charge, [0.55, 1, 0.1], 0.26, 0.062, "#7ee0b8");
  addSpike(charge, [-0.35, 1, 0.45], 0.24, 0.058, "#b8ffe4");

  const chipSpecs: readonly (readonly [number, number, number])[] = [
    [0.15, 1, 0.05],
    [1, 0.35, 0.2],
    [-0.8, 0.4, 0.35],
    [0.2, 0.45, -1],
    [-0.25, 0.7, 0.85],
  ];
  const chips = chipSpecs.map((direction, index) => {
    const mesh = addSpike(
      spawnBone,
      direction,
      index === 0 ? 0.12 : 0.07,
      index === 0 ? 0.028 : 0.02,
      index % 2 === 0 ? "#e9fff6" : "#6dcaa4",
    );
    mesh.visible = false;
    mesh.scale.setScalar(0);
    return { mesh, direction: mesh.position.clone().normalize() };
  });

  const rig: CrystalRig = { forearm, wrist, fist, charge, chips };
  model.userData[RIG_KEY] = rig;
  return rig;
}

function rigOf(action: AnimationAction | null | undefined): CrystalRig | null {
  const root = action?.getRoot();
  if (!root) {
    return null;
  }
  return (root.userData[RIG_KEY] as CrystalRig | undefined) ?? null;
}

function playingTime(action: AnimationAction | null | undefined): number | null {
  if (!action || !action.enabled || action.getEffectiveWeight() < 0.5) {
    return null;
  }
  return action.time;
}

function hideBurst(rig: CrystalRig): void {
  for (const chip of rig.chips) {
    chip.mesh.visible = false;
    chip.mesh.scale.setScalar(0);
  }
}

function poseBurst(rig: CrystalRig, unit: number): void {
  for (const chip of rig.chips) {
    const scale = Math.max(0, 1 - unit);
    chip.mesh.visible = scale > 0.04;
    chip.mesh.scale.setScalar(scale);
    scratchDir.copy(chip.direction).multiplyScalar(0.02 + unit * 0.16);
    scratchQuat.setFromUnitVectors(UP, chip.direction);
    chip.mesh.quaternion.copy(scratchQuat);
    chip.mesh.position.copy(scratchDir).addScaledVector(chip.direction, chip.mesh.scale.y * 0.03);
  }
}

export const diamondheadVisual: CharacterVisual = {
  prepareModel(model) {
    if (!model.userData.diamondheadPolished) {
      polishCrystals(model);
      model.userData.diamondheadPolished = true;
    }
    if (model.userData[RIG_KEY]) {
      return;
    }
    buildRig(model);
  },
  syncPlayback({ actions }) {
    const library = actions("body");
    const punch = library?.[diamondheadClips.crystalPunch];
    const shard = library?.[diamondheadClips.shardShot];
    const rig = rigOf(punch) ?? rigOf(shard);
    if (!rig) {
      return;
    }

    const punchTime = playingTime(punch);
    if (punchTime === null) {
      setGrowth(rig.forearm, 0);
      setGrowth(rig.wrist, 0);
      setGrowth(rig.fist, 0);
    } else {
      const growth = punchGrowth(punchTime);
      setGrowth(rig.forearm, growth.body);
      setGrowth(rig.wrist, growth.body);
      setGrowth(rig.fist, growth.fist);
    }

    const shardTime = playingTime(shard);
    if (shardTime === null) {
      setGrowth(rig.charge, 0);
      hideBurst(rig);
      return;
    }

    setGrowth(rig.charge, chargeAmount(shardTime));
    const burst = burstUnit(shardTime);
    if (burst === null) {
      hideBurst(rig);
      return;
    }
    poseBurst(rig, burst);
  },
};
