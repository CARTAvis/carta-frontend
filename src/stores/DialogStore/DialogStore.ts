import {TabId} from "@blueprintjs/core";
import {action, makeObservable, observable} from "mobx";

import {FileInfoType} from "components";
import {WorkspaceDialogMode} from "components/Dialogs/WorkspaceDialog/WorkspaceDialogComponent";
import {Snippet} from "models";
import {AppStore, SnippetStore} from "stores";

export enum DialogId {
    About = "about-dialog",
    CatalogQuery = "catalogQuery-dialog",
    Snippet = "snippet-dialog",
    Contour = "contour-dialog",
    DistanceMeasure = "distanceMeasure-dialog",
    ExternalPage = "externalPage-dialog",
    FileBrowser = "fileBrowser-dialog",
    FileInfo = "fileInfo-dialog",
    Fitting = "fitting-dialog",
    Layout = "saveLayout-dialog",
    Preference = "preference-dialog",
    Region = "region-dialog",
    Stokes = "stokes-dialog",
    Vector = "vector-dialog",
    Workspace = "workspace-dialog",
    ShareWorkspace = "shareWork-dialog",
    Hotkey = "hotkey-dialog"
}

interface showDialogOptions {
    oldLayoutName?: string;
    mode?: WorkspaceDialogMode;
    url?: string;
    title?: string;
    snippet?: Snippet;
    name?: string;
    newSnippet?: boolean;
}

export class DialogStore {
    private static staticInstance: DialogStore;

    @observable workspaceDialogMode = WorkspaceDialogMode.Hidden;
    @observable selectedFileInfoDialogTab: TabId = FileInfoType.IMAGE_HEADER;
    @observable externalPageDialogUrl: string;
    @observable externalPageDialogTitle: string;
    @observable dialogVisible = new Map<string, boolean>();

    constructor() {
        makeObservable(this);
        Object.values(DialogId).forEach(w => {
            this.dialogVisible.set(w, false);
        });
    }

    static get Instance() {
        if (!DialogStore.staticInstance) {
            DialogStore.staticInstance = new DialogStore();
        }
        return DialogStore.staticInstance;
    }

    zIndexManager = AppStore.Instance.zIndexManager;

    @action showDialog = (id: string, options?: showDialogOptions) => {
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
                case DialogId.Layout:
                    this.dialogVisible.set(DialogId.Layout, true);
                    AppStore.Instance.layoutStore.setOldLayoutName(options?.oldLayoutName);
                    this.zIndexManager.assignIndex(DialogId.Layout);
                    break;

                case DialogId.Workspace:
                    this.dialogVisible.set(DialogId.FileBrowser, false);
                    if (options?.mode) {
                        this.workspaceDialogMode = options.mode;
                    }
                    this.zIndexManager.assignIndex(DialogId.Workspace);
                    break;

                case DialogId.FileBrowser:
                    this.workspaceDialogMode = WorkspaceDialogMode.Hidden;
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
        this.zIndexManager.updateIndexOnRemove(id);
    };

    // File Info
    @action setSelectedFileInfoDialogTab = (newId: TabId) => {
        this.selectedFileInfoDialogTab = newId;
    };
}
