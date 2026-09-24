//+++ eye-ingeniere/src/state/CameraState.ts
//--- hex-eyes-engine/src/state/CameraState.ts
/**
 * CameraState — Estado encapsulado de la cámara
 *
 * [FASE] 5 — Orquestación / Estado
 * [REFERENCIA] Evita el anti-patrón de variables globales dispersas
 * [CRITERIO DE ACEPTACIÓN]
 *   - Encapsula offset, zoom y targetZoom
 *   - Permite transiciones suaves de zoom
 */

import type { Vec2 } from '@core/types';
import { DEFAULT_CONFIG } from '@core/types';

export interface CameraStateConfig {
  initialZoom?: number;
}

export class CameraState {
  private _offset: Vec2 = { x: 0, y: 0 };
  private _zoom: number;
  private _targetZoom: number;
  private readonly zoomSpeed: number = 0.1;

  constructor(config: CameraStateConfig = {}) {
    this._zoom = config.initialZoom ?? DEFAULT_CONFIG.cameraZoomDefault;
    this._targetZoom = this._zoom;
  }

  /**
   * Offset actual de la cámara
   */
  get offset(): Vec2 {
    return { ...this._offset };
  }

  set offset(value: Vec2) {
    this._offset = { ...value };
  }

  /**
   * Zoom actual (interpolado hacia targetZoom)
   */
  get zoom(): number {
    return this._zoom;
  }

  set zoom(value: number) {
    this._zoom = Math.max(0.1, Math.min(3.0, value));
  }

  /**
   * Zoom objetivo (para interpolación suave)
   */
  get targetZoom(): number {
    return this._targetZoom;
  }

  set targetZoom(value: number) {
    this._targetZoom = Math.max(0.1, Math.min(3.0, value));
  }

  /**
   * Actualiza el zoom interpolando hacia el target
   *
   * @param deltaTimeMs - Tiempo delta en milisegundos
   */
  update(deltaTimeMs: number): void {
    if (Math.abs(this._zoom - this._targetZoom) > 0.001) {
      const t = Math.min(1, (deltaTimeMs / 1000) * this.zoomSpeed);
      this._zoom += (this._targetZoom - this._zoom) * t;
    } else {
      this._zoom = this._targetZoom;
    }
  }

  /**
   * Aplica zoom en un punto específico (para scroll wheel)
   *
   * @param delta - Delta de zoom (positivo = acercar)
   * @param point - Punto en pantalla donde aplicar zoom
   */
  zoomAtPoint(delta: number, point: Vec2): void {
    const zoomFactor = 1 + delta * 0.1;
    const newZoom = this._zoom * zoomFactor;

    // Clamp zoom
    this._targetZoom = Math.max(0.1, Math.min(3.0, newZoom));

    // Ajustar offset para mantener el punto bajo el cursor
    if (Math.abs(this._zoom - 1) > 0.001) {
      const scaleChange = this._targetZoom / this._zoom;
      this._offset.x = point.x - (point.x - this._offset.x) * scaleChange;
      this._offset.y = point.y - (point.y - this._offset.y) * scaleChange;
    }
  }

  /**
   * Reinicia la cámara a estado default
   */
  reset(): void {
    this._offset = { x: 0, y: 0 };
    this._zoom = DEFAULT_CONFIG.cameraZoomDefault;
    this._targetZoom = this._zoom;
  }

  /**
   * Obtiene el estado completo serializable
   */
  toJSON(): { offset: Vec2; zoom: number; targetZoom: number } {
    return {
      offset: { ...this._offset },
      zoom: this._zoom,
      targetZoom: this._targetZoom
    };
  }

  /**
   * Restaura estado desde JSON
   */
  fromJSON(data: { offset: Vec2; zoom: number; targetZoom: number }): void {
    this._offset = { ...data.offset };
    this._zoom = data.zoom;
    this._targetZoom = data.targetZoom ?? data.zoom;
  }
}
