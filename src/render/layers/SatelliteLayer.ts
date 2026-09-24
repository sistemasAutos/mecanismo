//+++ eye-ingeniere/src/render/layers/SatelliteLayer.ts
import type { IRenderLayer, FrameData } from '../../render/layers/types';
import type { Vec2 } from '../../core/types';

export class SatelliteLayer implements IRenderLayer {
    private time: number = 0;

    draw(ctx: CanvasRenderingContext2D, frameData: FrameData): void {
        this.time += 0.016;

        ctx.save();
        ctx.font = '10px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (const cell of frameData.cells) {
            const key = `${cell.col},${cell.row}`;
            const eyeState = frameData.eyeStates.get(key);

            if (!eyeState) continue;

            const orbitRadius = 120 * cell.scale01;
            const orbitSpeed = 0.5;
            const orbitOffset = (cell.col + cell.row) * 0.3;

            const angle = this.time * orbitSpeed + orbitOffset;
            const satX = cell.center.x + Math.cos(angle) * orbitRadius;
            const satY = cell.center.y + Math.sin(angle) * orbitRadius;

            ctx.globalAlpha = cell.alpha01 * 0.7;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.beginPath();
            ctx.arc(satX, satY, 14, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = eyeState.colorway.hex;
            const label = eyeState.shapeId.substring(0, 3).toUpperCase();
            ctx.fillText(label, satX, satY);
        }

        ctx.restore();
    }
}