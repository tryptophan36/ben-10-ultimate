export type ImpactEvent = {
  id: number;
  x: number;
  y: number;
  z: number;
  scale: number;
  born: number;
  life: number;
};

const EMPTY: readonly ImpactEvent[] = [];
const MAX_IMPACTS = 12;
const BASE_LIFE_SECONDS = 0.24;

let nextId = 1;
let impacts: ImpactEvent[] = [];
let snapshot: readonly ImpactEvent[] = EMPTY;
const listeners = new Set<() => void>();

function emit(): void {
  snapshot = impacts.length === 0 ? EMPTY : impacts;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeImpacts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getImpacts(): readonly ImpactEvent[] {
  return snapshot;
}

export function getImpactsServerSnapshot(): readonly ImpactEvent[] {
  return EMPTY;
}

export function spawnImpact(x: number, y: number, z: number, scale: number): void {
  const size = Math.max(0.25, scale);
  const event: ImpactEvent = {
    id: nextId,
    x,
    y,
    z,
    scale: size,
    born: performance.now(),
    life: BASE_LIFE_SECONDS + Math.min(0.14, (size - 1) * 0.1),
  };
  nextId += 1;
  impacts = [...impacts, event].slice(-MAX_IMPACTS);
  emit();
}

export function dismissImpact(id: number): void {
  const next = impacts.filter((impact) => impact.id !== id);
  if (next.length === impacts.length) {
    return;
  }
  impacts = next;
  emit();
}

export function clearImpacts(): void {
  if (impacts.length === 0) {
    return;
  }
  impacts = [];
  emit();
}

/** Pull a buried fist point out to the target surface so the burst stays visible. */
export function visibleContactPoint(
  hit: { x: number; y: number; z: number },
  center: { x: number; y: number; z: number },
  surface: number,
): { x: number; y: number; z: number } {
  const dx = hit.x - center.x;
  const dy = hit.y - center.y;
  const dz = hit.z - center.z;
  const length = Math.hypot(dx, dy, dz);
  if (length < 1e-4) {
    return { x: center.x, y: center.y + surface, z: center.z };
  }
  if (length >= surface) {
    return { x: hit.x, y: hit.y, z: hit.z };
  }
  const scale = surface / length;
  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale,
    z: center.z + dz * scale,
  };
}
