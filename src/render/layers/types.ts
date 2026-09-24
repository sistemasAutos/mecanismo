
//ngeniere/src/render/layers/types.ts (修改后)
//--- hex-eyes-engine/src/render/layers/types.ts
/**
 * Tipos y contratos para capas de renderizado
 *
 * [FASE] 4 — Render
 * [CONTRATO] Interface único para todas las capas — intercambiables y testeables por separado
 */

import type { FrameData, OffsetCoord, Vec2 } from '@core/types';

/**
 * Contrato común para todas las capas de renderizado
 *
 * [CRITERIO DE ACEPTACIÓN]
 *   - <10ms de render puro con 500 celdas (medido con performance.now())
 *   - Interfaz uniforme para composición de pipeline
 */
export interface IRenderLayer {
  /**
   * [MÉTODO] [RENDER]
   * Dibuja la capa en el contexto dado
   *
   * @param ctx - Contexto de canvas
   * @param frameData - Datos del frame actual
   */
  draw(ctx: CanvasRenderingContext2D, frameData: FrameData): void;
}

/**
 * Configuración base para capas
 */
export interface BaseLayerConfig {
  enabled?: boolean;
  zIndex?: number;
}

/**
 * Configuración específica para GridLayer
 */
export interface GridLayerConfig extends BaseLayerConfig {
  cellSize?: number;
}

/**
 * Configuración específica para SatelliteLayer
 */
export interface SatelliteLayerConfig extends BaseLayerConfig {
  fontSize?: number;
}

/**
 * Configuración específica para LineLayer
 */
export interface LineLayerConfig extends BaseLayerConfig {
  lineWidth?: number;
}

export type { FrameData, OffsetCoord, Vec2 };