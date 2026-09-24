//--- hex-eyes-engine/src/__tests__/runTests.ts 
/**
 * Test suite — Verificación de criterios de aceptación
 *
 * [PROPÓSITO] Validar invariantes matemáticos y criterios de cada fase
 * [EJECUCIÓN] npx tsx src/__tests__/runTests.ts
 */

import { HexCoords } from '../grid/HexCoords';
import { SpiralLayout } from '../grid/SpiralLayout';
import { LensDistortion } from '../grid/LensDistortion';
import { evaluateCubicBezier, subdivideCubicBezier } from '../tracking/BezierSubdivision';
import { closestPointOnCurve, closestPointOnPath } from '../tracking/PointCurveDistance';
import type { Vec2, CubicBezier } from '../core/types';

// ============================================
// UTILIDADES DE TEST
// ============================================

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`✓ ${message}`);
  } else {
    failed++;
    console.error(`✗ ${message}`);
  }
}

function assertApprox(a: number, b: number, epsilon: number, message: string): void {
  const diff = Math.abs(a - b);
  assert(diff <= epsilon, `${message} (${a.toFixed(6)} ≈ ${b.toFixed(6)}, ε=${epsilon})`);
}

function assertVec2(a: Vec2, b: Vec2, epsilon: number, message: string): void {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  assert(
    dx <= epsilon && dy <= epsilon,
    `${message} ((${a.x.toFixed(2)},${a.y.toFixed(2)}) ≈ (${b.x.toFixed(2)},${b.y.toFixed(2)}))`
  );
}

// ============================================
// FASE 1: GRID MATH
// ============================================

console.log('\n=== FASE 1: Grid Math ===\n');

// --- HexCoords ---
const coords = new HexCoords({ hexSize: 50 });

console.log('--- HexCoords Tests ---');

// Test 1: Round-trip offsetToPixel → pixelToOffset
const testCoord = { col: 5, row: -3 };
const pixel = coords.offsetToPixel(testCoord);
const roundTrip = coords.pixelToOffset(pixel);
assert(
  roundTrip.col === testCoord.col && roundTrip.row === testCoord.row,
  'Round-trip offsetToPixel→pixelToOffset exacto'
);

// Test 2: Múltiples round-trips
let allRoundTripsPass = true;
for (let col = -10; col <= 10; col++) {
  for (let row = -10; row <= 10; row++) {
    const c = { col, row };
    const p = coords.offsetToPixel(c);
    const rt = coords.pixelToOffset(p);
    if (rt.col !== c.col || rt.row !== c.row) {
      allRoundTripsPass = false;
      console.error(`  Falló en (${col}, ${row}): round-trip dio (${rt.col}, ${rt.row})`);
    }
  }
}
assert(allRoundTripsPass, 'Round-trip correcto para grid 21x21');

// Test 3: hexDistance
const dist1 = coords.hexDistance({ col: 0, row: 0 }, { col: 0, row: 0 });
assert(dist1 === 0, 'hexDistance(a,a) = 0');

const dist2 = coords.hexDistance({ col: 0, row: 0 }, { col: 1, row: 0 });
assert(dist2 === 1, 'hexDistance(vecinos) = 1');

const dist3 = coords.hexDistance({ col: 0, row: 0 }, { col: 3, row: 0 });
assert(dist3 === 3, 'hexDistance(3 pasos) = 3');

// Test 4: neighbors (6 vecinos)
const center = { col: 5, row: 5 };
const neighbors = coords.neighbors(center);
assert(neighbors.length === 6, `neighbors retorna 6 elementos (got ${neighbors.length})`);

// Verifica que todos los vecinos estén a distancia 1
let allNeighborsAtDistance1 = true;
for (const n of neighbors) {
  if (coords.hexDistance(center, n) !== 1) {
    allNeighborsAtDistance1 = false;
  }
}
assert(allNeighborsAtDistance1, 'Todos los neighbors están a distancia 1');

// --- SpiralLayout ---
const spiral = new SpiralLayout();

