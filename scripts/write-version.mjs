// Génère version.json (utilisé par la page « À propos ») à partir de package.json et de l'environnement CI.
import { readFileSync, writeFileSync } from "node:fs";
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const commit = (process.env.GITHUB_SHA || "").slice(0, 12);
writeFileSync("version.json", `${JSON.stringify({ version, date: new Date().toISOString(), commit }, null, 2)}\n`);
console.log(`version.json : ${version} ${commit}`);
