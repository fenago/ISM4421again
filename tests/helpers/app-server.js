// Tiny static server for public/ that also serves /api/feed/:name via the real Function handler.
// Applies the CSP and other security headers parsed from netlify.toml so tests catch violations.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./fixtures.js";
import feed from "../../netlify/functions/feed.js";

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json" };

/** Security headers for "/*" from netlify.toml (first [[headers]] block). */
export function securityHeaders() {
  const toml = readFileSync(path.join(ROOT, "netlify.toml"), "utf8");
  const block = toml.split("[[headers]]").find(b => /for\s*=\s*"\/\*"/.test(b));
  const out = {};
  for (const m of block.matchAll(/^\s*([A-Za-z-]+)\s*=\s*"(.*)"\s*$/gm)) if (m[1] !== "for") out[m[1]] = m[2];
  return out;
}

export async function startAppServer() {
  const sec = securityHeaders();
  const requests = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    requests.push(`${req.method} ${url.pathname}${url.search}`);
    try {
      const fm = url.pathname.match(/^\/api\/feed\/([^/]+)$/);
      if (fm) {
        const r = await feed(new Request(`http://localhost${req.url}`, { method: req.method }), { params: { name: decodeURIComponent(fm[1]) } });
        res.writeHead(r.status, { ...sec, ...Object.fromEntries(r.headers) });
        return res.end(Buffer.from(await r.arrayBuffer()));
      }
      const rel = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
      const file = path.resolve(ROOT, "public", rel);
      if (!file.startsWith(path.join(ROOT, "public") + path.sep)) { res.writeHead(403); return res.end(); }
      const body = await readFile(file);
      res.writeHead(200, { ...sec, "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404, { ...sec, "content-type": "text/plain" }); res.end("not found");
    }
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  return { base: `http://127.0.0.1:${port}`, requests, csp: sec["Content-Security-Policy"], close: () => new Promise(r => { server.closeAllConnections?.(); server.close(r); }) };
}
