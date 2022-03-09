// From FITS standard (Table 29 of V4.0 of "Definition of the Flexible Image Transport System")
export const STANDARD_POLARIZATIONS = new Map<number, string>([
    [-8, "YX"],
    [-7, "XY"],
    [-6, "YY"],
    [-5, "XX"],
    [-4, "LR"],
    [-3, "RL"],
    [-2, "LL"],
    [-1, "RR"],
    [1, "I"],
    [2, "Q"],
    [3, "U"],
    [4, "V"]
]);

export const COMPUTED_POLARIZATIONS = new Map<number, string>([
    [13, "Ptotal"],
    [14, "Plinear"],
    [15, "PFtotal"],
    [16, "PFlinear"],
    [17, "Pangle"]
]);

export const FULL_POLARIZATIONS = new Map<number, string>([...STANDARD_POLARIZATIONS, ...COMPUTED_POLARIZATIONS]);

export const POLARIZATION_LABELS = new Map<string, string>([
    ["", "Current"],
    ["I", "Stokes I"],
    ["Q", "Stokes Q"],
    ["U", "Stokes U"],
    ["V", "Stokes V"],
    ["YX", "YX"],
    ["XY", "XY"],
    ["YY", "YY"],
    ["XX", "XX"],
    ["LR", "LR"],
    ["RL", "RL"],
    ["LL", "LL"],
    ["RR", "RR"],
    ["Ptotal", "Ptotal"],
    ["Plinear", "Plinear"],
    ["PFtotal", "PFtotal"],
    ["PFlinear", "PFlinear"],
    ["Pangle", "Pangle"]
]);

export enum POLARIZATIONS {
    YX = -8,
    XY = -7,
    YY = -6,
    XX = -5,
    LR = -4,
    RL = -3,
    LL = -2,
    RR = -1,
    I = 1,
    Q = 2,
    U = 3,
    V = 4,
    Ptotal = 13,
    Plinear = 14,
    PFtotal = 15,
    PFlinear = 16,
    Pangle = 17
}

export const VALID_COORDINATES: string[] = ["z", ...Array.from(FULL_POLARIZATIONS.values()).map(val => `${val}z`)];
export const VALID_XY_COORDINATES: string[] = ["x", "y", ...Array.from(FULL_POLARIZATIONS.values()).map(val => `${val}x`), ...Array.from(FULL_POLARIZATIONS.values()).map(val => `${val}y`)];
