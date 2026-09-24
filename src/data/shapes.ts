// view /workspace/eye-ingeniere/src/data/shapes.ts	
//--- hex-eyes-engine/src/data/shapes.ts	
	
/**	
	
* Definición de formas geométricas procedurales usando curvas Bézier cúbicas	
	
* Basado en el esquema original de eyes_grid.min.js	
	
*/	
	
	
	
import type { CubicBezier, ShapeId } from '../core/types';	
	
	
	
/**	
	
* Genera puntos para un círculo aproximado con 4 curvas Bézier	
	
* Radio normalizado a 100 unidades	
	
*/	
	
export function createCircleShape(): CubicBezier[] {	
	
const r = 1;	
	
const k = 0.552284749831; // constante mágica para aproximar círculo con Bézier	
	
	
	
return [	
	
	// Cuadrante superior derecho
	
	{ p0: { x: 0, y: -r }, p1: { x: r * k, y: -r }, p2: { x: r, y: -r * k }, p3: { x: r, y: 0 } },
	
	// Cuadrante inferior derecho
	
	{ p0: { x: r, y: 0 }, p1: { x: r, y: r * k }, p2: { x: r * k, y: r }, p3: { x: 0, y: r } },
	
	// Cuadrante inferior izquierdo
	
	{ p0: { x: 0, y: r }, p1: { x: -r * k, y: r }, p2: { x: -r, y: r * k }, p3: { x: -r, y: 0 } },
	
	// Cuadrante superior izquierdo
	
	{ p0: { x: -r, y: 0 }, p1: { x: -r, y: -r * k }, p2: { x: -r * k, y: -r }, p3: { x: 0, y: -r } },
	
];	
	
}	
	
	
	
/**	
	
* Genera triángulo redondeado	
	
*/	
	
export function createTriangleShape(): CubicBezier[] {	
	
const r = 100;	
	
const corner = 25; // radio de esquinas redondeadas	
	
	
	
// Vértices del triángulo equilátero	
	
const top = { x: 0, y: -r };	
	
const bottomRight = { x: r * Math.sin(Math.PI / 3), y: r * Math.cos(Math.PI / 3) };	
	
const bottomLeft = { x: -r * Math.sin(Math.PI / 3), y: r * Math.cos(Math.PI / 3) };	
	
	
	
// Curvas para cada esquina redondeada	
	
return [	
	
	// Esquina superior
	
	{
	
	p0: { x: -corner, y: -r + corner * 0.5 },
	
	p1: { x: -corner * 0.5, y: -r },
	
	p2: { x: corner * 0.5, y: -r },
	
	p3: { x: corner, y: -r + corner * 0.5 }
	
	},
	
	// Lado derecho (simplificado)
	
	{
	
	p0: { x: corner, y: -r + corner * 0.5 },
	
	p1: bottomRight,
	
	p2: bottomRight,
	
	p3: { x: bottomRight.x - corner, y: bottomRight.y + corner * 0.5 }
	
	},
	
	// Esquina inferior derecha
	
	{
	
	p0: { x: bottomRight.x - corner, y: bottomRight.y + corner * 0.5 },
	
	p1: { x: bottomRight.x - corner * 0.5, y: bottomRight.y + corner },
	
	p2: { x: bottomRight.x + corner * 0.5, y: bottomRight.y + corner },
	
	p3: { x: bottomRight.x + corner, y: bottomRight.y + corner * 0.5 }
	
	},
	
	// Lado inferior (simplificado)
	
	{
	
	p0: { x: bottomRight.x + corner, y: bottomRight.y + corner * 0.5 },
	
	p1: bottomLeft,
	
	p2: bottomLeft,
	
	p3: { x: bottomLeft.x + corner, y: bottomLeft.y + corner * 0.5 }
	
	},
	
	// Esquina inferior izquierda
	
	{
	
	p0: { x: bottomLeft.x + corner, y: bottomLeft.y + corner * 0.5 },
	
	p1: { x: bottomLeft.x - corner * 0.5, y: bottomLeft.y + corner },
	
	p2: { x: bottomLeft.x + corner * 0.5, y: bottomLeft.y + corner },
	
	p3: { x: bottomLeft.x - corner, y: bottomLeft.y + corner * 0.5 }
	
	},
	
	// Lado izquierdo (simplificado)
	
	{
	
	p0: { x: bottomLeft.x - corner, y: bottomLeft.y + corner * 0.5 },
	
	p1: top,
	
	p2: top,
	
	p3: { x: -corner, y: -r + corner * 0.5 }
	
	},
	
];	
	
}	
	
	
	
/**	
	
* Genera cuadrado redondeado	
	
*/	
	
