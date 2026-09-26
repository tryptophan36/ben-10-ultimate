"use client";

import { useRef, useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  type Group,
  type Material,
} from "three";
import {
  dismissImpact,
  getImpacts,
  getImpactsServerSnapshot,
  subscribeImpacts,
  type ImpactEvent,
} from "@/lib/game/combat/impactVfx";

const SPARK_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
  [0.16, 0.08, 0.02],
  [-0.14, 0.12, 0.05],
  [0.04, 0.18, -0.08],
  [-0.06, 0.05, 0.16],
  [0.15, 0.02, -0.12],
  [-0.02, 0.14, -0.13],
];

function fadeMaterial(material: Material, opacity: number): void {
  material.opacity = opacity;
  if (material instanceof MeshStandardMaterial) {
    material.emissiveIntensity = 1.4 + opacity * 2.2;
  }
}

function fadeMesh(mesh: Mesh | null, opacity: number): void {
  const material = mesh?.material;
  if (!material || Array.isArray(material)) {
    return;
  }
  fadeMaterial(material, opacity);
}

function ImpactBurst({ impact }: { impact: ImpactEvent }) {
  const ringRef = useRef<Mesh>(null);
  const coreRef = useRef<Mesh>(null);
  const sparksRef = useRef<Group>(null);
  const removed = useRef(false);

  useFrame(({ camera }) => {
    const t = (performance.now() - impact.born) / (impact.life * 1000);
    if (t >= 1) {
      if (!removed.current) {
        removed.current = true;
        dismissImpact(impact.id);
      }
      return;
    }

    const fade = 1 - t;
    const expand = 0.35 + t * 1.7;
    const ring = ringRef.current;
    if (ring) {
      ring.scale.setScalar(expand);
      ring.lookAt(camera.position);
      fadeMesh(ring, fade * 0.9);
    }

    const core = coreRef.current;
    if (core) {
      core.scale.setScalar(0.65 + t * 0.9);
      fadeMesh(core, Math.max(0, fade * 1.15 - t * 0.2));
    }

    const sparks = sparksRef.current;
    if (sparks) {
      sparks.scale.setScalar(0.25 + t * 1.65);
      for (const child of sparks.children) {
        if (child instanceof Mesh) {
          fadeMesh(child, fade * 0.8);
        }
      }
    }
  });

  return (
    <group position={[impact.x, impact.y, impact.z]} scale={impact.scale} frustumCulled={false}>
      <mesh ref={coreRef} renderOrder={3}>
        <sphereGeometry args={[0.11, 10, 8]} />
        <meshStandardMaterial
          color="#ffe7a3"
          emissive="#ff8c1a"
          emissiveIntensity={3}
          transparent
          opacity={1}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={ringRef} renderOrder={3}>
        <ringGeometry args={[0.1, 0.18, 28]} />
        <meshBasicMaterial
          color="#fff3c4"
          transparent
          opacity={0.9}
          side={DoubleSide}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <group ref={sparksRef}>
        {SPARK_OFFSETS.map((offset) => (
          <mesh
            key={`${offset[0]}:${offset[1]}:${offset[2]}`}
            position={[offset[0], offset[1], offset[2]]}
            renderOrder={3}
          >
            <sphereGeometry args={[0.035, 6, 5]} />
            <meshBasicMaterial
              color="#ffb703"
              transparent
              opacity={0.85}
              blending={AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function ImpactBursts() {
  const impacts = useSyncExternalStore(
    subscribeImpacts,
    getImpacts,
    getImpactsServerSnapshot,
  );

  return impacts.map((impact) => <ImpactBurst key={impact.id} impact={impact} />);
}
