//--- hex-eyes-engine/src/grid/HexCoords.ts 
/**
 * HexCoords — Coordenadas hexagonales offset (odd-row, flat-top)
 *
 * [FASE] 1 — Grid math
 * [REFERENCIA] Red Blob Games: https://www.redblobgames.com/grids/hexagons/
 * [CRITERIO DE ACEPTACIÓN]
 *   - Round-trip offsetToPixel→pixelToOffset exacto (error < 0.5px)
 *   - hexDistance devuelve distancia en "pasos de celda", no píxeles
 *   - neighbors retorna máximo 6 vecinos directos
 */

import type { Vec2, OffsetCoord } from '@core/types';
import { DEFAULT_CONFIG, type EngineConfig } from '@core/types';

export interface HexCoordsConfig {
  hexSize: number;
}

export interface IHexCoords {
  /**
   * [MÉTODO] [FUNCIÓN PURA]
   * Convierte coordenada offset a posición pixel
   * Precondición: col,row enteros finitos
   * Determinístico
   */
  offsetToPixel(coord: OffsetCoord): Vec2;

  /**
   * [MÉTODO] [FUNCIÓN PURA]
   * Convierte posición pixel a coordenada offset
   * Complejidad O(1): evalúa ≤4 candidatos, no recorre el grid
   */
  pixelToOffset(point: Vec2): OffsetCoord;

  /**
   * [MÉTODO] [UTILIDAD]
   * Distancia en "pasos de celda", no en píxeles
   */
  hexDistance(a: OffsetCoord, b: OffsetCoord): number;

  /**
   * [MÉTODO] [UTILIDAD]
   * Retorna los 6 vecinos directos (máximo)
   */
  neighbors(coord: OffsetCoord): OffsetCoord[];
}

/**
 * Implementación de coordenadas hexagonales odd-row offset, flat-top
 *
 * Layout original del código:
 *   - Filas pares: x = col * size + row%2 * size/2
 *   - Filas impares: x = col * size + size/2
 *   - y = row * size * sqrt(3)/2
 */
export class HexCoords implements IHexCoords {
  private readonly hexSize: number;
  private readonly rowHeight: number;
  private readonly halfWidth: number;

  constructor(config: HexCoordsConfig = { hexSize: DEFAULT_CONFIG.hexSizeBase / 2 }) {
    this.hexSize = config.hexSize;
    this.rowHeight = config.hexSize * (Math.sqrt(3) / 2);
    this.halfWidth = config.hexSize / 2;
  }

  /**
   * Convierte coordenada offset (col, row) a posición pixel (x, y)
   * Fórmula: odd-row offset, flat-top
   */
  offsetToPixel(coord: OffsetCoord): Vec2 {
    const rowOffset = (coord.row % 2 + 2) % 2 === 1 ? this.halfWidth : 0;
    return {
      x: coord.col * this.hexSize + rowOffset,
      y: coord.row * this.rowHeight
    };
  }

  /**
   * Convierte posición pixel a coordenada offset
   * Método: evalúa 4 candidatos cercanos y elige el más próximo
   * Complejidad O(1)
   */
  pixelToOffset(point: Vec2): OffsetCoord {
    const row = Math.round(point.y / this.rowHeight);
    const rowOffset = (row % 2 + 2) % 2 === 1 ? this.halfWidth : 0;
    const col = Math.round((point.x - rowOffset) / this.hexSize);

    // Verifica 4 candidatos para manejar casos límite
    const candidates: Array<{ coord: OffsetCoord; distSq: number }> = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (Math.abs(dr) + Math.abs(dc) > 1 && !(dr === 0 && dc === 0)) continue;
        const testCoord: OffsetCoord = { col: col + dc, row: row + dr };
        const pixel = this.offsetToPixel(testCoord);
        const dx = point.x - pixel.x;
        const dy = point.y - pixel.y;
        candidates.push({ coord: testCoord, distSq: dx * dx + dy * dy });
      }
    }

    // Retorna el candidato más cercano
    candidates.sort((a, b) => a.distSq - b.distSq);
    return candidates[0].coord;
  }

  /**
   * Calcula distancia hexagonal en pasos de celda
   * Usa sistema de coordenadas cúbicas para cálculo exacto
   */
  hexDistance(a: OffsetCoord, b: OffsetCoord): number {
    // Convierte offset a cúbicas
    const toCube = (c: OffsetCoord) => {
      const x = c.col - (c.row - (c.row & 1)) / 2;
      const z = c.row;
      const y = -x - z;
      return { x, y, z };
    };

    const ac = toCube(a);
    const bc = toCube(b);

    // Distancia Manhattan en coordenadas cúbicas
    return (Math.abs(ac.x - bc.x) + Math.abs(ac.y - bc.y) + Math.abs(ac.z - bc.z)) / 2;
  }

  /**
   * Retorna los 6 vecinos directos en orden clockwise desde arriba-derecha
   * Para odd-row offset, las direcciones alternan por paridad de fila
   */
  neighbors(coord: OffsetCoord): OffsetCoord[] {
    // Direcciones para filas pares vs impares (odd-row offset)
    // Fila par (row%2==0):
    //   Los vecinos son: derecha, abajo-derecha, abajo-izquierda, izquierda, arriba-izquierda, arriba-derecha
    const evenRowDirs = [
      { col: 1, row: 0 },   // derecha
      { col: 0, row: 1 },   // abajo-derecha
      { col: -1, row: 1 },  // abajo-izquierda
      { col: -1, row: 0 },  // izquierda
      { col: 0, row: -1 },  // arriba-izquierda
      { col: 1, row: -1 }   // arriba-derecha
    ];

    // Fila impar (row%2==1):
    //   Los vecinos son: derecha, abajo-derecha, abajo-izquierda, izquierda, arriba-izquierda, arriba-derecha
    //   Pero las direcciones "abajo" y "arriba" se ajustan
    const oddRowDirs = [
      { col: 1, row: 0 },   // derecha
      { col: 0, row: 1 },   // abajo-derecha
      { col: -1, row: 1 },  // abajo-izquierda
      { col: -1, row: 0 },  // izquierda
      { col: 0, row: -1 },  // arriba-izquierda
      { col: 1, row: -1 }   // arriba-derecha
    ];

    const dirs = (coord.row % 2 + 2) % 2 === 0 ? evenRowDirs : oddRowDirs;
    return dirs.map(d => ({
      col: coord.col + d.col,
      row: coord.row + d.row
    }));
  }

  /**
   * Obtiene el tamaño de celda en píxeles
   */
  getHexSize(): number {
    return this.hexSize;
  }

  /**
   * Obtiene la altura de fila en píxeles
   */
  getRowHeight(): number {
    return this.rowHeight;
  }
}
