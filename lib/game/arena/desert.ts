import { Mesh, Quaternion, Vector3, type Object3D } from "three";

export const DESERT_ARENA_URL = "/model/world/desert-arena.glb";
export const HAVANA_ARENA_URL = "/model/world/havana-street.glb";

const COLLIDER_PREFIX = "COL_";
const SPAWN_PLAYER_1 = "Spawn_Player1";
const SPAWN_PLAYER_2 = "Spawn_Player2";

/**
 * Blender custom properties stay on their Z-up axes. The glTF node and mesh
 * are already Y-up, so a check against extras swaps Y and Z before comparing.
 */
const EXTRAS_TOLERANCE = 0.05;

export type ArenaCuboid = {
  name: string;
  position: [number, number, number];
  quaternion: Quaternion;
  halfExtents: [number, number, number];
};

export type ArenaSpawnPoint = {
  name: string;
  position: [number, number, number];
  /** Yaw whose forward is the spawn node's glTF +Z. */
  yaw: number;
};

export type DesertArenaLayout = {
  colliders: ArenaCuboid[];
  spawns: {
    player1: ArenaSpawnPoint;
    player2: ArenaSpawnPoint;
  };
};

const scratchSize = new Vector3();
const scratchCenter = new Vector3();
const scratchScale = new Vector3();

function colliderMesh(object: Object3D): Mesh | null {
  if (object instanceof Mesh) {
    return object;
  }
  let found: Mesh | null = null;
  object.traverse((child) => {
    if (!found && child instanceof Mesh) {
      found = child;
    }
  });
  return found;
}

function halfExtentsFromExtras(
  object: Object3D,
  scale: Vector3,
): [number, number, number] | null {
  const extras = object.userData as {
    size_x?: unknown;
    size_y?: unknown;
    size_z?: unknown;
  };
  if (
    typeof extras.size_x !== "number" ||
    typeof extras.size_y !== "number" ||
    typeof extras.size_z !== "number"
  ) {
    return null;
  }
  return [
    (Math.abs(extras.size_x) * Math.abs(scale.x)) / 2,
    (Math.abs(extras.size_z) * Math.abs(scale.y)) / 2,
    (Math.abs(extras.size_y) * Math.abs(scale.z)) / 2,
  ];
}

function extentsMatch(
  meshExtents: [number, number, number],
  extrasExtents: [number, number, number],
): boolean {
  return meshExtents.every(
    (value, index) => Math.abs(value - extrasExtents[index]) <= EXTRAS_TOLERANCE,
  );
}

function readCuboid(object: Object3D): ArenaCuboid {
  const mesh = colliderMesh(object);
  const quaternion = new Quaternion();
  const scale = scratchScale;

  if (!mesh) {
    object.updateWorldMatrix(true, false);
    const position = new Vector3();
    object.matrixWorld.decompose(position, quaternion, scale);
    const halfExtents = halfExtentsFromExtras(object, scale);
    if (!halfExtents) {
      throw new Error(`${object.name} has no mesh and no collider size`);
    }
    return {
      name: object.name,
      position: [position.x, position.y, position.z],
      quaternion,
      halfExtents,
    };
  }

  const geometry = mesh.geometry;
  if (!geometry.boundingBox) {
    geometry.computeBoundingBox();
  }
  const box = geometry.boundingBox;
  if (!box) {
    throw new Error(`${object.name} has no collider bounds`);
  }

  mesh.updateWorldMatrix(true, false);
  mesh.matrixWorld.decompose(new Vector3(), quaternion, scale);
  box.getSize(scratchSize);
  const halfExtents: [number, number, number] = [
    (Math.abs(scratchSize.x) * Math.abs(scale.x)) / 2,
    (Math.abs(scratchSize.y) * Math.abs(scale.y)) / 2,
    (Math.abs(scratchSize.z) * Math.abs(scale.z)) / 2,
  ];
  const authored = halfExtentsFromExtras(object, scale);
  if (authored && !extentsMatch(halfExtents, authored)) {
    throw new Error(
      `${object.name} mesh bounds do not match its Blender collider size`,
    );
  }

  box.getCenter(scratchCenter);
  scratchCenter.applyMatrix4(mesh.matrixWorld);

  return {
    name: object.name,
    position: [scratchCenter.x, scratchCenter.y, scratchCenter.z],
    quaternion,
    halfExtents,
  };
}

function readSpawn(object: Object3D): ArenaSpawnPoint {
  object.updateWorldMatrix(true, false);
  const position = new Vector3();
  const quaternion = new Quaternion();
  object.matrixWorld.decompose(position, quaternion, new Vector3());
  const forward = new Vector3(0, 0, 1).applyQuaternion(quaternion);
  return {
    name: object.name,
    position: [position.x, position.y, position.z],
    yaw: Math.atan2(forward.x, forward.z),
  };
}

/** Read COL_* cuboids and player spawns. Shared by every arena GLB. */
export function readDesertArena(scene: Object3D): DesertArenaLayout {
  scene.updateMatrixWorld(true);

  const colliders: ArenaCuboid[] = [];
  const spawns = new Map<string, Object3D>();

  scene.traverse((object) => {
    if (object.name === SPAWN_PLAYER_1 || object.name === SPAWN_PLAYER_2) {
      spawns.set(object.name, object);
    }
    if (!object.name.startsWith(COLLIDER_PREFIX)) {
      return;
    }
    if (object.parent?.name.startsWith(COLLIDER_PREFIX)) {
      return;
    }
    colliders.push(readCuboid(object));
  });

  const player1 = spawns.get(SPAWN_PLAYER_1);
  const player2 = spawns.get(SPAWN_PLAYER_2);
  if (!player1 || !player2) {
    throw new Error("Arena is missing Spawn_Player1 or Spawn_Player2");
  }

  colliders.sort((a, b) => a.name.localeCompare(b.name));

  return {
    colliders,
    spawns: {
      player1: readSpawn(player1),
      player2: readSpawn(player2),
    },
  };
}

/** Hide authoring colliders. Geometry and materials stay shared with the glTF cache. */
export function prepareArenaVisual(source: Object3D): Object3D {
  const visual = source.clone(true);
  visual.traverse((object) => {
    if (object.name.startsWith(COLLIDER_PREFIX)) {
      object.visible = false;
      object.castShadow = false;
      object.receiveShadow = false;
      return;
    }
    if (object instanceof Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return visual;
}

/** Move in the spawn's horizontal frame. `right` is the character's right. */
export function offsetFromSpawn(
  spawn: ArenaSpawnPoint,
  forward: number,
  right: number,
  height: number,
): [number, number, number] {
  const fx = Math.sin(spawn.yaw);
  const fz = Math.cos(spawn.yaw);
  const rx = -fz;
  const rz = fx;
  return [
    spawn.position[0] + fx * forward + rx * right,
    spawn.position[1] + height,
    spawn.position[2] + fz * forward + rz * right,
  ];
}
