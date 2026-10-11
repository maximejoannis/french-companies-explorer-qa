// Prépare le dossier _site publié sur GitHub Pages : uniquement les fichiers d'exécution (ni tests, ni node_modules).
import { cpSync, mkdirSync, rmSync } from "node:fs";
const OUT = "_site";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const path of ["index.html", "styles.css", "sw.js", "manifest.webmanifest", "version.json", "CHANGELOG.md", "LICENSE", "PRIVACY.md", "src", "assets"]) {
    cpSync(path, `${OUT}/${path}`, { recursive: true });
}
console.log(`Site prêt dans ${OUT}/`);