console.log('\n--- SpiralLayout Tests ---');

// Test 5: ringAt(c, 0) = [centro]
const ring0 = spiral.ringAt({ col: 0, row: 0 }, 0);
assert(ring0.length === 1, 'ringAt(ring=0).length === 1');

// Test 6: ringAt(c, 3).length === 18
const ring3 = spiral.ringAt({ col: 0, row: 0 }, 3);
assert(ring3.length === 18, `ringAt(ring=3).length === 18 (got ${ring3.length})`);

// Test 7: ringAt(c, n).length === 6*n para n > 0
let ringsCorrect = true;
for (let ring = 1; ring <= 10; ring++) {
  const r = spiral.ringAt({ col: 0, row: 0 }, ring);
  if (r.length !== 6 * ring) {
    ringsCorrect = false;
    console.error(`  Ring ${ring}: esperado ${6*ring}, obtenido ${r.length}`);
  }
}
assert(ringsCorrect, 'ringAt(n).length === 6*n para n=1..10');

// Test 8: walkSpiral visita cada celda una vez
const visited = new Set<string>();
let visitCount = 0;
spiral.walkSpiral({ col: 0, row: 0 }, 5, (coord) => {
  const key = `${coord.col},${coord.row}`;
  if (visited.has(key)) {
    console.error(`  Visita duplicada: ${key}`);
  }
  visited.add(key);
  visitCount++;
});
const expectedCount = 1 + 6 * (1 + 2 + 3 + 4 + 5); // centro + suma de anillos
assert(visitCount === expectedCount, `walkSpiral visita ${expectedCount} celdas`);
assert(visited.size === visitCount, 'walkSpiral sin duplicados');

// --- LensDistortion ---
const lens = new LensDistortion({ strength01: 0.85, falloffRadiusPx: 40, maxScale: 1.9 });
const cameraCenter = { x: 400, y: 300 };

console.log('\n--- LensDistortion Tests ---');

// Test 9: scaleFactorAt en centro = 1.0
const centerScale = lens.scaleFactorAt(cameraCenter, cameraCenter);
assertApprox(centerScale, 1.0, 0.001, 'scaleFactorAt(centro) = 1.0');

// Test 10: applyToPosition en centro no mueve
const appliedCenter = lens.applyToPosition(cameraCenter, cameraCenter);
assertVec2(appliedCenter, cameraCenter, 0.001, 'applyToPosition(centro) no mueve');

// Test 11: scaleFactorAt es monótona no-creciente
const d1 = { x: 400, y: 300 };  // centro
const d2 = { x: 420, y: 300 };  // 20px
const d3 = { x: 440, y: 300 };  // 40px
const s1 = lens.scaleFactorAt(d1, cameraCenter);
const s2 = lens.scaleFactorAt(d2, cameraCenter);
const s3 = lens.scaleFactorAt(d3, cameraCenter);
assert(s1 >= s2 && s2 >= s3, `Monotonicidad: ${s1.toFixed(3)} >= ${s2.toFixed(3)} >= ${s3.toFixed(3)}`);

// ============================================
// FASE 2: TRACKING (BÉZIER)
// ============================================

console.log('\n=== FASE 2: Tracking (Bézier) ===\n');

// Curva de prueba: línea recta de (0,0) a (100,0)
const lineCurve: CubicBezier = {
  p0: { x: 0, y: 0 },
  p1: { x: 33.33, y: 0 },
  p2: { x: 66.67, y: 0 },
  p3: { x: 100, y: 0 }
};

console.log('--- BezierSubdivision Tests ---');

// Test 12: evaluateCubicBezier(t=0) = p0
const p0 = evaluateCubicBezier(lineCurve, 0);
assertVec2(p0, lineCurve.p0, 0.001, 'evaluateCubicBezier(t=0) = p0');

// Test 13: evaluateCubicBezier(t=1) = p3
const p1 = evaluateCubicBezier(lineCurve, 1);
assertVec2(p1, lineCurve.p3, 0.001, 'evaluateCubicBezier(t=1) = p3');

