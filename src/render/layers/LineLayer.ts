
//+++ eye-ingeniere/src/render/layers/LineLayer.ts 
import type { IRenderLayer, FrameData } from '../../render/layers/types';
import type { OffsetCoord, Vec2 } from '../../core/types';
import { DEFAULT_CONFIG } from '../../core/types';

export class LineLayer implements IRenderLayer {
    private getNeighbors(coord: OffsetCoord): OffsetCoord[] {
        const isEvenRow = coord.row % 2 === 0;

        const evenRowDirs = [
            { col: 1, row: 0 }, { col: 0, row: -1 }, { col: -1, row: -1 },
            { col: -1, row: 0 }, { col: 0, row: 1 }, { col: 1, row: 1 }
        ];

        const oddRowDirs = [
            { col: 1, row: 0 }, { col: 1, row: -1 }, { col: 0, row: -1 },
            { col: -1, row: 0 }, { col: 0, row: 1 }, { col: 1, row: 1 }
        ];

        const dirs = isEvenRow ? evenRowDirs : oddRowDirs;
        return dirs.map(d => ({ col: coord.col + d.col, row: coord.row + d.row }));
    }

    draw(ctx: CanvasRenderingContext2D, frameData: FrameData): void {
        const isMobile = window.innerWidth < 640;
        const lineThickness = isMobile ? DEFAULT_CONFIG.lineThicknessMobile : DEFAULT_CONFIG.lineThickness;
        const lineAlpha = DEFAULT_CONFIG.lineAlpha;
        const curveMargin = DEFAULT_CONFIG.lineCurveMargin;
        const curveTightness = DEFAULT_CONFIG.lineCurveTightness;

        ctx.save();
        ctx.strokeStyle = `rgba(255, 255, 255, ${lineAlpha})`;
        ctx.lineWidth = lineThickness;
        ctx.lineCap = 'round';

        const cellMap = new Map<string, Vec2>();
        for (const cell of frameData.cells) {
            const key = `${cell.col},${cell.row}`;
            cellMap.set(key, cell.center);
        }

        const drawnLines = new Set<string>();

        for (const cell of frameData.cells) {
            const neighbors = this.getNeighbors({ col: cell.col, row: cell.row });

            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.col},${neighbor.row}`;
                const neighborPos = cellMap.get(neighborKey);

                if (!neighborPos) continue;

                const lineKey = [cell.col, cell.row, neighbor.col, neighbor.row]
                    .sort()
                    .join('-');

                if (drawnLines.has(lineKey)) continue;
                drawnLines.add(lineKey);

                const midX = (cell.center.x + neighborPos.x) / 2;
                const midY = (cell.center.y + neighborPos.y) / 2;

                const dx = neighborPos.x - cell.center.x;
                const dy = neighborPos.y - cell.center.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                const perpX = -dy / dist * curveMargin;
                const perpY = dx / dist * curveMargin;

                const cpX = midX + perpX * curveTightness;
                const cpY = midY + perpY * curveTightness;

                ctx.beginPath();
                ctx.moveTo(cell.center.x, cell.center.y);
                ctx.quadraticCurveTo(cpX, cpY, neighborPos.x, neighborPos.y);
                ctx.stroke();
            }
        }

        ctx.restore();
    }
}