import type {TabId} from "@blueprintjs/core";
import {action, makeObservable, observable} from "mobx";

import {DialogId, FileInfoType, WorkspaceDialogMode} from "enums";
import {type Snippet} from "models";
import {AppStore, SnippetStore} from "stores";
import {type FrameStore} from "stores/Frame";

/** Where a dialog is and how large it is, in pixels of the browser window. */
export interface DialogGeometry {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface ShowDialogOptions {
    mode?: WorkspaceDialogMode;
    url?: string;
    title?: string;
    snippet?: Snippet;
    name?: string;
    newSnippet?: boolean;
    /** Keeps the Workspace dialog open under the file browser. The Workspace dialog asks the file browser for a file then. */
    shouldKeepWorkspaceDialog?: boolean;
}

/**
 * The dialogs that show their first tab again when they open. Their tabs were not kept before a
 * workspace could save them, so closing one of these dialogs still forgets its tab.
 */
const DIALOGS_WITH_TAB_RESET_ON_CLOSE: string[] = [DialogId.Contour, DialogId.Vector, DialogId.OnlineDataQuery, DialogId.Layout];

/** The settings that a dialog shows but that are not applied, and the image that they are for. */
export interface DialogSettings {
    frame: FrameStore;
    values: object;
}

export interface DialogSettingsHandler {
    capture: () => DialogSettings | undefined;
    apply: (settings: DialogSettings | undefined) => void;
}

export class DialogStore {
    private static staticInstance: DialogStore;

    @observable workspaceDialogMode: WorkspaceDialogMode = WorkspaceDialogMode.Hidden;
    @observable selectedFileInfoDialogTab: TabId = FileInfoType.IMAGE_HEADER;
    /** The text of the header search of the File Info dialog, or undefined when the search is closed. */
    @observable fileInfoSearchString: string | undefined = undefined;
    @observable externalPageDialogUrl: string = "";
    @observable externalPageDialogTitle: string = "";
    @observable dialogVisible: Map<string, boolean> = new Map();
    /**
     * Where each open dialog is, after the user moved or resized it, or after a workspace restore
     * placed it. A dialog that is not here opens in the middle of the window. Closing a dialog
     * forgets its place.
     */
    @observable dialogGeometries: Map<string, DialogGeometry> = new Map();
    /**
     * The tab that each dialog shows, after the user chose one. The File Info dialog keeps its tab in
     * `selectedFileInfoDialogTab`. Closing the Contour, Vector Overlay or Online Data Query dialog
     * forgets its tab.
     */
    @observable private dialogTabs: Map<string, TabId> = new Map();
    private readonly settingsHandlers = new Map<string, DialogSettingsHandler>();

    constructor() {
        makeObservable(this);
        Object.values(DialogId).forEach(w => {
            this.dialogVisible.set(w, false);
        });
    }

    public static get Instance() {
        if (!DialogStore.staticInstance) {
            DialogStore.staticInstance = new DialogStore();
        }
        return DialogStore.staticInstance;
    }

    zIndexManager = AppStore.Instance.zIndexManager;

