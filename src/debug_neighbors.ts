//--- hex-eyes-engine/src/debug_neighbors.ts 
import { HexCoords } from './grid/HexCoords';

const coords = new HexCoords({ hexSize: 50 });
const center = { col: 5, row: 5 };
const neighbors = coords.neighbors(center);

console.log('Centro:', center);
console.log('Vecinos:');
for (const n of neighbors) {
  const dist = coords.hexDistance(center, n);
  console.log(`  (${n.col}, ${n.row}) -> distancia ${dist}`);
}
