"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { Vector3, type PerspectiveCamera as PerspectiveCameraImpl } from "three";
import { playerFocus } from "@/lib/game/runtime";

const LOOK_HEIGHT = 1.3;
const DISTANCE = 5.7;
const HORIZONTAL_SMOOTH_TIME = 0.12;
const VERTICAL_SMOOTH_TIME = 0.08;
const MOUSE_SENSITIVITY = 0.0022;
const MIN_PITCH = 0.12;
const MAX_PITCH = 1.15;

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

export function Camera() {
  const { gl } = useThree();
  const cameraRef = useRef<PerspectiveCameraImpl>(null);
  const pivot = useRef(new Vector3());
  const velocityX = useRef({ value: 0 });
  const velocityY = useRef({ value: 0 });
  const velocityZ = useRef({ value: 0 });
  const yaw = useRef(Math.PI);
  const pitch = useRef(0.22);
  const seeded = useRef(false);

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
    if (!seeded.current) {
      pivot.current.copy(target);
      seeded.current = true;
    }

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

    const lookY = pivot.current.y + LOOK_HEIGHT;
    const horizontal = Math.cos(pitch.current) * DISTANCE;
    camera.position.set(
      pivot.current.x + Math.sin(yaw.current) * horizontal,
      lookY + Math.sin(pitch.current) * DISTANCE,
      pivot.current.z + Math.cos(yaw.current) * horizontal,
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
      position={[0, 2.5, -5.5]}
    />
  );
}
