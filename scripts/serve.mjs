// Serveur statique minimal pour le développement local (aucune dépendance).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".woff2": "font/woff2",
    ".md": "text/markdown; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    "": "text/plain; charset=utf-8"
};

createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    if (path.endsWith("/")) path += "index.html";
    const file = join(root, path);
    if (!file.startsWith(root) || /[/\\](node_modules|\.git)[/\\]/.test(file)) {
        res.writeHead(403).end("Forbidden");
        return;
    }
    try {
        const body = await readFile(file);
        res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
        res.end(body);
    } catch {
        res.writeHead(404).end("Not found");
    }
}).listen(port, () => console.log(`French Companies Explorer : http://localhost:${port}/`));
