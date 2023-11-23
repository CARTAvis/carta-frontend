import {TabId} from "@blueprintjs/core";
import {action, makeObservable, observable} from "mobx";

import {FileInfoType} from "components";
import {WorkspaceDialogMode} from "components/Dialogs/WorkspaceDialog/WorkspaceDialogComponent";
import {FloatingObjzIndexManager, Snippet} from "models";
import {AppStore, SnippetStore} from "stores";

export enum DialogId {
    About = "about-dialog",
    CatalogQuery = "catalogQuery-dialog",
    Snippet = "code-snippet-dialog",
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
    ShareWorkspace = "shareWork-dialog"
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

    floatingObjzIndexManager = FloatingObjzIndexManager.Instance;

    // Region
    @observable regionDialogVisible: boolean;
    @action showRegionDialog = () => {
        this.regionDialogVisible = true;
        this.floatingObjzIndexManager.assignIndex(DialogId.Region, AppStore.Instance.floatingObjs);
    };
    @action hideRegionDialog = () => {
        this.regionDialogVisible = false;
        AppStore.Instance.floatingObjs = this.floatingObjzIndexManager.removeIndex(DialogId.Region, AppStore.Instance.floatingObjs);
    };

    // Hotkey
    @observable hotkeyDialogVisible: boolean;
    @action showHotkeyDialog = () => {
        this.hotkeyDialogVisible = true;
    };
    @action hideHotkeyDialog = () => {
        this.hotkeyDialogVisible = false;
    };

    // About
    @observable aboutDialogVisible: boolean;
    @action showAboutDialog = () => {
        this.aboutDialogVisible = true;
        this.floatingObjzIndexManager.assignIndex(DialogId.About, AppStore.Instance.floatingObjs);
    };
    @action hideAboutDialog = () => {
        this.aboutDialogVisible = false;
        AppStore.Instance.floatingObjs = this.floatingObjzIndexManager.removeIndex(DialogId.About, AppStore.Instance.floatingObjs);
    };

    // Preference
    @observable preferenceDialogVisible: boolean;
    @action showPreferenceDialog = () => {
        this.preferenceDialogVisible = true;
        this.floatingObjzIndexManager.assignIndex(DialogId.Preference, AppStore.Instance.floatingObjs);
    };
    @action hidePreferenceDialog = () => {
        this.preferenceDialogVisible = false;
        AppStore.Instance.floatingObjs = this.floatingObjzIndexManager.removeIndex(DialogId.Preference, AppStore.Instance.floatingObjs);
    };

    // Layout
    @observable saveLayoutDialogVisible: boolean;
    @action showSaveLayoutDialog = (oldLayoutName?: string) => {
        this.saveLayoutDialogVisible = true;
        AppStore.Instance.layoutStore.setOldLayoutName(oldLayoutName);
        this.floatingObjzIndexManager.assignIndex(DialogId.Layout, AppStore.Instance.floatingObjs);
    };
    @action hideSaveLayoutDialog = () => {
        this.saveLayoutDialogVisible = false;
        AppStore.Instance.floatingObjs = this.floatingObjzIndexManager.removeIndex(DialogId.Layout, AppStore.Instance.floatingObjs);
    };

    // Workspace
    @observable workspaceDialogMode = WorkspaceDialogMode.Hidden;
    @action showWorkspaceDialog = (mode = WorkspaceDialogMode.Save) => {
        this.fileBrowserDialogVisible = false;
        this.workspaceDialogMode = mode;
        this.floatingObjzIndexManager.assignIndex(DialogId.Workspace, AppStore.Instance.floatingObjs);
    };
    @action hideWorkspaceDialog = () => {
        this.workspaceDialogMode = WorkspaceDialogMode.Hidden;
        AppStore.Instance.floatingObjs = this.floatingObjzIndexManager.removeIndex(DialogId.Workspace, AppStore.Instance.floatingObjs);
    };

    // Workspace sharing
    @observable shareWorkspaceDialogVisible: boolean;
    @action showShareWorkspaceDialog = () => {
        this.shareWorkspaceDialogVisible = true;
        this.floatingObjzIndexManager.assignIndex(DialogId.ShareWorkspace, AppStore.Instance.floatingObjs);
    };
    @action hideShareWorkspaceDialog = () => {
        this.shareWorkspaceDialogVisible = false;
        AppStore.Instance.floatingObjs = this.floatingObjzIndexManager.removeIndex(DialogId.ShareWorkspace, AppStore.Instance.floatingObjs);
    };

    // File Browser
    @observable fileBrowserDialogVisible: boolean = false;
    @action showFileBrowserDialog = () => {
        this.workspaceDialogMode = WorkspaceDialogMode.Hidden;
        this.fileBrowserDialogVisible = true;
        this.floatingObjzIndexManager.assignIndex(DialogId.FileBrowser, AppStore.Instance.floatingObjs);
    };
    @action hideFileBrowserDialog = () => {
        this.fileBrowserDialogVisible = false;
        AppStore.Instance.floatingObjs = this.floatingObjzIndexManager.removeIndex(DialogId.FileBrowser, AppStore.Instance.floatingObjs);
    };

    // File Info
    @observable fileInfoDialogVisible: boolean = false;
    @observable selectedFileInfoDialogTab: TabId = FileInfoType.IMAGE_HEADER;
    @action showFileInfoDialog = () => {
        this.fileInfoDialogVisible = true;
        this.floatingObjzIndexManager.assignIndex(DialogId.FileInfo, AppStore.Instance.floatingObjs);
    };
    @action hideFileInfoDialog = () => {
        this.fileInfoDialogVisible = false;
        AppStore.Instance.floatingObjs = this.floatingObjzIndexManager.removeIndex(DialogId.FileInfo, AppStore.Instance.floatingObjs);
    };
    @action setSelectedFileInfoDialogTab = (newId: TabId) => {
        this.selectedFileInfoDialogTab = newId;
    };

