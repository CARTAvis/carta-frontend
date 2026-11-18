export enum WorkspaceDialogMode {
    Hidden,
    Save,
    Open
}

/** Why a restore left an item out of the session. */
export enum WorkspaceIssueOutcome {
    Failed = "failed",
    Skipped = "skipped"
}

/** How a widget differs from the workspace, when the restore could not show what the widget showed. */
export enum WorkspaceIssueEffect {
    /** The widget shows the active image, because the image that it showed was not restored. */
    ActiveImage = "active-image",
    /**
     * The widget follows the active image, and the image that was active when the workspace was
     * saved was not restored. So the widget shows another image.
     */
    ActiveImageFollowed = "active-image-followed",
    /** The widget shows the active region, because the region that it showed was not restored. */
    ActiveRegion = "active-region",
    /** The catalog widget or plot shows another catalog or none, because the catalog that it showed was not restored. */
    CatalogNotRestored = "catalog-not-restored"
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
    /** A dialog whose settings a workspace saves, such as the Image Fitting dialog. */
    Dialog = "dialog",
    Layout = "layout"
}

/** The kinds of item a workspace refers to by an ID of its own, a subset of the kinds it reports
 * issues about. */
export type WorkspaceIdentifiedItemKind = WorkspaceItemKind.Image | WorkspaceItemKind.Catalog;
