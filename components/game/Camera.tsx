"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { interactionGroups, useRapier } from "@react-three/rapier";
import { Vector3, type PerspectiveCamera as PerspectiveCameraImpl } from "three";
import { sampleCameraShake } from "@/lib/game/camera/cameraShake";
import { isHitstopActive } from "@/lib/game/combat/hitstop";
import { physicsGroups } from "@/lib/game/physics";
import { playerFocus } from "@/lib/game/runtime";

const LOOK_HEIGHT = 1.3;
const DISTANCE = 5.7;
const HORIZONTAL_SMOOTH_TIME = 0.12;
const VERTICAL_SMOOTH_TIME = 0.08;
const MOUSE_SENSITIVITY = 0.0022;
const MIN_PITCH = 0.12;
const MAX_PITCH = 1.15;
const DEFAULT_PITCH = 0.22;
const WALL_MARGIN = 0.35;
const MIN_CAMERA_DISTANCE = 1.7;
const STAGE_CAMERA_GROUPS = interactionGroups(
  [physicsGroups.fighter],
  [physicsGroups.stage],
);

type CameraProps = {
  initialYaw?: number;
  initialFocus?: [number, number, number];
};

function smoothDamp(
  current: number,
  target: number,
  velocity: { value: number },
  smoothTime: number,
  deltaTime: number,
): number {
  const omega = 2 / Math.max(0.0001, smoothTime);
  const x = omega * deltaTime;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity.value + omega * change) * deltaTime;
  velocity.value = (velocity.value - omega * temp) * exp;
  let output = target + (change + temp) * exp;
  const overshot = target - current > 0 === output > target;
  if (overshot) {
    output = target;
    velocity.value = 0;
  }
  return output;
}

export function Camera({
  initialYaw = Math.PI,
  initialFocus = [0, 0, 0],
}: CameraProps) {
  const { gl } = useThree();
  const { world, rapier } = useRapier();
  const cameraRef = useRef<PerspectiveCameraImpl>(null);
  const pivot = useRef(new Vector3(initialFocus[0], initialFocus[1], initialFocus[2]));
  const velocityX = useRef({ value: 0 });
  const velocityY = useRef({ value: 0 });
  const velocityZ = useRef({ value: 0 });
  const yaw = useRef(initialYaw);
  const pitch = useRef(DEFAULT_PITCH);
  const rayRef = useRef<InstanceType<typeof rapier.Ray> | null>(null);
  const startPosition = useMemo<[number, number, number]>(() => {
    const horizontal = Math.cos(DEFAULT_PITCH) * DISTANCE;
    return [
      initialFocus[0] + Math.sin(initialYaw) * horizontal,
      initialFocus[1] + LOOK_HEIGHT + Math.sin(DEFAULT_PITCH) * DISTANCE,
      initialFocus[2] + Math.cos(initialYaw) * horizontal,
    ];
  }, [initialFocus, initialYaw]);

  useEffect(() => {
    const canvas = gl.domElement;

    const onMouseMove = (event: MouseEvent) => {
      if (event.movementX === 0 && event.movementY === 0) {
        return;
      }
      yaw.current -= event.movementX * MOUSE_SENSITIVITY;
      pitch.current = Math.min(
        MAX_PITCH,
        Math.max(MIN_PITCH, pitch.current + event.movementY * MOUSE_SENSITIVITY),
      );
    };

    const onClick = () => {
      if (document.pointerLockElement !== canvas) {
        void canvas.requestPointerLock();
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onClick);
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
    };
  }, [gl]);

  useFrame((_, delta) => {
    const camera = cameraRef.current;
    if (!camera) {
      return;
    }

    const dt = Math.min(delta, 0.05);
    const target = playerFocus.feet;

    if (!isHitstopActive()) {
      pivot.current.x = smoothDamp(
        pivot.current.x,
        target.x,
        velocityX.current,
        HORIZONTAL_SMOOTH_TIME,
        dt,
      );
      pivot.current.y = smoothDamp(
        pivot.current.y,
        target.y,
        velocityY.current,
        VERTICAL_SMOOTH_TIME,
        dt,
      );
      pivot.current.z = smoothDamp(
        pivot.current.z,
        target.z,
        velocityZ.current,
        HORIZONTAL_SMOOTH_TIME,
        dt,
      );
    }

    const lookY = pivot.current.y + LOOK_HEIGHT;
    const horizontal = Math.cos(pitch.current) * DISTANCE;
    let offsetX = Math.sin(yaw.current) * horizontal;
    const offsetY = Math.sin(pitch.current) * DISTANCE;
    let offsetZ = Math.cos(yaw.current) * horizontal;
    const flatDistance = Math.hypot(offsetX, offsetZ);
    if (flatDistance > 0.05) {
      const ray =
        rayRef.current ??
        (rayRef.current = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }));
      ray.origin.x = pivot.current.x;
      ray.origin.y = lookY;
      ray.origin.z = pivot.current.z;
      ray.dir.x = offsetX / flatDistance;
      ray.dir.y = 0;
      ray.dir.z = offsetZ / flatDistance;
      const hit = world.castRay(
        ray,
        flatDistance,
        true,
        rapier.QueryFilterFlags.EXCLUDE_SENSORS,
        STAGE_CAMERA_GROUPS,
      );
      if (hit && hit.timeOfImpact < flatDistance) {
        const allowed = Math.max(MIN_CAMERA_DISTANCE, hit.timeOfImpact - WALL_MARGIN);
        const scale = allowed / flatDistance;
        offsetX *= scale;
        offsetZ *= scale;
      }
    }
    const shake = sampleCameraShake(dt);
    camera.position.set(
      pivot.current.x + offsetX + shake.x,
      lookY + offsetY + shake.y,
      pivot.current.z + offsetZ + shake.z,
    );
    camera.lookAt(pivot.current.x, lookY, pivot.current.z);
  });

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      fov={45}
      near={0.1}
      far={80}
      position={startPosition}
    />
  );
}