    // Contour dialog
    @observable contourDialogVisible: boolean = false;
    @action showContourDialog = () => {
        this.contourDialogVisible = true;
        this.floatingObjzIndexManager.assignIndex(DialogId.Contour, AppStore.Instance.floatingObjs);
    };
    @action hideContourDialog = () => {
        this.contourDialogVisible = false;
        AppStore.Instance.floatingObjs = this.floatingObjzIndexManager.removeIndex(DialogId.Contour, AppStore.Instance.floatingObjs);
    };

    // Vector overlay dialog
    @observable vectorOverlayDialogVisible: boolean = false;
    @action showVectorOverlayDialog = () => {
        this.vectorOverlayDialogVisible = true;
        this.floatingObjzIndexManager.assignIndex(DialogId.Vector, AppStore.Instance.floatingObjs);
    };
    @action hideVectorOverlayDialog = () => {
        this.vectorOverlayDialogVisible = false;
        AppStore.Instance.floatingObjs = this.floatingObjzIndexManager.removeIndex(DialogId.Vector, AppStore.Instance.floatingObjs);
    };

    // Code snippet dialog
    @observable codeSnippetDialogVisible: boolean = false;
    @action showExistingCodeSnippet = (snippet: Snippet, name: string) => {
        if (snippet) {
            SnippetStore.Instance.setActiveSnippet(snippet, name);
        }
        this.codeSnippetDialogVisible = true;
        this.floatingObjzIndexManager.assignIndex(DialogId.Snippet, AppStore.Instance.floatingObjs);
    };

    @action showNewCodeSnippet = () => {
        SnippetStore.Instance.clearActiveSnippet();
        this.codeSnippetDialogVisible = true;
        this.floatingObjzIndexManager.assignIndex(DialogId.Snippet, AppStore.Instance.floatingObjs);
    };

    @action showCodeSnippetDialog = () => {
        this.codeSnippetDialogVisible = true;
        this.floatingObjzIndexManager.assignIndex(DialogId.Snippet, AppStore.Instance.floatingObjs);
    };
    @action hideCodeSnippetDialog = () => {
        this.codeSnippetDialogVisible = false;
        AppStore.Instance.floatingObjs = this.floatingObjzIndexManager.removeIndex(DialogId.Snippet, AppStore.Instance.floatingObjs);
    };

    // External page dialog
    @observable externalPageDialogVisible: boolean = false;
    @observable externalPageDialogUrl: string;
    @observable externalPageDialogTitle: string;
    @action showExternalPageDialog = (url: string, title: string) => {
        this.externalPageDialogUrl = url;
        this.externalPageDialogTitle = title;
        this.externalPageDialogVisible = true;
        this.floatingObjzIndexManager.assignIndex(DialogId.ExternalPage, AppStore.Instance.floatingObjs);
    };
    @action hideExternalPageDialog = () => {
        this.externalPageDialogVisible = false;
        AppStore.Instance.floatingObjs = this.floatingObjzIndexManager.removeIndex(DialogId.ExternalPage, AppStore.Instance.floatingObjs);
    };

    // Stokes dialog
    @observable stokesDialogVisible: boolean = false;
    @action showStokesDialog = () => {
        this.stokesDialogVisible = true;
        this.floatingObjzIndexManager.assignIndex(DialogId.Stokes, AppStore.Instance.floatingObjs);
    };
    @action hideStokesDialog = () => {
        this.stokesDialogVisible = false;
        AppStore.Instance.floatingObjs = this.floatingObjzIndexManager.removeIndex(DialogId.Stokes, AppStore.Instance.floatingObjs);
    };

    // Catalog query dialog
    @observable catalogQueryDialogVisible: boolean = false;
    @action showCatalogQueryDialog = () => {
        this.catalogQueryDialogVisible = true;
        this.floatingObjzIndexManager.assignIndex(DialogId.CatalogQuery, AppStore.Instance.floatingObjs);
    };
    @action hideCatalogQueryDialog = () => {
        this.catalogQueryDialogVisible = false;
        AppStore.Instance.floatingObjs = this.floatingObjzIndexManager.removeIndex(DialogId.CatalogQuery, AppStore.Instance.floatingObjs);
    };

    // Fitting dialog
    @observable fittingDialogVisible: boolean = false;
    @action showFittingDialog = () => {
        this.fittingDialogVisible = true;
        this.floatingObjzIndexManager.assignIndex(DialogId.Fitting, AppStore.Instance.floatingObjs);
    };
    @action hideFittingDialog = () => {
        this.fittingDialogVisible = false;
        AppStore.Instance.floatingObjs = this.floatingObjzIndexManager.removeIndex(DialogId.Fitting, AppStore.Instance.floatingObjs);
    };

    // Distance Measuring dialog
    @observable distanceMeasuringDialogVisible: boolean = false;
    @action showDistanceMeasuringDialog = () => {
        this.distanceMeasuringDialogVisible = true;
        this.floatingObjzIndexManager.assignIndex(DialogId.DistanceMeasure, AppStore.Instance.floatingObjs);
    };
    @action hideDistanceMeasuringDialog = () => {
        this.distanceMeasuringDialogVisible = false;
        AppStore.Instance.floatingObjs = this.floatingObjzIndexManager.removeIndex(DialogId.DistanceMeasure, AppStore.Instance.floatingObjs);
    };
}
