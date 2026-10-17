import {jsPDF} from "jspdf";
import {svg2pdf} from "svg2pdf.js";

const PDF_FONT_FAMILIES: Record<string, string> = {
    helvetica: "helvetica",
    times: "times",
    courier: "courier",
    "courier new": "courier",
    palatino: "times"
};

export function prepareSvgForPdf(svgElement: SVGSVGElement): SVGSVGElement {
    const pdfSvg = svgElement.cloneNode(true) as SVGSVGElement;
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
