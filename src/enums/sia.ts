/** Data product type filter values for SIA queries. */
export enum SiaDataProductType {
    Any = "",
    Image = "image",
    Cube = "cube"
}

/** A named region of the electromagnetic spectrum, bounded by wavelength in metres. */
export interface SiaBand {
    name: string;
    /** The shortest wavelength of the band, or NaN where the spectrum is open-ended. */
    min: number;
    /** The longest wavelength of the band, or NaN where the spectrum is open-ended. */
    max: number;
}

/** A composite band and the sub-bands which divide it. */
export interface SiaBandGroup {
    name: string;
    bands: SiaBand[];
}

const SPEED_OF_LIGHT_METRES_PER_SECOND = 299792458;
/** Planck's constant times the speed of light, in electronvolt metres. */
const PLANCK_EV_METRES = 1.239841984e-6;

const FromFrequency = (hertz: number): number => SPEED_OF_LIGHT_METRES_PER_SECOND / hertz;
const FromEnergy = (electronVolts: number): number => PLANCK_EV_METRES / electronVolts;

/**
 * Bands offered by the query filters, longest wavelength first, each group headed by the composite
 * band its sub-bands divide. Edges are approximate and the groups deliberately overlap.
 */
export const SIA_BAND_GROUPS: SiaBandGroup[] = [
    {
        name: "Radio",
        bands: [
            {name: "Radio", min: FromFrequency(30e9), max: FromFrequency(3)},
            {name: "Extremely low frequency (ELF)", min: FromFrequency(30), max: FromFrequency(3)},
            {name: "Super low frequency (SLF)", min: FromFrequency(300), max: FromFrequency(30)},
            {name: "Ultra low frequency (ULF)", min: FromFrequency(3e3), max: FromFrequency(300)},
            {name: "Very low frequency (VLF)", min: FromFrequency(30e3), max: FromFrequency(3e3)},
            {name: "Low frequency (LF)", min: FromFrequency(300e3), max: FromFrequency(30e3)},
            {name: "Medium frequency (MF)", min: FromFrequency(3e6), max: FromFrequency(300e3)},
            {name: "High frequency (HF)", min: FromFrequency(30e6), max: FromFrequency(3e6)},
            {name: "Very high frequency (VHF)", min: FromFrequency(300e6), max: FromFrequency(30e6)},
            {name: "Ultra high frequency (UHF)", min: FromFrequency(3e9), max: FromFrequency(300e6)},
            {name: "Super high frequency (SHF)", min: FromFrequency(30e9), max: FromFrequency(3e9)}
        ]
    },
    {
        name: "Microwave and submillimetre",
        bands: [
            {name: "Microwave", min: FromFrequency(300e9), max: FromFrequency(300e6)},
            {name: "Millimetre", min: 1e-3, max: 1e-2},
            {name: "Submillimetre", min: 3e-4, max: 1e-3}
        ]
    },
    {
        name: "Infrared",
        bands: [
            {name: "Infrared", min: 7e-7, max: 3e-4},
            {name: "Far infrared (FIR)", min: 3e-5, max: 3e-4},
            {name: "Mid infrared (MIR)", min: 3e-6, max: 3e-5},
            {name: "Near infrared (NIR)", min: 7e-7, max: 3e-6}
        ]
    },
    {
        name: "Visible",
        bands: [
            {name: "Visible", min: 3.8e-7, max: 7e-7},
            {name: "Red", min: 6.2e-7, max: 7e-7},
            {name: "Orange", min: 5.9e-7, max: 6.2e-7},
            {name: "Yellow", min: 5.7e-7, max: 5.9e-7},
            {name: "Green", min: 4.95e-7, max: 5.7e-7},
            {name: "Blue", min: 4.5e-7, max: 4.95e-7},
            {name: "Violet", min: 3.8e-7, max: 4.5e-7}
        ]
    },
    {
        name: "Ultraviolet",
        bands: [
            {name: "Ultraviolet", min: 1e-8, max: 4e-7},
            {name: "UVA", min: 3.15e-7, max: 4e-7},
            {name: "UVB", min: 2.8e-7, max: 3.15e-7},
            {name: "UVC", min: 1e-7, max: 2.8e-7},
            {name: "Extreme UV (EUV)", min: 1e-8, max: 1e-7}
        ]
    },
    {
        name: "X-ray",
        bands: [
            {name: "X-ray", min: FromEnergy(124e3), max: FromEnergy(124)},
            {name: "Soft X-ray", min: FromEnergy(12.4e3), max: FromEnergy(124)},
            {name: "Hard X-ray", min: FromEnergy(124e3), max: FromEnergy(12.4e3)}
        ]
    },
    {
        name: "Gamma ray",
        bands: [
            {name: "Gamma ray", min: NaN, max: FromEnergy(124e3)},
            {name: "Low-energy γ", min: FromEnergy(1.24e6), max: FromEnergy(124e3)},
            {name: "Medium-energy γ", min: FromEnergy(124e6), max: FromEnergy(1.24e6)},
            {name: "High-energy γ", min: FromEnergy(100e9), max: FromEnergy(0.1e9)},
            {name: "Very-high-energy γ", min: NaN, max: FromEnergy(100e9)}
        ]
    }
];

export const SIA_BANDS: SiaBand[] = SIA_BAND_GROUPS.flatMap(group => group.bands);

/** A time range offered by the SIA query filters, reaching the given number of days back from now. */
export interface SiaTimeRange {
    name: string;
    days: number;
}

export const SIA_TIME_RANGES: SiaTimeRange[] = [
    {name: "Last week", days: 7},
    {name: "Last month", days: 30},
    {name: "Last year", days: 365},
    {name: "Last decade", days: 3650}
];
