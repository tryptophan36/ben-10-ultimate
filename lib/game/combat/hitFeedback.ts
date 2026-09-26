import { triggerCameraShake } from "@/lib/game/camera/cameraShake";
import { publishHitDebug } from "@/lib/game/combat/feelDebug";
import { triggerHitstop } from "@/lib/game/combat/hitstop";
import { spawnImpact } from "@/lib/game/combat/impactVfx";
import type { DamageRequest } from "@/lib/game/combat/types";

/** Visual and freeze feedback for a hit that has already dealt damage. */
export function emitHitFeedback(request: DamageRequest): void {
  spawnImpact(request.hitX, request.hitY, request.hitZ, request.impactScale);
  triggerHitstop(request.hitstopMs);
  triggerCameraShake(request.cameraShake);
  publishHitDebug({
    x: request.hitX,
    y: request.hitY,
    z: request.hitZ,
    horizontal: request.knockback.horizontal,
    vertical: request.knockback.vertical,
  });
}
