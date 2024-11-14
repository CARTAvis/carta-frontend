// export const CtypeSpatial = ["RA", "DEC", "GLON", "GLAT", "x", "y", "b", "l"];
const CtypeSpatial = ["RA", "DEC", "GLON", "GLAT", "OFFSET"];

export const IsSpatialCtype = (ctype: string): boolean => {
    const normalizedStr = ctype?.toUpperCase();
    for (let i = 0; i < CtypeSpatial.length; i++) {
        if (normalizedStr.includes(CtypeSpatial[i])) {
            return true;
        }
    }
    return false;
};
