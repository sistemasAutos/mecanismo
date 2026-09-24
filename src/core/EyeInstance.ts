/**
 * EyeInstance.ts — Entidad con estado visual y comportamiento de pupila
 *
 * [FASE] Core — Entidad visual individual
 */

import type { EyeVisualState, ColorwayDef, ShapeId, Vec2 } from './types';

export class EyeInstance {
  public readonly id: string;
  public state: EyeVisualState;

  constructor(id: string, shapeId: ShapeId, colorway: ColorwayDef) {
    this.id = id;
    this.state = {
      shapeId,
      colorway,
      animFrame: 0,
      pupilAngleRad: 0,
      pupilOffset01: 0
    };
  }

  /**
   * Actualiza el ángulo y desplazamiento de la pupila hacia una posición objetivo en pantalla
   */
  public updatePupilTarget(eyeScreenPos: Vec2, cursorScreenPos: Vec2 | null, smoothing: number = 0.18): void {
    if (!cursorScreenPos) {
      // Retorna suavemente al centro si no hay cursor
      this.state.pupilOffset01 += (0 - this.state.pupilOffset01) * smoothing;
      return;
    }

    const dx = cursorScreenPos.x - eyeScreenPos.x;
    const dy = cursorScreenPos.y - eyeScreenPos.y;
    const dist = Math.hypot(dx, dy);

    const targetAngle = Math.atan2(dy, dx);
    const targetOffset = Math.min(dist / 200, 1.0);

    // Interpolación de ángulo de pupila de forma suave
    let angleDiff = targetAngle - this.state.pupilAngleRad;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

    this.state.pupilAngleRad += angleDiff * smoothing;
    this.state.pupilOffset01 += (targetOffset - this.state.pupilOffset01) * smoothing;
  }
}
