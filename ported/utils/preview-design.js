const HOME = `<!doctype html><html><head><style>
body{margin:0;font:16px system-ui,sans-serif;color:#1d1d1f}
header{display:flex;justify-content:space-between;padding:20px 40px;border-bottom:1px solid #eee}
main{padding:80px 40px}h1{font-size:44px;margin:0 0 16px}
.cta{display:inline-block;padding:12px 20px;border-radius:8px;background:#1d1d1f;color:#fff}
</style></head><body><header><strong>Orbit</strong><nav>Pricing \xB7 Docs</nav></header>
<main><h1 id="hero-title">Ship calmer releases</h1><p>Orbit watches every deploy for you.</p><a class="cta">Start free</a></main></body></html>`;
const PHONE = `<!doctype html><html><head><meta name="artboard-width" content="390"><style>
body{margin:0;font:15px system-ui,sans-serif}section{padding:24px}h2{margin:0 0 8px}li{padding:10px 0;border-bottom:1px solid #eee}
</style></head><body><section><h2>Deploys</h2><ul><li>api \xB7 2 min ago</li><li>web \xB7 1 h ago</li></ul></section></body></html>`;
function createPreviewDesign() {
  const files = /* @__PURE__ */ new Map([["home.html", { html: HOME, modified: 1 }], ["phone.html", { html: PHONE, modified: 1 }]]);
  let comments = [{ id: "sample-1", artboard: "home.html", selector: "body > main > a", bbox: { x: 40, y: 230, width: 108, height: 44 }, text: "Use the accent color here.", status: "open", createdAt: Date.now() - 6e4 }];
  let clock = 1;
  const list = () => [...files].sort(([a], [b]) => a.localeCompare(b)).map(([name, f]) => ({ name, path: `.pandacode/design/${name}`, size: f.html.length, modified: f.modified }));
  return {
    list,
    read(name) {
      const file = files.get(name);
      if (!file) throw new Error(`No artboard named ${name}.`);
      return file.html;
    },
    comments: () => structuredClone(comments),
    saveComments(next) {
      comments = structuredClone(next);
      return null;
    },
    /** What pandacode_design_write does; preview callers emit `design-changed` after. */
    write(name, html) {
      files.set(name, { html, modified: ++clock });
      return list().find((a) => a.name === name);
    },
    resolve(id, note) {
      comments = comments.map((c) => c.id === id ? { ...c, status: "resolved", note } : c);
    }
  };
}
export {
  createPreviewDesign
};