export function createSquareShape(): CubicBezier[] {	
	
const r = 100;	
	
const corner = 30;	
	
	
	
return [	
	
	// Superior
	
	{ p0: { x: -r + corner, y: -r }, p1: { x: -r + corner * 0.5, y: -r }, p2: { x: r - corner * 0.5, y: -r }, p3: { x: r - corner, y: -r } },
	
	// Esquina superior derecha
	
	{ p0: { x: r - corner, y: -r }, p1: { x: r, y: -r + corner * 0.5 }, p2: { x: r, y: -r + corner }, p3: { x: r, y: -r + corner } },
	
	// Derecha
	
	{ p0: { x: r, y: -r + corner }, p1: { x: r, y: -r + corner * 0.5 }, p2: { x: r, y: r - corner * 0.5 }, p3: { x: r, y: r - corner } },
	
	// Esquina inferior derecha
	
	{ p0: { x: r, y: r - corner }, p1: { x: r - corner * 0.5, y: r }, p2: { x: r - corner, y: r }, p3: { x: r - corner, y: r } },
	
	// Inferior
	
	{ p0: { x: r - corner, y: r }, p1: { x: r - corner * 0.5, y: r }, p2: { x: -r + corner * 0.5, y: r }, p3: { x: -r + corner, y: r } },
	
	// Esquina inferior izquierda
	
	{ p0: { x: -r + corner, y: r }, p1: { x: -r, y: r - corner * 0.5 }, p2: { x: -r, y: r - corner }, p3: { x: -r, y: r - corner } },
	
	// Izquierda
	
	{ p0: { x: -r, y: r - corner }, p1: { x: -r, y: r - corner * 0.5 }, p2: { x: -r, y: -r + corner * 0.5 }, p3: { x: -r, y: -r + corner } },
	
	// Esquina superior izquierda
	
	{ p0: { x: -r, y: -r + corner }, p1: { x: -r + corner * 0.5, y: -r }, p2: { x: -r + corner, y: -r }, p3: { x: -r + corner, y: -r } },
	
];	
	
}	
	
	
	
/**	
	
* Genera hexágono regular	
	
*/	
	
export function createHexagonShape(): CubicBezier[] {	
	
const r = 100;	
	
const curves: CubicBezier[] = [];	
	
	
	
for (let i = 0; i < 6; i++) {	
	
	const angle1 = (i * 60) * Math.PI / 180;
	
	const angle2 = ((i + 1) * 60) * Math.PI / 180;
	
	
	
	const x1 = r * Math.cos(angle1);
	
	const y1 = r * Math.sin(angle1);
	
	const x2 = r * Math.cos(angle2);
	
	const y2 = r * Math.sin(angle2);
	
	
	
	// Curva Bézier simple para cada lado (línea recta representada como Bézier)
	
	curves.push({
	
	p0: { x: x1, y: y1 },
	
	p1: { x: x1 * 0.67 + x2 * 0.33, y: y1 * 0.67 + y2 * 0.33 },
	
	p2: { x: x1 * 0.33 + x2 * 0.67, y: y1 * 0.33 + y2 * 0.67 },
	
	p3: { x: x2, y: y2 }
	
	});
	
}	
	
	
	
return curves;	
	
}	
	
	
	
/**	
	
* Genera estrella de 5 puntas	
	
*/	
	
export function createStarShape(): CubicBezier[] {	
	
const outerR = 100;	
	
const innerR = 45;	
	
const curves: CubicBezier[] = [];	
	
	
	
for (let i = 0; i < 10; i++) {	
	
	const angle = (i * 36 - 90) * Math.PI / 180;
	
	const radius = i % 2 === 0 ? outerR : innerR;
	
	
	
	const nextAngle = ((i + 1) * 36 - 90) * Math.PI / 180;
	
	const nextRadius = (i + 1) % 2 === 0 ? outerR : innerR;
	
	
	
	const x1 = radius * Math.cos(angle);
	
	const y1 = radius * Math.sin(angle);
	
	const x2 = nextRadius * Math.cos(nextAngle);
	
	const y2 = nextRadius * Math.sin(nextAngle);
	
	
	
	curves.push({
	
	p0: { x: x1, y: y1 },
	
	p1: { x: x1 * 0.67 + x2 * 0.33, y: y1 * 0.67 + y2 * 0.33 },
	
	p2: { x: x1 * 0.33 + x2 * 0.67, y: y1 * 0.33 + y2 * 0.67 },
	
	p3: { x: x2, y: y2 }
	
	});
	
}	
	
	
	
return curves;	
	
}	
	
	
	
/**	
	
* Catálogo de formas disponibles	
	
*/	
	
export const SHAPE_CATALOG: Record<ShapeId, CubicBezier[]> = {	
	
'circle': createCircleShape(),	
	
'triangle': createTriangleShape(),	
	
'square': createSquareShape(),	
	
'hexagon': createHexagonShape(),	
	
'star': createStarShape(),	
	
};	
	
	
	
export type ShapeGenerator = () => CubicBezier[];	
	
	
	
export const SHAPE_GENERATORS: Record<ShapeId, ShapeGenerator> = {	
	
'circle': createCircleShape,	
	
'triangle': createTriangleShape,
	
'square': createSquareShape,	
	
'hexagon': createHexagonShape,	
	
'star': createStarShape,	
	
};	
	
	
	
/**	
	
* Obtiene una forma por ID	
	
*/	
	
export function getShape(shapeId: ShapeId): CubicBezier[] {	
	
const shape = SHAPE_CATALOG[shapeId];	
	
if (!shape) {	
	
	console.warn(`Shape "${shapeId}" not found, falling back to circle`);
	
	return SHAPE_CATALOG['circle'];
	
}	
	
return shape;	
	
}	
	
	
	
/**	
	
* Lista de IDs de formas disponibles	
	
*/	
	
export const AVAILABLE_SHAPES: ShapeId[] = Object.keys(SHAPE_CATALOG) as ShapeId[];	
	
	