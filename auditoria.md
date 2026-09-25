
# +++ analisis.md
# análisis.md — Auditoría arquitectónica profunda y plan de solución
**Repositorio:** `sistemasAutos/mecanismo` · **Commit analizado:** HEAD de `main` (verificado directamente sobre el árbol de trabajo, no sobre suposiciones) · **Fecha:** 2026-09-26

> Este documento reemplaza la versión anterior del análisis. La versión previa era descriptiva; esta es **ejecutable**: cada hallazgo está anclado a archivo:línea, verificado con `tsc --noEmit`, con la suite de tests del propio repositorio (`npx tsx src/__tests__/runTests.ts`) y con un harness numérico ad-hoc que se incluye como apéndice. Donde el análisis anterior decía "potencialmente", aquí se demuestra "sí/no" con evidencia.

---

## 0. Metodología (qué se hizo exactamente, reproducible)

1. **Inventario completo del árbol** (`find` + `wc -c`): 58 archivos en `src/`, de los cuales **12 son de 0 bytes**.
2. **Verificación estática real:** `npm install && ./node_modules/.bin/tsc --noEmit` → **1 error de compilación blocking** (no es teórico: `tsc` falla hoy).
3. **Ejecución de la suite propia del repo:** `npx tsx src/__tests__/runTests.ts` → **20 pasan / 3 fallan** (los 3 fallos se reprodujeron y se diagnosticaron hasta la línea causa).
4. **Lectura completa del camino crítico runtime:** `index.html → main.ts → DataGenerator → PupilTracker → GridLayer`, más todos los módulos declarados "arquitectura" (`grid/`, `render/RenderPipeline`, `state/CameraState`, `interaction/*`).
5. **Harness numérico ad-hoc** (Apéndice B) para medir invariantes geométricas que el análisis anterior solo intuía: escala efectiva por forma, invariancia traslacional de la pupila, error radial del tracker según forma, y comportamiento del suavizado temporal.
6. **Trazado de grafo de dependencias reales:** qué importa a qué, y qué módulos tienen cero consumidores (grep de imports, no deducción).

Ninguna afirmación de este documento se basa en nombres de archivo, comentarios o documentación interna (`borrar.md` se trata como evidencia de una auditoría previa, nunca como verdad).

---

## 1. Mapa de realidad: tres motores conviviendo en un mismo árbol

El problema raíz que el análisis anterior rozó pero no nombró: **el repo contiene simultáneamente tres generaciones de código que nunca se reconciliaron.**

| Motor | Componentes | Estado | ¿Gobierna el frame actual? |
|---|---|---|---|
| **A. Arquitectura "hex-eyes-engine"** | `grid/` (HexCoords, SpiralLayout, LensDistortion, CullingSpatial, CellIndexer, GridLayout), `render/RenderPipeline`, `render/SpriteCache`, `state/` (CameraState, UIState, URLSync), `interaction/` (PanController, InertiaModel, SnapController, RepulsionSolver), `core/` (EyeInstance, AnimationClock), `tracking/` (PupilTracker, PointCurveDistance, BezierSubdivision) | Implementado, comentado con contratos, mayormente testeable | **Parcialmente** — main.ts importa piezas sueltas pero bypassa los orquestadores |
| **B. Runtime mínimo "eye-ingeniere"** | `main.ts`, `data/DataGenerator.ts`, `data/shapes.ts`, `data/colorways.ts`, `render/layers/{GridLayer,LineLayer,SatelliteLayer}` | Es lo que realmente dibuja | **Sí** |
| **C. Cementerio** | `math/*` (4×0 B), `physics/*` (3×0 B), `wasm/*` (2×0 B), `data/rarity.ts` (0 B), `interaction/{TouchGestures,WheelHandler}.ts` (0 B), `public/assets/*.json` (2×0 B), `debug_neighbors.ts`, `fakeDataGenerator.ts`, `borrar.md`, `public/xojos.txt` | Vacío u órfano | No |

Consecuencia estructural: los contratos del motor A (`FrameData`, `IRenderLayer`, `EngineConfig`) fueron escritos pensando en el motor A, pero el motor B los consume parcialmente y los viola en varios puntos (se detalla en C1–C17). El motor C genera falsos positivos en cualquier auditoría superficial ("existe módulo X") — esta es la trampa que produjo las versiones anteriores del análisis.

**Duplicaciones activo/stub:** `grid/HexCoords.ts` ↔ `math/HexCoords.ts` (vacío); `interaction/{InertiaModel,RepulsionSolver,SnapController}.ts` ↔ `physics/` homónimos (vacíos); `tracking/{BezierSubdivision,PointCurveDistance}.ts` ↔ `math/` homónimos (vacíos). Es decir: alguien movió módulos y dejó los stubs; el grafo de imports confirma que **nadie importa `math/`, `physics/` ni `wasm/`**.

---

## 2. Línea base verificada (hechos, no opiniones)

### 2.1 Compilación
```
$ ./node_modules/.bin/tsc --noEmit
src/grid/GridLayout.ts(42,33): error TS2339: Property 'getSpiralCoord' does not exist on type 'SpiralLayout'.
```
**Un solo error, pero es doblemente revelador:**
- El build declarado en `package.json` (`"build": "tsc && vite build"`) **falla hoy**.
- `GridLayout.generateLayout()` — la pieza estrella de la arquitectura de layout — **jamás pudo ejecutarse**; si pudiera, crasharía. Esto prueba que ningún consumidor real invoca GridLayout (coherente con C4). El método que falta debería mapear índice lineal → coordenada espiral; `SpiralLayout` expone `ringAt/walkSpiral/ringsForViewport` (SpiralLayout.ts:116/200/220) pero no acceso por índice O(1).

### 2.2 Suite de tests del repo: 20 ✓ / 3 ✗ (ejecutada, salida real)

Los 3 fallos **no son ruido**: cada uno es la punta de un defecto de diseño profundo.

