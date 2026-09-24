//--- hex-eyes-engine/src/interaction/PanController.ts 
/**
 * PanController — Controlador de paneo con eventos de puntero
 *
 * [FASE] 3 — Physics / Interacción
 * [REFERENCIA] Patrón estándar de traducción de eventos de puntero
 * [ALGORITMO ORIGINAL] Funciones relacionadas con pointer events del código original
 * [CRITERIO DE ACEPTACIÓN]
 *   - Traduce eventos de puntero a desplazamientos de cámara
 *   - Calcula velocidad para inercia al soltar
 *   - Compatible con touch y mouse
 */

import type { Vec2 } from '@core/types';
import { DEFAULT_CONFIG } from '@core/types';

export interface IPanController {
  /**
   * [EVENT HANDLER]
   * Se invoca al presionar el puntero
   */
  onPointerDown(point: Vec2): void;

  /**
   * [EVENT HANDLER]
   * Se invoca al mover el puntero
   * @param point - Posición actual del puntero en pantalla
   * @param cameraOffset - Offset actual de la cámara
   * @returns Nuevo offset de cámara
   */
  onPointerMove(point: Vec2, cameraOffset: Vec2): Vec2;

  /**
   * [EVENT HANDLER]
   * Se invoca al soltar el puntero
   */
  onPointerUp(): void;

  /**
   * Obtiene la velocidad calculada al soltar (para inercia)
   */
  getVelocity(): Vec2 | null;

  /**
   * Indica si se está realizando un paneo activo
   */
  readonly isPanning: boolean;
}

interface PointerHistoryEntry {
  position: Vec2;
  timestamp: number;
}

export class PanController implements IPanController {
  private isDragging: boolean = false;
  private lastPointerPos: Vec2 | null = null;
  private panStartOffset: Vec2 | null = null;

  // Historial de posiciones para calcular velocidad
  private pointerHistory: PointerHistoryEntry[] = [];
  private readonly maxHistoryLength: number = 5;
  private readonly historyTimeWindow: number = 100; // ms

  /**
   * Maneja el evento pointerdown
   */
  onPointerDown(point: Vec2): void {
    this.isDragging = true;
    this.lastPointerPos = { ...point };
    this.pointerHistory = [{
      position: { ...point },
      timestamp: performance.now()
    }];
  }

  /**
   * Maneja el evento pointermove y retorna el nuevo offset de cámara
   *
   * @param point - Posición actual del puntero
   * @param cameraOffset - Offset actual de la cámara
   * @returns Nuevo offset de cámara
   */
  onPointerMove(point: Vec2, cameraOffset: Vec2): Vec2 {
    if (!this.isDragging || !this.lastPointerPos) {
      return cameraOffset;
    }

    const now = performance.now();

    // Calcular delta desde el último frame
    const deltaX = point.x - this.lastPointerPos.x;
    const deltaY = point.y - this.lastPointerPos.y;

    // Actualizar offset de cámara
    const newOffset = {
      x: cameraOffset.x + deltaX,
      y: cameraOffset.y + deltaY
    };

    // Actualizar última posición
    this.lastPointerPos = { ...point };

    // Agregar al historial para cálculo de velocidad
    this.pointerHistory.push({
      position: { ...point },
      timestamp: now
    });

    // Limpiar historial antiguo
    this.pruneHistory(now);

    return newOffset;
  }

  /**
   * Maneja el evento pointerup
   * Calcula la velocidad final basada en el historial
   */
  onPointerUp(): void {
    if (!this.isDragging) {
      return;
    }

    this.isDragging = false;

    // Calcular velocidad basada en el historial
    if (this.pointerHistory.length >= 2) {
      const oldest = this.pointerHistory[0];
      const newest = this.pointerHistory[this.pointerHistory.length - 1];

      const dt = (newest.timestamp - oldest.timestamp) / 1000; // segundos

      if (dt > 0.016) { // Mínimo ~16ms para evitar divisiones por cero
        const dx = newest.position.x - oldest.position.x;
        const dy = newest.position.y - oldest.position.y;

        // Velocidad en px/segundo
        this.velocity = {
          x: dx / dt,
          y: dy / dt
        };
      } else {
        this.velocity = { x: 0, y: 0 };
      }
    } else {
      this.velocity = { x: 0, y: 0 };
    }

    // Limpiar historial
    this.pointerHistory = [];
    this.lastPointerPos = null;
    this.panStartOffset = null;
  }

  /**
   * Elimina entradas antiguas del historial fuera de la ventana de tiempo
   */
  private pruneHistory(now: number): void {
    const cutoff = now - this.historyTimeWindow;

    // Mantener solo entradas recientes
    while (
      this.pointerHistory.length > 1 &&
      this.pointerHistory[0].timestamp < cutoff
    ) {
      this.pointerHistory.shift();
    }

    // Limitar longitud máxima
    while (this.pointerHistory.length > this.maxHistoryLength) {
      this.pointerHistory.shift();
    }
  }

  // Velocidad calculada al soltar
  private velocity: Vec2 | null = null;

  /**
   * Obtiene la velocidad calculada al soltar (para inercia)
   */
  getVelocity(): Vec2 | null {
    return this.velocity;
  }

  /**
   * Indica si se está realizando un paneo activo
   */
  get isPanning(): boolean {
    return this.isDragging;
  }

  /**
   * Cancela el paneo actual sin calcular velocidad
   */
  cancel(): void {
    this.isDragging = false;
    this.velocity = null;
    this.pointerHistory = [];
    this.lastPointerPos = null;
    this.panStartOffset = null;
  }

  /**
   * Reinicia el estado del controlador
   */
  reset(): void {
    this.cancel();
  }
}
