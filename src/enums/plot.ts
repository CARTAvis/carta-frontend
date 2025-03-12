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

export enum PlotType {
    STEPS = "Steps",
    LINES = "Lines",
    POINTS = "Points"
}