    @action showDialog = (id: string, options?: ShowDialogOptions) => {
        if (id === DialogId.Snippet) {
            if (options?.newSnippet) {
                SnippetStore.Instance.clearActiveSnippet();
            } else if (options?.snippet) {
                SnippetStore.Instance.setActiveSnippet(options.snippet, options.name);
            }

            if (!this.dialogVisible.get(DialogId.Snippet)) {
                this.dialogVisible.set(DialogId.Snippet, true);
                this.zIndexManager.assignIndex(DialogId.Snippet);
            }

            this.zIndexManager.updateIndexOnSelect(id);
        } else if (!this.dialogVisible.get(id)) {
            switch (id) {
                case DialogId.Workspace:
                    this.hideDialog(DialogId.FileBrowser);
                    if (options?.mode) {
                        this.workspaceDialogMode = options.mode;
                    }
                    this.zIndexManager.assignIndex(DialogId.Workspace);
                    break;

                case DialogId.FileBrowser:
                    if (!options?.shouldKeepWorkspaceDialog) {
                        this.hideDialog(DialogId.Workspace);
                    }
                    this.dialogVisible.set(DialogId.FileBrowser, true);
                    this.zIndexManager.assignIndex(DialogId.FileBrowser);
                    break;

                case DialogId.ExternalPage:
                    if (options?.url && options?.title) {
                        this.externalPageDialogUrl = options.url;
                        this.externalPageDialogTitle = options.title;
                    }
                    this.dialogVisible.set(DialogId.ExternalPage, true);
                    this.zIndexManager.assignIndex(DialogId.ExternalPage);
                    break;

                default:
                    this.dialogVisible.set(id, true);
                    this.zIndexManager.assignIndex(id);
                    break;
            }
        } else {
            this.zIndexManager.updateIndexOnSelect(id);
        }
    };

    @action hideDialog = (id: string) => {
        if (id === DialogId.Workspace) {
            this.workspaceDialogMode = WorkspaceDialogMode.Hidden;
        } else {
            this.dialogVisible.set(id, false);
        }
        this.dialogGeometries.delete(id);
        if (id === DialogId.FileInfo) {
            this.fileInfoSearchString = undefined;
        }
        if (DIALOGS_WITH_TAB_RESET_ON_CLOSE.includes(id)) {
            this.dialogTabs.delete(id);
        }
        this.zIndexManager.updateIndexOnRemove(id);
    };

    /**
     * Puts a dialog back in the middle of the window, and shows its first tab. A workspace restore
     * does this before it applies the place and the tab that the workspace saved.
     */
    /**
     * Lets a dialog that is always mounted give and take the settings that it shows but that are not
     * applied, so that a workspace keeps them. Returns a function that removes the handler.
     */
    registerSettingsHandler = (id: string, handler: DialogSettingsHandler): (() => void) => {
        this.settingsHandlers.set(id, handler);
        return () => {
            if (this.settingsHandlers.get(id) === handler) {
                this.settingsHandlers.delete(id);
            }
        };
    };

    /** Returns the settings that a dialog shows but that are not applied, or undefined when there are none. */
    unappliedSettingsOf = (id: string): DialogSettings | undefined => {
        return this.settingsHandlers.get(id)?.capture();
    };

    /** Shows the given settings in a dialog, or the settings of its image when `settings` is undefined. */
    applyUnappliedSettings = (id: string, settings: DialogSettings | undefined) => {
        this.settingsHandlers.get(id)?.apply(settings);
    };

    @action resetPlaceAndTab = (id: string) => {
        this.dialogGeometries.delete(id);
        if (id === DialogId.FileInfo) {
            this.selectedFileInfoDialogTab = FileInfoType.IMAGE_HEADER;
        } else {
            this.dialogTabs.delete(id);
        }
    };

    @action setFileInfoSearchString = (searchString: string | undefined) => {
        this.fileInfoSearchString = searchString;
    };

    @action setDialogGeometry = (id: string, geometry: DialogGeometry) => {
        const current = this.dialogGeometries.get(id);
        if (!current || current.x !== geometry.x || current.y !== geometry.y || current.width !== geometry.width || current.height !== geometry.height) {
            this.dialogGeometries.set(id, geometry);
        }
    };

    /** Returns the tab that a dialog shows, or undefined when the user has not chosen one. */
    selectedTabOf = (id: string): TabId | undefined => {
        return id === DialogId.FileInfo ? this.selectedFileInfoDialogTab : this.dialogTabs.get(id);
    };

    @action selectTab = (id: string, tab: TabId) => {
        if (id === DialogId.FileInfo) {
            this.selectedFileInfoDialogTab = tab;
        } else {
            this.dialogTabs.set(id, tab);
        }
    };

    // File Info
    @action setSelectedFileInfoDialogTab = (newId: TabId) => {
        this.selectedFileInfoDialogTab = newId;
    };
}
