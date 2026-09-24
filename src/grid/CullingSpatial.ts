/**
 * CullingSpatial.ts — Determinación de visibilidad de celdas en Viewport
 *
 * [REFERENCIA] Lógica en original eyes_grid.min.js
 */

import type { Vec2, CellPlacement } from '../core/types';

export interface ViewportBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export class CullingSpatial {
  private readonly cullMarginPx: number;

  constructor(cullMarginPx: number = 200) {
    this.cullMarginPx = cullMarginPx;
  }

  /**
   * Calcula los límites en píxeles del viewport actual considerando cámara y zoom
   */
  public getViewportBounds(screenSize: Vec2, cameraOffset: Vec2, zoom: number): ViewportBounds {
    const halfW = (screenSize.x / (2 * zoom)) + this.cullMarginPx;
    const halfH = (screenSize.y / (2 * zoom)) + this.cullMarginPx;

    return {
      minX: cameraOffset.x - halfW,
      minY: cameraOffset.y - halfH,
      maxX: cameraOffset.x + halfW,
      maxY: cameraOffset.y + halfH
    };
  }

  /**
   * Determina si una celda cae dentro de los límites del viewport
   */
  public isCellVisible(cell: CellPlacement, bounds: ViewportBounds): boolean {
    return (
      cell.center.x >= bounds.minX &&
      cell.center.x <= bounds.maxX &&
      cell.center.y >= bounds.minY &&
      cell.center.y <= bounds.maxY
    );
  }
}
