/**
 * Constants.ts — Constantes Mágicas de Tuning (Validación)
 *
 * [ORIGEN] Extraídas de eyes_grid.min.js en C:\AGENTES_IA\workspace\proyectos\my_robot\documentos\codigo_documentado
 * [CRITERIO] Firma exacta y valores calibrados del motor original para asegurar física idéntica.
 */

import type { EngineConfig } from './types';

export const DEFAULT_CONFIG: EngineConfig = {
  // === Grid Layout (odd-row offset, flat-top) ===
  hexSizeBase: 400,            // Ft = 400 (radio base de celda = 200px)
  variantsPerRow: 10,          // vt = 10 (variantes por fila)
  spiralGrowthRate: 0.005,     // se = 0.005 (tasa de crecimiento espiral)
  spiralMinRadius: 1.85,       // rn = 1.85 (crecimiento mínimo)
  spiralMaxRadius: 0.35,       // Js = 0.35 (crecimiento máximo)

  // === Cámara y Viewport ===
  cameraZoomDefault: 0.5,      // je / na = 0.5 (zoom default mobile/desktop)
  cameraZoomDesktop: 0.5,      // na = 0.5
  lensStrength: 0.85,          // Xe = 0.85 (fuerza de distorsión de lente)
  lensFalloff: 40,             // Qs = 40 (caída de lente en px)
  cullMargin: 10,              // Ye = 10 (margen de culling en celdas)

  // === Distorsión de Lente ===
  lensMaxScale: 1.9,           // He = 1.9 (escala máxima desktop)
  lensMaxScaleMobile: 2.15,    // ta = 2.15 (escala máxima móvil)
  lensTransitionSpeed: 4,      // sa = 4 (velocidad de transición)

  // === Snap y Inercia ===
  snapThreshold: 2,            // ee = 2 (umbral de snap en px)
  snapDuration: 800,           // be = 800ms (duración de snap)
  inertiaDecay: 325,           // $a = 325ms (tiempo de decaimiento exponencial exp(-dt/325))
  inertiaMinVelocity: 0.02,    // Ka = 0.02 (velocidad mínima para inercia)
  inertiaDelaySnap: 140,       // za = 140ms
  inertiaDelayLong: 1000,      // Va = 1000ms

  // === Repulsión ===
  repulsionIterations: 8,      // 8 iteraciones fijas en original
  repulsionPadding: 10,        // Ye = 10 (padding entre celdas)
  repulsionWeightBias: 0.5,    // 0.5 bias de peso

  // === Tracking de Pupila ===
  pupilSmoothing: 0.18,        // ce = 0.18 (suavizado de pupila)
  pupilOrbitRadius: 80,        // qe = 80 (radio de órbita de texto)
  pupilOrbitOffset: 20,        // Ke = 20 (offset de órbita)
  pointerAttraction: 0.75,     // Ta = 0.75 (fuerza de atracción de puntero)
  pointerTauBase: 100,         // os = 100ms (tau base)
  pointerTauMax: 250,          // La = 250ms (tau máximo)

  // === Render ===
  renderBlendOver: 0.75,       // $e = 0.75
  renderBoostFactor: 0.9,      // Bo = 0.9
  cacheTilePadding: 40,        // Qs = 40

  // === Animación de Textos ===
  textFadeInDuration: 900,     // da = 900ms
  textFadeOutDelay: 400,       // ma = 400ms
  textFadeOutDuration: 200,    // Ma = 200ms
  textOrbitSpeed: 8,           // Aa = 8°/s
  textPointerScale: 0.65,      // Fo = 0.65

  // === Líneas de Conexión ===
  lineThickness: 2,            // Ve = 2 (grosor desktop)
  lineThicknessMobile: 1,      // la = 1 (grosor móvil)
  lineCapLength: 20,           // eo = 20
  lineCurveMargin: 10,         // re = 10
  lineAlpha: 0.3,              // ha = 0.3
  lineCurveTightness: 2.1,     // fa = 2.1
  lineSearchRadius: 25,        // Qe = 25

  // === Focus Overlay ===
  focusBlurPx: 20,             // ic = 20px
  focusSaturate: 2,            // lc = 2
  focusInnerRadius: 48,        // fc = 48
  focusOuterRadius: 42,        // uc = 42
  focusEdgeSoftness: 0.65      // pc = 0.65
};

export const MOBILE_BREAKPOINT_PX = 640; // Ro = 640px
