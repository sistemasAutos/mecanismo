Fortalezas — máximo 3
Arquitectura modular real: core, grid, tracking, interaction, render, state, data, etc., con contratos tipados y barrels independientes.
Geometría y matemática especializadas: Bézier, SpiralLayout, LensDistortion, culling, indexing y tracking tienen implementaciones independientes y pruebas asociadas.
Separación conceptual correcta en varias capas: generación → estado → tracking → render; el problema es principalmente que el entrypoint actual no utiliza toda esa arquitectura.
3. Hallazgos críticos definitivos
C1 — Contrato geométrico inexistente

[Alta certeza]

GridLayer utiliza:

baseScale = 80 * cell.scale01

y después:

irisRadius = 0.25
pupilRadius = 0.08
pupilDistance = 0.15 * pupilOffset01

Todos son valores independientes.

Mientras shapes.ts contiene formas con escalas geométricas diferentes; el círculo usa r = 1 y otras formas usan r = 100.

Consecuencia: no existe una unidad geométrica canónica del ojo.

C2 — PupilTracker trabaja con una geometría diferente de la composición visual

[Alta certeza]

PupilTracker recibe CubicBezier[] y devuelve posiciones sobre ese contorno.

Pero GridLayer no utiliza ese contorno para posicionar la pupila: recibe solamente:

pupilAngleRad
pupilOffset01

y reconstruye una posición radial:

x = cos(angle) × distance
y = sin(angle) × distance

Consecuencia: tracking y rendering no comparten una transformación geométrica común.

C3 — main.ts mezcla potencialmente espacios de coordenadas

[Alta certeza]

PupilTracker.currentPosition pertenece al espacio del contorno local. cell.center pertenece al espacio de layout.

main.ts calcula:

pupilPos - cell.center

antes de producir pupilAngleRad/pupilOffset01.

Esto debe corregirse antes de considerar estable el comportamiento de la pupila.

C4 — main.ts bypassa GridLayout

[Alta certeza]

La arquitectura desarrollada tiene:

GridLayout
 ├── SpiralLayout
 ├── HexCoords
 ├── LensDistortion
 ├── CullingSpatial
 └── CellIndexer

pero el runtime mínimo genera directamente los datos de las celdas.

Consecuencia: culling, indexing, layout avanzado y distorsión no forman parte del camino visual actual.

C5 — main.ts bypassa RenderPipeline

[Alta certeza]

La arquitectura tiene un pipeline de render con separación de contextos/layers, pero el entrypoint dibuja directamente sobre el contexto utilizado por su ruta simplificada.

Consecuencia: existe infraestructura de render que no gobierna el frame actual.

C6 — Estado arquitectónico parcialmente duplicado

[Alta certeza]

CameraState posee comportamiento propio para actualización/zoom, mientras main.ts contiene lógica directa de interpolación y zoom.

Consecuencia: dos lugares potencialmente responsables del mismo comportamiento.

C7 — Componentes implementados sin consumidor runtime

[Alta certeza]

Casos demostrados:

URLSync
RepulsionSolver
GridLayout
LensDistortion
CullingSpatial
SpiralLayout
RenderPipeline

No deben eliminarse: deben integrarse, declararse opcionales o clasificarse como infraestructura no activada.

C8 — Archivos vacíos/artefactos

El árbol confirma archivos de tamaño 0:

public/assets/colorways.json
public/assets/shapes.json
src/data/rarity.ts
src/interaction/TouchGestures.ts
src/interaction/WheelHandler.ts

y anteriormente se confirmó la rama WASM vacía.

Esto es deuda estructural real, pero no debe confundirse con los módulos funcionales que simplemente no están conectados.

4. Plan de acción técnico
FASE 1 — CRÍTICO / BLOQUEANTE
F1.1 — Crear contrato geométrico canónico del ojo

Archivos afectados

src/core/types.ts
src/data/shapes.ts
src/render/layers/GridLayer.ts
Problema

Actualmente la forma exterior y los componentes internos no comparten dimensiones.

Solución exacta

Introducir un contrato geométrico explícito, conceptualmente:

EyeGeometry
 ├── curves
 ├── bounds
 ├── center
 ├── radius
 ├── normalizedScale
 ├── irisRadius01
 ├── pupilRadius01
 └── pupilTravelRadius01

SHAPE_CATALOG debe dejar de representar únicamente:

ShapeId → CubicBezier[]

y pasar a representar:

ShapeId → EyeGeometry

La geometría deberá estar normalizada a un espacio común.

Regla: ninguna forma podrá depender de que unas estén en 1 y otras en 100.

Criterio de aceptación

Para todos los ShapeId:

boundingRadius(normalizedShape) ≈ 1

dentro de una tolerancia definida.

Y:

irisRadius / eyeRadius
pupilRadius / irisRadius
pupilTravel / eyeRadius

serán invariantes del modelo y no constantes independientes del renderer.

