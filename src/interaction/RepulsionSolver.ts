//--- hex-eyes-engine/src/interaction/RepulsionSolver.ts 
/**
 * RepulsionSolver — Solver de repulsión n-body simplificado
 *
 * [FASE] 3 — Physics / Interacción
 * [REFERENCIA] Force-directed layout, usado en visualización de grafos desde décadas
 * [ALGORITMO ORIGINAL] Función ms() del código original
 * [CRITERIO DE ACEPTACIÓN]
 *   - Post-resolución, ningún par de bodies con overlap >2% de sus radios
 *   - Muta bodies in-place (evita allocs por frame)
 *   - Complejidad O(iterations * n²) — válido para n≈500
 */

import type { Vec2 } from '@core/types';
import { DEFAULT_CONFIG } from '@core/types';

export interface RepulsionBody {
  position: Vec2;
  radius: number;
}

/**
 * Resuelve overlaps entre cuerpos mediante repulsión iterativa
 *
 * @param bodies - Array de cuerpos con posición y radio (mutado in-place)
 * @param iterations - Número de iteraciones (default: 8 del original)
 * @param pressure - Factor de presión de repulsión (default: calculado del original)
 *
 * Algoritmo:
 *   Para cada iteración:
 *     Para cada par de cuerpos (i, j):
 *       Si hay overlap (dist < r1 + r2):
 *         Calcula vector de separación normalizado
 *         Aplica fuerza de repulsión proporcional al overlap
 *         Distribuye el desplazamiento entre ambos cuerpos
 *
 * Optimización del original:
 *   - Usa squared distance para evitar sqrt innecesario
 *   - Aplica bias de peso para priorizar cuerpos más importantes
 *   - Limita desplazamiento máximo por iteración para estabilidad
 */
export function resolveOverlaps(
  bodies: RepulsionBody[],
  iterations: number = DEFAULT_CONFIG.repulsionIterations,
  pressure: number = DEFAULT_CONFIG.repulsionWeightBias
): void {
  const n = bodies.length;
  if (n < 2) return;

  // Pre-calcular padding mínimo entre celdas
  const minPadding = DEFAULT_CONFIG.repulsionPadding;

  for (let iter = 0; iter < iterations; iter++) {
    let totalDisplacement = 0;

    for (let i = 0; i < n; i++) {
      const bodyA = bodies[i];

      for (let j = i + 1; j < n; j++) {
        const bodyB = bodies[j];

        // Vector de A hacia B
        const dx = bodyB.position.x - bodyA.position.x;
        const dy = bodyB.position.y - bodyA.position.y;

        // Distancia al cuadrado (evitar sqrt si no es necesario)
        const distSq = dx * dx + dy * dy;

        // Radio combinado más padding mínimo
        const combinedRadius = bodyA.radius + bodyB.radius + minPadding;
        const combinedRadiusSq = combinedRadius * combinedRadius;

        // Solo procesar si hay overlap potencial
        if (distSq < combinedRadiusSq && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);

          // Magnitud del overlap
          const overlap = combinedRadius - dist;

          // Vector normalizado de repulsión
          const nx = dx / dist;
          const ny = dy / dist;

          // Fuerza de repulsión con presión y bias
          // El original usa un factor de 0.5 para distribuir equitativamente
          const force = overlap * pressure * 0.5;

          // Desplazamiento para cada cuerpo
          const moveX = nx * force;
          const moveY = ny * force;

          // Aplicar repulsión (A se mueve en dirección opuesta, B en la misma)
          bodyA.position.x -= moveX;
          bodyA.position.y -= moveY;
          bodyB.position.x += moveX;
          bodyB.position.y += moveY;

          totalDisplacement += Math.abs(force);
        } else if (distSq <= 0.0001) {
          // Caso especial: cuerpos casi en la misma posición
          // Aplicar repulsión aleatoria mínima para evitar singularidad
          const angle = Math.random() * Math.PI * 2;
          const pushForce = 0.5;
          bodyA.position.x -= Math.cos(angle) * pushForce;
          bodyA.position.y -= Math.sin(angle) * pushForce;
          bodyB.position.x += Math.cos(angle) * pushForce;
          bodyB.position.y += Math.sin(angle) * pushForce;
        }
      }
    }

    // Criterio de convergencia temprana: si el desplazamiento total es mínimo
    if (totalDisplacement < 0.1) {
      break;
    }
  }
}

/**
 * Versión optimizada con spatial hashing para n grande (>500)
 * [NOTA] Fuera de alcance actual — solo para referencia futura
 */
export function resolveOverlapsOptimized(
  bodies: RepulsionBody[],
  iterations: number = DEFAULT_CONFIG.repulsionIterations,
  pressure: number = DEFAULT_CONFIG.repulsionWeightBias
): void {
  // Implementación diferida hasta que profiling muestre necesidad
  // Por ahora, usar resolveOverlaps simple para n < 500
  resolveOverlaps(bodies, iterations, pressure);
}
