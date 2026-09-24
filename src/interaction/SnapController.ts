//--- hex-eyes-engine/src/interaction/SnapController.ts
/**
 * SnapController — Controlador de snap con easing cúbico
 *
 * [FASE] 3 — Physics / Interacción
 * [REFERENCIA] Patrón estándar de UI con scroll/paneo inercial
 * [ALGORITMO ORIGINAL] Función ja() del código original
 * [CRITERIO DE ACEPTACIÓN]
 *   - Resultado nunca fuera del segmento [snapStart, snapTarget] interpolado por easingFn(t)
 *   - Snap nunca sale del segmento interpolado
 *   - Retorna null si no está en snap activo
 */

import type { Vec2, OffsetCoord } from '@core/types';
import { DEFAULT_CONFIG } from '@core/types';
import type { IHexCoords } from '@grid/HexCoords';

/**
 * Función de easing cúbico — padrão del original
 * f(t) = t³ * (10 + t * (-15 + t * 6))
 * Esta es la curva smoothstep cúbica estándar
 */
export function cubicEase(t: number): number {
  // Clamp a [0, 1] para evitar overshoot
  t = Math.max(0, Math.min(1, t));
  return t * t * (10 + t * (-15 + t * 6));
}

/**
 * Función de easing lineal — alternativa simple
 */
export function linearEase(t: number): number {
  return t;
}

export interface SnapControllerConfig {
  coords: IHexCoords;
  easingFn?: (t: number) => number;
}

export interface ISnapController {
  /**
   * [MÉTODO] [EVENT HANDLER]
   * Se invoca al soltar el paneo
   */
  beginSnap(currentPosition: Vec2): void;

  /**
   * [MÉTODO] [CONTROL DE FLUJO] [ANIMACIÓN]
   * Retorna null si no está en snap
   */
  update(deltaTimeMs: number, durationMs?: number): Vec2 | null;

  readonly isActive: boolean;
}

export class SnapController implements ISnapController {
  private readonly coords: IHexCoords;
  private readonly easingFn: (t: number) => number;

  private snapStart: Vec2 | null = null;
  private snapTarget: Vec2 | null = null;
  private snapProgress: number = 0;
  private snapDuration: number = DEFAULT_CONFIG.snapDuration;
  private snapStartTime: number = 0;

  constructor(config: SnapControllerConfig) {
    this.coords = config.coords;
    this.easingFn = config.easingFn || cubicEase;
  }

  /**
   * Inicia el snap desde la posición actual hacia la celda hexagonal más cercana
   */
  beginSnap(currentPosition: Vec2): void {
    // Encontrar la celda hexagonal más cercana
    const targetCoord = this.coords.pixelToOffset(currentPosition);
    const targetPixel = this.coords.offsetToPixel(targetCoord);

    // Calcular distancia al objetivo
    const dx = targetPixel.x - currentPosition.x;
    const dy = targetPixel.y - currentPosition.y;
    const distSq = dx * dx + dy * dy;

    // Solo iniciar snap si la distancia supera el umbral
    const threshold = DEFAULT_CONFIG.snapThreshold;
    if (distSq > threshold * threshold) {
      this.snapStart = { ...currentPosition };
      this.snapTarget = { ...targetPixel };
      this.snapProgress = 0;
      this.snapStartTime = performance.now();
    } else {
      // Ya está suficientemente cerca — snap instantáneo
      this.snapStart = null;
      this.snapTarget = null;
      this.snapProgress = 1;
    }
  }

  /**
   * Actualiza el estado del snap y retorna la posición interpolada
   *
   * @param deltaTimeMs - Tiempo delta en milisegundos
   * @param durationMs - Duración opcional (override del default)
   * @returns Posición actual o null si no hay snap activo
   */
  update(deltaTimeMs: number, durationMs?: number): Vec2 | null {
    if (!this.snapStart || !this.snapTarget) {
      return null;
    }

    const duration = durationMs !== undefined ? durationMs : this.snapDuration;

    // Avanzar progreso
    this.snapProgress += deltaTimeMs / duration;

    // Clamp a [0, 1]
    if (this.snapProgress >= 1) {
      this.snapProgress = 1;
      const result = { ...this.snapTarget };

      // Limpiar estado al completar
      this.snapStart = null;
      this.snapTarget = null;

      return result;
    }

    // Aplicar easing
    const easedT = this.easingFn(this.snapProgress);

    // Interpolar entre start y target
    return {
      x: this.snapStart.x + (this.snapTarget.x - this.snapStart.x) * easedT,
      y: this.snapStart.y + (this.snapTarget.y - this.snapStart.y) * easedT
    };
  }

  /**
   * Indica si el snap está actualmente activo
   */
  get isActive(): boolean {
    return this.snapStart !== null && this.snapTarget !== null && this.snapProgress < 1;
  }

  /**
   * Obtiene la posición objetivo del snap (útil para debugging)
   */
  getTargetPosition(): Vec2 | null {
    return this.snapTarget;
  }

  /**
   * Obtiene la posición inicial del snap
   */
  getStartPosition(): Vec2 | null {
    return this.snapStart;
  }

  /**
   * Obtiene el progreso actual del snap (0..1)
   */
  getProgress(): number {
    return this.snapProgress;
  }

  /**
   * Cancela el snap actual
   */
  cancel(): void {
    this.snapStart = null;
    this.snapTarget = null;
    this.snapProgress = 0;
  }
}