F1.2 — Separar explícitamente espacios de coordenadas

Archivos

src/tracking/PupilTracker.ts
src/main.ts
src/core/types.ts
Problema

El tracker trabaja en coordenadas locales del contorno; cell.center está en coordenadas de layout.

Solución

Definir explícitamente:

LocalEyeSpace
WorldSpace
ScreenSpace

mediante tipos nominales o wrappers tipados.

Flujo obligatorio:

pointer Screen
       ↓
screen → world
       ↓
world → eye-local
       ↓
PupilTracker
       ↓
normalized pupil position
       ↓
eye-local render
       ↓
world
       ↓
screen

El tracker no debe recibir una posición mezclada con cell.center.

Criterio de aceptación

Con una celda ubicada en cualquier posición del grid:

pupilOffset01

debe ser idéntico para la misma posición relativa del puntero respecto al ojo.

Mover la celda completa por el mundo no puede cambiar la posición normalizada de la pupila.

F1.3 — Unificar tracking y rendering mediante geometría normalizada

Archivos

src/tracking/PupilTracker.ts
src/core/types.ts
src/render/layers/GridLayer.ts
Problema

Actualmente:

Tracker → punto sobre Bézier

pero:

GridLayer → angle + distancia fija

Son dos representaciones diferentes.

Solución

El tracker debe devolver una representación normalizada del ojo:

PupilPose
 ├── position01
 ├── angle
 └── travel01

GridLayer debe consumir esa pose usando las métricas de EyeGeometry.

No debe volver a inventar:

0.15
0.25
0.08

en el renderer.

Criterio de aceptación

La misma PupilPose debe producir una posición proporcionalmente equivalente para círculo, triángulo, cuadrado, hexágono y estrella.

F1.4 — Eliminar el escalado arbitrario del renderer

Archivo

src/render/layers/GridLayer.ts
Problema
baseScale = 80 * cell.scale01

es una constante visual sin relación explícita con las dimensiones normalizadas de la forma.

Solución

La escala debe derivarse de:

cell.scale01
+
configuración geométrica
+
métrica normalizada de EyeGeometry

El renderer debe limitarse a transformar:

eye-local → world

y dibujar.

Criterio de aceptación

Cambiar shapeId no debe cambiar arbitrariamente:

diámetro relativo del iris;
diámetro relativo de la pupila;
recorrido máximo de la pupila;
relación superficie/componentes.
F1.5 — Activar GridLayout como fuente única de placements

Archivos

src/grid/GridLayout.ts
src/data/DataGenerator.ts
src/main.ts
Problema

Hay dos rutas de generación:

GridLayout

y:

DataGenerator.generateEyeData()

La primera incorpora arquitectura espacial avanzada; la segunda es la utilizada por el entrypoint.

Solución

GridLayout debe convertirse en la fuente de:

CellPlacement[]

y DataGenerator debe encargarse únicamente de datos visuales:

shape
colorway
animation
contour/geometry

La composición final debe ser:

GridLayout
      ↓
CellPlacement
      +
DataGenerator
      ↓
EyeVisualState
      ↓
FrameData
Criterio de aceptación

main.ts no debe calcular directamente el layout geométrico de las celdas.

F1.6 — Integrar culling antes del render

Archivos

src/grid/CullingSpatial.ts
src/grid/GridLayout.ts
src/render/layers/GridLayer.ts
Problema

El runtime actual puede generar/renderizar más celdas de las visibles.

Solución

Pipeline:

camera
 ↓
viewport bounds
 ↓
GridLayout
 ↓
CullingSpatial
 ↓
visible CellPlacement[]
 ↓
FrameData
 ↓
RenderPipeline

El culling debe ocurrir antes de construir trabajo visual innecesario, no dentro de Canvas.

Criterio de aceptación

Al cambiar viewport/camera:

renderedCells <= generatedCells

y las celdas fuera del viewport no deben llegar a GridLayer.draw().

F1.7 — Hacer que RenderPipeline sea el único orquestador de render

Archivos

src/render/RenderPipeline.ts
src/render/layers/GridLayer.ts
src/render/layers/LineLayer.ts
src/render/layers/SatelliteLayer.ts
src/main.ts
Problema

Existe un pipeline arquitectónico, pero main.ts dibuja directamente.

Solución
HexEyesApp.render()
       ↓
RenderPipeline.renderFrame(frameData)
       ↓
GridLayer
LineLayer
SatelliteLayer

main.ts no debe conocer los detalles de:

ctx.save()
ctx.restore()
layer.draw()
Criterio de aceptación

El único consumidor directo de los tres contexts de render debe ser RenderPipeline.

F1.8 — Eliminar duplicación de cámara

Archivos

src/state/CameraState.ts
src/main.ts
Problema

La cámara tiene comportamiento encapsulado y main.ts reproduce parte de ese comportamiento.

Solución

CameraState debe ser la única autoridad para:

offset
zoom
targetZoom
zoomAtPoint
update
reset

