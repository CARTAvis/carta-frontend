export function isColorValid(colorString: string): boolean {
    const colorHex: RegExp = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return colorHex.test(colorString);
}

// adapted from https://stackoverflow.com/questions/21646738/convert-hex-to-rgba
export function hexStringToRgb(colorString: string) {
    let c;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(colorString)) {
        c = colorString.substring(1).split("");
        if (c.length === 3) {
            c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c = "0x" + c.join("");

        return {
            r: (c >> 16) & 255,
            g: (c >> 8) & 255,
            b: c & 255
        };
    }
    return null;
}

// end stolen from https://stackoverflow.com/questions/21646738/convert-hex-to-rgba