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

export enum CatalogPlotType {
    ImageOverlay = "Image overlay",
    Histogram = "Histogram",
    D2Scatter = "2D scatter"
}

export enum CatalogOverlayShape {
    BOX_LINED = 1,
    CIRCLE_FILLED = 2,
    CIRCLE_LINED = 3,
    HEXAGON_LINED = 5,
    RHOMB_LINED = 7,
    TRIANGLE_LINED_UP = 9,
    ELLIPSE_LINED = 11,
    TRIANGLE_LINED_DOWN = 13,
    HEXAGON_LINED_2 = 15,
    CROSS_FILLED = 16,
    CROSS_LINED = 17,
    X_FILLED = 18,
    X_LINED = 19,
    LineSegment_FILLED = 20
}

/** Display catalog sources with single or mapped sizes (Canvas) or their angular sizes (World) */
export enum CatalogDisplayMode {
    CANVAS = "Custom",
    WORLD = "Angular size"
}

export enum CatalogSizeUnits {
    SCREENPIXEL = "screen px",
    IMAGEPIXEL = "image px",
    MILLIARCSEC = "milliarcsec",
    ARCSEC = "arcsec",
    ARCMIN = "arcmin",
    DEG = "deg"
}
