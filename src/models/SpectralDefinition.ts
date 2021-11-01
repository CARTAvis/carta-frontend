export interface SpectralTypeSet {
    code: string;
    unit: string;
    name: string;
}

// From FITS standard (Table 25 of V4.0 of "Definition of the Flexible Image Transport System")
export const STANDARD_SPECTRAL_TYPE_SETS: SpectralTypeSet[] = [
    {code: "FREQ", name: "Frequency", unit: "Hz"},
    {code: "ENER", name: "Energy", unit: "J"},
    {code: "WAVN", name: "Wavenumber", unit: "1/m"},
    {code: "VRAD", name: "Radio velocity", unit: "m/s"},
    {code: "WAVE", name: "Vacuum wavelength", unit: "m"},
    {code: "VOPT", name: "Optical velocity", unit: "m/s"},
    {code: "ZOPT", name: "Redshift", unit: ""},
    {code: "AWAV", name: "Air wavelength", unit: "m"},
    {code: "VELO", name: "Apparent radial velocity", unit: "m/s"},
    {code: "BETA", name: "Beta", unit: ""}
];

// FREQ, ENER, WAVN
export enum SpectralColorMap {
    FREQ = "FREQ",
    ENER = "ENER",
    WAVE = "WAVE"
}

export enum SpectralType {
    VRAD = "VRAD",
    VOPT = "VOPT",
    FREQ = "FREQ",
    WAVE = "WAVE",
    AWAV = "AWAV",
    CHANNEL = "CHANNEL"
}

// Channel is not a valid standalone spectral type
export const IsSpectralTypeSupported = (typeStr: string): boolean => {
    const normalizedStr = typeStr?.toUpperCase();
    return Object.values(SpectralType).includes(normalizedStr as SpectralType) && normalizedStr !== SpectralType.CHANNEL;
};

export const SPECTRAL_MATCHING_TYPES: SpectralType[] = [SpectralType.VRAD, SpectralType.VOPT, SpectralType.FREQ, SpectralType.CHANNEL];
export function IsSpectralMatchingTypeValid(type: SpectralType) {
    return type && SPECTRAL_MATCHING_TYPES.includes(type);
}

export enum SpectralUnit {
    KMS = "km/s",
    MS = "m/s",
    GHZ = "GHz",
    MHZ = "MHz",
    KHZ = "kHz",
    HZ = "Hz",
    M = "m",
    MM = "mm",
    UM = "um",
    NM = "nm",
    ANGSTROM = "Angstrom"
}

export enum FrequencyUnit {
    GHZ = "GHz",
    MHZ = "MHz",
    KHZ = "kHz",
    HZ = "Hz"
}

export const IsSpectralUnitSupported = (unit: string): boolean => {
    return unit && Object.values(SpectralUnit).includes(unit as SpectralUnit);
};

export enum SpectralSystem {
    LSRK = "LSRK",
    LSRD = "LSRD",
    BARY = "BARYCENT",
    TOPO = "TOPOCENT"
}

export const IsSpectralSystemSupported = (systemStr: string): boolean => {
    const normalizedStr = systemStr?.toUpperCase();
    return Object.values(SpectralSystem).includes(normalizedStr as SpectralSystem);
};

export const SPECTRAL_TYPE_STRING = new Map<SpectralType, string>([
    [SpectralType.VRAD, "Radio velocity"],
    [SpectralType.VOPT, "Optical velocity"],
    [SpectralType.FREQ, "Frequency"],
    [SpectralType.WAVE, "Vacuum wavelength"],
    [SpectralType.AWAV, "Air wavelength"],
    [SpectralType.CHANNEL, "Channel"]
]);

export const SPECTRAL_DEFAULT_UNIT = new Map<SpectralType, SpectralUnit>([
    [SpectralType.VRAD, SpectralUnit.KMS],
    [SpectralType.VOPT, SpectralUnit.KMS],
    [SpectralType.FREQ, SpectralUnit.GHZ],
    [SpectralType.WAVE, SpectralUnit.MM],
    [SpectralType.AWAV, SpectralUnit.MM]
]);

