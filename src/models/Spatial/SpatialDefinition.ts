// export enum CtypeSpatial{
//     RA = "RA",
//     DEC = "DEC",
//     GLON = "GLON",
//     GLAT = "GLAT",
//     x = "x",
//     y = "y",
//     b = "b",
//     l = "l"
// }

// export const CtypeSpatial = ["RA", "DEC", "GLON", "GLAT", "x", "y", "b", "l"];
const CtypeSpatial = ["RA", "DEC", "GLON", "GLAT"];

export const IsSpatialCtype = (ctype: string): boolean => {
    const normalizedStr = ctype?.toUpperCase();
    for (let i = 0; i < CtypeSpatial.length; i++) {
        if (normalizedStr.includes(CtypeSpatial[i])) {
            return true;
        }
    }
    return false;
};
