//--- hex-eyes-engine/src/core/types.ts
/**
 * Tipos compartidos — Contrato técnico §4.0
 *
 * [ESTADO] Formas de datos puras, sin lógica
 * [DEPENDENCIA] Ninguna — base para todos los módulos
 */

export interface Vec2 {
  x: number;
  y: number;
}

export interface OffsetCoord {
  col: number;
  row: number;
}

/**
 * Definición de colorway con peso de rareza
 * [CONTRATO] rarityWeight: 0..1 (1 = más común)
 */
export interface ColorwayDef {
  id: string;
  name: string;
  hex: string;
  rarityWeight: number; // 0..1
}

/**
 * Curva de Bézier cúbica
 * [REFERENCIA] Farin, "Curves and Surfaces for CAGD", cap. 2
 */
export interface CubicBezier {
  p0: Vec2;
  p1: Vec2;
  p2: Vec2;
  p3: Vec2;
}

/**
 * Identificador de forma — catálogo definido en data/shapes.ts
 * [NOTA] No enumerado aquí para permitir extensión dinámica
 */
export type ShapeId = string;

/**
 * Estado visual completo de un ojo
 * [INVARIANTE] animFrame es índice discreto, nunca tiempo continuo
 * [INVARIANTE] pupilOffset01 ∈ [0..1]
 */
export interface EyeVisualState {
  shapeId: ShapeId;
  colorway: ColorwayDef;
  animFrame: number;      // índice discreto
  pupilAngleRad: number;
  pupilOffset01: number;  // 0..1
}

/**
 * Posicionamiento de celda en pantalla
 * [CONTRATO] scale01 ∈ [0..1], alpha01 ∈ [0..1]
 */
export interface CellPlacement extends OffsetCoord {
  center: Vec2;
  scale01: number;
  alpha01: number;
}

/**
 * Datos completos para renderizar un frame
 * [CONTRATO] Usado por IRenderLayer.draw()
 */
export interface FrameData {
  cells: CellPlacement[];
  eyeStates: Map<string, EyeVisualState>; // key: "col,row"
  cellContours?: Map<string, CubicBezier[]>; // key: "col,row"
  cursorScreenPos: Vec2 | null;
  cameraOffset?: Vec2;
  cameraZoom?: number;
}

/**
 * Configuración global del motor — constantes de tuning documentadas
 * [ORIGEN] Extraídas del código original (eyes_grid.min.js)
 * [PARAMETRIZACIÓN] Valores recalibrables sin afectar algoritmos
 */
export interface EngineConfig {
  // === Grid layout (odd-row offset, flat-top) ===
  hexSizeBase: number;        // Ft = 400 (tamaño base)
  variantsPerRow: number;     // vt = 10 (variantes por fila)
  spiralGrowthRate: number;   // se = 0.005 (tasa de crecimiento espiral)
  spiralMinRadius: number;    // rn = 1.85 (radio mínimo espiral)
  spiralMaxRadius: number;    // Js = 0.35 (radio máximo relativo)

  // === Cámara y viewport ===
  cameraZoomDefault: number;  // je = 0.5 (zoom default mobile)
  cameraZoomDesktop: number;  // na = 0.5 (zoom desktop)
  lensStrength: number;       // Xe = 0.85 (fuerza de distorsión de lente)
  lensFalloff: number;        // Qs = 40 (caída de lente en px)
  cullMargin: number;         // Ye = 10 (margen de culling en celdas)

  // === Distorsión de lente ===
  lensMaxScale: number;       // He = 1.9 (escala máxima lente)
  lensMaxScaleMobile: number; // ta = 2.15 (escala máxima móvil)
  lensTransitionSpeed: number;// sa = 4 (velocidad de transición)

  // === Snap y inercia ===
  snapThreshold: number;      // ee = 2 (umbral de snap en px)
  snapDuration: number;       // be = 800ms (duración de snap)
  inertiaDecay: number;       // $a = 325ms (decaimiento de inercia)
  inertiaMinVelocity: number; // Ka = 0.02 (velocidad mínima para inercia)
  inertiaDelaySnap: number;   // za = 140ms (delay antes de snap)
  inertiaDelayLong: number;   // Va = 1000ms (delay largo si hay velocidad)

