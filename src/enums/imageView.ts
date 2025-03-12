export enum ImageViewLayer {
    RegionCreating = "regionCreating",
    Catalog = "catalog",
    RegionMoving = "regionMoving"
}

export enum ImagePanelMode {
    None = "none",
    Dynamic = "dynamic",
    Fixed = "fixed"
}

export enum ImageType {
    FRAME,
    COLOR_BLENDING,
    PV_PREVIEW
}

/**
 * @privateRemarks the enum element should be a power of 2 value
 */
export enum WCSMatchingType {
    NONE = 0,
    SPATIAL = 1,
    SPECTRAL = 2,
    RASTER = 4
}
