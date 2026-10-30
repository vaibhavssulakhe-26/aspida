// Shared signal constructor. A signal is plain data:
//   { id, category, weight, evidence, detail }
// evidence = the exact text / URL fragment that triggered it (UI cites it).
import { WEIGHTS } from '../scoring/weights.js';

export function signal(id, category, evidence, detail) {
  if (!(id in WEIGHTS)) throw new Error(`Unknown signal id: ${id}`);
  return { id, category, weight: WEIGHTS[id], evidence: String(evidence), detail };
}