  // === Repulsión ===
  repulsionIterations: number;// 8 iteraciones (hardcoded en original)
  repulsionPadding: number;   // Ye = 10 (padding entre celdas)
  repulsionWeightBias: number;// 0.5 bias para ponderación (calculado)

  // === Pupil tracking ===
  pupilSmoothing: number;     // ce = 0.18 (suavizado de pupila)
  pupilOrbitRadius: number;   // qe = 80 (radio de órbita de texto)
  pupilOrbitOffset: number;   // Ke = 20 (offset de órbita)
  pointerAttraction: number;  // Ta = 0.75 (fuerza de atracción del puntero)
  pointerTauBase: number;     // os = 100ms (tau base para interpolación)
  pointerTauMax: number;      // La = 250ms (tau máximo)

  // === Render ===
  renderBlendOver: number;    // $e = 0.75 (alpha base para blend)
  renderBoostFactor: number;  // Bo = 0.9 (factor de boost en bordes)
  cacheTilePadding: number;   // Qs = 40 (padding para tiles cacheados)

  // === Animación de textos ===
  textFadeInDuration: number; // da = 900ms (fade in de textos)
  textFadeOutDelay: number;   // ma = 400ms (delay antes de fade out)
  textFadeOutDuration: number;// Ma = 200ms (duración fade out)
  textOrbitSpeed: number;     // Aa = 8°/s (velocidad de órbita)
  textPointerScale: number;   // Fo = 0.65 (escala al interactuar)

  // === Líneas de conexión ===
  lineThickness: number;      // Ve = 2 (grosor de línea base)
  lineThicknessMobile: number;// la = 1 (grosor móvil)
  lineCapLength: number;      // eo = 20 (longitud de cap)
  lineCurveMargin: number;    // re = 10 (margen de curva)
  lineAlpha: number;          // ha = 0.3 (alpha base de línea)
  lineCurveTightness: number; // fa = 2.1 (tensión de curva)
  lineSearchRadius: number;   // Qe = 25 (radio de búsqueda de anclaje)

  // === Focus overlay ===
  focusBlurPx: number;        // ic = 20px (desenfoque de focus)
  focusSaturate: number;      // lc = 2 (saturación de focus)
  focusInnerRadius: number;   // fc = 48 (radio interno mobile)
  focusOuterRadius: number;   // uc = 42 (radio externo desktop)
  focusEdgeSoftness: number;  // pc = 0.65 (suavidad de borde)
}

/**
 * Configuración por defecto — valores exactos del original
 * [CRITERIO] Mantener constantes originales cuando hay conflicto de resultado
 */
export const DEFAULT_CONFIG: EngineConfig = {
  hexSizeBase: 400,
  variantsPerRow: 10,
  spiralGrowthRate: 0.005,
  spiralMinRadius: 1.85,
  spiralMaxRadius: 0.35,

  cameraZoomDefault: 0.5,
  cameraZoomDesktop: 0.5,
  lensStrength: 0.85,
  lensFalloff: 40,
  cullMargin: 10,

  lensMaxScale: 1.9,
  lensMaxScaleMobile: 2.15,
  lensTransitionSpeed: 4,

  snapThreshold: 2,
  snapDuration: 800,
  inertiaDecay: 325,
  inertiaMinVelocity: 0.02,
  inertiaDelaySnap: 140,
  inertiaDelayLong: 1000,

  repulsionIterations: 8,
  repulsionPadding: 10,
  repulsionWeightBias: 0.5,

  pupilSmoothing: 0.18,
  pupilOrbitRadius: 80,
  pupilOrbitOffset: 20,
  pointerAttraction: 0.75,
  pointerTauBase: 100,
  pointerTauMax: 250,

  renderBlendOver: 0.75,
  renderBoostFactor: 0.9,
  cacheTilePadding: 40,

  textFadeInDuration: 900,
  textFadeOutDelay: 400,
  textFadeOutDuration: 200,
  textOrbitSpeed: 8,
  textPointerScale: 0.65,

  lineThickness: 2,
  lineThicknessMobile: 1,
  lineCapLength: 20,
  lineCurveMargin: 10,
  lineAlpha: 0.3,
  lineCurveTightness: 2.1,
  lineSearchRadius: 25,

  focusBlurPx: 20,
  focusSaturate: 2,
  focusInnerRadius: 48,
  focusOuterRadius: 42,
  focusEdgeSoftness: 0.65
};
