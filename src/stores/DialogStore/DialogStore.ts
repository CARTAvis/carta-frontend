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
    ExistingSnippet = "existing-snippet-dialog",
    NewSnippet = "new-snippet-dialog",
    Contour = "contour-dialog",
    DistanceMeasure = "distanceMeasure-dialog",
    ExternalPage = "externalPage-dialog", // no one call this ??
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

interface showDialogProps {
    oldLayoutName?: string;
    mode?: WorkspaceDialogMode;
    url?: string; // no one call this ??
    title?: string; // no one call this ??
    snippet?: Snippet;
    name?: string;
}

export class DialogStore {
    private static staticInstance: DialogStore;

    constructor() {
        makeObservable(this);
    }

    static get Instance() {
        if (!DialogStore.staticInstance) {
            DialogStore.staticInstance = new DialogStore();
        }
        return DialogStore.staticInstance;
    }

    zIndexManager = AppStore.Instance.zIndexManager;

    @observable workspaceDialogMode = WorkspaceDialogMode.Hidden;
    @observable selectedFileInfoDialogTab: TabId = FileInfoType.IMAGE_HEADER;
    @observable externalPageDialogUrl: string;
    @observable externalPageDialogTitle: string;
    @observable dialogVisible = new Map<string, boolean>();

    @action showDialog = (id: string, props?: showDialogProps) => {
        switch (id) {
            case DialogId.Layout:
                this.dialogVisible.set(DialogId.Layout, true);
                if (props && props.oldLayoutName) {
                    AppStore.Instance.layoutStore.setOldLayoutName(props.oldLayoutName);
                }
                this.zIndexManager.assignIndex(DialogId.Layout);
                break;

            case DialogId.Workspace:
                this.dialogVisible.set(DialogId.FileBrowser, false);
                this.workspaceDialogMode = props.mode;
                this.zIndexManager.assignIndex(DialogId.Workspace);
                break;

            case DialogId.FileBrowser:
                this.workspaceDialogMode = WorkspaceDialogMode.Hidden;
                this.dialogVisible.set(DialogId.FileBrowser, true);
                this.zIndexManager.assignIndex(DialogId.FileBrowser);
                break;

            case DialogId.ExistingSnippet:
                if (props.snippet) {
                    SnippetStore.Instance.setActiveSnippet(props.snippet, props.name);
                }
                this.dialogVisible.set(DialogId.Snippet, true);
                this.zIndexManager.assignIndex(DialogId.Snippet);
                break;

            case DialogId.NewSnippet:
                SnippetStore.Instance.clearActiveSnippet();
                this.dialogVisible.set(DialogId.Snippet, true);
                this.zIndexManager.assignIndex(DialogId.Snippet);
                break;

            case DialogId.ExternalPage: // no one call this ??
                this.externalPageDialogUrl = props.url;
                this.externalPageDialogTitle = props.title;
                this.dialogVisible.set(DialogId.ExternalPage, true);
                this.zIndexManager.assignIndex(DialogId.ExternalPage);
                break;

            default:
                this.dialogVisible.set(id, true);
                this.zIndexManager.assignIndex(id);
                break;
        }
    };

    @action hideDialog = (id: string) => {
        if (id === DialogId.Workspace) {
            this.workspaceDialogMode = WorkspaceDialogMode.Hidden;
            this.zIndexManager.removeIndex(DialogId.Workspace);
        } else {
            this.dialogVisible.set(id, false);
            this.zIndexManager.removeIndex(id);
        }
    };

    // File Info
    @action setSelectedFileInfoDialogTab = (newId: TabId) => {
        this.selectedFileInfoDialogTab = newId;
    };
}
