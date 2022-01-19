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

export const COMPUTED_POLARIZATIONS = new Map<string, number>([
    ["Ptotal", 13],
    ["Plinear", 14],
    ["PFtotal", 15],
    ["PFlinear", 16],
    ["Pangle", 17]
]);

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

export const VALID_COORDINATES: string[] = ["z", ...Array.from(STANDARD_POLARIZATIONS.values()).map(val => `${val}z`), ...Array.from(COMPUTED_POLARIZATIONS.keys()).map(val => `${val}z`)];
export const VALID_XY_COORDINATES: string[] = [
    "x",
    "y",
    ...Array.from(STANDARD_POLARIZATIONS.values()).map(val => `${val}x`),
    ...Array.from(STANDARD_POLARIZATIONS.values()).map(val => `${val}y`),
    ...Array.from(COMPUTED_POLARIZATIONS.keys()).map(val => `${val}x`),
    ...Array.from(COMPUTED_POLARIZATIONS.keys()).map(val => `${val}y`)
];
