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

export const SPECTRAL_MATCHING_TYPES: SpectralType[] = Object.values(SpectralType);
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

export const GetFreqInGHz = (unit: string, value: number): number => {
    if (unit && Object.values(FrequencyUnit).includes(unit as FrequencyUnit) && isFinite(value)) {
        if (unit === FrequencyUnit.GHZ) {
            return value;
        } else if (unit === FrequencyUnit.MHZ) {
            return value / 1e3;
        } else if (unit === FrequencyUnit.KHZ) {
            return value / 1e6;
        } else {
            return value / 1e9;
        }
    }
    return undefined;
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
    Kelvin,
    JyBeam,
    JySr,
    JyArcsec2,
    JyPixel,
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

const Jys = Object.values(Jansky);
const IntensityOptionsMap = new Map<IntensityUnitType, string[]>([
    [IntensityUnitType.Kelvin, Object.values(Kelvin)],
    [IntensityUnitType.JyBeam, Jys.filter(jy => jy !== Jansky.MJy).map(jy => `${jy}/beam`)],
    [IntensityUnitType.JySr, Jys.filter(jy => jy === Jansky.MJy).map(jy => `${jy}/sr`)],
    [IntensityUnitType.JyArcsec2, Jys.filter(jy => jy !== Jansky.MJy).map(jy => `${jy}/arcsec^2`)],
    [IntensityUnitType.JyPixel, Jys.map(jy => `${jy}/pixel`)]
]);

export const FindIntensityUnitType = (unitStr: string): IntensityUnitType => {
    const lowercaseJyBeam = IntensityOptionsMap.get(IntensityUnitType.JyBeam).map(unit => {
        return unit.toLowerCase();
    });
    const lowercaseJySr = IntensityOptionsMap.get(IntensityUnitType.JySr).map(unit => {
        return unit.toLowerCase();
    });
    const lowercaseJyArcsec2 = IntensityOptionsMap.get(IntensityUnitType.JyArcsec2).map(unit => {
        return unit.toLowerCase();
    });
    const lowercaseJyPixel = IntensityOptionsMap.get(IntensityUnitType.JyPixel).map(unit => {
        return unit.toLowerCase();
    });
    const lowercaseKelvins = IntensityOptionsMap.get(IntensityUnitType.Kelvin).map(unit => {
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

export type IntensityConfig = {nativeIntensityUnit: string; bmaj?: number[]; bmin?: number[]; cdelta1?: number; cdelta2?: number; freqGHz?: number};
const FindConvertibleIntensityTypes = (config: IntensityConfig): IntensityUnitType[] => {
    let options: IntensityUnitType[] = [];
    const type = FindIntensityUnitType(config?.nativeIntensityUnit);
    if (type !== IntensityUnitType.Unsupported) {
        if (type === IntensityUnitType.Kelvin) {
            options.push(IntensityUnitType.Kelvin);
            if (config?.bmaj?.every(x => isFinite(x)) && config?.bmin?.every(x => isFinite(x)) && isFinite(config?.freqGHz)) {
                options.push(IntensityUnitType.JyBeam);
                options.push(IntensityUnitType.JySr);
                options.push(IntensityUnitType.JyArcsec2);
            }
        } else if (type === IntensityUnitType.JyBeam) {
            options.push(IntensityUnitType.JyBeam);
            if (config?.bmaj?.every(x => isFinite(x)) && config?.bmin?.every(x => isFinite(x))) {
                options.push(IntensityUnitType.JySr);
                options.push(IntensityUnitType.JyArcsec2);
                if (isFinite(config?.freqGHz)) {
                    options.push(IntensityUnitType.Kelvin);
                }
            }
        } else if (type === IntensityUnitType.JySr || type === IntensityUnitType.JyArcsec2) {
            options.push(IntensityUnitType.JySr);
            options.push(IntensityUnitType.JyArcsec2);
            if (config?.bmaj?.every(x => isFinite(x)) && config?.bmin?.every(x => isFinite(x))) {
                options.push(IntensityUnitType.JyBeam);
                if (isFinite(config?.freqGHz)) {
                    options.push(IntensityUnitType.Kelvin);
                }
            }
            if (isFinite(config?.cdelta1) && isFinite(config?.cdelta2)) {
                options.push(IntensityUnitType.JyPixel);
            }
        } else if (type === IntensityUnitType.JyPixel) {
            options.push(IntensityUnitType.JyPixel);
            if (isFinite(config?.cdelta1) && isFinite(config?.cdelta2)) {
                options.push(IntensityUnitType.JySr);
                options.push(IntensityUnitType.JyArcsec2);
            }
        }
    }
    return options;
};

export const GetIntensityOptions = (config: IntensityConfig): string[] => {
    const convertibleTypes = FindConvertibleIntensityTypes(config);
    let supportedOptions = [];
    convertibleTypes?.forEach(type => {
        supportedOptions.push(...IntensityOptionsMap.get(type));
    });
    return supportedOptions;
};

const JyBeamToKelvin = (freqGHz: number, bmaj: number, bmin: number, forward: boolean = true): number => {
    const coefficient = (1.222 * 1e6) / (freqGHz * freqGHz * bmaj * bmin);
    return forward ? coefficient : 1 / coefficient;
};

const JyBeamToJySr = (bmaj: number, bmin: number, forward: boolean = true): number => {
    const bmajRad = (bmaj * Math.PI) / 648000;
    const bminRad = (bmin * Math.PI) / 648000;
    const omega = (Math.PI * bmajRad * bminRad) / (4 * Math.LN2);
    return forward ? 1 / omega : omega;
};

const JySrToJyArcsec2 = (forward: boolean = true): number => {
    const constant = 2.350443 * 1e-11;
    return forward ? constant : 1 / constant;
};

const JyPixelToJyArcsec2 = (cdelta1: number, cdelta2: number, forward: boolean = true): number => {
    const coefficient = (cdelta1 * cdelta2) / (2.350443 * 1e-11);
    return forward ? coefficient : 1 / coefficient;
};

export type IntensityConversion = (values: Float32Array | Float64Array) => Float32Array | Float64Array;

const FindIntensityConversion = (unitFromType: IntensityUnitType, unitToType: IntensityUnitType, scale: number, config: IntensityConfig = undefined): IntensityConversion => {
    let conversion = undefined;
    if (unitFromType === IntensityUnitType.Kelvin) {
        if (unitToType === IntensityUnitType.JyBeam) {
            conversion = (value, i) => value * scale * JyBeamToKelvin(config.freqGHz, config.bmaj[i], config.bmin[i], false);
        } else if (unitToType === IntensityUnitType.JySr) {
            conversion = (value, i) => value * scale * JyBeamToKelvin(config.freqGHz, config.bmaj[i], config.bmin[i], false) * JyBeamToJySr(config.bmaj[i], config.bmin[i]);
        } else if (unitToType === IntensityUnitType.JyArcsec2) {
            conversion = (value, i) => value * scale * JyBeamToKelvin(config.freqGHz, config.bmaj[i], config.bmin[i], false) * JyBeamToJySr(config.bmaj[i], config.bmin[i]) * JySrToJyArcsec2();
        }
    } else if (unitFromType === IntensityUnitType.JyBeam) {
        if (unitToType === IntensityUnitType.Kelvin) {
            conversion = (value, i) => value * scale * JyBeamToKelvin(config.freqGHz, config.bmaj[i], config.bmin[i]);
        } else if (unitToType === IntensityUnitType.JySr) {
            conversion = (value, i) => value * scale * JyBeamToJySr(config.bmaj[i], config.bmin[i]);
        } else if (unitToType === IntensityUnitType.JyArcsec2) {
            conversion = (value, i) => value * scale * JyBeamToJySr(config.bmaj[i], config.bmin[i]) * JySrToJyArcsec2();
        }
    } else if (unitFromType === IntensityUnitType.JySr) {
        if (unitToType === IntensityUnitType.Kelvin) {
            conversion = (value, i) => value * scale * JyBeamToJySr(config.bmaj[i], config.bmin[i], false) * JyBeamToKelvin(config.freqGHz, config.bmaj[i], config.bmin[i]);
        } else if (unitToType === IntensityUnitType.JyBeam) {
            conversion = (value, i) => value * scale * JyBeamToJySr(config.bmaj[i], config.bmin[i], false);
        } else if (unitToType === IntensityUnitType.JyArcsec2) {
            conversion = value => value * scale * JySrToJyArcsec2();
        } else if (unitToType === IntensityUnitType.JyPixel) {
            conversion = value => value * scale * JySrToJyArcsec2() * JyPixelToJyArcsec2(config.cdelta1, config.cdelta2, false);
        }
    } else if (unitFromType === IntensityUnitType.JyArcsec2) {
        if (unitToType === IntensityUnitType.Kelvin) {
            conversion = (value, i) => value * scale * JySrToJyArcsec2(false) * JyBeamToJySr(config.bmaj[i], config.bmin[i], false) * JyBeamToKelvin(config.freqGHz, config.bmaj[i], config.bmin[i]);
        } else if (unitToType === IntensityUnitType.JyBeam) {
            conversion = (value, i) => value * scale * JySrToJyArcsec2(false) * JyBeamToJySr(config.bmaj[i], config.bmin[i], false);
        } else if (unitToType === IntensityUnitType.JySr) {
            conversion = value => value * scale * JySrToJyArcsec2(false);
        } else if (unitToType === IntensityUnitType.JyPixel) {
            conversion = value => value * scale * JyPixelToJyArcsec2(config.cdelta1, config.cdelta2, false);
        }
    } else if (unitFromType === IntensityUnitType.JyPixel) {
        if (unitToType === IntensityUnitType.JySr) {
            conversion = value => value * scale * JyPixelToJyArcsec2(config.cdelta1, config.cdelta2) * JySrToJyArcsec2(false);
        } else if (unitToType === IntensityUnitType.JyArcsec2) {
            conversion = value => value * scale * JyPixelToJyArcsec2(config.cdelta1, config.cdelta2);
        }
    }
    return conversion
        ? (values: Float32Array | Float64Array): Float32Array | Float64Array => {
              return values.map(conversion);
          }
        : undefined;
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

export const GetIntensityConversion = (config: IntensityConfig, unitTo: string): IntensityConversion => {
    const unitFromType = FindIntensityUnitType(config?.nativeIntensityUnit);
    const unitToType = FindIntensityUnitType(unitTo);
    if (unitFromType === IntensityUnitType.Unsupported || unitToType === IntensityUnitType.Unsupported || config?.nativeIntensityUnit === unitTo) {
        return undefined;
    }

    const unitFromScale = GetUnitScale(config.nativeIntensityUnit);
    const unitToScale = GetUnitScale(unitTo);
    const scale = unitFromScale / unitToScale;
    if (unitFromType === unitToType) {
        return (values: Float32Array | Float64Array): Float32Array | Float64Array => {
            return values.map(value => value * scale);
        };
    } else {
        return FindIntensityConversion(unitFromType, unitToType, scale, config);
    }
};
