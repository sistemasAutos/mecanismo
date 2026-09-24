/**
 * AnimationClock.ts — Reloj de animación con delta time acotado (clamped)
 *
 * [REQUISITO] Previene "spiral of death" al cambiar de pestaña acotando deltaTime a max 100ms.
 */

export interface IAnimationClock {
  tick(nowMs: number): number;
  reset(): void;
}

export class AnimationClock implements IAnimationClock {
  private lastTimeMs: number = 0;
  private maxDeltaMs: number;

  constructor(maxDeltaMs: number = 100) {
    this.maxDeltaMs = maxDeltaMs;
  }

  /**
   * Procesa un tick del reloj y devuelve el deltaTime transcurrido en ms (acotado)
   */
  public tick(nowMs: number): number {
    if (this.lastTimeMs === 0) {
      this.lastTimeMs = nowMs;
      return 16.66; // Delta inicial estándar (~60fps)
    }

    let deltaTime = nowMs - this.lastTimeMs;

    // Clamp para evitar saltos gigantes en la física tras inactividad
    if (deltaTime < 0) deltaTime = 0;
    if (deltaTime > this.maxDeltaMs) deltaTime = this.maxDeltaMs;

    this.lastTimeMs = nowMs;
    return deltaTime;
  }

  public reset(): void {
    this.lastTimeMs = 0;
  }
}
