// eye-ingeniere/src/data/DataGenerator.ts
import type { OffsetCoord, EyeVisualState, CellPlacement, Vec2, ShapeId, ColorwayDef, CubicBezier } from '../core/types';
import { DEFAULT_CONFIG } from '../core/types';
import { AVAILABLE_SHAPES, getShape } from './shapes';
import { COLORWAYS } from './colorways';

/**
 * DataGenerator — Genera UN solo ojo con componentes distribuidos en espiral hexagonal
 *
 * [CORRECCIÓN CRÍTICA] El original NO genera 500 ojos independientes
 * Genera UN ojo compuesto por múltiples celdas hexagonales en espiral
 * Cada celda contiene una fracción de la forma Bézier completa
 */

export interface GeneratedEyeData {
    placements: CellPlacement[];
    eyeStates: Map<string, EyeVisualState>;
    cellContours: Map<string, CubicBezier[]>;
}

class SeededRandom {
    private seed: number;

    constructor(seed: number) {
        this.seed = seed;
    }

    next(): number {
        this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
        return this.seed / 0x7fffffff;
    }

    nextInt(max: number): number {
        return Math.floor(this.next() * max);
    }

    pick<T>(array: T[]): T {
        return array[this.nextInt(array.length)];
    }
}

function offsetToPixel(coord: OffsetCoord, hexSize: number): Vec2 {
    const x = hexSize * (coord.col + coord.row * 0.5);
    const y = hexSize * coord.row * 0.866025404;
    return { x, y };
}

function generateSpiralCoords(maxCount: number): OffsetCoord[] {
    const coords: OffsetCoord[] = [];

    coords.push({ col: 0, row: 0 });
    if (maxCount <= 1) return coords;

    let ring = 1;
    while (coords.length < maxCount) {
        const directions = [
            { dc: 0, dr: -1 },
            { dc: 1, dr: -1 },
            { dc: 1, dr: 0 },
            { dc: 0, dr: 1 },
            { dc: -1, dr: 1 },
            { dc: -1, dr: 0 },
        ];

        for (let dir = 0; dir < 6 && coords.length < maxCount; dir++) {
            const { dc, dr } = directions[dir];

            for (let step = 0; step < ring && coords.length < maxCount; step++) {
                const prev = coords[coords.length - 1];
                coords.push({ col: prev.col + dc, row: prev.row + dr });
            }
        }
        ring++;
    }

    return coords.slice(0, maxCount);
}

/**
 * Genera UN solo ojo distribuido en espiral hexagonal
 *
 * [ALGORITMO]
 * 1. Genera N celdas en espiral desde el centro
 * 2. Cada celda representa un segmento de la forma del ojo
 * 3. Todas las celdas comparten el mismo colorway base
 * 4. Las pupilas se sincronizan hacia el cursor
 */
export function generateSingleEyeData(spiralCount: number = 91, seed: number = 42): GeneratedEyeData {
    if (spiralCount <= 0 || spiralCount > 5000) {
        throw new Error(`Invalid spiral count: ${spiralCount}. Must be between 1 and 5000.`);
    }

    const rng = new SeededRandom(seed);
    const coords = generateSpiralCoords(spiralCount);
    const hexSize = DEFAULT_CONFIG.hexSizeBase; // Usar tamaño base completo para un solo ojo

    // Colorway base único para todo el ojo
    const baseColorway = COLORWAYS[rng.nextInt(COLORWAYS.length)];
    // Forma base única para todo el ojo
    const baseShapeId = AVAILABLE_SHAPES[rng.nextInt(AVAILABLE_SHAPES.length)];
    // Obtener el contorno Bézier de la forma seleccionada
    const baseContour = getShape(baseShapeId);

    const placements: CellPlacement[] = [];
    const eyeStates = new Map<string, EyeVisualState>();
    const cellContours = new Map<string, CubicBezier[]>();

    const spiralGrowthRate = DEFAULT_CONFIG.spiralGrowthRate;
    const spiralMinRadius = DEFAULT_CONFIG.spiralMinRadius;
    const spiralMaxRadius = DEFAULT_CONFIG.spiralMaxRadius;

    coords.forEach((coord, index) => {
        const center = offsetToPixel(coord, hexSize);
        const distanceFromCenter = Math.sqrt(coord.col * coord.col + coord.row * coord.row);

        // Escala decreciente desde el centro hacia los bordes
        // Las celdas cercanas al centro son más grandes
        const scale01 = Math.max(
            0.15,
            Math.min(1.0, 1.0 - distanceFromCenter * spiralGrowthRate * 50)
        );

        // Alpha basado en distancia para fade out suave en los bordes
        const maxVisibleRing = Math.sqrt(spiralCount) * 0.8;
        const alpha01 = distanceFromCenter > maxVisibleRing
            ? Math.max(0.1, 1 - (distanceFromCenter - maxVisibleRing) * 0.15)
            : 1.0;

        const placement: CellPlacement = {
            col: coord.col,
            row: coord.row,
            center,
            scale01,
            alpha01,
        };

        placements.push(placement);

        // Cada celda tiene variación sutil pero comparte identidad visual
        const hueVariation = (rng.next() - 0.5) * 0.1;
        const variantColorway: ColorwayDef = {
            ...baseColorway,
            hex: adjustHue(baseColorway.hex, hueVariation),
        };

        // Calcular contorno local para esta celda
        // Cada celda recibe una fracción del contorno completo basada en su posición en la espiral
        const cellContour = calculateCellContour(baseContour, index, spiralCount);
        cellContours.set(`${coord.col},${coord.row}`, cellContour);

        const eyeState: EyeVisualState = {
            shapeId: baseShapeId,
            colorway: variantColorway,
            animFrame: 0,
            pupilAngleRad: 0,
            pupilOffset01: 0.5,
        };

        const key = `${coord.col},${coord.row}`;
        eyeStates.set(key, eyeState);
    });

    return { placements, eyeStates, cellContours };
}

function adjustHue(hex: string, factor: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    const adjust = (val: number) => {
        const adjusted = Math.round(val * (1 + factor));
        return Math.max(0, Math.min(255, adjusted));
    };

    return `#${adjust(r).toString(16).padStart(2, '0')}${adjust(g).toString(16).padStart(2, '0')}${adjust(b).toString(16).padStart(2, '0')}`;
}

/**
 * Calcula el contorno local para una celda específica en la espiral
 *
 * [CORRECCIÓN CRÍTICA] Cada celda recibe el contorno COMPLETO de la forma base
 * El concepto de "ojo distribuido" es visual: las celdas juntas forman un patrón
 * Pero cada celda individualmente es un ojo completo con su propia pupila
 */
function calculateCellContour(
    baseContour: CubicBezier[],
    cellIndex: number,
    totalCells: number
): CubicBezier[] {
    if (baseContour.length === 0) {
        return [];
    }

    // RETORNA EL CONTORNO COMPLETO para que PupilTracker funcione correctamente
    // Cada celda es un ojo independiente que mira hacia el cursor
    return [...baseContour];
}

export function generateEyeData(count: number = 91, seed: number = 42): GeneratedEyeData {
    return generateSingleEyeData(count, seed);
}