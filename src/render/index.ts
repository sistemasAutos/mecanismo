//--- hex-eyes-engine/src/render/index.ts
/**
 * Render module — Export unificado de renderizado
 *
 * [FASE] 4 — Render
 * Módulos: SpriteCache, RenderPipeline, layers (GridLayer, SatelliteLayer, LineLayer)
 */

export { SpriteCache, type SpriteKey, type CachedSprite, type SpriteCacheConfig } from './SpriteCache';
export { GridLayer } from './layers/GridLayer';
export { SatelliteLayer } from './layers/SatelliteLayer';
export { LineLayer } from './layers/LineLayer';
export type { GridLayerConfig, SatelliteLayerConfig, LineLayerConfig, IRenderLayer, BaseLayerConfig } from './layers/types';
