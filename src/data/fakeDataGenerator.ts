//--- hex-eyes-engine/src/data/fakeDataGenerator.ts 
/**
 * Generador de datos de prueba: 500 ojos en distribución espiral hexagonal
 * Basado en la lógica original de eyes_grid.min.js
 */

import type { OffsetCoord, EyeVisualState, CellPlacement, Vec2 } from '../core/types';
import { getRandomColorway } from './colorways';
import { AVAILABLE_SHAPES } from './shapes';
import { DEFAULT_CONFIG } from '../core/types';
import type { ShapeId } from '../core/types';

/**
 * Genera una posición en coordenadas offset (odd-row)
 */
function offsetToPixel(coord: OffsetCoord, hexSize: number): Vec2 {
  const x = hexSize * (coord.col + coord.row * 0.5);
  const y = hexSize * coord.row * 0.866025404; // sqrt(3)/2
  return { x, y };
}

/**
 * Genera coordenadas en espiral desde el centro
 * Retorna array de {col, row, ring} ordenado por anillo ascendente
 */
function generateSpiralCoords(maxCount: number): Array<{ col: number; row: number; ring: number }> {
  const coords: Array<{ col: number; row: number; ring: number }> = [];

  // Centro
  coords.push({ col: 0, row: 0, ring: 0 });
  if (maxCount <= 1) return coords;

  let ring = 1;
  while (coords.length < maxCount) {
    // 6 direcciones de la espiral hexagonal
    const directions = [
      { dc: 0, dr: -1 },   // arriba
      { dc: 1, dr: -1 },   // arriba-derecha
      { dc: 1, dr: 0 },    // derecha
      { dc: 0, dr: 1 },    // abajo
      { dc: -1, dr: 1 },   // abajo-izquierda
      { dc: -1, dr: 0 },   // izquierda
    ];

    for (let dir = 0; dir < 6 && coords.length < maxCount; dir++) {
      const { dc, dr } = directions[dir];

      // Cada lado del anillo tiene 'ring' celdas
      for (let step = 0; step < ring && coords.length < maxCount; step++) {
        const prev = coords[coords.length - 1];
        const newCol = prev.col + dc;
        const newRow = prev.row + dr;
        coords.push({ col: newCol, row: newRow, ring });
      }
    }

    ring++;
  }

  return coords.slice(0, maxCount);
}

/**
 * Genera 500 ojos con estado visual completo para pruebas
 */
export function generateTestEyesGrid(count: number = 500): {
  placements: CellPlacement[];
  eyeStates: Map<string, EyeVisualState>;
} {
  const coords = generateSpiralCoords(count);
  const hexSize = DEFAULT_CONFIG.hexSizeBase / 2; // radio base

  const placements: CellPlacement[] = [];
  const eyeStates = new Map<string, EyeVisualState>();

  // Parámetros de escala espiral (extraídos del original)
  const spiralGrowthRate = DEFAULT_CONFIG.spiralGrowthRate;
  const spiralMinRadius = DEFAULT_CONFIG.spiralMinRadius;
  const spiralMaxRadius = DEFAULT_CONFIG.spiralMaxRadius;

  coords.forEach((coord, index) => {
    const center = offsetToPixel(coord, hexSize);

    // Escala basada en distancia del centro (efecto espiral)
    const distanceFromCenter = Math.sqrt(coord.col * coord.col + coord.row * coord.row);
    const scale01 = Math.max(
      spiralMaxRadius,
      Math.min(1.0, spiralMinRadius - distanceFromCenter * spiralGrowthRate)
    );

    // Alpha basado en posición (culling suave en bordes)
    const alpha01 = 1.0;

    const placement: CellPlacement = {
      col: coord.col,
      row: coord.row,
      center,
      scale01,
      alpha01,
    };

    placements.push(placement);

    // Estado visual del ojo
    const shapeId = AVAILABLE_SHAPES[index % AVAILABLE_SHAPES.length] as ShapeId;
    const colorway = getRandomColorway();

    const eyeState: EyeVisualState = {
      shapeId,
      colorway,
      animFrame: Math.floor(Math.random() * 4), // 4 frames de animación discretos
      pupilAngleRad: Math.random() * Math.PI * 2,
      pupilOffset01: 0.5, // posición neutral inicial
    };

    const key = `${coord.col},${coord.row}`;
    eyeStates.set(key, eyeState);
  });

  return { placements, eyeStates };
}

/**
 * Genera un solo ojo de prueba para debugging
 */
export function generateSingleTestEye(col: number = 0, row: number = 0): {
  placement: CellPlacement;
  eyeState: EyeVisualState;
} {
  const hexSize = DEFAULT_CONFIG.hexSizeBase / 2;
  const center = offsetToPixel({ col, row }, hexSize);

  const placement: CellPlacement = {
    col,
    row,
    center,
    scale01: 1.0,
    alpha01: 1.0,
  };

  const shapeId = AVAILABLE_SHAPES[Math.floor(Math.random() * AVAILABLE_SHAPES.length)] as ShapeId;
  const colorway = getRandomColorway();

  const eyeState: EyeVisualState = {
    shapeId,
    colorway,
    animFrame: 0,
    pupilAngleRad: 0,
    pupilOffset01: 0.5,
  };

  return { placement, eyeState };
}
