//--- hex-eyes-engine/src/tracking/PupilTracker.ts		
		
/**		
		
* PupilTracker — Seguimiento de pupila con interpolación y suavizado temporal		
		
*		
		
* [FASE] 2 — Tracking (Bézier)		
		
* [ALGORITMO ORIGINAL] Función ns() del código original		
		
* [CRITERIO DE ACEPTACIÓN]		
		
*   - Con smoothing01=0 converge en 1 frame		
		
*   - Con smoothing>0, sin overshoot ni oscilación		
		
*   - update debe llamarse 1 vez por frame con deltaTime real		
		
*/		
		
		
		
import type { Vec2, CubicBezier } from '@core/types';		
		
import { DEFAULT_CONFIG } from '@core/types';		
		
import { closestPointOnCurveWarmStart } from './PointCurveDistance';		
		
import { evaluateCubicBezier } from './BezierSubdivision';		
		
		
		
export interface PupilTrackerConfig {		
		
	contour: CubicBezier[];  // Contorno completo del ojo (4 curvas para círculo aproximado)	
		
	smoothing01: number;	// 0 = instantáneo, 1 = nunca se mueve. Sugerido: 0.15-0.3
		
}		
		
		
		
export interface IPupilTracker {		
		
	/**	
		
	* [MÉTODO] [CONTROL DE FLUJO] [ANIMACIÓN]	
		
	* Debe llamarse 1 vez por frame con deltaTime real	
		
	*/	
		
	update(pointerTarget: Vec2 | null, deltaTimeMs: number): void;	
		
		
		
	/**	
		
	* [MÉTODO] [FUNCIÓN PURA] [ESTADO]	
		
	* Retorna la posición actual de la pupila	
		
	*/	
		
	getCurrentPosition(): Vec2;	
		
		
		
	/**	
		
	* [MÉTODO] [ESTADO]	
		
	* Retorna el parámetro t actual en la curva	
		
	*/	
		
	getCurrentT(): number;	
		
		
		
	/**	
		
	* [MÉTODO] [ESTADO]	
		
	* Retorna el índice de curva actual	
		
	*/	
		
	getCurrentCurveIndex(): number;	
		
}		
		
		
		
/**		
		
* Implementación del tracker de pupila del original		
		
*		
		
* El algoritmo original:		
		
*   1. Proyecta el puntero al contorno del ojo (función ns())		
		
*   2. Interpola la posición con smoothing exponencial		
		
*   3. Aplica atracción del puntero con factor Ta (0.75)		
		
*   4. Usa tau variable (os=100ms base, La=250ms máx) para interpolación temporal		
		
*		
		
* La pupila se mueve a lo largo del contorno del ojo, no libremente en 2D.		
		
*/		
		
export class PupilTracker implements IPupilTracker {		
		
	private readonly contour: CubicBezier[];	
		
	private readonly smoothing: number;	
		
	private readonly pointerAttraction: number;	
		
	private readonly tauBase: number;	
		
	private readonly tauMax: number;	
		
		
		
	// Estado interno	
		
	private currentT: number = 0;	// Parámetro t en [0, numCurvas]
		
	private currentCurveIndex: number = 0;	
		
	private currentPosition: Vec2 = { x: 0, y: 0 };	
		
	private previousPointer: Vec2 | null = null;	
		
		
		
	// Para warm start en búsquedas continuas	
		
	private lastSearchT: number = 0;	
		
		
		
	constructor(config: PupilTrackerConfig) {	
		
	if (config.contour.length === 0) {	
		
	throw new Error('PupilTracker requiere al menos una curva en el contorno');	
		
	}	
		
		
		
	this.contour = config.contour;	
		
	this.smoothing = Math.max(0, Math.min(1, config.smoothing01));	
		
	this.pointerAttraction = DEFAULT_CONFIG.pointerAttraction;	
		
	this.tauBase = DEFAULT_CONFIG.pointerTauBase;	
		
	this.tauMax = DEFAULT_CONFIG.pointerTauMax;	
		
		
		
	// Inicializa en el primer punto de la primera curva	
		
	this.currentPosition = evaluateCubicBezier(this.contour[0], 0);	
		
	}	
		
		
		
	/**	
		
	* Actualiza la posición de la pupila basado en el puntero	
		
	*	
		
	* Algoritmo:	
		
	*   1. Si no hay puntero, retorna (sin movimiento)	
		
	*   2. Proyecta el puntero al contorno (encuentra punto más cercano)	
		
	*   3. Interpola hacia el objetivo con smoothing exponencial	
		
	*   4. Actualiza posición actual	
		
	*/	
		
