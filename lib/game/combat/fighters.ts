export const PLAYER_FIGHTER_ID = "player";
export const OPPONENT_FIGHTER_ID = "opponent";
export const FIGHTER_MAX_HP = 200;

export function freshFighterHealth(): { hp: number; maxHp: number; hitstun: boolean } {
  return { hp: FIGHTER_MAX_HP, maxHp: FIGHTER_MAX_HP, hitstun: false };
}
