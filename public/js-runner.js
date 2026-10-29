// Runs learner JavaScript off the main thread. Loaded by src/interactive/CodeRunner.jsx.
// Its security policy (worker/headers.js) allows compiling code but blocks requests to this site.
const fmt = (v) => { if (typeof v === 'string') return v; try { return JSON.stringify(v, null, 2) ?? String(v) } catch { return String(v) } };
const send = (kind, args) => postMessage({ kind, text: args.map(fmt).join(' ') });
console.log = console.info = console.debug = (...a) => send('out', a);
console.warn = console.error = (...a) => send('err', a);
console.table = (v) => send('out', [v]);
onmessage = async (e) => {
  try { await new (Object.getPrototypeOf(async function () {}).constructor)(e.data)() }
  catch (err) { send('err', [String(err)]) }
  postMessage({ kind: 'done' })
};
