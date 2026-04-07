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

export enum StokesCoordinate {
    CurrentZ = "z",
    TotalIntensity = "Iz",
    LinearPolarizationQ = "Qz",
    LinearPolarizationU = "Uz",
    CircularPolarization = "Vz",
    PolarizedIntensity = "PIz",
    PolarizationAngle = "PAz",
    PolarizationQU = "QvsU"
}
