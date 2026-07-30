export enum RegionMode {
    MOVING,
    CREATING
}

export enum RegionOpacity {
    Visible = 1,
    SemiTransparent = 0.5,
    Invisible = 0
}

export enum SelectionType {
    Active = "active",
    Secondary = "secondary"
}

export enum RegionId {
    NONE = -4,
    ACTIVE = -3,
    CUBE = -2,
    IMAGE = -1,
    CURSOR = 0
}

export enum RegionsType {
    CLOSED,
    CLOSED_AND_POINT,
    POINT_AND_LINES,
    LINE
}

export enum AppearanceControl {
    Color = "color",
    LineWidth = "lineWidth",
    DashLength = "dashLength",
    Font = "font",
    Point = "point",
    VectorPointer = "vectorPointer",
    Compass = "compass",
    Ruler = "ruler",
    TextAlignment = "textAlignment"
}

export enum FontStyle {
    NORMAL = "Normal",
    BOLD = "Bold",
    ITALIC = "Italic",
    BOLD_ITALIC = "Italic Bold"
}

export enum Font {
    HELVETICA = "Helvetica",
    TIMES = "Times",
    COURIER = "Courier"
}
