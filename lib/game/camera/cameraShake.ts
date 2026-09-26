export type CameraShakeSpec = {
  /** Peak offset added to the camera position, in meters. */
  amplitude: number;
  /** How long the shake lasts, in seconds. */
  duration: number;
  /** Oscillation rate, in hertz. */
  frequency: number;
};

type ActiveShake = {
  amplitude: number;
  duration: number;
  frequency: number;
  elapsed: number;
  seed: number;
};

const sample = { x: 0, y: 0, z: 0 };

let active: ActiveShake | null = null;

function envelope(elapsed: number, duration: number): number {
  const t = elapsed / duration;
  if (t <= 0 || t >= 1) {
    return 0;
  }
  const attack = Math.min(1, t / 0.05);
  const release = 1 - t;
  return attack * release * release;
}

function clearSample(): void {
  sample.x = 0;
  sample.y = 0;
  sample.z = 0;
}

/**
 * Start a shake. A new shake replaces the current one only when it is
 * stronger than the offset still playing, so hits do not sum into drift.
 */
export function triggerCameraShake(spec: CameraShakeSpec): void {
  if (!Number.isFinite(spec.amplitude) || spec.amplitude <= 0) {
    return;
  }
  if (!Number.isFinite(spec.duration) || spec.duration <= 0) {
    return;
  }

  if (active) {
    const playing = active.amplitude * envelope(active.elapsed, active.duration);
    if (spec.amplitude <= playing) {
      return;
    }
  }

  active = {
    amplitude: spec.amplitude,
    duration: spec.duration,
    frequency: Math.max(1, spec.frequency),
    elapsed: 0,
    seed: Math.random() * Math.PI * 2,
  };
}

/**
 * Advance the shake and return this frame's additive offset.
 * The returned object is reused; read it before the next sample.
 * Offset is computed from elapsed time, then discarded, so it cannot accumulate.
 */
export function sampleCameraShake(deltaSeconds: number): {
  x: number;
  y: number;
  z: number;
} {
  if (!active) {
    clearSample();
    return sample;
  }

  const dt = Number.isFinite(deltaSeconds) ? Math.min(Math.max(deltaSeconds, 0), 0.05) : 0;
  active.elapsed += dt;
  if (active.elapsed >= active.duration) {
    active = null;
    clearSample();
    return sample;
  }

  const amp = active.amplitude * envelope(active.elapsed, active.duration);
  const omega = active.frequency * Math.PI * 2;
  const time = active.elapsed;
  sample.x = Math.sin(time * omega + active.seed) * amp;
  sample.y = Math.cos(time * omega * 0.85 + active.seed) * amp * 0.55;
  sample.z = Math.sin(time * omega * 1.15 + active.seed * 0.5) * amp * 0.3;
  return sample;
}

export function resetCameraShake(): void {
  active = null;
  clearSample();
}
