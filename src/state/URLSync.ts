//--- hex-eyes-engine/src/state/URLSync.ts 
/**
 * URLSync — Sincronización de estado con URL (query params)
 *
 * [FASE] 5 — Orquestación / Estado
 * [REFERENCIA] Esquema de query param propio (ej. ?cell=col-row)
 * [CRITERIO DE ACEPTACIÓN]
 *   - Serializa estado a query params
 *   - Hidrata estado desde location.search
 *   - No reutiliza formato original
 */

import type { OffsetCoord } from '@core/types';

export interface URLSyncConfig {
  paramName?: string;
  useHash?: boolean;
}

export interface IURLSync {
  /**
   * [MÉTODO] [SERIALIZACIÓN]
   * Serializa una coordenada a string de URL
   */
  serialize(coord: OffsetCoord | null): string;

  /**
   * [MÉTODO] [SERIALIZACIÓN] [IMPORT]
   * Hidrata estado desde location.search
   */
  hydrateFromLocation(): OffsetCoord | null;
}

export class URLSync implements IURLSync {
  private readonly paramName: string;
  private readonly useHash: boolean;

  constructor(config: URLSyncConfig = {}) {
    this.paramName = config.paramName ?? 'cell';
    this.useHash = config.useHash ?? false;
  }

  /**
   * Serializa una coordenada offset a string para URL
   * Formato propio: "col-row" (ej. "3--2" para col=3, row=-2)
   *
   * @param coord - Coordenada a serializar
   * @returns String para URL o vacío si null
   */
  serialize(coord: OffsetCoord | null): string {
    if (!coord) return '';

    // Formato: col-row (los negativos se mantienen con signo)
    return `${coord.col}-${coord.row}`;
  }

  /**
   * Deserializa un string de URL a coordenada offset
   *
   * @param str - String de URL (ej. "3--2")
   * @returns Coordenada o null si inválido
   */
  deserialize(str: string): OffsetCoord | null {
    if (!str || typeof str !== 'string') return null;

    // Buscar el último guión que separa col de row
    // Esto maneja casos como "3--2" (col=3, row=-2)
    const lastDashIndex = str.lastIndexOf('-');

    if (lastDashIndex <= 0) return null;

    const colStr = str.substring(0, lastDashIndex);
    const rowStr = str.substring(lastDashIndex + 1);

    const col = parseInt(colStr, 10);
    const row = parseInt(rowStr, 10);

    if (isNaN(col) || isNaN(row)) return null;

    return { col, row };
  }

  /**
   * Obtiene el valor del parámetro desde la URL actual
   *
   * @returns Valor del parámetro o null si no existe
   */
  private getParamValue(): string | null {
    if (this.useHash && typeof window !== 'undefined') {
      // Usar hash (#cell=3--2)
      const hash = window.location.hash.slice(1);
      if (hash.startsWith(`${this.paramName}=`)) {
        return hash.substring(this.paramName.length + 1);
      }
      return null;
    } else {
      // Usar query params (?cell=3--2)
      if (typeof window === 'undefined') return null;

      const params = new URLSearchParams(window.location.search);
      return params.get(this.paramName);
    }
  }

  /**
   * Establece el valor del parámetro en la URL actual
   *
   * @param value - Valor a establecer
   */
  private setParamValue(value: string | null): void {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);

    if (value) {
      if (this.useHash) {
        url.hash = `${this.paramName}=${value}`;
      } else {
        url.searchParams.set(this.paramName, value);
      }
    } else {
      if (this.useHash) {
        url.hash = '';
      } else {
        url.searchParams.delete(this.paramName);
      }
    }

    // Actualizar URL sin recargar (usando replaceState para no añadir al historial)
    window.history.replaceState({}, '', url.toString());
  }

  /**
   * Hidrata estado desde la URL actual
   *
   * @returns Coordenada deserializada o null
   */
  hydrateFromLocation(): OffsetCoord | null {
    const value = this.getParamValue();
    return this.deserialize(value || '');
  }

  /**
   * Actualiza la URL con una coordenada
   *
   * @param coord - Coordenada a sincronizar
   */
  syncToLocation(coord: OffsetCoord | null): void {
    const value = this.serialize(coord);
    this.setParamValue(value || null);
  }

  /**
   * Escucha cambios en la URL (popstate/hashchange)
   *
   * @param callback - Función a llamar cuando cambia la URL
   * @returns Función de cleanup
   */
  listenToChanges(callback: (coord: OffsetCoord | null) => void): () => void {
    const handleChange = () => {
      const coord = this.hydrateFromLocation();
      callback(coord);
    };

    const eventName = this.useHash ? 'hashchange' : 'popstate';
    window.addEventListener(eventName, handleChange);

    return () => {
      window.removeEventListener(eventName, handleChange);
    };
  }
}
