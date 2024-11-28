const ctypeSpatial = ["RA", "DEC", "GLON", "GLAT", "OFFSET"];
const ctypeSpectral = ["VRAD", "VOPT", "FREQ", "WAVE", "AWAV", "CHANNEL", "NATIVE", "ENER", "WAVN", "ZOPT", "VELO", "BETA"];
const ctypeTime = ["TIME"];
const ctypeStokes = ["STOKES"];

export const determineCtypeAbbr = (ctype: string): string => {
    const normalizedStr = ctype.toUpperCase();

    for (let i = 0; i < ctypeSpatial.length; i++) {
        if (normalizedStr.includes(ctypeSpatial[i])) {
            return "XY";
        }
    }

    if (ctypeSpectral.includes(normalizedStr)) {
        return "Z";
    }

    if (ctypeTime.includes(normalizedStr)) {
        return "T";
    }

    if (ctypeStokes.includes(normalizedStr)) {
        return "P";
    }

    return ctype;
};
