// Copie la police Poppins (SIL OFL 1.1) depuis @fontsource vers assets/fonts (auto-hébergement, sans appel à Google).
import { copyFileSync, mkdirSync } from "node:fs";
const src = "node_modules/@fontsource/poppins";
mkdirSync("assets/fonts", { recursive: true });
for (const weight of [400, 500, 600, 700])
    copyFileSync(`${src}/files/poppins-latin-${weight}-normal.woff2`, `assets/fonts/poppins-latin-${weight}-normal.woff2`);
copyFileSync(`${src}/LICENSE`, "assets/fonts/OFL-LICENSE.txt");
console.log("Polices copiées dans assets/fonts");
