import {jsPDF} from "jspdf";
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
    test("inlines channel-map references while preserving viewport clips, transforms, text, and resource references", () => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.innerHTML = `<defs><g id="source"><defs><clipPath id="clip"><rect width="100" height="80"/></clipPath></defs><g transform="scale(1,-1) translate(0,-80)" clip-path="url(#clip)"><line x1="10" x2="70" y1="40" y2="40" stroke="red"/><text x="75" y="70" font-family="Helvetica" dominant-baseline="central">Long annotation</text></g></g></defs>
            <svg x="5" y="7" width="100" height="80" viewBox="0 0 100 80" overflow="hidden"><use href="#source"/></svg>
            <svg x="115" y="7" width="100" height="80" overflow="hidden"><use href="#source" x="2" y="3" transform="rotate(10)" opacity="0.5"/></svg>`;
        const original = svg.outerHTML;
        const pdfSvg = prepareSvgForPdf(svg);
        expect(pdfSvg.querySelector("use")).toBeNull();
        const viewports = pdfSvg.querySelectorAll("svg");
        expect(viewports).toHaveLength(2);
        viewports.forEach(viewport => {
            expect(viewport).toHaveAttribute("overflow", "hidden");
            expect(viewport).toHaveAttribute("width", "100");
            const clip = viewport.querySelector("clipPath")!;
            expect(viewport.querySelector("g[clip-path]")).toHaveAttribute("clip-path", `url(#${clip.id})`);
            expect(viewport.querySelector("g[clip-path]")).toHaveAttribute("transform", "scale(1,-1) translate(0,-80)");
            expect(viewport.querySelector("text")).toHaveAttribute("font-family", "helvetica");
            expect(viewport.querySelector("text")).toHaveAttribute("alignment-baseline", "central");
            expect(viewport.querySelector("text")).toHaveTextContent("Long annotation");
        });
        expect(viewports[1].firstElementChild).toHaveAttribute("transform", "rotate(10) translate(2,3)");
        expect(viewports[1].firstElementChild).toHaveAttribute("opacity", "0.5");
        const ids = [...pdfSvg.querySelectorAll("[id]")].map(element => element.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(svg.outerHTML).toBe(original);
    });

    test.each([false, true])("renders repeated axis-aligned lines without zero-area PDF Form clipping (vertical=%s)", async isVertical => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "220");
        svg.setAttribute("height", "100");
        const coordinates = isVertical ? 'x1="40" x2="40" y1="10" y2="70"' : 'x1="10" x2="70" y1="40" y2="40"';
        svg.innerHTML = `<defs><g id="line"><line ${coordinates} stroke="red" stroke-width="2"/></g></defs><svg width="100" height="100" overflow="hidden"><use href="#line"/></svg><svg x="110" width="100" height="100" overflow="hidden"><use href="#line"/></svg>`;
        const secondUse = svg.querySelectorAll("use")[1];
        secondUse.removeAttribute("href");
        secondUse.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "#line");
        const pdf = new jsPDF({unit: "pt", format: [220, 100], orientation: "landscape"});
        const lineTo = jest.spyOn(pdf, "lineTo");
        const actualSvg2pdf = jest.requireActual<{svg2pdf: typeof svg2pdf}>("svg2pdf.js").svg2pdf;
        await actualSvg2pdf(prepareSvgForPdf(svg), pdf, {width: 220, height: 100});
        expect(lineTo).toHaveBeenCalledTimes(2);
        expect(pdf.output()).not.toContain("/Subtype /Form");
    });

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