	update(pointerTarget: Vec2 | null, deltaTimeMs: number): void {	
		
	if (!pointerTarget) {	
		
	// Sin puntero: no se mueve	
		
	return;	
		
	}	
		
		
		
	// Encuentra el punto más cercano en el contorno	
		
	// Usa warm start si hay continuidad de movimiento	
		
	const searchResult = this.previousPointer	
		
	? this.findClosestPointWarmStart(pointerTarget)	
		
	: this.findClosestPointGlobal(pointerTarget);	
		
		
		
	// Calcula factor de interpolación basado en deltaTime	
		
	// Tau variable: más rápido si el puntero se mueve mucho	
		
	const tau = this.calculateTau(pointerTarget, searchResult.point);	
		
	const alpha = 1 - Math.exp(-deltaTimeMs / tau);	
		
		
		
	// Interpola suavemente hacia el objetivo	
		
	// smoothing=0 → alpha=1 (instantáneo), smoothing=1 → alpha=0 (sin movimiento)	
		
	const effectiveAlpha = alpha * (1 - this.smoothing);	
		
		
		
	// Interpolación lineal entre posición actual y objetivo	
		
	this.currentPosition = {	
		
	x: this.currentPosition.x + (searchResult.point.x - this.currentPosition.x) * effectiveAlpha,	
		
	y: this.currentPosition.y + (searchResult.point.y - this.currentPosition.y) * effectiveAlpha	
		
	};	
		
		
		
	// Actualiza estado	
		
	this.currentT = searchResult.t;	
		
	this.currentCurveIndex = searchResult.curveIndex;	
		
	this.previousPointer = pointerTarget;	
		
	this.lastSearchT = searchResult.t;	
		
	}	
		
		
		
	/**	
		
	* Búsqueda global (sin semilla previa)	
		
	* Más costosa pero necesaria en el primer frame o después de saltos	
		
	*/	
		
	private findClosestPointGlobal(target: Vec2) {	
		
	let bestDist = Infinity;	
		
	let bestResult: { point: Vec2; t: number; curveIndex: number } | null = null;	
		
		
		
	for (let i = 0; i < this.contour.length; i++) {	
		
	const result = this.findClosestInCurve(this.contour[i], target, i);	
		
	if (result.distance < bestDist) {	
		
		bestDist = result.distance;
		
		bestResult = result;
		
	}	
		
	}	
		
		
		
	return bestResult!;	
		
	}	
		
		
		
	/**	
		
	* Búsqueda con warm start (usa resultado anterior como semilla)	
		
	* Más eficiente para movimiento continuo frame a frame	
		
	*/	
		
	private findClosestPointWarmStart(target: Vec2) {	
		
	// Solo busca en la curva actual y adyacentes (optimización)	
		
	const adjacentCurves = [	
		
	this.currentCurveIndex,	
		
	(this.currentCurveIndex - 1 + this.contour.length) % this.contour.length,	
		
	(this.currentCurveIndex + 1) % this.contour.length	
		
	];	
		
		
		
	let bestDist = Infinity;	
		
	let bestResult: { point: Vec2; t: number; curveIndex: number } | null = null;	
		
		
		
	for (const curveIndex of adjacentCurves) {	
		
	const curve = this.contour[curveIndex];	
		
		
		
	// Convierte t global a t local para esta curva	
		
	const localT = this.currentT - Math.floor(this.currentT);	
		
		
		
	const result = this.findClosestInCurveWithWarmStart(	
		
		curve,
		
		target,
		
		localT,
		
		curveIndex
		
	);	
		
		
		
	if (result.distance < bestDist) {	
		
		bestDist = result.distance;
		
		bestResult = result;
		
	}	
		
	}	
		
		
		
	return bestResult!;	
		
	}	
		
		
		
	/**	
		
	* Encuentra punto más cercano en una curva específica (búsqueda global)	
		
	*/	
		
