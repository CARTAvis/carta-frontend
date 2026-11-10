export enum DialogId {
    About = "about-dialog",
    OnlineDataQuery = "online-data-query-dialog",
    Snippet = "snippet-dialog",
    Contour = "contour-dialog",
    ExternalPage = "external-page-dialog",
    FileBrowser = "file-browser-dialog",
    FileInfo = "file-info-dialog",
    Fitting = "fitting-dialog",
    Layout = "layout-dialog",
    Preference = "preference-dialog",
    Region = "region-dialog",
    Stokes = "stokes-dialog",
    Vector = "vector-dialog",
    Workspace = "workspace-dialog",
    ShareWorkspace = "share-work-dialog",
    Hotkey = "hotkey-dialog"
}

/**
 * The dialogs that a workspace keeps open. These show the data of the session. The other dialogs,
 * such as the file browser or the preferences, are not part of a workspace.
 */
export const WORKSPACE_DIALOGS: string[] = [DialogId.Contour, DialogId.Vector, DialogId.Fitting, DialogId.Region, DialogId.FileInfo, DialogId.OnlineDataQuery];

export enum LayoutDialogMode {
    DynamicLayout,
    Layout
}
