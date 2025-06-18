import {CARTA} from "carta-protobuf";

const ctypeSpatial = ["RA", "DEC", "GLON", "GLAT", "ELON", "ELAT", "OFFSET", "DISTANCE"];
const ctypeSpectral = ["VRAD", "VOPT", "FREQ", "WAVE", "AWAV", "CHANNEL", "NATIVE", "ENER", "WAVN", "ZOPT", "VELO", "BETA"];
const ctypeTime = ["TIME", "EPOCH"];
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

export function FileCtypeInfo(headerEntries: CARTA.IFileInfoExtended | CARTA.IHeaderEntry[] | null): {ctype: string; rank: number} {
    if (headerEntries === null) {
        console.debug("no header");
        return {ctype: "", rank: 0};
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

    // error handling for the files with minimal headers
    if (Object.keys(tempCtypes).length === 0 || Object.keys(tempNaxes).length === 0) {
        console.debug("no CTYPE or NAXIS keys in the header");
        return {ctype: "", rank: 0};
    }

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
        tempCtypes[`CTYPE${minLen}`].abbr = "SinglePixel" + tempCtypes[`CTYPE${minLen}`].abbr;
        ctypes.push(tempCtypes[`CTYPE${minLen}`]);

        return {ctype: ctypes[0].abbr, rank: ctypes[0].rank};
    }

    // sort CTYPE
    const stokesIndex = ctypes.findIndex(item => item.abbr === "P"); // extract STOCKS since we don't use it in XY
    if (stokesIndex !== -1) {
        ctypes.splice(stokesIndex, 1);
    }
    const showedXY = ctypes.splice(0, 2); // if showed XY is not first two dimensions, modify here
    showedXY.sort((a, b) => a.rank - b.rank);
    if (stokesIndex !== -1) {
        ctypes = [...ctypes, {abbr: "P", rank: 2}]; // add STOKES back
    }
    ctypes.sort((a, b) => a.rank - b.rank);

    const sortedCtype = ctypes.length > 0 ? [showedXY.map(item => item.abbr), ctypes.map(item => item.abbr)] : [showedXY.map(item => item.abbr)];
    const ctypeString = sortedCtype.join(",");
    const ctypeRank = ctypes.length > 0 ? ctypes[ctypes.length - 1].rank : showedXY[showedXY.length - 1].rank;

    return {ctype: ctypeString, rank: ctypeRank};
}

export function HyperCubeCtypeTransform(ctypes: {ctype: string[]; rank: number[]}): {ctype: string[]; rank: number[]} {
    const ctypeString = ctypes.ctype.map(ctype => {
        return ctype + ",P";
    });
    const ctypeRank = ctypes.rank.map(rank => {
        return Math.max(rank, 2);
    });

    return {ctype: ctypeString, rank: ctypeRank};
}
