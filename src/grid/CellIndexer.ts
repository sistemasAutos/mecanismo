/**
 * CellIndexer.ts — Mapeo lineal y espacial de celdas hexagonales
 *
 * [REFERENCIA] Lógica ds(col, row) en eyes_grid.min.js
 */

import type { OffsetCoord } from '../core/types';

export class CellIndexer {
  private readonly variantsPerRow: number;

  constructor(variantsPerRow: number = 10) {
    this.variantsPerRow = variantsPerRow;
  }

  /**
   * Mapea (col, row) a un índice lineal único
   */
  public coordToIndex(coord: OffsetCoord): number {
    return coord.row * this.variantsPerRow + coord.col;
  }

  /**
   * Convierte un índice lineal a coordenada (col, row)
   */
  public indexToCoord(index: number): OffsetCoord {
    const row = Math.floor(index / this.variantsPerRow);
    const col = index % this.variantsPerRow;
    return { col, row };
  }

  /**
   * Clave string única para mapas Hash ("col,row")
   */
  public coordToKey(coord: OffsetCoord): string {
    return `${coord.col},${coord.row}`;
  }
}
