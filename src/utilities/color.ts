export function isColorValid(colorString: string): boolean {
    const colorHex: RegExp = /^#([A-Fa-f0-9]{3}){1,2}$/;
    return colorHex.test(colorString);
}

// adapted from https://stackoverflow.com/questions/21646738/convert-hex-to-rgba
export function hexStringToRgb(colorString: string) {
    if (!isColorValid(colorString)) {
        return null;
    }

    let c = colorString.substring(1).split("");
    if (c.length === 3) { // shorthand hex color
        c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    const hex = Number("0x" + c.join(""));

    return {
        r: (hex >> 16) & 255,
        g: (hex >> 8) & 255,
        b: hex & 255
    };
}
// end stolen from https://stackoverflow.com/questions/21646738/convert-hex-to-rgba