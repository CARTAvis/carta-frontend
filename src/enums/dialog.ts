import {FileInfoType} from "./fileBrowser";
import {ContourDialogTabs, FittingResultTabs, OnlineDataQueryDialogTabs, PreferenceDialogTabs, RegionDialogTabs, VectorOverlayDialogTabs} from "./tab";

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

export enum LayoutDialogMode {
    DynamicLayout,
    Layout
}

/**
 * The dialogs that a workspace keeps open. The Preferences dialog is kept open, but a restore does
 * not change the preferences. The dialogs of one step, such as the file browser, the Stokes dialog
 * and the Workspace dialog, are not part of a workspace.
 */
export const WORKSPACE_DIALOGS: string[] = [DialogId.Contour, DialogId.Vector, DialogId.Fitting, DialogId.Region, DialogId.FileInfo, DialogId.OnlineDataQuery, DialogId.Preference, DialogId.Layout, DialogId.About];

/** Returns the tabs of a numeric tab enum by name. For example, "Levels" is 0 and "Configuration" is 1. */
function tabsByName(tabs: object): {[name: string]: number} {
    return Object.fromEntries(Object.entries(tabs).filter(([, tab]) => typeof tab === "number"));
}

/**
 * The tabs of each dialog that a workspace keeps, by the name that the workspace saves for them.
 * The name keeps a saved workspace readable, and it does not change when a tab is added.
 */
export const WORKSPACE_DIALOG_TABS: {[dialogId: string]: {[name: string]: string | number}} = {
    [DialogId.Contour]: tabsByName(ContourDialogTabs),
    [DialogId.Vector]: tabsByName(VectorOverlayDialogTabs),
    [DialogId.Fitting]: tabsByName(FittingResultTabs),
    [DialogId.Region]: tabsByName(RegionDialogTabs),
    [DialogId.FileInfo]: {[FileInfoType.IMAGE_FILE]: FileInfoType.IMAGE_FILE, [FileInfoType.IMAGE_HEADER]: FileInfoType.IMAGE_HEADER},
    [DialogId.OnlineDataQuery]: tabsByName(OnlineDataQueryDialogTabs),
    [DialogId.Preference]: tabsByName(PreferenceDialogTabs),
    [DialogId.Layout]: tabsByName(LayoutDialogMode)
};
