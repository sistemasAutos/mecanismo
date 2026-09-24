//--- hex-eyes-engine/src/interaction/index.ts 
/**
 * Interaction module — Export unificado de interacción
 *
 * [FASE] 3 — Physics / Interacción
 * Módulos: RepulsionSolver, SnapController, InertiaModel, PanController
 */

export { resolveOverlaps, resolveOverlapsOptimized, type RepulsionBody } from './RepulsionSolver';
export { SnapController, cubicEase, linearEase, type SnapControllerConfig, type ISnapController } from './SnapController';
export { InertiaModel, type InertiaModelConfig, type IInertiaModel } from './InertiaModel';
export { PanController, type IPanController } from './PanController';
