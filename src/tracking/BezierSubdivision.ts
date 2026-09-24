//--- hex-eyes-engine/src/tracking/BezierSubdivision.ts 
/**
 * BezierSubdivision — Álgebra de curvas de Bézier cúbicas
 *
 * [FASE] 2 — Tracking (Bézier)
 * [REFERENCIA] Farin, "Curves and Surfaces for CAGD", cap. 2
 * [ALGORITMO] De Casteljau — dominio público
 * [CRITERIO DE ACEPTACIÓN]
 *   - evaluateCubicBezier(t=0) === p0, t=1 === p3 (exacto salvo epsilon)
 *   - subdivideCubicBezier produce dos curvas que reconstruyen la original
 */

import type { Vec2, CubicBezier } from '@core/types';

/**
 * Evalúa una curva de Bézier cúbica en el parámetro t ∈ [0,1]
 * Usa el algoritmo de De Casteljau para estabilidad numérica
 *
 * Fórmula: B(t) = (1-t)³p0 + 3(1-t)²tp1 + 3(1-t)t²p2 + t³p3
 */
export function evaluateCubicBezier(curve: CubicBezier, t: number): Vec2 {
  const clampedT = Math.max(0, Math.min(1, t));
  const mt = 1 - clampedT;

  // Algoritmo de De Casteljau (más estable que la fórmula directa)
  // Nivel 1: interpolación entre puntos de control
  const q0x = curve.p0.x * mt + curve.p1.x * clampedT;
  const q0y = curve.p0.y * mt + curve.p1.y * clampedT;

  const q1x = curve.p1.x * mt + curve.p2.x * clampedT;
  const q1y = curve.p1.y * mt + curve.p2.y * clampedT;

  const q2x = curve.p2.x * mt + curve.p3.x * clampedT;
  const q2y = curve.p2.y * mt + curve.p3.y * clampedT;

  // Nivel 2: interpolación entre resultados del nivel 1
  const r0x = q0x * mt + q1x * clampedT;
  const r0y = q0y * mt + q1y * clampedT;

  const r1x = q1x * mt + q2x * clampedT;
  const r1y = q1y * mt + q2y * clampedT;

  // Nivel 3: punto final en la curva
  return {
    x: r0x * mt + r1x * clampedT,
    y: r0y * mt + r1y * clampedT
  };
}

/**
 * Muestrea una curva de Bézier en segmentos equiespaciados en t
 * Complejidad O(segments)
 *
 * NOTA: El muestreo es equiespaciado en t, no en arco-longitud
 * Para arco-longitud uniforme se requiere integración numérica adicional
 */
export function sampleCubicBezier(curve: CubicBezier, segments: number): Vec2[] {
  const result: Vec2[] = [];
  const step = 1 / Math.max(1, segments);

  for (let i = 0; i <= segments; i++) {
    const t = i * step;
    result.push(evaluateCubicBezier(curve, t));
  }

  return result;
}

/**
 * Subdivide una curva de Bézier en dos mitades en el parámetro t
 * Retorna dos curvas nuevas que juntas reconstruyen la original
 *
 * Algoritmo de De Casteljau aplicado hasta obtener los puntos de control
 * de ambas subdivisiones.
 */
export function subdivideCubicBezier(curve: CubicBezier, t: number): [CubicBezier, CubicBezier] {
  const clampedT = Math.max(0, Math.min(1, t));
  const mt = 1 - clampedT;

  // Nivel 1: interpolación entre puntos de control originales
  const q0: Vec2 = {
    x: curve.p0.x * mt + curve.p1.x * clampedT,
    y: curve.p0.y * mt + curve.p1.y * clampedT
  };

  const q1: Vec2 = {
    x: curve.p1.x * mt + curve.p2.x * clampedT,
    y: curve.p1.y * mt + curve.p2.y * clampedT
  };

  const q2: Vec2 = {
    x: curve.p2.x * mt + curve.p3.x * clampedT,
    y: curve.p2.y * mt + curve.p3.y * clampedT
  };

  // Nivel 2: interpolación entre resultados del nivel 1
  const r0: Vec2 = {
    x: q0.x * mt + q1.x * clampedT,
    y: q0.y * mt + q1.y * clampedT
  };

  const r1: Vec2 = {
    x: q1.x * mt + q2.x * clampedT,
    y: q1.y * mt + q2.y * clampedT
  };

  // Nivel 3: punto de subdivisión (punto en la curva en t)
  const pointOnCurve: Vec2 = {
    x: r0.x * mt + r1.x * clampedT,
    y: r0.y * mt + r1.y * clampedT
  };

  // Primera mitad: desde p0 hasta pointOnCurve
  const left: CubicBezier = {
    p0: curve.p0,
    p1: q0,
    p2: r0,
    p3: pointOnCurve
  };

  // Segunda mitad: desde pointOnCurve hasta p3
  const right: CubicBezier = {
    p0: pointOnCurve,
    p1: r1,
    p2: q2,
    p3: curve.p3
  };

  return [left, right];
}

/**
 * Calcula la longitud aproximada de una curva mediante muestreo
 * Útil para normalizar parámetros por arco-longitud
 */
export function approximateCurveLength(curve: CubicBezier, segments: number = 20): number {
  const samples = sampleCubicBezier(curve, segments);
  let length = 0;

  for (let i = 1; i < samples.length; i++) {
    const dx = samples[i].x - samples[i - 1].x;
    const dy = samples[i].y - samples[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }

  return length;
}
