/**
 * GridLayout.ts — Orquestador de disposición de la cuadrícula hexagonal en espiral
 *
 * [REFERENCIA] Generación de Sn[] en eyes_grid.min.js
 */

import type { CellPlacement, Vec2 } from '../core/types';
import { HexCoords } from './HexCoords';
import { SpiralLayout } from './SpiralLayout';
import { LensDistortion } from './LensDistortion';
import { CullingSpatial } from './CullingSpatial';
import { CellIndexer } from './CellIndexer';

export class GridLayout {
  private readonly coords: HexCoords;
  private readonly spiral: SpiralLayout;
  private readonly lens: LensDistortion;
  private readonly culling: CullingSpatial;
  private readonly indexer: CellIndexer;

  constructor(hexSize: number = 200) {
    this.coords = new HexCoords({ hexSize });
    this.spiral = new SpiralLayout();
    this.lens = new LensDistortion({ strength01: 0.85, falloffRadiusPx: 40, maxScale: 1.9 });
    this.culling = new CullingSpatial(300);
    this.indexer = new CellIndexer(10);
  }

  /**
   * Genera los plomadas y posiciones calculadas para las N celdas solicitadas
   */
  public generateLayout(
    count: number,
    cameraOffset: Vec2,
    screenSize: Vec2,
    zoom: number
  ): CellPlacement[] {
    const placements: CellPlacement[] = [];
    const bounds = this.culling.getViewportBounds(screenSize, cameraOffset, zoom);

    for (let i = 0; i < count; i++) {
      const coord = this.spiral.getSpiralCoord(i);
      const center = this.coords.offsetToPixel(coord);

      const placement: CellPlacement = {
        col: coord.col,
        row: coord.row,
        center,
        scale01: 1.0,
        alpha01: 1.0
      };

      if (this.culling.isCellVisible(placement, bounds)) {
        placements.push(placement);
      }
    }

    return placements;
  }
}
