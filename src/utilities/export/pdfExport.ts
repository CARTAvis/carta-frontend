import {jsPDF} from "jspdf";
import {svg2pdf} from "svg2pdf.js";

function prepareSvgForPdf(svgElement: SVGSVGElement): SVGSVGElement {
    const pdfSvg = svgElement.cloneNode(true) as SVGSVGElement;
    const baselineMap: Record<string, string> = {
        "text-before-edge": "text-top",
        "text-after-edge": "bottom",
        central: "central"
    };

    pdfSvg.querySelectorAll<SVGTextElement>("text[dominant-baseline]").forEach(textElement => {
        const dominantBaseline = textElement.getAttribute("dominant-baseline");
        const alignmentBaseline = dominantBaseline ? baselineMap[dominantBaseline] : undefined;
        if (alignmentBaseline) {
            textElement.setAttribute("alignment-baseline", alignmentBaseline);
        }
        textElement.removeAttribute("dominant-baseline");
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
