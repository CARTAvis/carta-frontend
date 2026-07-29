export enum BrowserMode {
    File,
    SaveFile,
    RegionImport,
    RegionExport,
    Catalog
}

export enum FileFilteringType {
    Fuzzy = "fuzzy",
    Unix = "unix",
    Regex = "regex"
}

export enum SelectionMode {
    All,
    Annotation,
    Region
}

export enum FileInfoType {
    IMAGE_FILE = "image-file",
    IMAGE_HEADER = "image-header",
    SAVE_IMAGE = "save-image",
    REGION_FILE = "region-file",
    SELECT_REGION = "select-region",
    CATALOG_FILE = "catalog-file",
    CATALOG_HEADER = "catalog-header"
}
