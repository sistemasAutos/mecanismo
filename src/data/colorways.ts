
//--- hex-eyes-engine/src/data/colorways.ts
/**
 * Definición de paletas de colores (Colorways)
 * Basado en el esquema original de eyes_grid.min.js
 */

import type { ColorwayDef } from '../core/types';

/**
 * Lista unificada de colorways para generación procedural
 */
export const COLORWAYS: ColorwayDef[] = [
  { id: 'red', name: 'Red', hex: '#FF3B30', rarityWeight: 1.0 },
  { id: 'blue', name: 'Blue', hex: '#007AFF', rarityWeight: 1.0 },
  { id: 'yellow', name: 'Yellow', hex: '#FFCC00', rarityWeight: 0.9 },
  { id: 'green', name: 'Green', hex: '#34C759', rarityWeight: 1.0 },
  { id: 'purple', name: 'Purple', hex: '#AF52DE', rarityWeight: 0.8 },
  { id: 'orange', name: 'Orange', hex: '#FF9500', rarityWeight: 0.95 },
  { id: 'cyan', name: 'Cyan', hex: '#5AC8FA', rarityWeight: 0.85 },
];

/**
 * Colores primarios vibrantes extraídos del original
 */
export const PRIMARY_COLORS: ColorwayDef[] = [
  { id: 'red', name: 'Red', hex: '#FF3B30', rarityWeight: 1.0 },
  { id: 'blue', name: 'Blue', hex: '#007AFF', rarityWeight: 1.0 },
  { id: 'yellow', name: 'Yellow', hex: '#FFCC00', rarityWeight: 0.9 },
  { id: 'green', name: 'Green', hex: '#34C759', rarityWeight: 1.0 },
  { id: 'purple', name: 'Purple', hex: '#AF52DE', rarityWeight: 0.8 },
  { id: 'orange', name: 'Orange', hex: '#FF9500', rarityWeight: 0.95 },
  { id: 'cyan', name: 'Cyan', hex: '#5AC8FA', rarityWeight: 0.85 },
];

/**
 * Paletas curadas por tono
 */
export const COLOR_PALETTE: Record<string, ColorwayDef[]> = {
  'warm': [
    { id: 'warm-red', name: 'Warm Red', hex: '#FF3B30', rarityWeight: 1.0 },
    { id: 'warm-orange', name: 'Warm Orange', hex: '#FF9500', rarityWeight: 0.95 },
    { id: 'warm-yellow', name: 'Warm Yellow', hex: '#FFCC00', rarityWeight: 0.9 },
  ],
  'cool': [
    { id: 'cool-blue', name: 'Cool Blue', hex: '#007AFF', rarityWeight: 1.0 },
    { id: 'cool-cyan', name: 'Cool Cyan', hex: '#5AC8FA', rarityWeight: 0.85 },
    { id: 'cool-purple', name: 'Cool Purple', hex: '#AF52DE', rarityWeight: 0.8 },
  ],
  'natural': [
    { id: 'nat-green', name: 'Natural Green', hex: '#34C759', rarityWeight: 1.0 },
    { id: 'nat-teal', name: 'Natural Teal', hex: '#5AC8FA', rarityWeight: 0.85 },
    { id: 'nat-lime', name: 'Natural Lime', hex: '#FFCC00', rarityWeight: 0.9 },
  ],
};

/**
 * Catálogo completo de todos los colorways disponibles
 */
export const COLORWAY_CATALOG: ColorwayDef[] = [
  ...PRIMARY_COLORS,
  ...COLOR_PALETTE.warm,
  ...COLOR_PALETTE.cool,
  ...COLOR_PALETTE.natural,
];

/**
 * Obtiene un colorway por ID
 */
export function getColorway(colorwayId: string): ColorwayDef | undefined {
  return COLORWAY_CATALOG.find(cw => cw.id === colorwayId);
}

/**
 * Selecciona un colorway aleatorio basado en rareza (rarityWeight)
 */
export function getRandomColorway(): ColorwayDef {
  const totalWeight = COLORWAY_CATALOG.reduce((sum, cw) => sum + cw.rarityWeight, 0);
  let random = Math.random() * totalWeight;

  for (const colorway of COLORWAY_CATALOG) {
    random -= colorway.rarityWeight;
    if (random <= 0) {
      return colorway;
    }
  }

  return COLORWAY_CATALOG[0]; // fallback
}

/**
 * Lista de IDs de colorways disponibles
 */
export const AVAILABLE_COLORWAYS: string[] = COLORWAY_CATALOG.map(cw => cw.id);
