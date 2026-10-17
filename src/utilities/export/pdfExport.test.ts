import {svg2pdf} from "svg2pdf.js";

import {downloadPdf, prepareSvgForPdf} from "./pdfExport";

jest.mock("svg2pdf.js", () => ({svg2pdf: jest.fn()}));

test.each([
    [16000, 8000],
    [8000, 16000],
    [16000, 16000],
    [2000, 1000]
])("fits a %s by %s SVG into the PDF page without changing raster resolution", async (width, height) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.innerHTML = `<image x="0" y="0" width="${width}" height="${height}" href="data:image/png;base64,pixels"/>`;
    const scale = Math.min(1, 14400 / Math.max(width, height));
    const save = jest.fn();
    jest.mocked(svg2pdf).mockImplementation(async (element, pdf, options) => {
        expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(width * scale);
        expect(pdf.internal.pageSize.getHeight()).toBeCloseTo(height * scale);
        expect(options).toMatchObject({width: width * scale, height: height * scale});
        expect(element).toHaveAttribute("width", String(width * scale));
        expect(element).toHaveAttribute("height", String(height * scale));
        expect(element).toHaveAttribute("viewBox", `0 0 ${width} ${height}`);
        expect(element.querySelector("image")).toHaveAttribute("width", String(width));
        expect(element.querySelector("image")).toHaveAttribute("height", String(height));
        expect(element.querySelector("image")).toHaveAttribute("href", "data:image/png;base64,pixels");
        pdf.save = save;
        return pdf;
    });
    await downloadPdf(svg, "image.pdf");
    expect(save).toHaveBeenCalledWith("image.pdf");
    expect(svg).toHaveAttribute("width", String(width));
    expect(svg).toHaveAttribute("height", String(height));
});

describe("prepareSvgForPdf", () => {
    test("maps annotation fonts to jsPDF font families", () => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        for (const fontFamily of ["Helvetica", "Times", "Courier", "sans-serif", "courier new", "palatino", "'Courier New', monospace"]) {
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("font-family", fontFamily);
            svg.appendChild(text);
        }

        const pdfSvg = prepareSvgForPdf(svg);
        const fontFamilies = [...pdfSvg.querySelectorAll("text")].map(text => text.getAttribute("font-family"));

        expect(fontFamilies).toEqual(["helvetica", "times", "courier", "sans-serif", "courier", "times", "courier"]);
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
