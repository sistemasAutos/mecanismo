//--- hex-eyes-engine/src/render/RenderPipeline.ts
/**
 * RenderPipeline.ts — Orquestador de capas de renderizado
 *
 * [FASE] 4 — Render
 * [CRITERIO DE ACEPTACIÓN] <10ms de render puro con 500 celdas en hardware gama media
 * [DEPENDENCIA] SpriteCache, GridLayer, SatelliteLayer, LineLayer
 */

import type { FrameData, EngineConfig } from '../core/types';
import type { IRenderLayer } from './layers/types';
import { GridLayer } from './layers/GridLayer';
import { SatelliteLayer } from './layers/SatelliteLayer';
import { LineLayer } from './layers/LineLayer';
import type { SpriteCache } from './SpriteCache';

export interface RenderPipelineConfig {
  gridCtx: CanvasRenderingContext2D;
  satCtx: CanvasRenderingContext2D;
  lineCtx: CanvasRenderingContext2D;
  spriteCache: SpriteCache;
  config: EngineConfig;
}

export class RenderPipeline {
  private gridLayer: IRenderLayer;
  private satelliteLayer: IRenderLayer;
  private lineLayer: IRenderLayer;

  private gridCtx: CanvasRenderingContext2D;
  private satCtx: CanvasRenderingContext2D;
  private lineCtx: CanvasRenderingContext2D;

  private config: EngineConfig;

  constructor(cfg: RenderPipelineConfig) {
    this.gridCtx = cfg.gridCtx;
    this.satCtx = cfg.satCtx;
    this.lineCtx = cfg.lineCtx;
    this.config = cfg.config;

    // Inicializa capas sin configuración (usan defaults internos)
    this.gridLayer = new GridLayer();
    this.satelliteLayer = new SatelliteLayer();
    this.lineLayer = new LineLayer();
  }

  /**
   * Renderiza un frame completo en las 3 capas
   * [MÉTODO] [RENDER] [CONTROL DE FLUJO] Una vez por tick de rAF
   */
  renderFrame(frameData: FrameData): void {
    const width = this.gridCtx.canvas.width / (window.devicePixelRatio || 1);
    const height = this.gridCtx.canvas.height / (window.devicePixelRatio || 1);

    // Limpia todos los canvases
    this.gridCtx.clearRect(0, 0, width, height);
    this.satCtx.clearRect(0, 0, width, height);
    this.lineCtx.clearRect(0, 0, width, height);

    // Capa 1: Grid principal (ojos)
    this.gridLayer.draw(this.gridCtx, frameData);

    // Capa 2: Satélites (etiquetas, textos orbitales)
    this.satelliteLayer.draw(this.satCtx, frameData);

    // Capa 3: Líneas de tracking
    this.lineLayer.draw(this.lineCtx, frameData);
  }
}
