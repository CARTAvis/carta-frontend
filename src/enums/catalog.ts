export enum CatalogType {
    VIZIER,
    SIMBAD,
    FILE
}

export enum CatalogDatabase {
    SIMBAD = "SIMBAD",
    VIZIER = "VizieR"
}

export enum CatalogSystemType {
    Ecliptic = "ECLIPTIC",
    FK4 = "FK4",
    FK5 = "FK5",
    Galactic = "GALACTIC",
    ICRS = "ICRS",
    Pixel0 = "Pixel0",
    Pixel1 = "Pixel1"
}

export enum CatalogOverlay {
    X = "X",
    Y = "Y",
    NONE = "None",
    RA = "RA",
    DEC = "DEC",
    GLAT = "GLAT",
    GLON = "GLON",
    ELON = "ELON",
    ELAT = "ELAT",
    X0 = "X0",
    Y0 = "Y0",
    X1 = "X1",
    Y1 = "Y1"
}

export enum CatalogTextureType {
    Position,
    Size,
    Color,
    Orientation,
    SelectedSource,
    SizeMinor
}

export enum CatalogUpdateMode {
    TableUpdate = "TableUpdate",
    ViewUpdate = "ViewUpdate",
    PlotsUpdate = "PlotsUpdate"
}
