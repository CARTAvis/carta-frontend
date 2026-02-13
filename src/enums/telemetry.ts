export enum TelemetryMode {
    None = "none",
    Minimal = "minimal",
    Usage = "usage"
}

export enum TelemetryAction {
    Connection = "connection",
    EndSession = "endSession",
    RetryConnection = "retryConnection",
    OptIn = "optIn",
    OptOut = "optOut",
    FileOpen = "fileOpen",
    FileClose = "fileClose",
    SpectralProfileGeneration = "spectralProfileGeneration",
    PvGeneration = "pvGeneration",
    MomentGeneration = "momentGeneration",
    CatalogLoading = "catalogLoading"
}
