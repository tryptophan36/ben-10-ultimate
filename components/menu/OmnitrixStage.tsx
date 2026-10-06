"use client";

import { Suspense, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import {
  Box3,
  DoubleSide,
  Group,
  LoopRepeat,
  Mesh,
  MeshBasicMaterial,
  NeutralToneMapping,
  Object3D,
  PointLight,
  Quaternion,
  Vector3,
} from "three";
import { clone as cloneSkinnedScene } from "three/addons/utils/SkeletonUtils.js";
import { characters, characterIds, type CharacterId } from "@/lib/game/characters";
import { characterVisuals } from "@/lib/game/characters/visuals";

const OMNITRIX_URL = "/models/omnitrix_omniverse.glb";
const gltfLoaderOptions = [false, false] as const;
const WATCH_SIZE = 1.95;
const ALIEN_HEIGHT = 2.95;
const ALIEN_MAX_WIDTH = 2.25;
const CAMERA_POSITION: [number, number, number] = [0, 1.15, 8];
const CAMERA_FOCUS_Y = 0.6;
const CAMERA_FOCUS_Y_COMPACT = 0.6;

type StageAnchors = {
  /** Dial face in rig space. */
  face: Vector3;
  /** Height of the watch top in rig space, where the alien stands. */
  standY: number;
};
const RETRACT_MS = 220;
const EMERGE_MS = 780;
const DIAL_NOTCH = (Math.PI * 2) / 11;

const scratchBox = new Box3();
const scratchSize = new Vector3();
const scratchCenter = new Vector3();
const scratchNormal = new Vector3();
const scratchDesired = new Vector3(0, 0.38, 1).normalize();
const scratchTurn = new Quaternion();
const scratchFace = new Vector3();
const scratchMid = new Vector3();
const scratchDir = new Vector3();
const scratchUp = new Vector3(0, 1, 0);
const scratchAxisZ = new Vector3(0, 0, 1);
const scratchSpin = new Quaternion();

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function easeOutBack(value: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (value - 1) ** 3 + c1 * (value - 1) ** 2;
}

function findNamed(root: Object3D, name: string): Object3D | null {
  let found: Object3D | null = null;
  root.traverse((object) => {
    if (!found && object.name === name) {
      found = object;
    }
  });
  return found;
}

function centerAndScale(object: Object3D, targetSize: number) {
  object.position.set(0, 0, 0);
  object.quaternion.identity();
  object.scale.set(1, 1, 1);
  object.updateMatrixWorld(true);
  scratchBox.setFromObject(object);
  scratchBox.getSize(scratchSize);
  scratchBox.getCenter(scratchCenter);
  const maxDim = Math.max(scratchSize.x, scratchSize.y, scratchSize.z, 1e-4);
  const scale = targetSize / maxDim;
  object.scale.setScalar(scale);
  object.position.copy(scratchCenter).multiplyScalar(-scale);
  object.updateMatrixWorld(true);
}

/** Turn the dial toward the camera so the alien can rise out of the face. */
function aimFaceTowardCamera(root: Object3D, face: Object3D | null) {
  if (!face) {
    return;
  }
  root.updateMatrixWorld(true);
  scratchBox.setFromObject(root);
  scratchBox.getCenter(scratchCenter);
  face.getWorldPosition(scratchFace);
  scratchNormal.copy(scratchFace).sub(scratchCenter);
  if (scratchNormal.lengthSq() < 1e-8) {
    return;
  }
  scratchNormal.normalize();
  scratchTurn.setFromUnitVectors(scratchNormal, scratchDesired);
  root.quaternion.premultiply(scratchTurn);
  root.updateMatrixWorld(true);
  scratchBox.setFromObject(root);
  scratchBox.getCenter(scratchCenter);
  root.position.sub(scratchCenter);
  root.updateMatrixWorld(true);
}

function fitFeet(object: Object3D, height: number) {
  object.position.set(0, 0, 0);
  object.scale.set(1, 1, 1);
  object.updateMatrixWorld(true);
  scratchBox.setFromObject(object, true);
  scratchBox.getSize(scratchSize);
  const scale = Math.min(
    height / Math.max(scratchSize.y, 1e-4),
    ALIEN_MAX_WIDTH / Math.max(scratchSize.x, scratchSize.z, 1e-4),
  );
  object.scale.setScalar(scale);
  object.updateMatrixWorld(true);
  scratchBox.setFromObject(object, true);
  scratchBox.getCenter(scratchCenter);
  object.position.x -= scratchCenter.x;
  object.position.z -= scratchCenter.z;
  object.position.y -= scratchBox.min.y;
  object.updateMatrixWorld(true);
}

/** amount 0 sits inside the dial; 1 stands on top of the watch. easeOutBack overshoots past 1. */
function placeAlien(node: Group, anchors: StageAnchors, amount: number) {
  const { face, standY } = anchors;
  const travel = clamp01(amount);
  node.position.set(
    face.x * (1 - travel),
    face.y + (standY - face.y) * amount,
    face.z * (1 - travel),
  );
  node.scale.setScalar(Math.max(0.001, 0.04 + 0.96 * amount));
  node.rotation.y = (1 - travel) * Math.PI * 1.5;
}

function poseBeam(mesh: Mesh | null, face: Vector3, alien: Vector3, strength: number) {
  if (!mesh) {
    return;
  }
  scratchDir.subVectors(alien, face);
  const length = Math.max(0.04, scratchDir.length());
  scratchDir.multiplyScalar(1 / length);
  scratchMid.copy(face).addScaledVector(scratchDir, length * 0.5);
  mesh.position.copy(scratchMid);
  mesh.quaternion.setFromUnitVectors(scratchUp, scratchDir);
  mesh.scale.set(1, length, 1);
  const material = mesh.material;
  if (material instanceof MeshBasicMaterial) {
    material.opacity = 0.55 * clamp01(strength);
  }
}

function StageCamera({ compact }: { compact: boolean }) {
  const { camera } = useThree();
  const focus = useRef(CAMERA_FOCUS_Y);

  useFrame(() => {
    const next = compact ? CAMERA_FOCUS_Y_COMPACT : CAMERA_FOCUS_Y;
    focus.current += (next - focus.current) * 0.08;
    camera.position.set(...CAMERA_POSITION);
    camera.lookAt(0, focus.current, 0);
  });

  return null;
}

function OmnitrixModel({
  characterId,
  anchors,
  space,
}: {
  characterId: CharacterId;
  anchors: RefObject<StageAnchors>;
  space: RefObject<Group | null>;
}) {
  const gltf = useGLTF(OMNITRIX_URL, ...gltfLoaderOptions);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const root = useRef<Group>(null);
  const faceNode = useRef<Object3D | null>(null);
  const cloner = useRef<Object3D | null>(null);
  const clonerRest = useRef(new Quaternion());
  const spin = useRef(0);
  const spinTarget = useRef(0);

  useLayoutEffect(() => {
    const node = root.current;
    if (!node) {
      return;
    }
    centerAndScale(node, WATCH_SIZE);
    faceNode.current = findNamed(node, "Cylinder");
    cloner.current = findNamed(node, "Cloner");
    if (cloner.current) {
      clonerRest.current.copy(cloner.current.quaternion);
    }
    aimFaceTowardCamera(node, faceNode.current);
    scratchBox.setFromObject(node);
    anchors.current.standY = scratchBox.max.y - WATCH_SIZE * 0.08;
    node.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }, [anchors, scene]);

  useLayoutEffect(() => {
    spinTarget.current += DIAL_NOTCH;
  }, [characterId]);

  useFrame((_, delta) => {
    const dial = cloner.current;
    if (dial) {
      spin.current += (spinTarget.current - spin.current) * Math.min(1, delta * 6);
      scratchSpin.setFromAxisAngle(scratchUp, spin.current);
      dial.quaternion.copy(clonerRest.current).multiply(scratchSpin);
    }
    const anchor = faceNode.current;
    const rig = space.current;
    if (!anchor || !rig) {
      return;
    }
    anchor.getWorldPosition(scratchFace);
    rig.worldToLocal(scratchFace);
    anchors.current.face.copy(scratchFace);
  });

  return (
    <group ref={root}>
      <primitive object={scene} />
    </group>
  );
}

function AlienModel({ characterId }: { characterId: CharacterId }) {
  const character = characters[characterId];
  const slot = character.models[0];
  const gltf = useGLTF(slot.url, ...gltfLoaderOptions);
  const scene = useMemo(() => {
    const clone = cloneSkinnedScene(gltf.scene);
    characterVisuals[characterId]?.prepareModel?.(clone, slot.id);
    clone.traverse((object) => {
      if (object instanceof Mesh) {
        object.frustumCulled = false;
        object.castShadow = true;
      }
    });
    // Fit before the clone is parented; world-space bounds would include the reveal scale.
    fitFeet(clone, ALIEN_HEIGHT);
    return clone;
  }, [characterId, gltf.scene, slot.id]);
  const { actions } = useAnimations(gltf.animations, scene);

  useLayoutEffect(() => {
    const action = actions[character.defaultAnimation];
    if (!action) {
      return;
    }
    action.enabled = true;
    action.reset();
    action.setLoop(LoopRepeat, Infinity);
    action.play();
    return () => {
      action.stop();
    };
  }, [actions, character.defaultAnimation]);

  return <primitive object={scene} />;
}

function AlienReveal({
  characterId,
  anchors,
}: {
  characterId: CharacterId;
  anchors: RefObject<StageAnchors>;
}) {
  const group = useRef<Group>(null);
  const beam = useRef<Mesh>(null);
  const [shownId, setShownId] = useState(characterId);
  const phase = useRef<"in" | "out">("in");
  const started = useRef(0);
  const swapQueued = useRef(false);
  const booted = useRef(false);

  useLayoutEffect(() => {
    if (!booted.current) {
      booted.current = true;
      phase.current = "in";
      started.current = performance.now();
      return;
    }
    phase.current = "out";
    started.current = performance.now();
    swapQueued.current = false;
  }, [characterId]);

  useFrame(() => {
    const node = group.current;
    const origin = anchors.current.face;
    if (!node) {
      return;
    }
    const now = performance.now();
    if (phase.current === "out") {
      const retract = clamp01((now - started.current) / RETRACT_MS);
      placeAlien(node, anchors.current, 1 - retract);
      poseBeam(beam.current, origin, node.position, 1 - retract);
      if (retract < 1) {
        return;
      }
      if (shownId !== characterId) {
        if (!swapQueued.current) {
          swapQueued.current = true;
          setShownId(characterId);
        }
        return;
      }
      phase.current = "in";
      started.current = now;
      swapQueued.current = false;
    }
    const emerge = clamp01((performance.now() - started.current) / EMERGE_MS);
    const amount = easeOutBack(emerge);
    placeAlien(node, anchors.current, amount);
    poseBeam(beam.current, origin, node.position, Math.sin(Math.min(emerge, 1) * Math.PI));
  });

  return (
    <>
      <mesh ref={beam} frustumCulled={false}>
        <cylinderGeometry args={[0.03, 0.11, 1, 12, 1, true]} />
        <meshBasicMaterial
          color="#b8ffd2"
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
          side={DoubleSide}
        />
      </mesh>
      <group ref={group} scale={0.001}>
        <AlienModel characterId={shownId} />
      </group>
    </>
  );
}

function DialFlash({
  characterId,
  anchors,
}: {
  characterId: CharacterId;
  anchors: RefObject<StageAnchors>;
}) {
  const light = useRef<PointLight>(null);
  const ring = useRef<Mesh>(null);
  const core = useRef<Mesh>(null);
  const started = useRef(0);

  useLayoutEffect(() => {
    started.current = performance.now();
  }, [characterId]);

  useFrame(() => {
    const origin = anchors.current.face;
    const emerge = clamp01((performance.now() - started.current) / 700);
    const flash = Math.sin(emerge * Math.PI);
    if (light.current) {
      light.current.position.copy(origin);
      light.current.intensity = 3 + flash * 22;
    }
    scratchDir.copy(origin);
    if (scratchDir.lengthSq() > 1e-6) {
      scratchDir.normalize();
    } else {
      scratchDir.set(0, 0, 1);
    }
    for (const mesh of [ring.current, core.current]) {
      if (!mesh) {
        continue;
      }
      mesh.position.copy(origin);
      mesh.quaternion.setFromUnitVectors(scratchAxisZ, scratchDir);
    }
    if (ring.current) {
      const spread = 0.15 + emerge * 1.1;
      ring.current.scale.setScalar(spread);
      const material = ring.current.material;
      if (material instanceof MeshBasicMaterial) {
        material.opacity = (1 - emerge) * 0.9;
      }
    }
    if (core.current) {
      const material = core.current.material;
      if (material instanceof MeshBasicMaterial) {
        material.opacity = 0.35 + flash * 0.65;
      }
    }
  });

  return (
    <>
      <pointLight ref={light} color="#7dff9a" distance={6} decay={2} />
      <mesh ref={core}>
        <circleGeometry args={[0.11, 32]} />
        <meshBasicMaterial color="#e9ffe8" transparent opacity={0.4} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={ring}>
        <ringGeometry args={[0.22, 0.3, 48]} />
        <meshBasicMaterial color="#d7ffd8" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}

function Stage({
  characterId,
  compact,
}: {
  characterId: CharacterId;
  compact: boolean;
}) {
  const rig = useRef<Group>(null);
  const watch = useRef<Group>(null);
  const anchors = useRef<StageAnchors>({ face: new Vector3(0, 0.2, 0.4), standY: 0.3 });
  const punch = useRef(0);
  const skipPunch = useRef(true);

  useLayoutEffect(() => {
    if (skipPunch.current) {
      skipPunch.current = false;
      return;
    }
    punch.current = 1;
  }, [characterId]);

  useFrame((_, delta) => {
    const rigNode = rig.current;
    if (rigNode) {
      const t = performance.now() / 1000;
      rigNode.rotation.y = Math.sin(t * 0.45) * 0.16;
      rigNode.rotation.z = Math.sin(t * 0.3) * 0.025;
    }
    punch.current = Math.max(0, punch.current - delta * 1.7);
    const watchNode = watch.current;
    if (watchNode) {
      watchNode.scale.setScalar(1 + Math.sin(punch.current * Math.PI) * 0.06);
    }
  });

  return (
    <>
      <StageCamera compact={compact} />
      <hemisphereLight args={["#e7fff1", "#163226", 0.9]} />
      <ambientLight intensity={0.32} />
      <directionalLight position={[4.5, 6.5, 4]} intensity={2.6} color="#fff6ea" />
      <directionalLight position={[-3.5, 2.2, -2]} intensity={0.85} color="#9dffc0" />
      <group ref={rig}>
        <group ref={watch}>
          <OmnitrixModel characterId={characterId} anchors={anchors} space={rig} />
        </group>
        <DialFlash characterId={characterId} anchors={anchors} />
        <AlienReveal characterId={characterId} anchors={anchors} />
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.75, 0]}>
        <circleGeometry args={[1.5, 48]} />
        <meshStandardMaterial color="#062117" roughness={1} metalness={0} />
      </mesh>
    </>
  );
}

export function OmnitrixStage({
  characterId,
  compact,
}: {
  characterId: CharacterId;
  compact: boolean;
}) {
  return (
    <Canvas
      className="h-full w-full"
      dpr={[1, 1.75]}
      camera={{ position: CAMERA_POSITION, fov: 36, near: 0.1, far: 40 }}
      gl={{ antialias: true, alpha: true, toneMapping: NeutralToneMapping }}
      onCreated={({ gl }) => {
        gl.toneMapping = NeutralToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.setClearColor(0x000000, 0);
      }}
    >
      <Suspense fallback={null}>
        <Stage characterId={characterId} compact={compact} />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(OMNITRIX_URL, ...gltfLoaderOptions);
for (const id of characterIds) {
  const slot = characters[id].models[0];
  if (slot) {
    useGLTF.preload(slot.url, ...gltfLoaderOptions);
  }
}
