// @ts-check
/**
 * Déclenche le téléchargement d'un fichier généré côté client.
 * @param {{ document: Document, URL: { createObjectURL(b: Blob): string, revokeObjectURL(u: string): void }, Blob: typeof Blob }} env
 * @param {string} name
 * @param {string} mime
 * @param {string} content
 */
export function downloadFile(env, name, mime, content) {
    const blob = new env.Blob([content], { type: mime });
    const url = env.URL.createObjectURL(blob);
    const a = env.document.createElement("a");
    a.href = url;
    a.download = name;
    a.rel = "noopener";
    env.document.body.appendChild(a);
    a.click();
    a.remove();
    env.URL.revokeObjectURL(url);
}
