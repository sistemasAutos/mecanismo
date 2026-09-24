//+++ eye-ingeniere/src/main.ts
import { DEFAULT_CONFIG } from './core/types';
import { CameraState, UIState } from './state';
import { generateEyeData } from './data/DataGenerator';
import { GridLayer } from './render/layers/GridLayer';
import { LineLayer } from './render/layers/LineLayer';
import { SatelliteLayer } from './render/layers/SatelliteLayer';
import { PupilTracker } from './tracking/PupilTracker';
import { PanController } from './interaction/PanController';
import { InertiaModel } from './interaction/InertiaModel';
import { SnapController, cubicEase } from './interaction/SnapController';
import { HexCoords } from './grid/HexCoords';

interface AppState {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    camera: CameraState;
    ui: UIState;
    gridLayer: GridLayer;
    lineLayer: LineLayer;
    satLayer: SatelliteLayer;
    panController: PanController;
    inertiaModel: InertiaModel | null;
    snapController: SnapController;
    pupilTrackers: Map<string, PupilTracker>;
    frameData: any;
    mousePos: Vec2 | null;
    lastTime: number;
    animationId: number | null;
    fps: number;
    frameCount: number;
    lastFpsUpdate: number;
}

interface Vec2 {
    x: number;
    y: number;
}

class HexEyesApp {
    private state: AppState;

    constructor() {
        console.log('[HexEyes] Bootstrap iniciado');

        try {
            const gridCanvas = document.getElementById('grid-canvas') as HTMLCanvasElement;
            const lineCanvas = document.getElementById('line-canvas') as HTMLCanvasElement;
            const satCanvas = document.getElementById('sat-canvas') as HTMLCanvasElement;

            if (!gridCanvas || !lineCanvas || !satCanvas) {
                throw new Error('Canvas elements not found');
            }

            this.setupCanvas(gridCanvas);

            this.state = {
                canvas: gridCanvas,
                ctx: gridCanvas.getContext('2d')!,
                camera: new CameraState(),
                ui: new UIState(),
                gridLayer: new GridLayer(),
                lineLayer: new LineLayer(),
                satLayer: new SatelliteLayer(),
                panController: new PanController(),
                inertiaModel: null,
                snapController: new SnapController({
                    coords: new HexCoords({ hexSize: DEFAULT_CONFIG.hexSizeBase }),
                    easingFn: cubicEase
                }),
                pupilTrackers: new Map(),
                frameData: { cells: [], eyeStates: new Map(), cursorScreenPos: null, cameraOffset: { x: 0, y: 0 }, cameraZoom: 1 },
                mousePos: null,
                lastTime: performance.now(),
                animationId: null,
                fps: 60,
                frameCount: 0,
                lastFpsUpdate: performance.now()
            };

            this.initializeData();
            this.setupEventListeners();
            this.startAnimationLoop();

            console.log('[HexEyes] Inicialización completada exitosamente');
        } catch (error) {
            console.error('[HexEyes] Error en inicialización:', error);
            throw error;
        }
    }

