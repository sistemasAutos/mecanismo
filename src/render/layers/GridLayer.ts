
//+++ eye-ingeniere/src/render/layers/GridLayer.ts 
import type { IRenderLayer, FrameData } from '../../render/layers/types';
import type { Vec2, ShapeId, CubicBezier } from '../../core/types';
import { evaluateCubicBezier } from '../../tracking/BezierSubdivision';
import { SHAPE_CATALOG } from '../../data/shapes';

export class GridLayer implements IRenderLayer {
    draw(ctx: CanvasRenderingContext2D, frameData: FrameData): void {
        ctx.save();

        for (const cell of frameData.cells) {
            const key = `${cell.col},${cell.row}`;
            const eyeState = frameData.eyeStates.get(key);

            if (!eyeState) continue;

            ctx.globalAlpha = cell.alpha01;

            const centerX = cell.center.x;
            const centerY = cell.center.y;
            const baseScale = 80 * cell.scale01;

            ctx.translate(centerX, centerY);
            ctx.scale(baseScale, baseScale);

            this.drawShape(ctx, eyeState.shapeId, eyeState.colorway.hex, eyeState.pupilAngleRad, eyeState.pupilOffset01);

            ctx.scale(1 / baseScale, 1 / baseScale);
            ctx.translate(-centerX, -centerY);
        }

        ctx.restore();
    }

    private drawShape(
        ctx: CanvasRenderingContext2D,
        shapeId: ShapeId,
        colorHex: string,
        pupilAngleRad: number,
        pupilOffset01: number
    ): void {
        const shapeDef = SHAPE_CATALOG[shapeId];
        if (!shapeDef) return;

        ctx.save();

        ctx.beginPath();
        const curves = shapeDef;
        if (curves.length > 0) {
            const startPoint = evaluateCubicBezier(curves[0], 0);
            ctx.moveTo(startPoint.x, startPoint.y);

            for (const curve of curves) {
                const points = this.sampleCurve(curve, 8);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x, points[i].y);
                }
            }
            ctx.closePath();
        }

        ctx.fillStyle = this.adjustColorBrightness(colorHex, 0.1);
        ctx.fill();

        ctx.strokeStyle = colorHex;
        ctx.lineWidth = 0.015;
        ctx.stroke();

        const irisRadius = 0.25;
        const pupilDistance = 0.15 * pupilOffset01;
        const pupilX = Math.cos(pupilAngleRad) * pupilDistance;
        const pupilY = Math.sin(pupilAngleRad) * pupilDistance;

        ctx.beginPath();
        ctx.arc(pupilX, pupilY, irisRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fill();

        const pupilRadius = 0.08;
        ctx.beginPath();
        ctx.arc(pupilX, pupilY, pupilRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#1a1a1a';
        ctx.fill();

        const highlightX = pupilX - pupilRadius * 0.3;
        const highlightY = pupilY - pupilRadius * 0.3;
        ctx.beginPath();
        ctx.arc(highlightX, highlightY, pupilRadius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fill();

        ctx.restore();
    }

    private sampleCurve(curve: CubicBezier, segments: number): Vec2[] {
        const points: Vec2[] = [];
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            points.push(evaluateCubicBezier(curve, t));
        }
        return points;
    }

    private adjustColorBrightness(hex: string, factor: number): string {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);

        const adjust = (val: number) => Math.min(255, Math.floor(val * (1 + factor)));

        return `#${adjust(r).toString(16).padStart(2, '0')}${adjust(g).toString(16).padStart(2, '0')}${adjust(b).toString(16).padStart(2, '0')}`;
    }
}