export const GenCoordinateLabel = (type: SpectralType, unit: SpectralUnit): string => {
    return `${type ? SPECTRAL_TYPE_STRING.get(type) : ""}${unit ? " (" + unit + ")" : ""}`;
};

export const SPECTRAL_COORDS_SUPPORTED = new Map<string, {type: SpectralType; unit: SpectralUnit}>([
    [GenCoordinateLabel(SpectralType.VRAD, SpectralUnit.KMS), {type: SpectralType.VRAD, unit: SpectralUnit.KMS}],
    [GenCoordinateLabel(SpectralType.VRAD, SpectralUnit.MS), {type: SpectralType.VRAD, unit: SpectralUnit.MS}],
    [GenCoordinateLabel(SpectralType.VOPT, SpectralUnit.KMS), {type: SpectralType.VOPT, unit: SpectralUnit.KMS}],
    [GenCoordinateLabel(SpectralType.VOPT, SpectralUnit.MS), {type: SpectralType.VOPT, unit: SpectralUnit.MS}],
    [GenCoordinateLabel(SpectralType.FREQ, SpectralUnit.GHZ), {type: SpectralType.FREQ, unit: SpectralUnit.GHZ}],
    [GenCoordinateLabel(SpectralType.FREQ, SpectralUnit.MHZ), {type: SpectralType.FREQ, unit: SpectralUnit.MHZ}],
    [GenCoordinateLabel(SpectralType.FREQ, SpectralUnit.KHZ), {type: SpectralType.FREQ, unit: SpectralUnit.KHZ}],
    [GenCoordinateLabel(SpectralType.FREQ, SpectralUnit.HZ), {type: SpectralType.FREQ, unit: SpectralUnit.HZ}],
    [GenCoordinateLabel(SpectralType.WAVE, SpectralUnit.M), {type: SpectralType.WAVE, unit: SpectralUnit.M}],
    [GenCoordinateLabel(SpectralType.WAVE, SpectralUnit.MM), {type: SpectralType.WAVE, unit: SpectralUnit.MM}],
    [GenCoordinateLabel(SpectralType.WAVE, SpectralUnit.UM), {type: SpectralType.WAVE, unit: SpectralUnit.UM}],
    [GenCoordinateLabel(SpectralType.WAVE, SpectralUnit.NM), {type: SpectralType.WAVE, unit: SpectralUnit.NM}],
    [GenCoordinateLabel(SpectralType.WAVE, SpectralUnit.ANGSTROM), {type: SpectralType.WAVE, unit: SpectralUnit.ANGSTROM}],
    [GenCoordinateLabel(SpectralType.AWAV, SpectralUnit.M), {type: SpectralType.AWAV, unit: SpectralUnit.M}],
    [GenCoordinateLabel(SpectralType.AWAV, SpectralUnit.MM), {type: SpectralType.AWAV, unit: SpectralUnit.MM}],
    [GenCoordinateLabel(SpectralType.AWAV, SpectralUnit.UM), {type: SpectralType.AWAV, unit: SpectralUnit.UM}],
    [GenCoordinateLabel(SpectralType.AWAV, SpectralUnit.NM), {type: SpectralType.AWAV, unit: SpectralUnit.NM}],
    [GenCoordinateLabel(SpectralType.AWAV, SpectralUnit.ANGSTROM), {type: SpectralType.AWAV, unit: SpectralUnit.ANGSTROM}],
    ["Channel", {type: SpectralType.CHANNEL, unit: null}]
]);

export enum IntensityUnitType {
    JyBeam,
    JySr,
    JyArcsec2,
    JyPixel,
    Kelvin,
    Unsupported
}

enum Jansky {
    MJy = "MJy",
    Jy = "Jy",
    mJy = "mJy",
    uJy = "uJy"
}

enum Kelvin {
    K = "K",
    mK = "mK"
}

const JYSR_TO_JYARCSEC2_CONSTANT = 23.50443;

const Jys = Object.values(Jansky);
const JyBeam = Jys.filter(jy => jy !== Jansky.MJy).map(jy => `${jy}/beam`);
const JySr = Jys.filter(jy => jy !== Jansky.Jy && jy !== Jansky.mJy).map(jy => `${jy}/sr`);
const JyArcsec2 = Jys.map(jy => `${jy}/arcsec^2`);
const JyPixel = Jys.map(jy => `${jy}/pixel`);
const Kelvins = Object.values(Kelvin);
export const IntensityUnits = [...Kelvins, ...JyBeam, ...JySr, ...JyArcsec2, ...JyPixel];

