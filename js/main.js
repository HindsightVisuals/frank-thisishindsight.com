import { runLoader } from './loader.js?v=202611252200';
import { initWork } from './work.js?v=202611252200';
import { startRD } from './rd.js?v=202611252200';

const canvas = document.getElementById('rd-canvas');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const noGL = new URLSearchParams(location.search).has('nowebgl');
let rd = null;
if (!reduced && !noGL) {
  try { rd = startRD(canvas); } catch (e) { console.warn('RD disabled:', e); }
}
if (!rd) canvas.classList.add('off');

runLoader();
initWork().catch(e => console.warn('Work sections failed to load:', e));
