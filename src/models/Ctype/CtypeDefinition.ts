import {CARTA} from "carta-protobuf";

const ctypeSpatial = ["RA", "DEC", "GLON", "GLAT", "OFFSET"];
const ctypeSpectral = ["VRAD", "VOPT", "FREQ", "WAVE", "AWAV", "CHANNEL", "NATIVE", "ENER", "WAVN", "ZOPT", "VELO", "BETA"];
const ctypeTime = ["TIME"];
const ctypeStokes = ["STOKES"];
const ctypeRM = ["RM"]; // Rotation Measure

export const DetermineCtypeAbbr = (ctype: string): {abbr: string; rank: number} => {
    const normalizedStr = ctype.toUpperCase();

    for (let i = 0; i < ctypeSpatial.length; i++) {
        if (normalizedStr.includes(ctypeSpatial[i])) {
            return {abbr: "XY", rank: 0};
        }
    }

    if (ctypeSpectral.includes(normalizedStr)) {
        return {abbr: "Z", rank: 1};
    }

    if (ctypeStokes.includes(normalizedStr)) {
        return {abbr: "P", rank: 2};
    }

    if (ctypeTime.includes(normalizedStr)) {
        return {abbr: "T", rank: 3};
    }

    if (ctypeRM.includes(normalizedStr)) {
        return {abbr: "RM", rank: 4};
    }

    return {abbr: normalizedStr, rank: 5};
};

export const CtypeName = new Map<string, string>([
    ["XY", "Spatial"],
    ["Z", "Spectral"],
    ["P", "Stokes"],
    ["T", "Time"],
    ["RM", "Rotation Measure"]
]);

export function CtypeAbbrToName(ctypes: string): string {
    let ctypeName: string[] = [];

    ctypes.split(",").forEach(ctype => {
        ctypeName.push(CtypeName.has(ctype) ? (CtypeName.get(ctype) as string) : ctype);
    });

    return ctypeName.join(", ");
}

export function FileCtypeInfo(headerEntries: CARTA.IFileInfoExtended | CARTA.IHeaderEntry[] | null): {ctype: string; name: string; rank: number} {
    if (headerEntries === null) {
        return {ctype: "", name: "", rank: 0};
    }

    let tempCtypes = {};
    let tempNaxes = {};
    let ctypes: any[] = [];

    (headerEntries as any[]).forEach(header => {
        if (header.name?.substring(0, 5) === "CTYPE") {
            const value = DetermineCtypeAbbr(`${header.value}`);
            tempCtypes[header.name] = value;
        }

        if (header.name?.substring(0, 5) === "NAXIS") {
            tempNaxes[header.name] = `${header.value}`;
        }
    });

    // deal with that CTYPE and NAXIS have different dimensions
    const extraNaxis = Object.keys(tempNaxes).includes("NAXIS") ? 1 : 0; // for 'NAXIS' itself
    const minLen = Math.min(Object.keys(tempNaxes).length - extraNaxis, Object.keys(tempCtypes).length);

    for (let j = 1; j <= minLen; j++) {
        // skip axes with size = 1
        if (tempNaxes[`NAXIS${j}`] !== "1") {
            ctypes.push(tempCtypes[`CTYPE${j}`]);
        }
    }

    // if all axes have size = 1, use the last dimension ctype
    if (ctypes.length === 0) {
        tempCtypes[`CTYPE${minLen}`].abbr = "SinglePixel"+tempCtypes[`CTYPE${minLen}`].abbr;
        ctypes.push(tempCtypes[`CTYPE${minLen}`]);
    }

    // sort CTYPE
    const first2D = ctypes.splice(0, 2);
    first2D.sort((a, b) => a.rank - b.rank);
    ctypes.sort((a, b) => a.rank - b.rank);

    const sortedCtype = ctypes.length > 0 ? [first2D.map(item => item.abbr), ctypes.map(item => item.abbr)] : [first2D.map(item => item.abbr)];
    const sortedCtypeName = ctypes.length > 0 ? [first2D.map(item => item.name), ctypes.map(item => item.name)] : [first2D.map(item => item.name)];

    const ctype = sortedCtype.join(",");
    const ctypeName = sortedCtypeName.join(", ");
    const ctypeRank = ctypes.length > 0 ? ctypes[ctypes.length - 1].rank : first2D[first2D.length - 1].rank;

    return {ctype: ctype, name: ctypeName, rank: ctypeRank};
}