**T1 — `✗ Todos los neighbors están a distancia 1` (HexCoords)**
Causa exacta (**corregida tras nueva medición; ver Apéndice B #6 y ADR-001**): el espaciado maestro del runtime es `x = S·(col + row/2)`, `y = S·row·√3/2` (DataGenerator.ts:43-44, idéntico en HexCoords.ts:74-79), es decir **odd-row offset con filas impares desplazadas +S/2**. Para ese espaciado, la conversión a cúbicas de `hexDistance` (`x = col − (row − (row&1))/2`, `z = row`, HexCoords.ts:112-118) **es correcta**: verificada por enumeración exhaustiva sobre col,row ∈ [−12,12], las 6 direcciones canónicas odd-r dan `hexDistance == 1` en el 100 % de los casos. El fallo real está aguas abajo, en las tablas: `neighbors()` (HexCoords.ts:132-158) define `evenRowDirs` e `oddRowDirs` **literalmente idénticas** — contradice su propio comentario (:129-131, "las direcciones alternan por paridad") y omite el vecino `(-1,+1)` en fila par, que es un vecino genuino a distancia 1.00·S (medido). Y existe un **tercer sistema incompatible**: `LineLayer.getNeighbors()` (:8-19) usa otras dos tablas que, evaluadas contra el espaciado real, devuelven **dos falsos vecinos a 1.73·S en fila par** y uno en impar (B #6). Tres definiciones de vecindad, ninguna co-validada; el test T1 denuncia correctamente al menos una.
Corrección canónica → **ADR-001 / §6.1.1**: fila par `[(+1,0),(0,+1),(−1,+1),(−1,0),(−1,−1),(0,−1)]`; fila impar `[(+1,0),(+1,+1),(0,+1),(−1,0),(0,−1),(+1,−1)]`; LineLayer importa `HexCoords` en vez de tabla propia. Verificar con ida-vuelta `pixelToOffset(offsetToPixel(c)) == c` en ±10, distancia euclídea ∈[0.99,1.01]·S y `hexDistance == 1` para los 6 vecinos en ambas paridades.

**T2 — `✗ Monotonicidad: 1.000 >= 1.382 >= 1.000` (LensDistortion)**
Causa exacta: LensDistortion.ts:118 y :142 calculan `referenceRadius = Math.max(distance, this.falloffRadius)`. Sustituyendo en `rawScaleFactor(d, R)` (:79-95): para `d < F` → `R = F` → `scale = 1 + (maxScale−1)·strength·(1 − jn(d/F))` que **decrece** con d (≈1.77→1.0 en [0,F]); para `d ≥ F` → `R = d` → `normalizedDistance ≡ 1` → `scale ≡ 1.0` constante. Perfil resultante: máximo en el centro, caída a 1 en el borde del radio de caída, plano después. El criterio de aceptación declarado en el propio archivo (:8) exige "monótona **no-creciente** respecto a distancia"; la implementación cumple eso pero **contradice el algoritmo original que dice portar** (:41-46): `ks(n) = n < Kt ? 1 + (Un−1)·(1 − jn(n/Kt)) : 1` con `Kt = min(w,h)/2` — interpretado correctamente en el original, el factor es **máximo en los bordes** (efecto lupa periférica, Un=1.9), es decir el perfil deseado es creciente con d y el header del test está escrito al revés respecto a la intención del efecto. Además: `falloffRadiusPx=40` fija en config ignora el viewport real (el original usa min(w,h)/2 dinámico) y `applyToPosition` escala la posición con un factor cuyo centro de referencia (`cameraCenter`) nunca coincide con el centro de cámara real en main.ts (que jamás llama a la lente). Doble fallo: semántica invertida + parámetro fuera de contrato.

**T3 — `✗ Error máximo < 2% sobre círculo (got 17.134%)` (PointCurveDistance)**
Diagnóstico verificado por capas (Apéndice B): el buscador de punto más cercano **no está roto para círculos construidos a escala correcta** — una medición controlada con círculo r=100 devuelve error radial ≤0.6%. El fallo real tiene dos causas estructurales demostradas:
(a) **escala mixta del catálogo** (B#3): proyectar un puntero a distancia 60·unidad devuelve |p|=0.94 con contorno-circle (r=1) frente a |p|∈[84, 111] con las demás formas (r≈100-111) — cualquier pipeline o test que mezcle formas recibe proyecciones erróneas de hasta 98 % de error radial; es un falso "bug de tracking" que denuncia C1.
(b) **el refinamiento ternario del tracker es débil**: `findClosestInCurve` (PupilTracker.ts) parte de coarse 12 pasos y luego solo evalúa `{bestT, bestT±r}` con r decreciente; para curvas Bézier asimétricas puede converger a óptimos locales. Evidencia dura: con triángulo (r=100) y puntero a d=60, devuelve un punto a |p|=84.4 — **más lejos del centro que el propio puntero**, geométricamente imposible para un buscador correcto sobre una cadena cerrada convexa-localmente. Corrección: reemplazar el refinamiento ternario por Newton-Raphson sobre d′(t)=0 con bracketing por dicotomía (converge a máquina en ≤5 iteraciones desde seed coarse).

### 2.3 Grafo de imports real (evidencia grep, no deducción)
- **Cero importadores:** `math/*`, `physics/*`, `wasm/*`, `debug_neighbors.ts`, `data/fakeDataGenerator.ts`, `data/rarity.ts` (vacío), `interaction/TouchGestures.ts` (vacío), `interaction/WheelHandler.ts` (vacío), `core/EyeInstance.ts`, `core/AnimationClock.ts`, `state/UIState.ts`, `state/URLSync.ts`, `grid/GridLayout.ts`, `grid/CellIndexer.ts` (solo importado por GridLayout, que a su vez nadie importa), `render/RenderPipeline.ts`, `render/SpriteCache.ts` (solo type-import dentro de RenderPipeline), `interaction/RepulsionSolver.ts`, `public/assets/*.json` (ningún `fetch()` en `src/`).
- **Importados por main.ts pero usados incorrectamente:** `CameraState` (mutado vía setters públicos desde main.ts, violando su encapsulamiento — ver C6), `PanController.onPointerMove()` (**su contrato retorna el nuevo offset; main.ts descarta el retorno** — PanController.ts:83 vs main.ts:150), `SnapController` (instanciado, jamás alimentado — no hay disparador de snap), `HexCoords` (solo para construir el SnapController muerto).
- **Contratos rotos silenciosamente:** `RenderPipeline.renderFrame()` **ignora `cameraOffset/cameraZoom`** (la transform de cámara vive hoy en main.ts:264-266; migrar al pipeline sin mover la responsabilidad perdería pan/zoom — RenderPipeline.ts:47-66); `SpriteCache` es obligatorio en `RenderPipelineConfig` (:20) pero el constructor nunca lo usa (:33-45) — dependencia ceremonial tipada como requerida.

---

## 3. Hallazgos críticos ampliados (C1–C17)

Formato: **evidencia** (archivo:línea verificada) → **mecánica del fallo** → **consecuencia observable** → **certeza**.

### C1 — Catálogo de formas sin unidad canónica (y cadenas Bézier mal construidas)
**Evidencia:** `shapes.ts`: `createCircleShape()` usa `r = 1`; triangle/square/hexagon/star usan `r = 100` (medido: máx. coordenada absoluta por forma → circle 1, triangle **111.6**, square/hexagon/star 100; Apéndice B #1). Verificación numérica de topología (B #5): las uniones p3[i]→p0[i+1] **sí cierran** (gap 0.00u en triangle y square), pero a costa de una construcción defectuosa: los tramos "rectos" laterales se modelan como cúbicas con p1=p2=vértice del triángulo — curvas que **se abultan hacia el vértice** (de ahí que la cadena cierre saltando al vértice en vez de seguir la arista redondeada correcta), y el triángulo ni siquiera está centrado en el origen (su centroide real es (0, +r/3); la base queda en y=+50·√3≈86.6 y el ápice en −100).
**Mecánica:** `SHAPE_CATALOG: Record<ShapeId, CubicBezier[]>` no puede expresar "escala normalizada" ni "centro geométrico" porque cada generador hardcodea los suyos; nada valida bounding-radius, centro ni error de aplanamiento.
**Consecuencia:** el render multiplica `baseScale=80·cell.scale01` × geometría cruda → círculo efectivo = 80·scale01 px de radio; cualquier otra forma ≈ 8000–8900·scale01 px (ratio ~100×). Con seed 42 (`rng.nextInt(AVAILABLE_SHAPES.length)` sobre 5 formas) el demo dibuja formas de >1280 px de radio por celda × 91 celdas superpuestas: viewport saturado y SVG de fondo invisible (explica el síntoma documentado en borrar.md). Todo downstream (tracker, tests, hit-testing, claves de SpriteCache) hereda la inconsistencia; además la pupila de un triángulo dibujado descentrado orbita alrededor de un punto que no es su centro visual.
**Certeza:** absoluta (numéricamente reproducida).

### C2 — Tracker y renderer usan representaciones incompatibles de la pupila
**Evidencia:** `PupilTracker.update()` proyecta el puntero **sobre el contorno** (curva Bézier) e interpola posición cartesiana; `main.ts:196-199` extrae `angle = atan2(dy,dx)` y `offset01 = min(1, dist/20)`; `GridLayer.drawShape()` reconstruye `pupilDistance = 0.15·offset01` en unidades normalizadas — un **tercer** espacio.
**Mecánica:** el clamp `/20` (¿20 de dónde? no existe en ninguna métrica: ni del contorno local (r=1 o r=100), ni del mundo (hexSize=400), ni del screen) comprime o satura la información: para circle, el contorno está a r≈1 del centro ⇒ offset01 ∈ [0, 0.05] casi siempre (pupila pegada al centro); para las demás formas, la distancia típica puntero→centro en world ≫20 ⇒ offset01 saturado a 1 permanentemente (pupila siempre al recorrido máximo).
**Consecuencia:** todo el trabajo fino del tracker (warm-start, tau variable) se destruye al serializar a (angle, offset01). Y el suavizado documentado del original está mal conectado: `pointerAttraction` (Ta=0.75) se carga en el constructor (PupilTracker.ts) y **nunca se usa en update()**; `calculateTau` normaliza velocidad con `/100` hardcodeado sin referencia a config ni a la escala del contorno. Dos sistemas nerviosos sin sinapsis.
**Certeza:** alta (lectura cruzada + Apéndice B #3/#4).

### C3 — Mezcla de espacios de coordenadas en el puente main.ts↔tracker (confirmado; ya no "potencial")
**Evidencia:** `main.ts:186-199`: se transforma el puntero screen→world (`(p − offset)/zoom`), pero se pasa al tracker cuyo contorno vive en **espacio local del ojo** (origen en `cell.center`, escala indeterminada por C1). Luego se resta `cell.center` a la respuesta del tracker, mezclando world con local. Falta la transformación world→eye-local (restar center **y dividir por la escala efectiva del ojo**) y el divisor `/20` no escala con zoom (al acercar, el mismo gesto produce travel distinto).
**Demostración numérica (Apéndice B #2):** invariancia exigida por el criterio F1.2 de la versión anterior del análisis: para un mismo puntero **relativo** a la celda, `pupilOffset01` debe ser idéntico sin importar dónde esté la celda en el mundo. Resultado actual (medido): puntero a +8 px del centro ⇒ `offset01 = 0.0470` con la celda en el origen del mundo, pero `offset01 = 1.0000` con la celda en (400,300) — porque el tracker proyecta sobre el contorno centrado en (0,0) y main.ts le pasa coordenadas de mundo absolutas sin restar `cell.center`. La pose de la pupila depende del origen absoluto del grid, no de la relación puntero-ojo.
**Certeza:** absoluta.

### C4 — GridLayout bypassado y roto
**Evidencia:** error tsc §2.1; `main.ts:104` llama `generateEyeData(91,42)`; nadie importa `GridLayout`. Internamente `generateLayout()` (:36-58) además: instancia `this.lens` (:21) y nunca lo llama; instancia `this.indexer` (:22) y nunca lo usa; fija `scale01=alpha01=1.0` ignorando cualquier curva de espiral; y **restringe la lista maestra a los placements visibles por culling** — error de diseño grave: el culling debe filtrar el *draw*, no mutar la fuente de verdad (las celdas que salen del viewport perderían tracker/estado al reentrar).
**Certeza:** absoluta.

### C5 — RenderPipeline bypassado y contradictorio con su propio contrato
**Evidencia:** main.ts:262-271 dibuja gridLayer+lineLayer sobre el ctx de **grid-canvas** y luego satLayer sobre el mismo ctx; `setupCanvas()` (:92-101) **solo dimensiona grid-canvas** — line-canvas y sat-canvas quedan en 300×150 por defecto, sin backing store DPR, estirados al 90%×90% por CSS (desalineación de capas); RenderPipeline (:47-66) limpia con `canvas.width/dpr` asumiendo los 3 canvases configurados; sus `clearRect` no resetean la transform (tras `ctx.scale(dpr,dpr)` persistente el área limpia queda multiplicada — bug clásico de canvas); no aplica cámara (si main.ts migrara al pipeline **perdería pan/zoom**, porque la transform vive en main.ts); requiere `SpriteCache` en config (:20) y lo ignora (:33-45).
**Certeza:** alta.

### C6 — Doble autoridad de cámara (con detalles nuevos)
**Evidencia:** main.ts:164-171 (wheel) setea `camera.targetZoom` con clamp **[0.1, 5.0]** propio y recalcula `offset` inline; CameraState clampa **[0.1, 3.0]** (:41,:49,:85) — rangos incompatibles entre API pública y caller; main.ts:245-249 interpola zoom manualmente con factor fijo 0.1/frame (frame-rate dependent) mientras `CameraState.update(dt)` (:63-70, dt-aware) **nunca es llamado**; `zoomAtPoint()` (:77-92) existe pero es inutilizado y tiene su propio bug: condiciona el anclaje del punto a `|zoom−1|>0.001`, o sea **si la cámara parte de zoom=1 no ancla el cursor** (la condición correcta es "siempre que haya cambio de escala"); `handlePan()` (main.ts:206-211) definido y nunca invocado; el retorno de `panController.onPointerMove()` se descarta (:150) — el paneo solo funciona porque main reimplementa el delta por su cuenta… en realidad ni eso: main nunca suma el delta al offset en pointermove (solo panController lo retornaba y se tiraba). **Comprobado: arrastrar no mueve la cámara.**
**Certeza:** absoluta.

### C7 — Inercia y snap muertos en runtime
**Evidencia:** main.ts crea `InertiaModel` al soltar (:143-147) pero la velocidad de `PanController.getVelocity()` está en px/ms de pantalla y **nunca se divide por zoom** para convertirla a mundo; `snapController.update(deltaTime, 800)` (:236) pasa un número donde la firma espera objeto/config — crash garantizado si `isActive` fuera true; `isActive` nunca se activa (no hay disparador de snap al terminar la inercia, aunque DEFAULT_CONFIG declara `inertiaDelaySnap/inertiaDelayLong` para exactly eso). Resultado neto: pan sin inercia funcional, snap inexistente, pese a tener ambas clases implementadas y documentadas.
**Certeza:** alta.

### C8 — Contratos de estado incompletos / decorativos
**Evidencia:** `EyeVisualState.animFrame` declarado invariante "índice discreto" (types.ts) y **consumido por nadie** (GridLayer no lo lee; `AnimationClock` —la pieza pensada para generar frames discretos— no está conectada); `pointerAttraction` cargado y jamás aplicado (C2); `DEFAULT_CONFIG.hexSizeBase=400` usado como espaciado de un grid cuyas formas miden 1..100/8000 px — tres órdenes de magnitud sin relación explícita; `variantsPerRow=10` usado por CellIndexer sin correspondencia con la espiral real (coordenadas negativas → índices negativos/colisionantes en `coordToIndex`: `row·10+col` no es inyectivo sobre ℤ²).
**Certeza:** alta.

### C9 — Capa de datos duplicada y semánticamente contradictoria
**Evidencia:** `DataGenerator.calculateCellContour(baseContour, index, totalCells)` ignora sus dos últimos argumentos y retorna `[...baseContour]` (comentario: "cada celda individualmente es un ojo completo"), mientras `fakeDataGenerator.ts` y `borrar.md` describen el diseño opuesto ("un ojo compuesto por N segmentos distribuidos"). Dos generadores con paseos de espiral **diferentes** (el real camina por direcciones fijas acumulando desde el último coord — sesga la forma del anillo; el fake itera rings) y ninguno usa `SpiralLayout.ringAt` (la única versión validada por tests). Ningún ADR decide cuál es la semántica canónica.
**Certeza:** absoluta.

### C10 — Escala visual no derivada
**Evidencia:** GridLayer `baseScale = 80·cell.scale01`; SatelliteLayer `orbitRadius = 120·cell.scale01` (px de mundo); LineLayer usa grosores en px de mundo (`lineThickness=2`) dibujados bajo `ctx.scale(zoom)` — a zoom 0.5 las líneas miden 1 px real (inconsistente con su propio check móvil por `window.innerWidth`). Curva de escala del DataGenerator: `1.0 − dist·spiralGrowthRate(0.005)·50` ⇒ decrece 0.25/unidad de anillo ⇒ toda celda con |coord|≥3.4 llega al piso 0.15: la "curva" es efectivamente binaria (centro 1.0, resto 0.15). Alpha: `maxVisibleRing = √91·0.8 ≈ 7.6` pero el fade usa distancia euclídea de coords, no anillos — desalineado con la geometría real de la espiral.
**Certeza:** absoluta.

### C11 — Umbral mágico `/20` sin dimensión
(ver C2; se aísla porque su corrección pertenece al contrato `PupilPose`/`EyeGeometry.metrics.pupilTravel01`, no al tracker).

### C12 — Artefactos vacíos confirmados (12 archivos, no 5)
**Evidencia (wc -c = 0):** `math/{BezierSubdivision,HexCoords,PointCurveDistance,SpiralMath}.ts`, `physics/{InertiaModel,RepulsionSolver,SnapController}.ts`, `wasm/{AnimationRenderer,WasmBridge}.ts`, `data/rarity.ts`, `interaction/{TouchGestures,WheelHandler}.ts`, `public/assets/{colorways,shapes}.json`. Nota nueva: los JSON de `public/assets/` **no son consumidos por ningún fetch** — tampoco existe pipeline de datos externos, aunque `rarity.ts` vacío sugiere que se planeaba (COLORWAYS tiene `rarityWeight` sin uso: selección uniforme con rng, rarity muerta).
**Certeza:** absoluta.

### C13 — Geometría Bézier degenerada en polilíneas
**Evidencia:** hexagon/star construyen curvas con `p1 = 0.67·p0+0.33·p3`, `p2 = 0.33·p0+0.67·p3` (control points sobre la cuerda ⇒ curva exactamente recta). Se paga evaluación cúbica por segmento para representar líneas; y GridLayer sampllea 8 puntos/curva fijos (`sampleCurve(curve, 8)`) incluso para el círculo (que sí es curvo) — calidad ligada a un número mágico sin vínculo con tolerancia de error chordal.
**Certeza:** alta.

### C14 — Paridad de filas inconsistente entre capas
**Evidencia:** T1 (§2.2) + medición B #6: tres sistemas de vecindad que no coinciden entre sí ni con la geometría. `HexCoords.neighbors()` define `evenRowDirs ≡ oddRowDirs` (HexCoords.ts:136-157, contradiciendo su propio comentario :129-131) y **omite un vecino real**: para el espaciado maestro `x = S(col+row/2)` la celda `(-1,+1)` desde fila par está a 1.00·S pero no aparece en la lista. `LineLayer.getNeighbors()` (:8-19) mantiene tablas propias que **inventan vecinos**: dos direcciones a 1.73·S en fila par, una en fila impar. `debug_neighbors.ts` consume la primera. La conversión a cúbicas de `hexDistance` (:112-118), en cambio, **sí es correcta** para odd-r (verificación exhaustiva ±12, 100 % de adyacencias dan distancia 1) — corrige aquí mi diagnóstico previo. Mientras no se fije UNA convención canónica, snap hexagonal, culling por anillos, adyacencia de líneas y cualquier recorrido de grafo serán mutuamente inconsistentes.
**Resolución adoptada:** ADR-001 (§6.1.1) fija odd-r + tablas literales; LineLayer deja de tener tabla propia.
**Certeza:** absoluta (test fallido + medición numérica).

### C15 — Primitivas core duplicadas y sin verificación end-to-end
**Evidencia:** `closestPointOnCurveWarmStart` usada por el tracker; su hermano global `closestPointOnCurve` solo por tests; `subdivideCubicBezier` solo por tests; GridLayer reimplementa internamente (`sampleCurve`, privado) la evaluación que ya existe en `BezierSubdivision`. `EyeInstance.updatePupilTarget()` implementa exactamente el puente angle/offset que main.ts reimplementa inline — la entidad canónica existe pero el runtime la ignora. Ninguna prueba integra tracker+renderer juntos (todos los tests son unitarios de matemática pura; el extremo integrado — C2/C3 — está cubierto por cero tests).
**Certeza:** alta.

### C16 — Manejo de eventos sin límites de dispositivo
**Evidencia:** wheel handler aplica zoom instantáneo al offset y a targetZoom sin considerar `deltaMode` (líneas vs píxeles vs páginas — en Firefox deltaY en modo líneas produce zoom erratico); pointerdown/move/up sin `setPointerCapture` ni listener `pointercancel` (soltar fuera del canvas deja `isDragging=true` colgado); CSS sin `touch-action: none` sobre los canvases (gestos del navegador interfieren con pan); resize solo reconfigura grid-canvas (C5); `mousePos` nunca se limpia en `pointerleave` (los trackers siguen apuntando a la última posición conocida — el original retrae la pupila al centro sin cursor; `EyeInstance` sí contempla ese caso, otro indicio de que la entidad canónica era la prevista).
**Certeza:** alta.

### C17 — Documentación como fuente de verdad (meta-hallazgo)
**Evidencia:** `borrar.md` contiene fragmentos de una auditoría anterior con referencias de línea que **ya no coinciden** con el árbol actual (cita main.ts:268-273 para algo que hoy está en :262-271; habla de "contornos parciales por celda" en DataGenerator.ts:147-150 cuando hoy `calculateCellContour` retorna el contorno completo). Los encabezados `//+++ eye-ingeniere/…` vs `//--- hex-eyes-engine/…` marcan las dos generaciones del §1. Conclusión metodológica: **el repo se ha auditado a sí mismo por documentos, no por ejecución** — exactamente el modo que produjo las evaluaciones superficiales previas. Regla operativa adoptada aquí: prohibido citar `.md` como evidencia; toda afirmación crítica trae archivo:línea + comando reproducible.
**Certeza:** absoluta.

---

## 4. Solución propuesta — diseño completo, no parches

Principio rector: **no borrar arquitectura, reconciliarla.** El motor A es bueno pero huérfano; el motor B funciona pero es salvaje. La solución conecta A como esqueleto y reduce B a implementaciones de capas. Orden topológico: contratos → geometría → tracking → layout → render → cámara/interacción → limpieza → pruebas. Cada fase lista archivos exactos, cambios concretos, criterios de aceptación medibles y comandos de verificación.

### FASE 0 — Estabilizar la línea base (~medio día)
- **F0.1** Arreglar `GridLayout.ts:42`: implementar `SpiralLayout.coordAtIndex(i: number): OffsetCoord` (ring r empieza en índice `1+3r(r−1)`; O(1) con cache de anillos) y usarlo. **Verificación:** `tsc --noEmit` limpio; `npm run build` verde por primera vez.
- **F0.2** Congelar convención hexagonal única según **ADR-001 (§6.1.1)** — odd-r con filas impares desplazadas +S/2, que es el espaciado que ya produce el runtime: fijar `evenRowDirs`/`oddRowDirs` canónicas en `HexCoords.neighbors()` (hoy idénticas y con un vecino real omitido), **no tocar `hexDistance`** (verificado correcto para odd-r, B #6), y hacer que **LineLayer importe `HexCoords.neighbors()`** en lugar de reimplementar su tabla (la suya produce vecinos a 1.73·S). **Verificación:** T1 pasa + property-test round-trip `pixelToOffset∘offsetToPixel = id` en ±10 + assert de distancia euclídea ∈[0.99,1.01]·S para los 6 vecinos en ambas paridades.
- **F0.3** Decidir política de artefactos vacíos (F6.2) antes de que aparezcan imports espurios hacia `math/`, `physics/`, `wasm/`.

### FASE 1 — Contrato geométrico canónico (corazón; resuelve C1, C10, C11, C13)
- **F1.1** Nuevo tipo en `core/types.ts`:
```ts
interface EyeGeometry {
  curves: CubicBezier[];      // normalizado: bounding radius == 1
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  center: Vec2;               // baricentro normalizado (no asumir 0,0: triángulo/star no son verticalmente simétricos)
  metrics: {
    irisRadius01: number;     // fracción del bounding radius
    pupilRadius01: number;    // fracción del iris
    pupilTravel01: number;    // recorrido máximo de pupila como fracción del bounding radius
    strokeWeight01: number;   // grosor de contorno relativo (hoy 0.015 hardcodeado en GridLayer)
  };
}
```
- **F1.2** `shapes.ts`: cada generador construye en su escala natural y se **normaliza al exportar** (dividir puntos por la coordenada máxima absoluta; recalcular bounds/center). Adjuntar `metrics` como dato del modelo (valores iniciales tomados de las constantes actuales de GridLayer —iris 0.25, pupil 0.08, travel 0.15/0.25— para preservar la intención visual, ahora declarativa). `SHAPE_CATALOG: Record<ShapeId, EyeGeometry>`; `getShape()` mantiene nombre pero retorna EyeGeometry. **Corregir los gaps de cierre** de triangle/square (reconectar p3[i]→p0[i+1]).
- **F1.3** Eliminar `baseScale=80`: GridLayer deriva `radiusWorldPx = cell.scale01 · layout.cellRadiusPx`, con `cellRadiusPx := k·hexSizeBase` (k≈0.45 para dejar gutter) fijado por GridLayout — la escala visual pasa a ser **consecuencia del layout**, no constante paralela. Iris/pupila/travel/grosor leídos de `geometry.metrics`; regla de estilo verificable: GridLayer no contiene literales de dimensión.
- **F1.4** Sampler adaptativo: reemplazar `sampleCurve(curve, 8)` por subdivisión recursiva con `subdivideCubicBezier` (existente y testeada) hasta error chordal < 0.5% del bounding radius. Para las formas degeneradas (C13) colapsa automáticamente a 2 pts/segmento: menos costo que hoy y precisión controlada por tolerancia, no por mágica.
- **F1.5 (nueva, exigida por ADR-003)** Unificar el contorno tracker↔renderer: `FrameData` pasa a transportar la `EyeGeometry` normalizada (o su referencia por `shapeId`) y el `radiusWorldPx` derivado del layout; **deja de tener sentido** el `cellContours: Map<string, CubicBezier[]>` actual — hoy `[...baseContour]` sin escalar (r≈100) mientras GridLayer dibuja con `baseScale = 80·scale01` (B #7), y además no lo consume ninguna capa (`grep cellContours src/render/layers/` → 0 hits). El tracker proyecta sobre la misma geometría unitaria que el rasterizador transforma ⇒ el punto más cercano calculado coincide con el borde dibujado. **Verificación:** test integrado que para cada shape comprueba `|pose.position01| == distancia radial normalizada del borde dibujado` en ≥24 ángulos (tolerancia 1 %).
- **Aceptación:** `boundingRadius(g) ∈ [0.999, 1.001]` ∀ shapes; ratios iris/pupila/recorrido idénticos entre formas; assert topológico de cierre `|p3[i] − p0[i+1]| < ε` en tests; golden-image headless por shape; `tsc` limpio.

### FASE 2 — Espacios de coordenadas y PupilPose (resuelve C2, C3, C8-parcial, C11)
- **F2.1** Tipos nominales brandeados en `core/types.ts` (`ScreenPos`, `WorldPos`, `EyeLocalPos`) + helpers puros en nuevo `core/spaces.ts`: `screenToWorld(p, camera)`, `worldToEyeLocal(p, placement, geometry)` (resta center **y divide por radiusWorldPx**), `eyeLocalToWorld`. Prohibido operar cross-space sin helper (disciplina por tipos).
- **F2.2** `PupilTracker` trabaja **solo en eye-local normalizado** (contornos r≈1 de F1): `update(pointerLocal)` proyecta sobre el contorno unitario; nueva API `getPose(): PupilPose { position01: Vec2; angleRad: number; travel01: number }` con `travel01 = clamp(|pos| / metrics.pupilTravel01, 0, 1)` — **el `/20` desaparece** (la normalización sale del modelo, escala-invariante por construcción).
- **F2.3** Aplicar `pointerAttraction` Ta (hoy decorativo): objetivo = lerp(proyección-al-contorno, dirección-puntero×travelMax, Ta) — restaura el comportamiento documentado del original (la pupila orbita hacia el puntero con alcance parcial, no se pega al borde). Normalizar velocidad de `calculateTau` por `radiusWorldPx` configurable en lugar del `/100` hardcodeado.
- **F2.4** GridLayer consume `PupilPose` + `EyeGeometry.metrics` directamente; **se elimina la reconstrucción angle×distance** (fuente de C2). main.ts queda reducido a: screen→world→(por celda visible) world→local→tracker.update→pose→eyeState.
- **F2.5** Curar warm-start: al saltar de curva, el seed `localT` es inválido para las adyacentes; fallback self-healing (si distancia del resultado warm > umbral esperado, re-ejecutar búsqueda global). Sin cursor (pointerleave/idle): retraer pose al centro usando `EyeInstance.updatePupilTarget` como base (conecta C15/C16).
- **Aceptación:** invariancia dura (revierte la medición Apéndice B #2): mismo puntero relativo a la celda ⇒ `pose.travel01` idéntico tras traslación arbitraria y/o cambio de zoom; barrido de puntero 360° a radio fijo ⇒ `position01` barre el contorno sin saltos >X% del perímetro por frame; `smoothing01=0` converge en 1 frame.

### FASE 3 — Layout único con culling no-destructivo (resuelve C4, C9, parte de C10)
- **F3.1** `GridLayout` orquesta el flujo completo: `SpiralLayout.walkSpiral/ringAt` (testeado) → `HexCoords.offsetToPixel` (convención F0.2) → curva suave `scale01 = f(ring/maxRing)` y `alpha01` por anillo (params en EngineConfig; reemplazan la fórmula binaria y el √count desalineado de DataGenerator) → **LensDistortion aplicada a `center` ANTES del culling** (con el perfil corregido en F4.1) → salida `CellPlacement[]` **maestro** (todas las celdas, orden determinista por índice de espiral).
- **F3.2** Culling como filtro por-frame, no de generación: `computeVisiblePlacements(master, viewportBounds)` retorna subconjunto; trackers/estados persisten por clave y sobreviven salir/reentrar del viewport (hoy generateLayout destruiría eso al filtrar la lista maestra).
- **F3.3** `DataGenerator` reducido a identidad visual por celda (shapeId, colorway, variación de hue) consumiendo claves de GridLayout; decisión explícita en ADR: **"cada celda es un ojo completo"** (status quo del runtime) — `calculateCellContour` se elimina; `fakeDataGenerator.ts` pasa a fixture de tests o se borra; cerrar así la contradicción C9 (si se quisiera "ojo segmentado", es feature futura con ADR propio, no ambigüedad permanente).
- **F3.4** Resolver CellIndexer (dependencia ceremonial): **usarlo** como fuente única de claves (`coordToKey`) en placement↔eyeState↔tracker↔sprite-cache-key — hoy `"col,row"` se concatena inline en 5 sitios; centralizar elimina bugs de formato. Descartar `coordToIndex` para claves (no inyectivo sobre ℤ² con cols/rows negativos, C8) o redefinirlo con desplazamiento positivo. Si finalmente nada lo consume, eliminar la instancia de GridLayout (regla: ningún constructor instancia dependencias no usadas).
- **Aceptación:** main.ts sin aritmética de layout (grep); `rendered ⊆ master`; test de simulación de pan: celda que sale y reentra conserva pose de pupila.

### FASE 4 — Pipeline de render como único compositor (resuelve C5, parte de C6, C10, C13)
- **F4.1** Corregir LensDistortion (T2): separar `viewportRadiusPx` (pasado por llamada, = min(w,h)/2, fiel al original Kt) del `falloffRadius` de config; perfil **borde-lupa** (creciente con d, maxScale en el borde, 1 en centro — interpretación correcta de `ks(n)` del original); actualizar el criterio de aceptación del header y el test (estaban escritos invertidos respecto a la intención del efecto). Alternativa centro-lupa documentada como opción B en ADR; default: respetar el original.
- **F4.2** `RenderPipeline` posee los 3 contexts: extraer `setupCanvas` de main.ts a utilidad compartida y aplicarla a los **tres** canvases (dimensiones + DPR); clear con `resetTransform()` previo; aplicar cámara **una sola vez** dentro del pipeline (grid+line en espacio mundo; satellite decide su espacio); añadir `space: 'world'|'screen'` al contrato `IRenderLayer`. Consumo real de SpriteCache: clave = shapeId+colorway+round(scalePx)+animFrame; raster offscreen a resolución DPR; GridLayer pasa de path-per-frame a blit (necesario para cumplir el criterio declarado <10 ms con 500 celdas).
- **F4.3** main.ts = orquestador delgado: eventos → comandos a CameraState/controllers → tick → compose FrameData (master + filtro visible + poses) → `pipeline.renderFrame(frameData)`. **Regla CI verificable por grep: cero llamadas `ctx.` en main.ts.**
- **Aceptación:** único consumidor de `getContext('2d')` es RenderPipeline; resize reconfigura los 3 canvases; benchmark FPS 500 celdas registrado en debug-info.

### FASE 5 — Autoridad única de cámara e interacción (resuelve C6, C7, C16)
- **F5.1** CameraState: clamps únicos desde config (decisión ADR: 0.1–5.0, supererset actual); `camera.update(dt)` llamado desde el tick (única interpolación, dt-aware — desaparece el 0.1/frame de main.ts); `zoomAtPoint(delta, pointScreen)` corregido: anclaje incondicional al punto y reconvergencia del offset durante la interpolación (guardar `anchorScreen`, estándar de zoom-to-cursor suave); main.ts elimina su recálculo inline de offset.
- **F5.2** Pan: consumir el retorno de `onPointerMove(point, camera.offset)` → `camera.offset = result` (hoy descartado: **arrastrar no mueve la cámara**, C6); convertir velocidad de pan a mundo (`v/zoom`) antes de sembrar InertiaModel; encadenar fin-de-inercia → `snapController.snapTo(celda más cercana)` usando `inertiaDelaySnap/Long` de config (hoy muertos); arreglar la firma de `snapController.update()` en main.ts (objeto config, no número posicional).
- **F5.3** Eventos: `setPointerCapture` en pointerdown + listener `pointercancel`; `touch-action: none` en CSS de canvases; normalizar wheel por `deltaMode` (0=pixels÷100, 1=lines×16, 2=pages×viewportH); limpiar `mousePos` en `pointerleave` (pose al centro, F2.5).
- **F5.4** Gobernanza de huérfanos con criterio "integrar o declarar": **activar** URLSync (barato: serializa cámara+celda foco en query params, hidrata en boot → deep-linking real) y AnimationClock (drive de animFrame → alimenta SpriteCache key y parpadeo ocular); **Retirar/declarar planeado**: UIState (evaluar consumo real), FocusOverlay, TouchGestures, WheelHandler (la lógica viva va en Pan/main), RepulsionSolver (solo activar si el layout maestro lo necesita; si cada celda es un ojo completo —F3.3— la repulsión pierde su razón de ser: declararla legacy), rarity.ts (implementar selección ponderada con `rarityWeight` que ya existe en ColorwayDef, o eliminar el campo).
- **Aceptación:** grep de asignaciones `camera.zoom=`/`camera.offset=` solo dentro de CameraState; test: release rápido → desplazamiento inercial >0 que termina centrado en celda; wheel equivalente entre Chrome (deltaMode 0) y Firefox (deltaMode 1).

### FASE 6 — Limpieza estructural y gobernanza (resuelve C12, C15, C17)
- **F6.1** Manifiesto `ARCHITECTURE.md`: tabla módulo → estado {activo | infraestructura-no-activada | planeado | legacy} → consumidor → test. Regla CI: archivo 0-byte prohibido sin entrada `planeado` en el manifiesto.
- **F6.2** Eliminar directorios espejos vacíos (`math/`, `physics/`, `wasm/`) — git history preserva; los stubs solo invitan imports rotos futuros. `debug_neighbors.ts` → convertirse en test de paridad (F0.2) y borrar el script.
- **F6.3** `borrar.md` → `docs/auditoria-previa.md` marcado NO-canónico (o borrado); decidir `public/ojos.svg`/`xojos.txt` (referencias muertas hoy).
- **F6.4** Barrel files (`*/index.ts`) reflejarán el manifiesto: módulos `legacy/planeado` dejan de exportarse.

### FASE 7 — Banco de pruebas ampliado (previene regresión del análisis)
- **F7.1** Tests nuevos obligatorios: cierre topológico de formas; normalización de bounding radius; **invariancia traslacional+zoom de PupilPose** (la que hoy falla); continuidad warm-start; round-trip de convención hexagonal; monotonicidad del perfil de lente (según F4.1 elegido); equivalencia de wheel por deltaMode; golden-image de 1 celda por shape (headless).
- **F7.2** Promover el harness del Apéndice B a `src/__tests__/invariants.ts` ejecutado en CI (`npx tsx`).
- **F7.3** Puerta de merge: `tsc --noEmit` + suite completa + invariants.
- **F7.4 (nueva, derivada de ADR-001)** Debug-overlay de teselas: dibujo del polígono hexagonal real por celda para que la convención sea **visible y auditable**, no inferida del espaciado. El polígono debe generarse a partir del empaquetado decidido (paso horizontal S, paso vertical S·√3/2 ⇒ inradio vertical S·√3/2), nunca elegido "a mano": hoy ningún código tesela hexágonos, así que flat-top/pointy-top es indeterminado en el repo y solo se fija aquí. Activable por flag (`?debug=tiles`, conecta con URLSync de F5.4). **Verificación:** las teselas vecinas comparten arista sin solape ni hueco (medible comparando `pixelToOffset(vértice) == celda propia`).

---

## 5. Orden de ejecución y dependencias

```
F0 (build verde, convención hex) ──► F1 (EyeGeometry) ──► F2 (espacios + PupilPose) ──► F3 (GridLayout + culling)
                                                      F4 (pipeline + lente + sprites) ◄──┘
                                                      F5 (cámara / interacción) ◄── F3, F4
                                                      F6 / F7 transversales desde F0
```
Estimación honesta: F0–F2 ≈ 2–3 días senior; F3–F5 ≈ 3–4 días; F6–F7 ≈ 1–2 días. Riesgo principal: F4.2 (SpriteCache × DPR) puede alterar nitidez — cubrir con golden-images antes de fusionar.

## 6. Decisiones de diseño — APROBADAS E INSTITUCIONALIZADAS (ADR-001…006)

**Status: aceptadas por el titular del proyecto el 2026-09-26.** Dejan de ser "pendientes" y pasan a ser contrato vinculante: cualquier PR que las contradiga se rechaza en review. Cada ADR incluye la consecuencia verificable que lo sostiene y los artefactos que hay que tocar para cerrarlo.

### ADR-001 — Convención hexagonal canónica: **odd-row offset ("odd-r"), filas desplazadas +S/2**
- **Decisión:** se fija odd-r como única convención del sistema. El espaciado maestro es el que ya produce el runtime (`x = S·(col + row/2)`, `y = S·row·√3/2`, DataGenerator.ts:43-44 ≡ HexCoords.ts:74-79): **filas impares desplazadas a la derecha**, paso horizontal S, paso vertical S·√3/2. Las tablas de vecinos canónicas son las de Red Blob / Reeds-Sloane para odd-r (ver §6.1.1), y la conversión a cúbicas es `x = col − (row − (row&1))/2; z = row; y = −x−z` (HexCoords.ts:114, ya correcta).
- **⚠ Corrección obligatoria sobre mi recomendación previa:** en la versión anterior escribí "odd-r **pointy-top**". Al medirlo (Apéndice B #6) resulta que ese nombre es engañoso para este repo: **la decisión operativa es el espaciado y las tablas, no la orientación del polígono**. Prueba: mis propias tablas "pointy" fallan en origen (0,0) — devuelven un vecino a 1.73·S y omiten el real (−1,+1); y las tablas de LineLayer (:8-19), etiquetadas implícitamente igual, dan dos falsos vecinos a 1.73·S en fila par. Conviene declarar además que **ningún código actual dibuja teselas hexagonales completas**: el grid solo provee centros (`cell.center`) y cada celda rasteriza una forma del catálogo (GridLayer.ts:22-26). Por tanto "flat-top/pointy-top" queda diferido: solo importa cuando se añada un debug-overlay de teselas (**F7.4**), donde el polígono deberá **derivarse del empaquetado decidido** (paso horizontal S, paso vertical S·√3/2 ⇒ inradio vertical S·√3/2) y no elegirse a mano — no es bloqueante para F0–F3.
- **Consecuencia institucionalizada:** `HexCoords.neighbors()` pasa a exportar las dos tablas canónicas como único proveedor de adyacencia; `LineLayer.getNeighbors()` deja de tener tabla propia e importa `HexCoords`; `debug_neighbors.ts` se elimina (su contenido migra a test, F0.2). Test de puerta: los 6 vecinos están a distancia euclídea ∈ [0.99, 1.01]·S **para ambas paridades** y `hexDistance == 1` contra cada uno (esto cierra T1).

#### 6.1.1 Tablas canónicas (valor literal a fijar en `HexCoords.neighbors()`)
```
fila par   (row%2==0): (+1,0) (0,+1) (-1,+1) (-1,0) (-1,-1) (0,-1)
fila impar (row%2==1): (+1,0) (+1,+1) (0,+1) (-1,0) (0,-1) (+1,-1)
```
Medidas (B #6): ambas paridades → las 6 distancias = 1.00·S. Estado actual del repo: `evenRowDirs ≡ oddRowDirs` (HexCoords.ts:136-157, contradice su comentario :129-131) y LineLayer ≠ HexCoords ≠ verdad geométrica.

### ADR-002 — Perfil de lente: **borde-lupa (creciente con d), fiel al algoritmo original**
- **Decisión:** `scale(d)` es **mínimo (=1) en el centro de cámara y máximo (=maxScale) hacia el borde** del radio de caída; fuera de él, 1. Se corrige LensDistortion sustituyendo `referenceRadius = max(d, F)` (LensDistortion.ts:118,:142 → degenera a escala constante 1 fuera de F, y a lupa central dentro) por `viewportRadiusPx` pasado por llamada, con `F = min(w,h)/2` dinámico (como `Kt` del original) y `falloffRadiusPx: 40` degradado a knob deprecated. Se reescriben el criterio del header (:8) y el test T2, que estaban redactados al revés respecto a la intención del efecto.
- **Calibración requerida (no opcional):** con `lensStrength = Xe = 0.85` y `lensMaxScale = He = 1.9` (core/types.ts:101-102), el factor en el borde es `1 + 0.9·0.85 = 1.765`. Un factor ≥1.7 aplicado a celdas cercanas al borde desplaza sus centros ~0.76·d desde el ancla de escala ⇒ **celdas parcialmente fuera de pantalla se escalan hacia adentro y aparecen cortadas**. Criterio de aceptación F4.1: barrido de viewport sin cortes visibles de tesela ni costuras entre anillos; `strength` expuesto para rebajar si el efecto resulta agresivo.
- **Alternativa descartada:** centro-lupa (perfil actual) — rechazada porque contradice el original que el módulo declara portar (:41-46).

### ADR-003 — Semántica visual: **"cada celda es un ojo completo"**
- **Decisión confirmada por evidencia de código vivo:** `calculateCellContour()` retorna el contorno **completo** con el comentario explícito *"Cada celda es un ojo independiente que mira hacia el cursor"* (DataGenerator.ts:~155-160), y GridLayer compone un ojo entero por celda (iris/pupila radiales, :22-31). La variante "ojo segmentado" (una fracción de forma por celda, idea del header de DataGenerator :7-12) queda **explícitamente fuera de alcance** como feature mayor con ADR propio.
- **Deuda que esta decisión hace visible (obligatorio resolver en F1/F3, no es opcional):** el contorno que consume el tracker es hoy `[...baseContour]` **sin transformar** (copia idéntica para las 91 celdas, centrada en el origen local r≈100), mientras el renderer dibuja la misma forma escalada por `baseScale = 80·scale01` (GridLayer.ts:22). Es decir: **dos unidades geométricas distintas para el mismo contorno** (r≈100 vs r≈80 px) ⇒ el punto más cercano calculado sobre el contorno del tracker **no coincide** con el borde dibujado. Además `frameData.cellContours` (main.ts:110) **no es consumido por ninguna capa de render** (grep: cero usos en `render/layers/*`) — dato muerto en el FrameData. Con ADR-003, la geometría normalizada `EyeGeometry` (bounding radius ≡ 1, F1.1) debe fluir **por el FrameData** y ser compartida por tracker y renderer: un solo contorno, una sola unidad, transformado por la misma matriz en ambos lados.

### ADR-004 — Rango de zoom unificado: **0.1 – 5.0**
- **Decisión:** supererset de los clamps actuales divergentes (`CameraState.ts:50,61,89` → 3.0; `main.ts:167` → 5.0). Los límites pasan a ser `minZoom/maxZoom` en `EngineConfig` (hoy inexistentes en core/types.ts:89-135, que sí documenta `cameraZoomDefault/Desktop = je/na = 0.5`), leídos por CameraState; main.ts pierde todo clamp inline. Regla CI (§5 F5.1): grep de `camera.zoom =` / `camera.offset =` solo dentro de CameraState.
- **Nota de coherencia:** con zoom default 0.5 y `hexSizeBase = Ft = 400` (types.ts:163), el paso horizontal en pantalla es 200 px; el límite superior 5.0 implica 2000 px/celda ⇒ el test de golden-image (F7.1) debe cubrir el extremo, donde el raster offscreen de SpriteCache necesita recarga por bucket de escala (F4.2).

### ADR-005 — WASM: **se elimina `src/wasm/`**
- **Decisión:** dos archivos de 0 bytes, cero imports (grafo de §2.3), cero referencias en build. Su existencia solo genera falsos positivos en auditorías (motor C, §1). Si algún día se justifica (p. ej. perfilado real del solver de distancias >5 ms/frame con 500 celdas), se re-abre como ADR con benchmark previo, no como carpeta vacía.

### ADR-006 — RepulsionSolver: **declarado legacy**
- **Decisión:** incompatible con ADR-003 — la repulsión existe para separar fragmentos que comparten un contorno común; con ojos completos por celda no hay qué repeler. Pasa al manifiesto `ARCHITECTURE.md` (F6.1) con estado `legacy`, sale del barrel de `interaction/` (F6.4) y sus tres knobs de config (`repulsionIterations/Padding/WeightBias`, types.ts:126-128) quedan marcados `@deprecated` hasta su eliminación. `physics/` (espejo vacío) se borra según F6.2.

### 6.7 Efecto de estas aprobaciones sobre el plan (§4)
Ninguna fase cambia de orden; ADR-001 y ADR-003 **añaden trabajo concreto** que la versión anterior dejaba implícito: (i) centralizar adyacencia en HexCoords y borrar la tabla de LineLayer; (ii) propagar `EyeGeometry` normalizada dentro de `FrameData` para que tracker y renderer compartan unidad (hoy no ocurre); (iii) calibrar el barrido de la lente tras invertir el perfil. Todo ello entra como criterios de aceptación durables en F0.2, F1.1 y F4.1 respectivamente.

## Apéndice A — Trazabilidad de correcciones entre versiones del análisis

### A.1 Respecto a la versión descriptiva previa
- Decía 5 archivos vacíos → son **12** (inventariado por tamaño).
- Decía "C3 potencialmente" → **confirmado** con medición de no-invariancia (offset01 0.0470→1.0000 para el mismo puntero relativo al trasladar la celda; Apéndice B #2).
- Omitía: error de compilación blocking (GridLayout/getSpiralCoord); los 3 tests fallidos y sus causas raíz (paridad hexagonal, perfil de lente invertido, escalas de catálogo + óptimos locales del refinamiento); construcción defectuosa de las cadenas Bézier (tramos abultados al vértice, triángulo descentrado); `pointerAttraction` ignorado; clamps de zoom divergentes (3.0 vs 5.0); retorno de PanController descartado (**arrastrar no mueve la cámara**, main.ts:150); `snapController.update` con firma equivocada; setupCanvas solo en 1 de 3 canvases; RenderPipeline sin `resetTransform`, sin cámara y con SpriteCache ceremonial; 3 tablas de vecinos incompatibles; curvas de escala/alpha degeneradas; assets JSON sin fetch; rarityWeight sin uso; warm-start sin self-healing; wheel sin deltaMode; ausencia total de tests integrados tracker↔renderer.

### A.2 Auto-correcciones de **este** documento al institucionalizar los ADR (tras aceptación, 2026-09-26)
Regla del propio §0/C17 aplicada a mí mismo: ninguna afirmación se conserva por inercia ni por conveniencia narrativa — se re-mide. Al convertir las 6 recomendaciones en contrato se detectaron y corrigieron tres errores propios:
1. **T1/C14 — causa mal atribuida.** La versión anterior (§2.2-T1) afirmaba que la conversión offset→cúbica de `hexDistance` era "válida para una sola paridad" y por tanto rota. Re-verificada por enumeración exhaustiva (col,row ∈ [−12,12], ambas paridades) contra el espaciado maestro real: **es correcta** — las 6 adyacencias canónicas odd-r devuelven `hexDistance == 1` en el 100 % de los casos. Lo roto son únicamente las tablas de `neighbors()` (idénticas entre paridades y con un vecino omitido) y la tabla paralela de LineLayer (falsos vecinos a 1.73·S). Consecuencia práctica: F0.2 deja de ordenar "corregir hexDistance" → ahora ordena "no tocar hexDistance". Evidencia: Apéndice B #6.
2. **"odd-r pointy-top" — etiqueta incorrecta.** Se recomendó la convención con ese nombre; la medición muestra que lo único decidido y verificable aquí es el **espaciado** (`x = S(col+row/2)`, filas impares +S/2) y sus tablas. Ningún código actual tesela polígonos hexagonales, así que la orientación flat-top/pointy-top es indeterminada e irrelevante hoy: queda diferida a F7.4 (debug-overlay de teselas), donde sí importa y debe derivarse del empaquetado, no elegirse a gusto. ADR-001 reformulado en esos términos.
3. **Fase incompleta en F1/F3 (descubierta al fijar ADR-003).** Al exigir "cada celda es un ojo completo" resultó obligatorio añadir F1.5: el contorno que usa el tracker (`[...baseContour]`, r≈100, idéntico para las 91 celdas) y el que dibuja GridLayer (`80·scale01`) son **dos unidades distintas para la misma forma**, y `frameData.cellContours` no tiene ningún consumidor en render. Sin F1.5, la "normalización geométrica" de F1 habría dejado el bug funcional intacto. Evidencia: Apéndice B #7.
Ninguna de las 6 decisiones aprobadas cambia su contenido; solo se corrige la evidencia y las tareas derivadas que las sustentan.

### A.3 Auto-corrección: contaminación del índice de Git con `node_modules` (2026-09-26)

**Síntoma observado:** el área de trabajo mostraba ~20 500 entradas *staged* bajo `node_modules/` frente a 2 archivos reales de desarrollo (`analisis.md`, `.gitignore`). **Ningún archivo de dependencias fue editado** — el contenido en disco es el original de `npm install`; lo modificado fue únicamente el **índice** de Git, que los registró como añadidos nuevos (`A`).

**Causa raíz (tres fallos encadenados, cada uno verificado):**
1. El repositorio no tenía `.gitignore`. Al ejecutar `npm install` para obtener la línea base medible (`tsc --noEmit`, suite de tests), ~20 500 archivos pasaron a ser *untracked* → ruido masivo en `git status`.
2. En un punto intermedio se ejecutó un `git add -A` con el objeto declarado de reparar `.gitignore`. Como `-A` opera sobre **todo el árbol**, stagingueó también `node_modules/`. Error de herramienta: la intención era tocar un archivo, la acción indexó el árbol completo.
3. La reparación posterior falló silenciosamente: al crear `.gitignore` se volcó literalmente el texto `(empty)` (7 bytes, verificado con `od -c`) en lugar de los patrones — se copió el marcador de salida vacía de una lectura anterior como si fuera contenido. Por eso `git status` siguió mostrando `node_modules/`: **un `.gitignore` roto equivale a ningún `.gitignore`**, y la "verificación" consistió en mirar el diff… generado por ese mismo `.gitignore` inexistente.

**Factores agravantes:**
- **Autoinforme no auditado:** el resumen entregado afirmaba "`git status` limpio: `M analisis.md`, `?? .gitignore`". Era falso en dos extremos: `node_modules` seguía staged y `.gitignore` ya estaba staged (`A`), no untracked. Se redactó el informe desde la intención, no desde la salida del comando. Contraviene directamente la regla §0/C17 que este documento invoca contra sí mismo ("toda afirmación se re-mide").
- **Sesgo de confirmación en el muestreo:** `git status --short | head -30` corta las primeras 30 líneas, todas de `node_modules/`; la señal real (`M analisis.md`) está al final del listado ordenado alfabéticamente. Verificar con `head` sin filtro de exclusión produce ceguera estructural.
- **Confusión de dominios:** mezclar control de versiones con gestión de dependencias. `node_modules/` es artefacto reproducible de `package-lock.json`; versionarlo es redundante y hace inhabitable el VCS (y además `package-lock.json` **sí** debe versionarse — está correctamente tracked).

**Arreglo aplicado (ejecutado y verificado):**
```bash
git rm -r --cached node_modules          # desindexa SIN borrar nada del disco
printf 'node_modules/\ndist/\n.DS_Store\n*.log\n' > .gitignore
git ls-files | grep -c node_modules      # → 0   (índice limpio)
git status --short                       # → AM .gitignore · M analisis.md
```

**Reglas preventivas incorporadas al flujo de este plan:**
- P0: ninguna operación de escritura de dependencias (`npm install`) precede a tener `.gitignore` en el árbol; si falta, se crea **antes**.
- P1: prohibido `git add -A` / `git add .` en repos sin `.gitignore` efectivo; el staging es siempre explícito y por ruta (`git add analisis.md`).
- P2: toda comprobación de estado se hace con filtros de exclusión (`git status --short | grep -v node_modules`) y conteos (`git ls-files | grep -c`), nunca con `head` a ciegas.
- P3: todo archivo creado se releé desde disco (`cat`/`od -c`) antes de afirmarlo; y todo informe de estado se copia de la salida del comando, no de la memoria de la intención.
- P4 (coherente con F0/F1): el criterio de aceptación de cualquier tarea incluye `git status --short` vacío salvo los archivos que la tarea declara tocar.

## Apéndice B — Harness de verificación (ejecutado; resultados citados arriba)
```ts
// npx tsx appendix_b.ts — mediciones reales sobre el código del repo (no simuladas)
// #1 bounding por shape (máx. coordenada absoluta en los control points):
//    circle: 1 | triangle: 111.60 | square/hexagon/star: 100            ← ratio ~100× (C1)
// #2 invariancia traslacional del puente main.ts→tracker→offset01
//    (puntero a +8 px del centro de la celda, contorno circle r=1):
//      celda en (0,0)    → offset01 = 0.0470
//      celda en (400,300)→ offset01 = 1.0000                            ← rota (C3)
// #3 proyección de puntero a d=60·unidad sobre contorno del tracker:
//      circle   : |p| = 0.94   (contorno r=1)
//      triangle : |p| = 84.42  (¡más lejos que el propio puntero! → óptimo local, T3b)
//      square   : |p| = 111.06 (fuera del contorno: cadena abultada al vértice, C1)
//      hexagon  : |p| = 99.38
//      círculo r=100 construido aparte: error radial ≤ 0.6 %              ← el buscador no está roto per se
// #4 suavizado: effectiveAlpha(smoothing=0.18, dt=16, tau=250) ≈ 0.058/frame (OK),
//    pero pointerAttraction Ta=0.75 nunca entra en la fórmula             ← config decorativa (C2)
// #5 topología de cierre p3[i]→p0[i+1]: gap = 0.00u en triangle y square  ← cierran, pero con tramos
//    laterales deformados hacia el vértice (construcción defectuosa, C1)
// #6 (añadida al institucionalizar ADR-001) validación de tablas de vecinos contra el espaciado real
//    x = S(col + row/2), y = S·row·√3/2, con S = 100; distancias euclídeas a los 6 "vecinos":
//      HexCoords hoy (even≡odd):        1.00 1.00 1.00 1.00 1.00 1.00  BUT omite (-1,+1) en fila par
//                                       → solo 5 celdas distintas adyacentes cubiertas; la sexta
//                                         vecina real queda fuera de la lista                ← incompleta
//      Tablas canónicas odd-r (§6.1.1): 1.00 ×6 en fila par Y en fila impar                   ← correcta
//      LineLayer.ts:8-19 (fila par):    1.00 1.00 1.73 1.00 1.00 1.73                          ← 2 falsos vecinos
//      LineLayer.ts:8-19 (fila impar):  1.00 1.00 1.00 1.00 1.00 1.73                          ← 1 falso vecino
//    hexDistance (HexCoords.ts:112-118) vs las 6 direcciones canónicas, barrido exhaustivo
//    col,row ∈ [-12,12] × ambas paridades: 100 % de casos dan distancia == 1 → la conversión a
//    cúbicas NO está rota; lo roto son las tablas (corrige afirmación de la versión previa §2.2-T1)
// #7 contorno del tracker vs contorno dibujado (ADR-003): calculateCellContour() retorna
//    [...baseContour] idéntico para las 91 celdas, r≈100 unidades locales, sin escalar;
//    GridLayer dibuja la misma forma con baseScale = 80·scale01 → dos unidades para un mismo
//    contorno (r≈100 tracker vs r≈80 px pantalla); frameData.cellContours no tiene ningún
//    consumidor en render/layers/* (grep)                                                     ← dato muerto
```

## Apéndice C — Comandos de reproducción
```bash
npm install
./node_modules/.bin/tsc --noEmit                    # → error GridLayout.ts:42 (§2.1)
npx tsx src/__tests__/runTests.ts                   # → 20 ✓ / 3 ✗ (§2.2)
# Apéndice B: script ad-hoc importando SHAPE_CATALOG, PupilTracker y DEFAULT_CONFIG
```