main.ts únicamente envía comandos/eventos:

camera.zoomAtPoint(...)
camera.update(...)
Criterio de aceptación

Buscar cálculos directos de zoom/interpolación fuera de CameraState debe producir cero responsabilidades duplicadas.

F1.9 — Resolver CellIndexer realmente o retirar su dependencia

Archivo

src/grid/GridLayout.ts
src/grid/CellIndexer.ts
Problema

GridLayout crea un CellIndexer, pero la generación no lo utiliza.

Solución

Una de dos rutas técnicas:

GridLayout
 ↓
CellIndexer
 ↓
key/index lookup

si realmente participa en acceso espacial;

o eliminar la instancia/dependencia si el diseño final no necesita indexación.

No mantener una dependencia ceremonial.

Criterio de aceptación

No debe existir ningún constructor que instancie una dependencia que no participe posteriormente en el comportamiento del módulo.

FASE 2 — OPTIMIZACIÓN
F2.1 — SpriteCache

Archivos

src/render/SpriteCache.ts
src/render/RenderPipeline.ts
Solución

Integrarlo realmente al pipeline:

shape + colorway + geometry state
       ↓
cache key
       ↓
SpriteCache
       ↓
render

La clave debe incluir todos los parámetros que alteran el sprite.

Aceptación

Render repetido del mismo estado no debe recrear el sprite.

F2.2 — LensDistortion

Archivos

src/grid/LensDistortion.ts
src/grid/GridLayout.ts
src/render/
Solución

Aplicar la distorsión en el punto arquitectónico definido por GridLayout, antes del render.

No duplicarla en GridLayer.

Aceptación

La posición calculada por GridLayout ya contiene la distorsión y GridLayer únicamente renderiza.

F2.3 — RepulsionSolver

Archivos

src/interaction/RepulsionSolver.ts
src/main.ts
src/state/
Solución

Definir explícitamente qué estado físico modifica y conectarlo solamente si ese estado tiene consumidor visual.

interaction
 ↓
physics result
 ↓
state
 ↓
FrameData
 ↓
render

No introducir mutaciones directas de Canvas.

Aceptación

Una modificación producida por RepulsionSolver debe ser observable exclusivamente a través del estado consumido por render.

FASE 3 — MANTENIBILIDAD
F3.1 — Consolidar contratos públicos

Archivos

src/core/types.ts
src/*/index.ts
Solución

Los módulos deben depender de contratos públicos y no de implementaciones internas cuando exista interfaz.

Aceptación

Dependencias cruzadas entre capas deben pasar por tipos/interfaces explícitos.

F3.2 — Eliminar o aislar artefactos vacíos

[Alta certeza]

Archivos actualmente vacíos confirmados:

src/data/rarity.ts
src/interaction/TouchGestures.ts
src/interaction/WheelHandler.ts
public/assets/colorways.json
public/assets/shapes.json
Solución

Cada uno debe quedar en exactamente una categoría:

implementado
planeado
legacy
eliminable

No deben permanecer como módulos aparentemente activos sin implementación.

Aceptación

Ningún archivo vacío debe ser importable como si proporcionara funcionalidad.

F3.3 — Separar documentación de evidencia ejecutable

Archivos

src/data/borrar.md
otros *.md
Solución

Los .md no se utilizarán como evidencia de que una funcionalidad está activa.

La fuente de verdad será:

caller
 ↓
implementación
 ↓
estado mutado/retorno
 ↓
consumidor
 ↓
efecto observable

La documentación únicamente describirá ese comportamiento ya demostrado.

Aceptación

Toda afirmación arquitectónica crítica debe poder verificarse mediante código, import, caller o test.

5. Orden de ejecución definitivo
FASE 1
│
├── 1. Contrato EyeGeometry
├── 2. Normalización de SHAPE_CATALOG
├── 3. Separación Local/World/Screen
├── 4. PupilPose
├── 5. Unificación Tracker → Renderer
├── 6. GridLayout como fuente de placements
├── 7. Culling
├── 8. RenderPipeline
├── 9. CameraState como autoridad
└── 10. CellIndexer: integrar o eliminar dependencia
        │
        ▼
FASE 2
│
├── SpriteCache
├── LensDistortion
└── RepulsionSolver
        │
        ▼
FASE 3
│
├── Contratos públicos
├── Archivos vacíos
└── Documentación
Criterio global para pasar de auditoría a implementación

[Alta certeza] La auditoría queda suficientemente cerrada para comenzar cambios sin volver a investigar la arquitectura básica.

La primera modificación debe ser geométrica, no cosmética:

SHAPE_CATALOG
      ↓
EyeGeometry normalizada
      ↓
CellPlacement / transform
      ↓
PupilPose
      ↓
GridLayer
      ↓
Canvas

Eso resuelve primero la relación matemática que actualmente está rota y evita intentar corregir visualmente irisRadius, pupilRadius o baseScale como constantes aisladas.
