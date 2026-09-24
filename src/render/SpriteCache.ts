//--- hex-eyes-engine/src/render/SpriteCache.ts 
/**
 * SpriteCache — Cache de sprites en offscreen canvas para renderizado eficiente
 *
 * [FASE] 4 — Render (ya entregado, integrado aquí)
 * [REFERENCIA] Patrón documentado por MDN y usado en cualquier motor Canvas2D con volumen de sprites
 * [CRITERIO DE ACEPTACIÓN]
 *   - getOrCreate retorna sprite cacheado o crea nuevo
 *   - delete elimina sprite específico
 *   - clear limpia todo el cache
 *   - evictLeastRecentlyUsed elimina el menos usado cuando se excede capacidad
 */

import type { Vec2 } from '@core/types';

export interface SpriteKey {
  shapeId: string;
  colorway: string;
  scale: number;
  animFrame?: number;
}

export interface CachedSprite {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  key: SpriteKey;
  lastUsed: number;
  useCount: number;
  width: number;
  height: number;
}

export interface SpriteCacheConfig {
  maxSprites: number;
  useOffscreen: boolean;
}

const DEFAULT_CONFIG: SpriteCacheConfig = {
  maxSprites: 100,
  useOffscreen: true
};

export class SpriteCache {
  private readonly cache: Map<string, CachedSprite>;
  private readonly maxSprites: number;
  private readonly useOffscreen: boolean;

  constructor(config: SpriteCacheConfig = DEFAULT_CONFIG) {
    this.cache = new Map();
    this.maxSprites = config.maxSprites;
    this.useOffscreen = config.useOffscreen;
  }

  /**
   * Genera una clave única para un sprite
   */
  private generateKey(key: SpriteKey): string {
    return `${key.shapeId}_${key.colorway}_${key.scale.toFixed(3)}_${key.animFrame ?? 0}`;
  }

  /**
   * Obtiene un sprite del cache o lo crea si no existe
   *
   * @param key - Clave del sprite
   * @param createFn - Función para crear el sprite si no existe
   * @returns Sprite cacheado
   */
  getOrCreate(
    key: SpriteKey,
    createFn: () => OffscreenCanvas | HTMLCanvasElement
  ): CachedSprite {
    const cacheKey = this.generateKey(key);

    // Verificar si ya está en cache
    const existing = this.cache.get(cacheKey);
    if (existing) {
      existing.lastUsed = performance.now();
      existing.useCount++;
      return existing;
    }

    // Crear nuevo sprite
    const canvas = createFn();
    const sprite: CachedSprite = {
      canvas,
      key: { ...key },
      lastUsed: performance.now(),
      useCount: 1,
      width: canvas.width,
      height: canvas.height
    };

    // Verificar si necesitamos hacer espacio
    if (this.cache.size >= this.maxSprites) {
      this.evictLeastRecentlyUsed();
    }

    this.cache.set(cacheKey, sprite);
    return sprite;
  }

  /**
   * Elimina un sprite específico del cache
   */
  delete(key: SpriteKey): boolean {
    const cacheKey = this.generateKey(key);
    return this.cache.delete(cacheKey);
  }

  /**
   * Limpia todo el cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Elimina el sprite menos usado (LRU eviction)
   */
  evictLeastRecentlyUsed(): void {
    if (this.cache.size === 0) return;

    let lruKey: string | null = null;
    let lruTime = Infinity;

    for (const [key, sprite] of this.cache.entries()) {
      if (sprite.lastUsed < lruTime) {
        lruTime = sprite.lastUsed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  /**
   * Obtiene estadísticas del cache
   */
  getStats(): { size: number; maxSize: number; keys: string[] } {
    return {
      size: this.cache.size,
      maxSize: this.maxSprites,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Limpia sprites no usados por más de un tiempo determinado
   *
   * @param maxAgeMs - Edad máxima en milisegundos
   * @returns Número de sprites eliminados
   */
  pruneOldSprites(maxAgeMs: number): number {
    const now = performance.now();
    let removed = 0;

    for (const [key, sprite] of this.cache.entries()) {
      if (now - sprite.lastUsed > maxAgeMs) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Obtiene un sprite sin actualizar su uso (para queries)
   */
  peek(key: SpriteKey): CachedSprite | undefined {
    const cacheKey = this.generateKey(key);
    return this.cache.get(cacheKey);
  }
}
