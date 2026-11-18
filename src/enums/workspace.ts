export enum WorkspaceDialogMode {
    Hidden,
    Save,
    Open
}

/** The kind of thing a workspace issue is about, for grouping and filtering. */
export enum WorkspaceItemKind {
    Image = "image",
    ColorBlending = "color-blending",
    Catalog = "catalog",
    CatalogSelection = "catalog-selection",
    CatalogWidget = "catalog-widget",
    CatalogPlot = "catalog-plot",
    Layout = "layout"
}

/** The kinds of item a workspace refers to by an ID of its own, a subset of the kinds it reports
 * issues about. */
export type WorkspaceIdentifiedItemKind = WorkspaceItemKind.Image | WorkspaceItemKind.Catalog;
