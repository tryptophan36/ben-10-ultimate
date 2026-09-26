# Ben 10 Ultimate

A third-person fighting prototype. The playable scene is Four Arms versus a training dummy: walk, run, jump, punch, and heavy punch, with bone-following hitboxes that deal damage.

The game is at [http://localhost:3000/game](http://localhost:3000/game). `app/page.tsx` is still the stock Next.js home page.

## Run

```bash
npm install
npm run dev
```

Open `/game`. Click the canvas to lock the mouse. Escape releases it.

```bash
npm run lint
npx tsc --noEmit
```

## Controls

| Input | Action |
| --- | --- |
| Mouse | Orbit the camera. Click locks the pointer. |
| WASD | Move, relative to the camera. D is screen-right. |
| Shift | Run |
| Space | Jump, once per landing |
| J | Punch (10 damage) |
| K | Heavy punch (25 damage) |
| H | Toggle hitbox debug draw |

The on-screen HUD shows the current clip, movement state, attack phase, dummy HP, and whether hitboxes are live.

## Stack

- Next.js 16 App Router, React 19, TypeScript, Tailwind 4
- React Three Fiber and drei for the scene
- `@react-three/rapier` for physics (it ships its own `@dimforge/rapier3d-compat`)
- Redux Toolkit for session and combat UI state

Path alias `@/` maps to the repo root.

## Where to start reading

```
app/game/page.tsx              Route. Renders GameCanvas.
app/providers.tsx              Redux Provider.
components/game/GameCanvas.tsx Scene, lights, physics world, ground, player, dummy.
components/game/Player.tsx     Four Arms body, capsule, model, animation, hitboxes.
components/game/Camera.tsx     Third-person orbit camera.
components/game/useCharacterController.ts
                               Movement, jump, facing, attack lock. Runs every physics step.
components/game/useAnimationController.ts
                               Plays the clip Redux asks for.
components/game/useGameInput.ts
                               Keyboard state. Edge flags for jump and attacks.
components/game/combat/        Hitbox followers and the training dummy.
lib/game/characters.ts         Character registry. One entry today: four-arms.
lib/game/locomotion.ts         Speeds, capsule size, clip names for movement.
lib/game/animations.ts         Which clips loop, which are one-shots, name matching.
lib/game/physics.ts            Timestep, gravity, collision groups.
lib/game/combat/attacks.ts     Punch and heavy punch numbers.
lib/game/combat/runtime.ts     Attack clock, hurtbox registry, one-hit tracking.
lib/game/runtime.ts            Per-frame focus point for the camera. Not Redux.
store/slices/gameSlice.ts      Selected character and current animation.
store/slices/combatSlice.ts    Attack phase, dummy HP, hitbox debug flag.
public/models/fourarms_game.glb
```

`components/game/useAnimationHotkeys.ts` can preview clips with the number keys. It is not mounted, so it does not fight the controller.

## One frame

Physics steps at a fixed 1/60 second inside `@react-three/rapier`. The character controller's `useBeforePhysicsStep` callback runs first, then the hitbox followers, then the Rapier step, then hit queries.

1. Read WASD, Shift, Space, J, and K.
2. Accelerate or decelerate the kinematic capsule and apply jump and gravity.
3. Face the move direction. Advance the attack phase from the clip clock.
4. If the phase is active, move each hitbox onto its hand bone and enable the sensor.
5. After the step, overlapping hurtboxes take damage at most once for this attack.
6. The animation mixer advances in `useFrame`, which runs after the physics step, and publishes the clip name and time for the next step.

Redux is updated when the attack id or phase changes, when HP changes, and when a one-shot clip should start. It is not updated with positions.

## Movement

`useCharacterController` owns the body. `Player` only mounts it.

The body is a `kinematicPosition` rigid body with a capsule. Gravity on the body is 0. The controller applies `GRAVITY` (`-20`) itself, so the world gravity and the character stay in agreement. The capsule is slightly above the visual feet (`colliderOffset`). The skinned mesh is dropped by that same amount so the feet sit on the ground.

Movement is camera-relative. The strafe axis is `cross(cameraForward, worldUp)`. That order makes D move screen-right.

Jump is a single press. `canJump` is consumed on takeoff and returns on landing. A coyote window of 0.08 seconds lets a jump that starts just after leaving the ground still count. Holding Space does not jump again.

The character controller uses `QueryFilterFlags.EXCLUDE_SENSORS`, so attack sensors do not block walking. Do not switch that to `EXCLUDE_FIXED`. The stage is a fixed body, and excluding fixed colliders drops the character through the floor.

Pass stable arrays into `position`, `args`, and `enabledRotations` on Rapier components. A fresh array each render recreates the body and resets it.

## Camera

`Camera` orbits a pivot. Mouse yaw and pitch are applied immediately. The pivot then smooth-damps onto the character's feet, so the follow lags and the look does not. Yaw starts at `Math.PI`, which places the camera on −Z, behind a character who faces +Z.

`playerFocus` in `lib/game/runtime.ts` is the shared feet position and yaw. The controller writes it every step. The camera and knockback read it. The debug HUD reads a separate throttled snapshot through `useSyncExternalStore`.

## Animation

Clips live in `public/models/fourarms_game.glb`. Do not edit that file to change gameplay. The exported punch clip is named `FA_PUNCH`. Code asks for `FA_Punch`. `resolveAnimationName` matches case-insensitively.

| Clip | Playback |
| --- | --- |
| `FA_Idle`, `FA_Walk`, `FA_Run` | Loop |
| `FA_Jump`, `FA_Punch`, `FA_HeavyPunch`, `FA_Hit` | Play once and hold the last frame |

`gameSlice` stores `currentAnimation` and `animationEpoch`. Dispatching `playAnimation` bumps the epoch, which restarts the clip even when the name is unchanged. `useAnimationController` crossfades over 0.2 seconds. When a one-shot finishes it asks the character controller what to play next: a buffered attack, the jump hold while still airborne, or the locomotion clip. There is also an `FA_Hit` clip on the model. The training dummy does not use it. The dummy is a capsule.

At yaw 0 the mesh faces +Z. `modelYawOffset` is 0. Three.js renames bones that contain spaces, so a glTF bone `Bip01 R Hand R` is `Bip01_R_Hand_R` in the scene graph.

## Combat

Attack data is `AttackDefinition` in `lib/game/combat/types.ts`. The Four Arms moves are `FOUR_ARMS_PUNCH` and `FOUR_ARMS_HEAVY_PUNCH` in `lib/game/combat/attacks.ts`. Frame counts are physics steps.

```
Input
  → ATTACK_STARTUP   hitboxes off
  → ATTACK_ACTIVE    sensors follow the hand bones
  → ATTACK_RECOVERY  hitboxes off, a new attack cannot start
  → IDLE             locomotion clip resumes
```

These clips extend the fists well after the first few frames, so the active windows sit on the part of the take where a hand is actually forward. Punch is the right upper hand. Heavy punch is both upper hands and the lower left hand. Recovery is the remainder of the clip. `interruptible` and `multiHit` are both false. A press during an attack is kept and starts after recovery.

`lib/game/combat/runtime.ts` is the per-step combat state: current attack, serial number, phase, and the set of targets already hit. The animation controller publishes the playing clip's time into `clipClock` after the mixer updates. The next physics step reads that time, so the phase is about one rendered frame behind the pose.

Hitboxes are kinematic sensor spheres in `AttackHitboxes`. Each step they copy a bone's world position and enable the collider only in `ATTACK_ACTIVE`. The red fill and yellow wireframe are that debug draw. They are not part of the character mesh. **H** toggles `showHitboxes`. The real collider is invisible either way.

The training dummy is a dynamic capsule with a hurtbox. It registers `takeDamage` against its Rapier body handle. A hit subtracts HP, sets a horizontal velocity from the attack's `knockback`, lifts it slightly, and starts a hitstun timer that tints the capsule and shows a floating number. The same attack serial cannot damage the same target twice.

Current numbers:

| Attack | Damage | Startup | Active | Knockback | Hitstun |
| --- | --- | --- | --- | --- | --- |
| Punch | 10 | 24 frames | 8 frames | 5 m/s | 0.25 s |
| Heavy punch | 25 | 50 frames | 12 frames | 10 m/s | 0.50 s |

The dummy starts at 100 HP.

## Collision groups

Groups are indices 0–15, combined with `interactionGroups(membership, filter)`. A pair collides only when each body's membership overlaps the other's filter.

| Group | Index | Who uses it |
| --- | --- | --- |
| `stage` | 0 | Ground |
| `fighter` | 1 | Four Arms capsule, dummy body |
| `hurtbox` | 2 | Dummy body |
| `hitbox` | 3 | Attack sensors |

The stage collides with fighters. Fighters collide with the stage and with each other. Hitboxes collide only with hurtboxes, so a punch does not hit Four Arms or the floor.

## What belongs in Redux

`game` holds the selected character, the clip name, and the epoch that restarts it.

`combat` holds the attack id, phase, dummy HP, hitstun flag, last damage event, and `showHitboxes`. Phase and HP change a handful of times per attack.

These stay outside Redux, because they change every step:

- Capsule position and yaw (`playerFocus`)
- Hitbox transforms
- Rapier contacts and velocities
- The clip clock

## Adding an attack

1. Add an `AttackDefinition` in `lib/game/combat/attacks.ts` and put it in the `ATTACKS` list. Set `characterId`, clip name, damage, frame windows, knockback, hitstun, and the hand bones.
2. Map the input in `useGameInput` and in the character's `LocomotionConfig.animations`, then let `consumeAttack` read it. The phase machine already blocks a new attack while one is running.
3. If the clip is a one-shot, add its name to `ONE_SHOT_ANIMATIONS`. Match the GLB name case-insensitively.
4. Confirm the active frames against the clip. Sample the bone while the clip plays, and put the active window on the frames where that bone is extended. `showHitboxes` is how you check it in the scene.

`kind: "melee"` and the hitbox list are the current shape. A later projectile, grab, or block can be another definition beside this one. Damage still goes through `takeDamage`.

## Adding a character

1. Add a `CharacterDefinition` in `lib/game/characters.ts` with a model URL, default clip, and a `LocomotionConfig`.
2. Add that id to `characterIds` and to the `CharacterId` union. `gameSlice` already switches `selectedCharacter`.
3. Give the character its own attacks with that `characterId`. `AttackHitboxes` only builds sensors for the mounted character, and it skips bones the model does not have.
4. Keep the capsule, the visual drop, and a fixed `modelYawOffset` so the feet and the facing stay consistent with the ground at y = 0.

Heatblast, other characters, and multiplayer are not in the tree yet. The split above is the seam for them.

## Physics rules that are easy to break

- Import Rapier types and flags from `useRapier().rapier`. The package hoisted at the repo root is a different Rapier version from the one inside `@react-three/rapier`, and the types do not match.
- Keep `EXCLUDE_SENSORS` on the character controller. Leave fixed bodies included.
- Keep `position` and collider `args` referentially stable.
- Drive attack timing from `attacks.ts`. Do not hardcode damage or frame counts inside components.
- Do not store per-frame transforms in Redux.
- Do not modify `public/models/fourarms_game.glb` to change move data. Tune `attacks.ts` and the locomotion config instead.
