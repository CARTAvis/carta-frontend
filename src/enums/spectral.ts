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
    CHANNEL = "CHANNEL",
    NATIVE = "NATIVE" // for non-support spectral type/unit images to switch the coordinate between channel and native value
}

export enum SpectralSystem {
    LSRK = "LSRK",
    LSRD = "LSRD",
    BARY = "BARYCENT",
    TOPO = "TOPOCENT"
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
    ANGSTROM = "Angstrom",
    M_SQUARE = "m^2",
    MM_SQUARE = "mm^2",
    UM_SQUARE = "um^2",
    NM_SQUARE = "nm^2",
    ANGSTROM_SQUARE = "Angstrom^2"
}

export enum FrequencyUnit {
    GHZ = "GHz",
    MHZ = "MHz",
    KHZ = "kHz",
    HZ = "Hz"
}
