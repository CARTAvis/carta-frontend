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

    test("aligns raster images with half-pixel coordinate borders", () => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
        image.setAttribute("x", "42");
        svg.appendChild(image);

        const pdfSvg = prepareSvgForPdf(svg);

        expect(pdfSvg.querySelector("image")).toHaveAttribute("x", "42.5");
        expect(image).toHaveAttribute("x", "42");
    });
});
