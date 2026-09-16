import {jsPDF} from "jspdf";
import {svg2pdf} from "svg2pdf.js";

const PDF_FONT_FAMILIES: Record<string, string> = {
    Helvetica: "helvetica",
    Times: "times",
    Courier: "courier"
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

        const fontFamily = textElement.getAttribute("font-family");
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
    const width = Number(pdfSvg.getAttribute("width"));
    const height = Number(pdfSvg.getAttribute("height"));
    const pdf = new jsPDF({
        orientation: width > height ? "landscape" : "portrait",
        unit: "pt",
        format: [width, height]
    });

    await svg2pdf(pdfSvg, pdf, {x: 0, y: 0, width, height});
    pdf.save(filename);
}
