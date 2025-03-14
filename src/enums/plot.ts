export enum ZoomMode {
    NONE,
    X,
    Y,
    XY
}

export enum InteractionMode {
    NONE,
    SELECTING,
    PANNING
}

export enum LinePlotSelectingMode {
    BOX,
    HORIZONTAL,
    VERTICAL,
    LINE
}

export enum TickType {
    Automatic,
    Scientific,
    Integer
}

export enum LineSettings {
    MIN_WIDTH = 0.5,
    MAX_WIDTH = 10,
    MIN_POINT_SIZE = 0.5,
    MAX_POINT_SIZE = 10,
    POINT_SIZE_STEP_SIZE = 0.5,
    LINE_WIDTH_STEP_SIZE = 0.5
}

export enum ScatterSettings {
    MIN_POINT_SIZE = 0.5,
    MAX_POINT_SIZE = 10,
    MIN_TRANSPARENCY = 0.1,
    MAX_TRANSPARENCY = 1,
    POINT_SIZE_STEP_SIZE = 0.5,
    TRANSPARENCY_STEP_SIZE = 0.1
}

export enum PlotType {
    STEPS = "Steps",
    LINES = "Lines",
    POINTS = "Points"
}

export enum SmoothingType {
    NONE = "None",
    HANNING = "Hanning",
    BOXCAR = "Boxcar",
    GAUSSIAN = "Gaussian",
    DECIMATION = "Decimation",
    BINNING = "Binning",
    SAVITZKY_GOLAY = "Savitzky-Golay"
}

export enum FittingFunction {
    GAUSSIAN = 0,
    LORENTZIAN = 1
}

export enum FittingContinuum {
    NONE = -1,
    ZEROTH_ORDER = 0,
    FIRST_ORDER = 1
}