// TODO: gen available conversion options
export const AvailableIntensityUnits = IntensityUnits;

// TODO: store this in a map

export const FindIntensityUnitType = (unitStr: string): IntensityUnitType => {
    const lowercaseJyBeam = JyBeam.map(unit => {
        return unit.toLowerCase();
    });
    const lowercaseJySr = JySr.map(unit => {
        return unit.toLowerCase();
    });
    const lowercaseJyArcsec2 = JyArcsec2.map(unit => {
        return unit.toLowerCase();
    });
    const lowercaseJyPixel = JyPixel.map(unit => {
        return unit.toLowerCase();
    });
    const lowercaseKelvins = Kelvins.map(unit => {
        return unit.toLowerCase();
    });
    const lowercaseUnitStr = unitStr?.toLowerCase();

    if (lowercaseJyBeam.includes(lowercaseUnitStr)) {
        return IntensityUnitType.JyBeam;
    } else if (lowercaseJySr.includes(lowercaseUnitStr)) {
        return IntensityUnitType.JySr;
    } else if (lowercaseJyArcsec2.includes(lowercaseUnitStr)) {
        return IntensityUnitType.JyArcsec2;
    } else if (lowercaseJyPixel.includes(lowercaseUnitStr)) {
        return IntensityUnitType.JyPixel;
    } else if (lowercaseKelvins.includes(lowercaseUnitStr)) {
        return IntensityUnitType.Kelvin;
    } else {
        return IntensityUnitType.Unsupported;
    }
};

export const IsIntensitySupported = (unitStr: string): boolean => {
    return FindIntensityUnitType(unitStr) !== IntensityUnitType.Unsupported;
};

type IntensityOption = {bmaj?: number; bmin?: number; cdelt1?: number; cdelta2?: number; isCTYPE3freq?: boolean};
export const GetAvailableIntensityConversions = (unitStr: string, option: IntensityOption = undefined): string[] => {
    if (IsIntensitySupported(unitStr)) {
        let supportedConversions = [];
        const type = FindIntensityUnitType(unitStr);
        if (type === IntensityUnitType.JyBeam) {
            supportedConversions.push(...JyBeam);
        }
        return supportedConversions;
    }
    return undefined;
};

const GetUnitScale = (unitStr: string): number => {
    if (unitStr.match(/^M/)) {
        return 1e6;
    } else if (unitStr.match(/^m/)) {
        return 1e-3;
    } else if (unitStr.match(/^u/)) {
        return 1e-6;
    }
    return 1;
};

export const IntensityConversion = (unitFrom: string, unitTo: string, values: number[]): number[] => {
    const unitFromType = FindIntensityUnitType(unitFrom);
    const unitToType = FindIntensityUnitType(unitTo);
    if (unitFromType === IntensityUnitType.Unsupported || unitToType === IntensityUnitType.Unsupported || values?.length <= 0) {
        return undefined;
    }

    const unitFromScale = GetUnitScale(unitFrom);
    const unitToScale = GetUnitScale(unitTo);

    let convertedValues;
    if (unitFromType === unitToType) {
        const scale = unitToScale / unitFromScale;
        return values.map(value => value * scale);
    } else {
        const normalizedValues = values.map(value => value * unitFromScale);
        if (unitFromType === IntensityUnitType.Kelvin && unitToType === IntensityUnitType.JyBeam) {
            convertedValues = KelvinToJyBeam(normalizedValues);
        } else if (unitFromType === IntensityUnitType.JySr && unitToType === IntensityUnitType.JyArcsec2) {
            convertedValues = JySrTOJyArcsec2(normalizedValues);
        }
    }
    return convertedValues?.map(value => value / unitToScale);
};

const KelvinToJyBeam = (values: number[]): number[] => {
    // TODO
    return values;
};

const JySrTOJyArcsec2 = (values: number[]): number[] => {
    return values?.map(value => value * JYSR_TO_JYARCSEC2_CONSTANT);
};
