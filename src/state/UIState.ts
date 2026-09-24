//--- hex-eyes-engine/src/state/UIState.ts
/**
 * UIState — Estado encapsulado de la UI
 *
 * [FASE] 5 — Orquestación / Estado
 * [REFERENCIA] Evita el anti-patrón de variables globales dispersas
 * [CRITERIO DE ACEPTACIÓN]
 *   - Encapsula selectedCell, hoveredCell, isPanelOpen
 *   - Permite suscripción a cambios (patrón observer)
 */

import type { OffsetCoord } from '@core/types';

export interface UIStateListener {
  onUIChange(state: Readonly<{
    selectedCell: OffsetCoord | null;
    hoveredCell: OffsetCoord | null;
    isPanelOpen: boolean;
  }>): void;
}

export class UIState {
  private _selectedCell: OffsetCoord | null = null;
  private _hoveredCell: OffsetCoord | null = null;
  private _isPanelOpen: boolean = false;
  private readonly listeners: Set<UIStateListener> = new Set();

  /**
   * Celda actualmente seleccionada
   */
  get selectedCell(): OffsetCoord | null {
    return this._selectedCell ? { ...this._selectedCell } : null;
  }

  set selectedCell(value: OffsetCoord | null) {
    const changed = this._selectedCell?.col !== value?.col ||
                    this._selectedCell?.row !== value?.row;
    this._selectedCell = value ? { ...value } : null;

    if (changed) {
      this.notifyListeners();
    }
  }

  /**
   * Celda actualmente bajo el hover
   */
  get hoveredCell(): OffsetCoord | null {
    return this._hoveredCell ? { ...this._hoveredCell } : null;
  }

  set hoveredCell(value: OffsetCoord | null) {
    const changed = this._hoveredCell?.col !== value?.col ||
                    this._hoveredCell?.row !== value?.row;
    this._hoveredCell = value ? { ...value } : null;

    if (changed) {
      this.notifyListeners();
    }
  }

  /**
   * Indica si el panel está abierto
   */
  get isPanelOpen(): boolean {
    return this._isPanelOpen;
  }

  set isPanelOpen(value: boolean) {
    if (this._isPanelOpen !== value) {
      this._isPanelOpen = value;
      this.notifyListeners();
    }
  }

  /**
   * Suscribe un listener a cambios de estado
   */
  subscribe(listener: UIStateListener): () => void {
    this.listeners.add(listener);

    // Retornar función de cleanup
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notifica a todos los listeners
   */
  private notifyListeners(): void {
    const readOnlyState = this.getReadOnlyState();
    for (const listener of this.listeners) {
      try {
        listener.onUIChange(readOnlyState);
      } catch (error) {
        console.error('Error en UIState listener:', error);
      }
    }
  }

  /**
   * Obtiene estado de solo lectura
   */
  getReadOnlyState(): Readonly<{
    selectedCell: OffsetCoord | null;
    hoveredCell: OffsetCoord | null;
    isPanelOpen: boolean;
  }> {
    return {
      selectedCell: this._selectedCell ? { ...this._selectedCell } : null,
      hoveredCell: this._hoveredCell ? { ...this._hoveredCell } : null,
      isPanelOpen: this._isPanelOpen
    };
  }

  /**
   * Reinicia todo el estado UI
   */
  reset(): void {
    this._selectedCell = null;
    this._hoveredCell = null;
    this._isPanelOpen = false;
    this.notifyListeners();
  }

  /**
   * Obtiene estado serializable
   */
  toJSON(): {
    selectedCell: OffsetCoord | null;
    hoveredCell: OffsetCoord | null;
    isPanelOpen: boolean;
  } {
    return {
      selectedCell: this._selectedCell ? { ...this._selectedCell } : null,
      hoveredCell: this._hoveredCell ? { ...this._hoveredCell } : null,
      isPanelOpen: this._isPanelOpen
    };
  }

  /**
   * Restaura estado desde JSON
   */
  fromJSON(data: {
    selectedCell: OffsetCoord | null;
    hoveredCell: OffsetCoord | null;
    isPanelOpen: boolean;
  }): void {
    this._selectedCell = data.selectedCell ? { ...data.selectedCell } : null;
    this._hoveredCell = data.hoveredCell ? { ...data.hoveredCell } : null;
    this._isPanelOpen = data.isPanelOpen ?? false;
    this.notifyListeners();
  }
}