// Test 14: evaluateCubicBezier(t=0.5) en línea recta
const pMid = evaluateCubicBezier(lineCurve, 0.5);
assertApprox(pMid.x, 50, 0.1, 'evaluateCubicBezier(t=0.5).x = 50');
assertApprox(pMid.y, 0, 0.1, 'evaluateCubicBezier(t=0.5).y = 0');

// Test 15: subdivideCubicBezier reconstruye la original
const [left, right] = subdivideCubicBezier(lineCurve, 0.5);
const leftEnd = evaluateCubicBezier(left, 1);
const rightStart = evaluateCubicBezier(right, 0);
assertVec2(leftEnd, rightStart, 0.001, 'Subdivisión: fin(left) = inicio(right)');
assertVec2(leftEnd, pMid, 0.001, 'Subdivisión: punto medio correcto');

// Test 16: Curva circular aproximada por 4 Bézier
// Radio 50, centro (0,0)
const R = 50;
const k = 0.5522847498;  // Constante mágica para aproximar círculo
const circleCurves: CubicBezier[] = [
  // Cuadrante 1: de (R,0) a (0,R)
  { p0: { x: R, y: 0 }, p1: { x: R, y: R*k }, p2: { x: R*k, y: R }, p3: { x: 0, y: R } },
  // Cuadrante 2: de (0,R) a (-R,0)
  { p0: { x: 0, y: R }, p1: { x: -R*k, y: R }, p2: { x: -R*k, y: R*k }, p3: { x: -R, y: 0 } },
  // Cuadrante 3: de (-R,0) a (0,-R)
  { p0: { x: -R, y: 0 }, p1: { x: -R, y: -R*k }, p2: { x: -R*k, y: -R }, p3: { x: 0, y: -R } },
  // Cuadrante 4: de (0,-R) a (R,0)
  { p0: { x: 0, y: -R }, p1: { x: R*k, y: -R }, p2: { x: R*k, y: -R*k }, p3: { x: R, y: 0 } }
];

console.log('\n--- PointCurveDistance Tests ---');

// Test 17: closestPointOnCurve en círculo
// Punto en (R, 0) debería estar muy cerca del contorno
const testPoint1 = { x: R + 10, y: 0 };  // 10px fuera del círculo
const result1 = closestPointOnCurve(circleCurves[0], testPoint1, 12, 4);
const error1 = Math.abs(result1.distance - 10);  // Debería ser ~10
assert(error1 < 1, `closestPointOnCurve error < 1px (got ${error1.toFixed(3)})`);

// Test 18: Error < 2% sobre círculo completo
let maxErrorPercent = 0;
const numTestPoints = 36;
for (let i = 0; i < numTestPoints; i++) {
  const angle = (i / numTestPoints) * 2 * Math.PI;
  const distFromCenter = R * 1.5;  // Punto a 1.5R del centro
  const testPoint = {
    x: Math.cos(angle) * distFromCenter,
    y: Math.sin(angle) * distFromCenter
  };

  const result = closestPointOnPath(circleCurves, testPoint, 12, 4);
  const expectedDistance = distFromCenter - R;  // Debería ser 0.5R
  const errorPercent = Math.abs(result.distance - expectedDistance) / R * 100;

  if (errorPercent > maxErrorPercent) {
    maxErrorPercent = errorPercent;
  }
}

assert(maxErrorPercent < 2, `Error máximo < 2% sobre círculo (got ${maxErrorPercent.toFixed(3)}%)`);

// ============================================
// RESUMEN
// ============================================

console.log('\n=== RESUMEN ===\n');
console.log(`Pasados: ${passed}`);
console.log(`Fallidos: ${failed}`);
console.log(`Total: ${passed + failed}`);

if (failed > 0) {
  console.error('\n❌ ALGUNOS TESTS FALLARON');
  process.exit(1);
} else {
  console.log('\n✅ TODOS LOS TESTS PASARON');
  process.exit(0);
}
