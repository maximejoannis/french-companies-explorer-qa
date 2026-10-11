// @ts-check
/**
 * Graphique en barres horizontales SVG accessible, accompagné de son tableau de données.
 * @param {import("./dom.js").Dom} dom
 * @param {{ id: string, title: string, buckets: import("../core/aggregate.js").Bucket[], valueLabel: string, tableLabel: string }} spec
 */
export function barChart(dom, spec) {
    const { h, svg } = dom;
    const max = Math.max(1, ...spec.buckets.map(b => b.count));
    const rowHeight = 28;
    const labelWidth = 180;
    const chartWidth = 320;
    const height = Math.max(rowHeight, spec.buckets.length * rowHeight);
    const titleId = `chart-${spec.id}-title`;
    const descId = `chart-${spec.id}-desc`;
    const total = spec.buckets.reduce((n, b) => n + b.count, 0);
    const graphic = svg(
        "svg",
        {
            viewBox: `0 0 ${labelWidth + chartWidth + 50} ${height}`,
            role: "img",
            "aria-labelledby": `${titleId} ${descId}`,
            class: "bar-chart",
            "data-testid": `analytics-chart-${spec.id}`
        },
        svg("title", { id: titleId }, spec.title),
        svg("desc", { id: descId }, spec.buckets.map(b => `${b.label} : ${b.count}`).join(", ")),
        ...spec.buckets.map((b, i) => {
            const y = i * rowHeight;
            const w = Math.max(2, Math.round((b.count / max) * chartWidth));
            return svg(
                "g",
                { "aria-hidden": "true" },
                svg(
                    "text",
                    { x: labelWidth - 8, y: y + 18, "text-anchor": "end", class: "bar-label" },
                    b.label.length > 26 ? `${b.label.slice(0, 25)}…` : b.label
                ),
                svg("rect", { x: labelWidth, y: y + 5, width: w, height: rowHeight - 10, rx: 4, class: "bar-rect" }),
                svg("text", { x: labelWidth + w + 6, y: y + 18, class: "bar-value" }, String(b.count))
            );
        })
    );
    const table = h(
        "details",
        { class: "chart-table" },
        h("summary", {}, spec.tableLabel),
        h(
            "table",
            { "data-testid": `analytics-table-${spec.id}` },
            h("caption", { class: "sr-only" }, spec.title),
            h("thead", {}, h("tr", {}, h("th", { scope: "col" }, spec.title), h("th", { scope: "col" }, spec.valueLabel))),
            h("tbody", {}, ...spec.buckets.map(b => h("tr", {}, h("th", { scope: "row" }, b.label), h("td", {}, String(b.count))))),
            h("tfoot", {}, h("tr", {}, h("th", { scope: "row" }, "Total"), h("td", {}, String(total))))
        )
    );
    return h("figure", { class: "chart panel" }, h("figcaption", { class: "chart-title" }, spec.title), graphic, table);
}

/**
 * Mini histogramme vertical (CA et résultat net par exercice).
 * @param {import("./dom.js").Dom} dom
 * @param {{ title: string, points: { label: string, value: number|null }[], format: (v: number) => string }} spec
 */
export function columnChart(dom, spec) {
    const { svg } = dom;
    const values = spec.points.map(p => p.value ?? 0);
    const maxAbs = Math.max(1, ...values.map(v => Math.abs(v)));
    const hasNegative = values.some(v => v < 0);
    const width = 60 * spec.points.length + 20;
    const height = 140;
    const baseline = hasNegative ? height / 2 : height - 20;
    const scale = (hasNegative ? height / 2 - 20 : height - 40) / maxAbs;
    return svg(
        "svg",
        { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": spec.title, class: "column-chart", "data-testid": "detail-finances-chart" },
        svg("title", {}, spec.title),
        svg("line", { x1: 0, x2: width, y1: baseline, y2: baseline, class: "axis" }),
        ...spec.points.map((p, i) => {
            const v = p.value ?? 0;
            const hgt = Math.max(1, Math.abs(v) * scale);
            const x = 20 + i * 60;
            return svg(
                "g",
                {},
                svg("rect", { x, y: v >= 0 ? baseline - hgt : baseline, width: 36, height: hgt, rx: 3, class: v >= 0 ? "col-positive" : "col-negative" }),
                svg("text", { x: x + 18, y: height - 4, "text-anchor": "middle", class: "bar-label" }, p.label)
            );
        })
    );
}