	private findClosestInCurve(	
		
	curve: CubicBezier,	
		
	target: Vec2,	
		
	curveIndex: number	
		
	): { point: Vec2; t: number; curveIndex: number; distance: number } {	
		
	const coarseSteps = 12;	
		
	const refineIterations = 4;	
		
		
		
	let bestT = 0;	
		
	let bestDistSq = Infinity;	
		
		
		
	// Búsqueda gruesa	
		
	for (let i = 0; i <= coarseSteps; i++) {	
		
	const t = i / coarseSteps;	
		
	const point = evaluateCubicBezier(curve, t);	
		
	const dx = point.x - target.x;	
		
	const dy = point.y - target.y;	
		
	const distSq = dx * dx + dy * dy;	
		
		
		
	if (distSq < bestDistSq) {	
		
		bestDistSq = distSq;
		
		bestT = t;
		
	}	
		
	}	
		
		
		
	// Refinamiento local	
		
	let searchRadius = 1 / coarseSteps;	
		
	for (let iter = 0; iter < refineIterations; iter++) {	
		
	searchRadius /= 2;	
		
	const tLeft = Math.max(0, bestT - searchRadius);	
		
	const tRight = Math.min(1, bestT + searchRadius);	
		
		
		
	for (const t of [bestT, tLeft, tRight]) {	
		
		const point = evaluateCubicBezier(curve, t);
		
		const dx = point.x - target.x;
		
		const dy = point.y - target.y;
		
		const distSq = dx * dx + dy * dy;
		
		
		
		if (distSq < bestDistSq) {
		
		bestDistSq = distSq;
		
		bestT = t;
		
		}
		
	}	
		
	}	
		
		
		
	return {	
		
	point: evaluateCubicBezier(curve, bestT),	
		
	t: curveIndex + bestT,  // t global: índice + fracción	
		
	curveIndex,	
		
	distance: Math.sqrt(bestDistSq)	
		
	};	
		
	}	
		
		
		
	/**	
		
	* Encuentra punto más cercano con warm start (búsqueda local)	
		
	*/	
		
	private findClosestInCurveWithWarmStart(	
		
	curve: CubicBezier,	
		
	target: Vec2,	
		
	previousT: number,	
		
	curveIndex: number	
		
	): { point: Vec2; t: number; curveIndex: number; distance: number } {	
		
	const result = closestPointOnCurveWarmStart(	
		
	curve,	
		
	target,	
		
	previousT,	
		
	0.3,  // searchRange	
		
	6	// refineIterations
		
	);	
		
		
		
	return {	
		
	point: result.point,	
		
	t: curveIndex + result.t,	
		
	curveIndex,	
		
	distance: result.distance	
		
	};	
		
	}	
		
		
		
	/**	
		
	* Calcula tau (constante de tiempo) basado en la velocidad del puntero	
		
	* Tau más pequeño = respuesta más rápida	
		
	*/	
		
	private calculateTau(target: Vec2, projectedPoint: Vec2): number {	
		
	if (!this.previousPointer) {	
		
	return this.tauMax;	
		
	}	
		
		
		
	// Velocidad del puntero	
		
	const dx = target.x - this.previousPointer.x;	
		
	const dy = target.y - this.previousPointer.y;	
		
	const speed = Math.sqrt(dx * dx + dy * dy);	
		
		
		
	// Tau inversamente proporcional a la velocidad	
		
	// Velocidad alta → tau pequeño (respuesta rápida)	
		
	// Velocidad baja → tau grande (suavizado)	
		
	const speedFactor = Math.min(1, speed / 100);  // Normaliza a ~100px/frame	
		
	return this.tauBase + (this.tauMax - this.tauBase) * (1 - speedFactor);	
		
	}	
		
		
		
	/**	
		
	* Retorna la posición actual de la pupila	
		
	*/	
		
	getCurrentPosition(): Vec2 {	
		
	return { ...this.currentPosition };	
		
	}	
		
		
		
	/**	
		
	* Retorna el parámetro t actual (global, a través de todas las curvas)	
		
	*/	
		
	getCurrentT(): number {	
		
	return this.currentT;	
		
	}	
		
		
		
	/**	
		
	* Retorna el índice de la curva actual	
		
	*/	
		
	getCurrentCurveIndex(): number {	
		
	return this.currentCurveIndex;	
		
	}	
		
		
		
	/**	
		
	* Fuerza la posición a un punto específico del contorno	
		
	* Útil para inicialización o teletransportación	
		
	*/	
		
	setPosition(t: number): void {	
		
	const curveIndex = Math.floor(t) % this.contour.length;	
		
	const localT = t - Math.floor(t);	
		
		
		
	this.currentT = t;	
		
	this.currentCurveIndex = curveIndex;	
		
	this.currentPosition = evaluateCubicBezier(this.contour[curveIndex], localT);	
		
	}	
		
		
		
	/**	
		
	* Reinicia el tracker al inicio del contorno	
		
	*/	
		
	reset(): void {	
		
	this.currentT = 0;	
		
	this.currentCurveIndex = 0;	
		
	this.currentPosition = evaluateCubicBezier(this.contour[0], 0);	
		
	this.previousPointer = null;	
		
	this.lastSearchT = 0;	
		
	}	
		
}		