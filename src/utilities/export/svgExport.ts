const SVG_NS = "http://www.w3.org/2000/svg";

/** Scope layer and resource IDs to a panel, including references to SVG definitions. */
export function namespaceSvgIds(root: SVGElement, prefix: string): void {
    const elements = [root, ...root.querySelectorAll<SVGElement>("*")];
    const replacements = new Map<string, string>();
    let index = 0;
    for (const element of elements) {
        if (!element.id) continue;
        const oldId = element.id;
        element.id = `${prefix}-${oldId}-${index++}`;
        if (!replacements.has(oldId)) replacements.set(oldId, element.id);
    }
    for (const element of elements) {
        for (const attribute of [...element.attributes]) {
            let value = attribute.value.replace(/url\((['"]?)#([^)'"\s]+)\1\)/g, (match, quote, id) => (replacements.has(id) ? `url(${quote}#${replacements.get(id)}${quote})` : match));
            if (attribute.localName === "href" && value.startsWith("#")) value = `#${replacements.get(value.slice(1)) ?? value.slice(1)}`;
            if (value !== attribute.value) element.setAttributeNS(attribute.namespaceURI, attribute.name, value);
        }
    }
}

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
