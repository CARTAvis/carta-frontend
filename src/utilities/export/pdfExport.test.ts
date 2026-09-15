import {prepareSvgForPdf} from "./pdfExport";

describe("prepareSvgForPdf", () => {
    test("maps annotation fonts to jsPDF font families", () => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        for (const fontFamily of ["Helvetica", "Times", "Courier", "sans-serif"]) {
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("font-family", fontFamily);
            svg.appendChild(text);
        }

        const pdfSvg = prepareSvgForPdf(svg);
        const fontFamilies = [...pdfSvg.querySelectorAll("text")].map(text => text.getAttribute("font-family"));

        expect(fontFamilies).toEqual(["helvetica", "times", "courier", "sans-serif"]);
        expect(svg.querySelector("text")?.getAttribute("font-family")).toBe("Helvetica");
    });
});
