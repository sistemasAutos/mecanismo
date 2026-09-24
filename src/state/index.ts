//--- hex-eyes-engine/src/state/index.ts
/**
 * State module — Export unificado de gestión de estado
 *
 * [FASE] 5 — Orquestación / Estado
 * Módulos: CameraState, UIState, URLSync
 */

export { CameraState, type CameraStateConfig } from './CameraState';
export { UIState, type UIStateListener } from './UIState';
export { URLSync, type URLSyncConfig, type IURLSync } from './URLSync';
