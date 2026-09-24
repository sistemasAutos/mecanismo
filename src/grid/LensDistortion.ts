//--- hex-eyes-engine/src/grid/LensDistortion.ts 
/**
 * LensDistortion — Distorsión de lente radial para efecto de ojo de pez
 *
 * [FASE] 1 — Grid math
 * [ALGORITMO ORIGINAL] Funciones ks(), mc() del código original
 * [CRITERIO DE ACEPTACIÓN]
 *   - scaleFactorAt es monótona no-creciente respecto a distancia
 *   - En d=0 (centro) devuelve 1.0
 *   - applyToPosition aplica la distorsión correctamente
 */

import type { Vec2 } from '@core/types';
import { DEFAULT_CONFIG, type EngineConfig } from '@core/types';

export interface LensDistortionConfig {
  strength01: number;       // 0 = sin distorsión, 1 = máxima
  falloffRadiusPx: number;
}

export interface ILensDistortion {
  /**
   * [MÉTODO] [FUNCIÓN PURA]
   * Aplica la distorsión de lente a una posición
   */
  applyToPosition(rawPosition: Vec2, cameraCenter: Vec2): Vec2;

  /**
   * [MÉTODO] [FUNCIÓN PURA]
   * Calcula el factor de escala en una posición dada
   * Invariante: monótona no-creciente respecto a distancia
   * En d=0 devuelve 1.0
   */
  scaleFactorAt(rawPosition: Vec2, cameraCenter: Vec2): number;
}

/**
 * Implementación de distorsión de lente basada en el original
 *
 * El algoritmo original usa:
 *   - ks(n) = n < Kt ? 1 + (Un - 1) * (1 - jn(n / Kt)) : 1
 *   - Donde jn es la interpolación cúbica: jn(e) = e²(3-2e)
 *   - Un = He (1.9) o ta (2.15) dependiendo del viewport
 *   - Kt = min(w, O) / 2 (mitad de la dimensión menor)
 *
 * La función produce un efecto de "lente" donde:
 *   - Centro: scale = 1.0 (sin distorsión)
 *   - Bordes: scale = Un (máxima expansión, típicamente 1.9-2.15)
 *   - Transición suave vía interpolación cúbica
 */
export class LensDistortion implements ILensDistortion {
  private readonly strength: number;
  private readonly falloffRadius: number;
  private readonly maxScale: number;

  constructor(config: LensDistortionConfig & { maxScale?: number } = {
    strength01: DEFAULT_CONFIG.lensStrength,
    falloffRadiusPx: DEFAULT_CONFIG.lensFalloff,
    maxScale: DEFAULT_CONFIG.lensMaxScale
  }) {
    this.strength = Math.max(0, Math.min(1, config.strength01));
    this.falloffRadius = config.falloffRadiusPx;
    this.maxScale = config.maxScale ?? DEFAULT_CONFIG.lensMaxScale;
  }

  /**
   * Interpolación cúbica original (función jn)
   * jn(e) = e * e * (3 - 2 * e)
   * Produce una curva suave de easing in-out
   */
  private cubicEase(t: number): number {
    const clamped = Math.max(0, Math.min(1, t));
    return clamped * clamped * (3 - 2 * clamped);
  }

  /**
   * Calcula el factor de escala basado en la distancia al centro
   * Fórmula adaptada del original:
   *   scale(d) = 1 + (maxScale - 1) * (1 - jn(d / falloffRadius))
   */
  private rawScaleFactor(distanceFromCenter: number, referenceRadius: number): number {
    if (distanceFromCenter <= 0) return 1.0;

    const normalizedDistance = distanceFromCenter / referenceRadius;

    if (normalizedDistance >= 1) return 1.0;

    // Interpola entre 1.0 (centro) y maxScale (borde)
    const easeValue = this.cubicEase(normalizedDistance);
    const baseScale = 1 + (this.maxScale - 1) * (1 - easeValue);

    // Aplica la fuerza de la lente (strength)
    // strength=0 → scale=1.0 siempre, strength=1 → scale completo
    return 1 + (baseScale - 1) * this.strength;
  }

  /**
   * Aplica la distorsión de lente a una posición
   *
   * Algoritmo:
   *   1. Calcula vector desde el centro a la posición
   *   2. Calcula distancia normalizada
   *   3. Obtiene factor de escala
   *   4. Escala la posición radialmente desde el centro
   */
  applyToPosition(rawPosition: Vec2, cameraCenter: Vec2): Vec2 {
    const dx = rawPosition.x - cameraCenter.x;
    const dy = rawPosition.y - cameraCenter.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 1e-6) {
      // En el centro exacto, no hay distorsión
      return { ...rawPosition };
    }

    // Usa la mitad de la dimensión menor como radio de referencia
    // Esto coincide con el comportamiento del original
    const referenceRadius = Math.max(distance, this.falloffRadius);
    const scale = this.rawScaleFactor(distance, referenceRadius);

    // Escala radialmente desde el centro
    const scaledDistance = distance * scale;
    const ratio = scaledDistance / distance;

    return {
      x: cameraCenter.x + dx * ratio,
      y: cameraCenter.y + dy * ratio
    };
  }

  /**
   * Calcula el factor de escala en una posición dada
   * Sin modificar la posición, solo retorna el factor
   */
  scaleFactorAt(rawPosition: Vec2, cameraCenter: Vec2): number {
    const dx = rawPosition.x - cameraCenter.x;
    const dy = rawPosition.y - cameraCenter.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 1e-6) return 1.0;

    const referenceRadius = Math.max(distance, this.falloffRadius);
    return this.rawScaleFactor(distance, referenceRadius);
  }

  /**
   * Calcula el factor de escala inverso (para deshacer la distorsión)
   * Útil para mapear coordenadas de pantalla a coordenadas lógicas
   */
  inverseScaleFactorAt(rawPosition: Vec2, cameraCenter: Vec2): number {
    const scale = this.scaleFactorAt(rawPosition, cameraCenter);
    return scale > 1e-6 ? 1 / scale : 1.0;
  }

  /**
   * Crea una nueva instancia con parámetros modificados
   * Método útil para actualizaciones dinámicas (ej. cambio mobile/desktop)
   */
  withOverrides(overrides: Partial<LensDistortionConfig & { maxScale?: number }>): LensDistortion {
    return new LensDistortion({
      strength01: overrides.strength01 ?? this.strength,
      falloffRadiusPx: overrides.falloffRadiusPx ?? this.falloffRadius,
      maxScale: overrides.maxScale ?? this.maxScale
    });
  }

  /**
   * Verifica si la distorsión está activa (strength > 0)
   */
  isActive(): boolean {
    return this.strength > 0.001;
  }

  /**
   * Obtiene el factor de escala máximo posible
   */
  getMaxScale(): number {
    return 1 + (this.maxScale - 1) * this.strength;
  }
}