    private setupCanvas(canvas: HTMLCanvasElement): void {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.scale(dpr, dpr);
        }
    }

    private initializeData(): void {
        const { placements, eyeStates, cellContours } = generateEyeData(91, 42);

        this.state.frameData.cells = placements;
        this.state.frameData.eyeStates = eyeStates;
        this.state.frameData.cellContours = cellContours;

        placements.forEach(placement => {
            const key = `${placement.col},${placement.row}`;
            const initialState = eyeStates.get(key);
            const contour = cellContours.get(key);

            if (initialState && contour && contour.length > 0) {
                this.state.pupilTrackers.set(key, new PupilTracker({
                    contour: contour,
                    smoothing01: DEFAULT_CONFIG.pupilSmoothing
                }));
            }
        });

        const debugInfo = document.getElementById('debug-info');
        if (debugInfo) {
            debugInfo.textContent = `FPS: 60 | Cells: ${placements.length}`;
        }
    }

    private setupEventListeners(): void {
        const { canvas } = this.state;

        canvas.addEventListener('pointerdown', (e: PointerEvent) => {
            const rect = canvas.getBoundingClientRect();
            const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            this.state.panController.onPointerDown(point);
        });

        canvas.addEventListener('pointermove', (e: PointerEvent) => {
            const rect = canvas.getBoundingClientRect();
            const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            this.state.mousePos = point;

            const camOffset = this.state.camera.offset;
            this.state.panController.onPointerMove(point, camOffset);

            this.updatePupilTracking(point);
        });

        canvas.addEventListener('pointerup', () => {
            this.state.panController.onPointerUp();
            const velocity = this.state.panController.getVelocity();
            if (velocity && (Math.abs(velocity.x) > 0.1 || Math.abs(velocity.y) > 0.1)) {
                this.state.inertiaModel = new InertiaModel({ frictionPerSecond: 4.0 });
                this.state.inertiaModel.setInitialVelocity(velocity);
            }
        });

        canvas.addEventListener('wheel', (e: WheelEvent) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const mousePoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };

            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            const newZoom = this.state.camera.zoom * zoomFactor;
            this.state.camera.targetZoom = Math.max(0.1, Math.min(5.0, newZoom));

            this.state.camera.offset = {
                x: mousePoint.x - (mousePoint.x - this.state.camera.offset.x) * (newZoom / this.state.camera.zoom),
                y: mousePoint.y - (mousePoint.y - this.state.camera.offset.y) * (newZoom / this.state.camera.zoom)
            };
        }, { passive: false });

        window.addEventListener('resize', () => {
            this.setupCanvas(canvas);
        });
    }

    private updatePupilTracking(mousePos: Vec2): void {
        const camOffset = this.state.camera.offset;
        const camZoom = this.state.camera.zoom;

        const worldMouseX = (mousePos.x - camOffset.x) / camZoom;
        const worldMouseY = (mousePos.y - camOffset.y) / camZoom;
        const worldMouse = { x: worldMouseX, y: worldMouseY };

        this.state.frameData.cells.forEach((cell: any) => {
            const key = `${cell.col},${cell.row}`;
            const tracker = this.state.pupilTrackers.get(key);
            const eyeState = this.state.frameData.eyeStates.get(key);

            if (tracker && eyeState) {
                tracker.update(worldMouse, 16);
                const pupilPos = tracker.getCurrentPosition();

                const dx = pupilPos.x - cell.center.x;
                const dy = pupilPos.y - cell.center.y;
                eyeState.pupilAngleRad = Math.atan2(dy, dx);
                eyeState.pupilOffset01 = Math.min(1.0, Math.sqrt(dx * dx + dy * dy) / 20);
            }
        });

        this.state.frameData.cursorScreenPos = mousePos;
    }

    private handlePan(deltaX: number, deltaY: number): void {
        this.state.camera.offset = {
            x: this.state.camera.offset.x + deltaX,
            y: this.state.camera.offset.y + deltaY
        };
    }

    private startAnimationLoop(): void {
        const loop = (currentTime: number) => {
            const deltaTime = Math.min(currentTime - this.state.lastTime, 100);
            this.state.lastTime = currentTime;

            this.update(deltaTime);
            this.render();
            this.updateFPS(currentTime);

            this.state.animationId = requestAnimationFrame(loop);
        };

        this.state.animationId = requestAnimationFrame(loop);
    }

    private update(deltaTime: number): void {
        if (this.state.inertiaModel && !this.state.inertiaModel.isSettled) {
            const displacement = this.state.inertiaModel.step(deltaTime);
            this.state.camera.offset = {
                x: this.state.camera.offset.x + displacement.x,
                y: this.state.camera.offset.y + displacement.y
            };

            if (this.state.inertiaModel.isSettled) {
                this.state.inertiaModel = null;
            }
        }

        if (this.state.snapController.isActive) {
            const snappedPos = this.state.snapController.update(deltaTime, 800);
            if (snappedPos) {
                this.state.camera.offset = snappedPos;
            }
        }

        const zoomDiff = Math.abs(this.state.camera.zoom - this.state.camera.targetZoom);
        if (zoomDiff > 0.001) {
            this.state.camera.zoom += (this.state.camera.targetZoom - this.state.camera.zoom) * 0.1;
        }
    }

    private render(): void {
        const { ctx, canvas, frameData, camera } = this.state;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        frameData.cameraOffset = camera.offset;
        frameData.cameraZoom = camera.zoom;

        ctx.save();
        ctx.translate(camera.offset.x, camera.offset.y);
        ctx.scale(camera.zoom, camera.zoom);

        this.state.gridLayer.draw(ctx, frameData);
        this.state.lineLayer.draw(ctx, frameData);

        ctx.restore();

        this.state.satLayer.draw(ctx, frameData);
    }

    private updateFPS(currentTime: number): void {
        this.state.frameCount++;

        if (currentTime - this.state.lastFpsUpdate >= 1000) {
            this.state.fps = this.state.frameCount;
            this.state.frameCount = 0;
            this.state.lastFpsUpdate = currentTime;

            const debugInfo = document.getElementById('debug-info');
            if (debugInfo) {
                debugInfo.textContent = `FPS: ${this.state.fps} | Cells: ${this.state.frameData.cells.length}`;
            }
        }
    }

    public dispose(): void {
        if (this.state.animationId !== null) {
            cancelAnimationFrame(this.state.animationId);
        }
        this.state.panController.reset();
        console.log('[HexEyes] Aplicación disposed');
    }
}

let app: HexEyesApp | null = null;

window.addEventListener('load', () => {
    app = new HexEyesApp();
});

window.addEventListener('beforeunload', () => {
    if (app) {
        app.dispose();
    }
});