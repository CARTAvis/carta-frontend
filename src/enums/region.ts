export enum RegionMode {
    MOVING,
    CREATING
}

export enum RegionsOpacity {
    Visible = 1,
    SemiTransparent = 0.5,
    Invisible = 0
}

export enum RegionId {
    NONE = -4,
    ACTIVE = -3,
    IMAGE = -1,
    CURSOR = 0
}

export enum RegionsType {
    CLOSED,
    CLOSED_AND_POINT,
    POINT_AND_LINES,
    LINE
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
