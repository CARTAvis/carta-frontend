export interface ChannelType {
    code: string;
    unit?: string;
    name: string;
}

// From FITS standard (Table 25 of V4.0 of "Definition of the Flexible Image Transport System")
export const CHANNEL_TYPES: ChannelType[] = [
    {code: "FREQ", name: "Frequency", unit: "Hz"},
    {code: "ENER", name: "Energy", unit: "J"},
    {code: "WAVN", name: "Wavenumber", unit: "1/m"},
    {code: "VRAD", name: "Velocity", unit: "m/s"},
    {code: "WAVE", name: "Vacuum wavelength", unit: "m"},
    {code: "VOPT", name: "Velocity\u00a0(OPT)", unit: "m/s"},
    {code: "ZOPT", name: "Redshift"},
    {code: "AWAV", name: "Air wavelength", unit: "m"},
    {code: "VELO", name: "Velocity\u00a0(Radial)", unit: "m/s"},
    {code: "BETA", name: "Beta"},
];
