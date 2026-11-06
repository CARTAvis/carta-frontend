export enum WorkspaceDialogMode {
    Hidden,
    Save,
    Open
}

/** Why a restore left an item out of the session. */
export enum WorkspaceIssueOutcome {
    /** The restore tried to open or make the item, and could not. */
    Failed = "failed",
    /** The user skipped the item. */
    Skipped = "skipped"
}

/** The kind of thing a workspace issue is about, for grouping and filtering. */
export enum WorkspaceItemKind {
    Image = "image",
    ColorBlending = "color-blending",
    /** A request that made moment, PV, HiPS or image fitting images. */
    GeneratedImage = "generated-image",
    Catalog = "catalog",
    CatalogSelection = "catalog-selection",
    CatalogWidget = "catalog-widget",
    CatalogPlot = "catalog-plot",
    PlotWidget = "plot-widget",
    Layout = "layout"
}

/** The kinds of item a workspace refers to by an ID of its own, a subset of the kinds it reports
 * issues about. */
export type WorkspaceIdentifiedItemKind = WorkspaceItemKind.Image | WorkspaceItemKind.Catalog;
