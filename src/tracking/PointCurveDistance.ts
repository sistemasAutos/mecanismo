//--- hex-eyes-engine/src/tracking/PointCurveDistance.ts 
/**
 * PointCurveDistance — Cálculo de punto más cercano en curva Bézier
 *
 * [FASE] 2 — Tracking (Bézier)
 * [MÉTODO] Muestreo grueso + refinamiento local (evita resolver polinomios grado 5)
 * [CRITERIO DE ACEPTACIÓN]
 *   - Error <2% del radio real sobre círculo aproximado por 4 curvas
 *   - Complejidad O(coarseSteps + refineIterations)
 */

import type { Vec2, CubicBezier } from '@core/types';
import { evaluateCubicBezier } from './BezierSubdivision';

export interface ClosestPointResult {
  point: Vec2;
  t: number;
  distance: number;
}

/**
 * Calcula distancia euclidiana al cuadrado (evita sqrt para eficiencia)
 */
function distanceSquared(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * Encuentra el punto más cercano en una curva de Bézier a un punto objetivo
 *
 * Método en dos fases:
 *   1. Muestreo grueso: evalúa coarseSteps puntos equiespaciados en t
 *   2. Refinamiento local: busca alrededor del mejor candidato con refineIterations
 *
 * Defaults sugeridos: coarseSteps=12, refineIterations=4
 * Esto da precisión suficiente para 60fps sin resolver polinomios de grado 5
 */
export function closestPointOnCurve(
  curve: CubicBezier,
  target: Vec2,
  coarseSteps: number = 12,
  refineIterations: number = 4
): ClosestPointResult {
  // Fase 1: Búsqueda gruesa
  let bestT = 0;
  let bestDistSq = Infinity;

  for (let i = 0; i <= coarseSteps; i++) {
    const t = i / coarseSteps;
    const point = evaluateCubicBezier(curve, t);
    const distSq = distanceSquared(point, target);

    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestT = t;
    }
  }

  // Fase 2: Refinamiento local (búsqueda binaria alrededor del mejor t)
  let searchRadius = 1 / coarseSteps;

  for (let iter = 0; iter < refineIterations; iter++) {
    searchRadius /= 2;

    // Evalúa 3 puntos: centro, izquierda, derecha
    const tLeft = Math.max(0, bestT - searchRadius);
    const tRight = Math.min(1, bestT + searchRadius);

    const candidates = [bestT, tLeft, tRight];

    for (const t of candidates) {
      const point = evaluateCubicBezier(curve, t);
      const distSq = distanceSquared(point, target);

      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestT = t;
      }
    }
  }

  // Resultado final
  const closestPoint = evaluateCubicBezier(curve, bestT);

  return {
    point: closestPoint,
    t: bestT,
    distance: Math.sqrt(bestDistSq)
  };
}

/**
 * Encuentra el punto más cercano en un path compuesto por múltiples curvas
 * Retorna además el índice de la curva que contiene el punto más cercano
 */
export function closestPointOnPath(
  curves: CubicBezier[],
  target: Vec2,
  coarseSteps?: number,
  refineIterations?: number
): ClosestPointResult & { curveIndex: number } {
  let globalBest: ClosestPointResult & { curveIndex: number } = {
    point: { x: 0, y: 0 },
    t: 0,
    distance: Infinity,
    curveIndex: 0
  };

  for (let i = 0; i < curves.length; i++) {
    const result = closestPointOnCurve(curves[i], target, coarseSteps, refineIterations);

    if (result.distance < globalBest.distance) {
      globalBest = { ...result, curveIndex: i };
    }
  }

  return globalBest;
}

/**
 * Versión optimizada para búsqueda continua (ej. tracking de puntero frame a frame)
 * Usa el resultado anterior como semilla para acelerar la convergencia
 */
export function closestPointOnCurveWarmStart(
  curve: CubicBezier,
  target: Vec2,
  previousT: number,
  searchRange: number = 0.3,
  refineIterations: number = 6
): ClosestPointResult {
  // Comienza desde el t anterior
  let bestT = Math.max(0, Math.min(1, previousT));
  let bestDistSq = distanceSquared(evaluateCubicBezier(curve, bestT), target);

  // Búsqueda local alrededor del punto anterior
  const stepSize = searchRange / refineIterations;

  // Busca hacia adelante
  for (let i = 1; i <= refineIterations; i++) {
    const t = Math.min(1, bestT + i * stepSize);
    const point = evaluateCubicBezier(curve, t);
    const distSq = distanceSquared(point, target);

    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestT = t;
    } else {
      break; // No mejora, detiene búsqueda en esta dirección
    }
  }

  // Busca hacia atrás
  for (let i = 1; i <= refineIterations; i++) {
    const t = Math.max(0, bestT - i * stepSize);
    const point = evaluateCubicBezier(curve, t);
    const distSq = distanceSquared(point, target);

    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestT = t;
    } else {
      break;
    }
  }

  const closestPoint = evaluateCubicBezier(curve, bestT);

  return {
    point: closestPoint,
    t: bestT,
    distance: Math.sqrt(bestDistSq)
  };
}
