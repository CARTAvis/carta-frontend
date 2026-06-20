const SVG_NS = "http://www.w3.org/2000/svg";

export function buildSvgDocument(width: number, height: number, backgroundColor: string): SVGSVGElement {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("xmlns", SVG_NS);
    svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    svg.setAttribute("width", `${width}`);
    svg.setAttribute("height", `${height}`);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    if (backgroundColor && backgroundColor !== "rgba(255, 255, 255, 0)") {
        const bgRect = document.createElementNS(SVG_NS, "rect");
        bgRect.setAttribute("width", `${width}`);
        bgRect.setAttribute("height", `${height}`);
        bgRect.setAttribute("fill", backgroundColor);
        svg.appendChild(bgRect);
    }

    return svg;
}

export function svgGroupFromLayer(name: string): SVGGElement {
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("id", name);
    return group;
}

export function embedRasterAsSvgImage(canvas: HTMLCanvasElement, x: number, y: number, width: number, height: number): SVGImageElement {
    const image = document.createElementNS(SVG_NS, "image");
    image.setAttribute("x", `${x}`);
    image.setAttribute("y", `${y}`);
    image.setAttribute("width", `${width}`);
    image.setAttribute("height", `${height}`);
    const dataUrl = canvas.toDataURL("image/png");
    image.setAttribute("href", dataUrl);
    image.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", dataUrl);
    return image;
}

export function downloadSvg(svgElement: SVGSVGElement, filename: string): void {
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgElement);
    const blob = new Blob([svgString], {type: "image/svg+xml;charset=utf-8"});
    const link = document.createElement("a");
    link.download = filename;
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.dispatchEvent(new MouseEvent("click"));
    URL.revokeObjectURL(url);
}

export function createSvgElement(tag: string, attrs: Record<string, string | number>): SVGElement {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) {
        el.setAttribute(key, `${value}`);
    }
    return el;
}

export function createSvgText(text: string, x: number, y: number, attrs: Record<string, string | number> = {}): SVGTextElement {
    const el = document.createElementNS(SVG_NS, "text") as SVGTextElement;
    el.setAttribute("x", `${x}`);
    el.setAttribute("y", `${y}`);
    for (const [key, value] of Object.entries(attrs)) {
        el.setAttribute(key, `${value}`);
    }
    el.textContent = text;
    return el;
}
