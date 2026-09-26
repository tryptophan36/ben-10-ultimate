export type FeelDebug = {
  hitX: number | null;
  hitY: number | null;
  hitZ: number | null;
  knockbackH: number | null;
  knockbackV: number | null;
  liveKnockback: number;
};

const INITIAL: FeelDebug = {
  hitX: null,
  hitY: null,
  hitZ: null,
  knockbackH: null,
  knockbackV: null,
  liveKnockback: 0,
};

let snapshot: FeelDebug = INITIAL;
const listeners = new Set<() => void>();

function emit(next: FeelDebug): void {
  snapshot = next;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeFeelDebug(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getFeelDebug(): FeelDebug {
  return snapshot;
}

export function getFeelDebugServerSnapshot(): FeelDebug {
  return INITIAL;
}

export function publishHitDebug(hit: {
  x: number;
  y: number;
  z: number;
  horizontal: number;
  vertical: number;
}): void {
  emit({
    ...snapshot,
    hitX: hit.x,
    hitY: hit.y,
    hitZ: hit.z,
    knockbackH: hit.horizontal,
    knockbackV: hit.vertical,
  });
}

export function publishLiveKnockback(speed: number): void {
  const rounded = Math.round(speed * 10) / 10;
  if (rounded === snapshot.liveKnockback) {
    return;
  }
  emit({ ...snapshot, liveKnockback: rounded });
}

export function resetFeelDebug(): void {
  if (snapshot === INITIAL) {
    return;
  }
  emit(INITIAL);
}
