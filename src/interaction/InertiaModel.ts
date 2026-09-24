//--- hex-eyes-engine/src/interaction/InertiaModel.ts 
/**
 * InertiaModel — Modelo de inercia con fricción exponencial
 *
 * [FASE] 3 — Physics / Interacción
 * [REFERENCIA] Patrón estándar de UI con scroll/paneo inercial (mapas, carruseles, listas)
 * [ALGORITMO ORIGINAL] Función relacionada con $a (inertiaDecay) del código original
 * [CRITERIO DE ACEPTACIÓN]
 *   - Decaimiento monótono, sin cambio de signo por error numérico
 *   - Converge en tiempo finito
 *   - v *= exp(-friction * dt)
 */

import type { Vec2 } from '@core/types';
import { DEFAULT_CONFIG } from '@core/types';

export interface InertiaModelConfig {
  frictionPerSecond: number; // ej. 4.0 ≈ 98% decaimiento en 1s
}

export interface IInertiaModel {
  /**
   * [MÉTODO] [EVENT HANDLER]
   * Establece la velocidad inicial
   */
  setInitialVelocity(v: Vec2): void;

  /**
   * [MÉTODO] [CONTROL DE FLUJO]
   * v *= exp(-friction * dt)
   * Retorna el desplazamiento del frame
   */
  step(deltaTimeMs: number): Vec2;

  readonly isSettled: boolean;
}

export class InertiaModel implements IInertiaModel {
  private readonly frictionPerSecond: number;

  private velocity: Vec2 = { x: 0, y: 0 };
  private readonly minVelocity: number;

  constructor(config: InertiaModelConfig = { frictionPerSecond: 1 / (DEFAULT_CONFIG.inertiaDecay / 1000) }) {
    this.frictionPerSecond = config.frictionPerSecond;
    this.minVelocity = DEFAULT_CONFIG.inertiaMinVelocity;
  }

  /**
   * Establece la velocidad inicial después de un evento de pointer up
   */
  setInitialVelocity(v: Vec2): void {
    this.velocity = { ...v };
  }

  /**
   * Aplica fricción exponencial y retorna el desplazamiento del frame
   *
   * Fórmula: v(t+dt) = v(t) * exp(-friction * dt)
   * Desplazamiento: integral de v(t) dt ≈ v * dt para dt pequeño
   *
   * @param deltaTimeMs - Tiempo delta en milisegundos
   * @returns Desplazamiento aplicado en este frame
   */
  step(deltaTimeMs: number): Vec2 {
    if (this.isSettled) {
      this.velocity = { x: 0, y: 0 };
      return { x: 0, y: 0 };
    }

    const dt = deltaTimeMs / 1000; // Convertir a segundos

    // Factor de decaimiento exponencial
    // El original usa una aproximación discreta basada en $a (325ms)
    const decayFactor = Math.exp(-this.frictionPerSecond * dt);

    // Aplicar decaimiento
    const prevVelX = this.velocity.x;
    const prevVelY = this.velocity.y;

    this.velocity.x *= decayFactor;
    this.velocity.y *= decayFactor;

    // Calcular desplazamiento como promedio entre velocidad anterior y nueva
    // Esto da una integración más suave que usar solo la velocidad inicial
    const avgVelX = (prevVelX + this.velocity.x) / 2;
    const avgVelY = (prevVelY + this.velocity.y) / 2;

    const displacement = {
      x: avgVelX * dt,
      y: avgVelY * dt
    };

    // Verificar si la velocidad es menor al umbral mínimo
    const speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
    if (speed < this.minVelocity) {
      this.velocity = { x: 0, y: 0 };
    }

    return displacement;
  }

  /**
   * Indica si la inercia se ha asentado (velocidad ≈ 0)
   */
  get isSettled(): boolean {
    const speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
    return speed < this.minVelocity;
  }

  /**
   * Obtiene la velocidad actual
   */
  getVelocity(): Vec2 {
    return { ...this.velocity };
  }

  /**
   * Obtiene la magnitud de la velocidad actual (speed)
   */
  getSpeed(): number {
    return Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
  }

  /**
   * Detiene la inercia inmediatamente
   */
  stop(): void {
    this.velocity = { x: 0, y: 0 };
  }

  /**
   * Aplica un impulso adicional a la velocidad actual
   * Útil para combinar múltiples gestos de swipe
   */
  addImpulse(impulse: Vec2): void {
    this.velocity.x += impulse.x;
    this.velocity.y += impulse.y;
  }
}
