import {jsPDF} from "jspdf";
import {svg2pdf} from "svg2pdf.js";

import {createSvgElement, namespaceSvgIds} from "./svgExport";

const PDF_FONT_FAMILIES: Record<string, string> = {
    helvetica: "helvetica",
    times: "times",
    courier: "courier",
    "courier new": "courier",
    palatino: "times"
};

export function prepareSvgForPdf(svgElement: SVGSVGElement): SVGSVGElement {
    const pdfSvg = svgElement.cloneNode(true) as SVGSVGElement;
    // svg2pdf puts <use> targets in Form XObjects with inferred clipping bounds.
    // Those bounds can omit line strokes, unmeasured text, and flipped AST grids.
    // Inline our reusable groups instead, retaining the enclosing tile viewport.
    const sources = new Map([...pdfSvg.querySelectorAll<SVGGElement>("defs > g[id]")].map(source => [source.id, source]));
    pdfSvg.querySelectorAll<SVGUseElement>("use").forEach((use, index) => {
        const href = use.getAttribute("href") ?? use.getAttributeNS("http://www.w3.org/1999/xlink", "href");
        const source = href?.startsWith("#") ? sources.get(href.slice(1)) : undefined;
        if (!source) return;
        const content = source.cloneNode(true) as SVGGElement;
        namespaceSvgIds(content, `pdf-use-${index}`);
        const group = createSvgElement("g", {});
        for (const attribute of Array.from(use.attributes)) {
            if (!["href", "x", "y", "width", "height"].includes(attribute.localName)) group.setAttributeNS(attribute.namespaceURI, attribute.name, attribute.value);
        }
        const translation = `translate(${use.getAttribute("x") ?? 0},${use.getAttribute("y") ?? 0})`;
        group.setAttribute("transform", `${use.getAttribute("transform") ?? ""} ${translation}`.trim());
        group.appendChild(content);
        use.replaceWith(group);
    });
    const referencedIds = new Set(
        [...pdfSvg.querySelectorAll<SVGUseElement>("use")]
            .map(use => use.getAttribute("href") ?? use.getAttributeNS("http://www.w3.org/1999/xlink", "href"))
            .filter((href): href is string => Boolean(href?.startsWith("#")))
            .map(href => href.slice(1))
    );
    sources.forEach(source => {
        if (!referencedIds.has(source.id)) source.remove();
    });
    pdfSvg.querySelectorAll("defs").forEach(definitions => {
        if (!definitions.childNodes.length) definitions.remove();
    });
    const baselineMap: Record<string, string> = {
        "text-before-edge": "text-top",
        "text-after-edge": "bottom",
        central: "central"
    };

    pdfSvg.querySelectorAll<SVGTextElement>("text").forEach(textElement => {
        const dominantBaseline = textElement.getAttribute("dominant-baseline");
        const alignmentBaseline = dominantBaseline ? baselineMap[dominantBaseline] : undefined;
        if (alignmentBaseline) {
            textElement.setAttribute("alignment-baseline", alignmentBaseline);
        }
        textElement.removeAttribute("dominant-baseline");

        const fontFamily = textElement
            .getAttribute("font-family")
            ?.split(",")[0]
            .trim()
            .replace(/^['"]|['"]$/g, "")
            .toLowerCase();
        if (fontFamily && PDF_FONT_FAMILIES[fontFamily]) {
            textElement.setAttribute("font-family", PDF_FONT_FAMILIES[fontFamily]);
        }
    });

    // Canvas grid borders are drawn on half-pixels. Align embedded rasters with
    // those vector borders when svg2pdf maps them into PDF coordinates.
    pdfSvg.querySelectorAll<SVGImageElement>("image").forEach(imageElement => {
        const x = imageElement.getAttribute("x");
        const numericX = Number(x);
        if (x !== null && Number.isFinite(numericX)) {
            imageElement.setAttribute("x", `${numericX + 0.5}`);
        }
    });

    return pdfSvg;
}

/** Converts an SVG document to a vector PDF and downloads it. */
export async function downloadPdf(svgElement: SVGSVGElement, filename: string): Promise<void> {
    const pdfSvg = prepareSvgForPdf(svgElement);
    const svgWidth = Number(pdfSvg.getAttribute("width"));
    const svgHeight = Number(pdfSvg.getAttribute("height"));
    // jsPDF limits page dimensions to 14,400 points. Scale the viewport, retaining
    // the original viewBox and embedded PNG pixels for full-resolution rendering.
    const scale = Math.min(1, 14400 / Math.max(svgWidth, svgHeight));
    const width = svgWidth * scale;
    const height = svgHeight * scale;
    if (!pdfSvg.hasAttribute("viewBox")) pdfSvg.setAttribute("viewBox", `0 0 ${svgWidth} ${svgHeight}`);
    pdfSvg.setAttribute("width", `${width}`);
    pdfSvg.setAttribute("height", `${height}`);
    const pdf = new jsPDF({
        orientation: width > height ? "landscape" : "portrait",
        unit: "pt",
        format: [width, height]
    });

    await svg2pdf(pdfSvg, pdf, {x: 0, y: 0, width, height});
    pdf.save(filename);
}
