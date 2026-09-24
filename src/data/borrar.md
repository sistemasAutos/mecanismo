index.html:83-91 contiene el SVG en línea; no se carga desde public/.
El SVG está en z-index: 0, mientras los canvas están en z-index: 1, 2 y 3.
main.ts:268-273 dibuja GridLayer, LineLayer y SatelliteLayer directamente sobre grid-canvas.
RenderPipeline.ts existe, pero main.ts no lo utiliza.
Fragmento 2/3 — Por qué el SVG puede desaparecer visualmente
#bg-svg ocupa solo 80% × 80% y tiene opacity: 0.08 (index.html:26-35), por lo que es extremadamente tenue.
Los canvas cubren 90% × 90% y están encima del SVG (index.html:37-58).
GridLayer dibuja formas con relleno y contorno (GridLayer.ts:62-67); si cubren gran parte del viewport, ocultan el SVG.
El canvas es transparente por defecto, pero el contenido dibujado puede tapar completamente el fondo.
Fragmento 3/3 — Causa visual más probable
Las formas Bézier están definidas en coordenadas normalizadas de radio 100 (shapes.ts:26-52).
GridLayer aplica baseScale = 80 (GridLayer.ts:21) y luego escala el contexto (GridLayer.ts:23-26).
El radio visual resultante es aproximadamente 100 × 80 = 8000 px.
Las formas quedan sobredimensionadas, se superponen y pueden cubrir el SVG; además, el resultado no corresponde a la imagen esperada.
Fragmento 4/3 — Inconsistencia de capas
main.ts:48-50 obtiene los tres canvas.
main.ts:56 solo configura dimensiones y DPR de gridCanvas.
line-canvas y sat-canvas nunca reciben contexto ni dibujo propio.
LineLayer y SatelliteLayer terminan dibujándose sobre el mismo grid-canvas (main.ts:268-273).
Fragmento 5/3 — Datos y forma esperada
DataGenerator.ts:147-150 genera contornos parciales por celda.
GridLayer.ts:42-43 ignora frameData.cellContours y dibuja siempre la forma completa desde SHAPE_CATALOG.
Por tanto, el diseño previsto de “un ojo compuesto por segmentos distribuidos en celdas” no se está renderizando.
El tracking usa esos contornos, pero el render no los consume.
Fragmento 6/3 — Verificación sin modificar código
Ocultar temporalmente los canvas en DevTools: el SVG debe aparecer.
Revisar getComputedStyle(bgSvg).opacity, width, height y zIndex.
Inspeccionar el número de elementos en frameData.cells y eyeStates.
Medir el bounding box de una forma dibujada: será mucho mayor que el viewport si se confirma la escala 80.
Revisar si GridLayer.draw() recibe formas válidas o si SHAPE_CATALOG[shapeId] retorna undefined.