import {TabId} from "@blueprintjs/core";
import {action, makeObservable, observable} from "mobx";

import {FileInfoType} from "components";
import {WorkspaceDialogMode} from "components/Dialogs/WorkspaceDialog/WorkspaceDialogComponent";
import {Snippet} from "models";
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

    zIndexManager = AppStore.Instance.zIndexManager;

    // Region
    @observable regionDialogVisible: boolean;
    @action showRegionDialog = () => {
        this.regionDialogVisible = true;
        this.zIndexManager.assignIndex(DialogId.Region);
    };
    @action hideRegionDialog = () => {
        this.regionDialogVisible = false;
        this.zIndexManager.removeIndex(DialogId.Region);
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
        this.zIndexManager.assignIndex(DialogId.About);
    };
    @action hideAboutDialog = () => {
        this.aboutDialogVisible = false;
        this.zIndexManager.removeIndex(DialogId.About);
    };

    // Preference
    @observable preferenceDialogVisible: boolean;
    @action showPreferenceDialog = () => {
        this.preferenceDialogVisible = true;
        this.zIndexManager.assignIndex(DialogId.Preference);
    };
    @action hidePreferenceDialog = () => {
        this.preferenceDialogVisible = false;
        this.zIndexManager.removeIndex(DialogId.Preference);
    };

    // Layout
    @observable saveLayoutDialogVisible: boolean;
    @action showSaveLayoutDialog = (oldLayoutName?: string) => {
        this.saveLayoutDialogVisible = true;
        AppStore.Instance.layoutStore.setOldLayoutName(oldLayoutName);
        this.zIndexManager.assignIndex(DialogId.Layout);
    };
    @action hideSaveLayoutDialog = () => {
        this.saveLayoutDialogVisible = false;
        this.zIndexManager.removeIndex(DialogId.Layout);
    };

    // Workspace
    @observable workspaceDialogMode = WorkspaceDialogMode.Hidden;
    @action showWorkspaceDialog = (mode = WorkspaceDialogMode.Save) => {
        this.fileBrowserDialogVisible = false;
        this.workspaceDialogMode = mode;
        this.zIndexManager.assignIndex(DialogId.Workspace);
    };
    @action hideWorkspaceDialog = () => {
        this.workspaceDialogMode = WorkspaceDialogMode.Hidden;
        this.zIndexManager.removeIndex(DialogId.Workspace);
    };

    // Workspace sharing
    @observable shareWorkspaceDialogVisible: boolean;
    @action showShareWorkspaceDialog = () => {
        this.shareWorkspaceDialogVisible = true;
        this.zIndexManager.assignIndex(DialogId.ShareWorkspace);
    };
    @action hideShareWorkspaceDialog = () => {
        this.shareWorkspaceDialogVisible = false;
        this.zIndexManager.removeIndex(DialogId.ShareWorkspace);
    };

    // File Browser
    @observable fileBrowserDialogVisible: boolean = false;
    @action showFileBrowserDialog = () => {
        this.workspaceDialogMode = WorkspaceDialogMode.Hidden;
        this.fileBrowserDialogVisible = true;
        this.zIndexManager.assignIndex(DialogId.FileBrowser);
    };
    @action hideFileBrowserDialog = () => {
        this.fileBrowserDialogVisible = false;
        this.zIndexManager.removeIndex(DialogId.FileBrowser);
    };

    // File Info
    @observable fileInfoDialogVisible: boolean = false;
    @observable selectedFileInfoDialogTab: TabId = FileInfoType.IMAGE_HEADER;
    @action showFileInfoDialog = () => {
        this.fileInfoDialogVisible = true;
        this.zIndexManager.assignIndex(DialogId.FileInfo);
    };
    @action hideFileInfoDialog = () => {
        this.fileInfoDialogVisible = false;
        this.zIndexManager.removeIndex(DialogId.FileInfo);
    };
    @action setSelectedFileInfoDialogTab = (newId: TabId) => {
        this.selectedFileInfoDialogTab = newId;
    };

    // Contour dialog
    @observable contourDialogVisible: boolean = false;
    @action showContourDialog = () => {
        this.contourDialogVisible = true;
        this.zIndexManager.assignIndex(DialogId.Contour);
    };
    @action hideContourDialog = () => {
        this.contourDialogVisible = false;
        this.zIndexManager.removeIndex(DialogId.Contour);
    };

    // Vector overlay dialog
    @observable vectorOverlayDialogVisible: boolean = false;
    @action showVectorOverlayDialog = () => {
        this.vectorOverlayDialogVisible = true;
        this.zIndexManager.assignIndex(DialogId.Vector);
    };
    @action hideVectorOverlayDialog = () => {
        this.vectorOverlayDialogVisible = false;
        this.zIndexManager.removeIndex(DialogId.Vector);
    };

    // Code snippet dialog
    @observable codeSnippetDialogVisible: boolean = false;
    @action showExistingCodeSnippet = (snippet: Snippet, name: string) => {
        if (snippet) {
            SnippetStore.Instance.setActiveSnippet(snippet, name);
        }
        this.codeSnippetDialogVisible = true;
        this.zIndexManager.assignIndex(DialogId.Snippet);
    };

    @action showNewCodeSnippet = () => {
        SnippetStore.Instance.clearActiveSnippet();
        this.codeSnippetDialogVisible = true;
        this.zIndexManager.assignIndex(DialogId.Snippet);
    };

    @action showCodeSnippetDialog = () => {
        this.codeSnippetDialogVisible = true;
        this.zIndexManager.assignIndex(DialogId.Snippet);
    };
    @action hideCodeSnippetDialog = () => {
        this.codeSnippetDialogVisible = false;
        this.zIndexManager.removeIndex(DialogId.Snippet);
    };

    // External page dialog
    @observable externalPageDialogVisible: boolean = false;
    @observable externalPageDialogUrl: string;
    @observable externalPageDialogTitle: string;
    @action showExternalPageDialog = (url: string, title: string) => {
        this.externalPageDialogUrl = url;
        this.externalPageDialogTitle = title;
        this.externalPageDialogVisible = true;
        this.zIndexManager.assignIndex(DialogId.ExternalPage);
    };
    @action hideExternalPageDialog = () => {
        this.externalPageDialogVisible = false;
        this.zIndexManager.removeIndex(DialogId.ExternalPage);
    };

    // Stokes dialog
    @observable stokesDialogVisible: boolean = false;
    @action showStokesDialog = () => {
        this.stokesDialogVisible = true;
        this.zIndexManager.assignIndex(DialogId.Stokes);
    };
    @action hideStokesDialog = () => {
        this.stokesDialogVisible = false;
        this.zIndexManager.removeIndex(DialogId.Stokes);
    };

    // Catalog query dialog
    @observable catalogQueryDialogVisible: boolean = false;
    @action showCatalogQueryDialog = () => {
        this.catalogQueryDialogVisible = true;
        this.zIndexManager.assignIndex(DialogId.CatalogQuery);
    };
    @action hideCatalogQueryDialog = () => {
        this.catalogQueryDialogVisible = false;
        this.zIndexManager.removeIndex(DialogId.CatalogQuery);
    };

    // Fitting dialog
    @observable fittingDialogVisible: boolean = false;
    @action showFittingDialog = () => {
        this.fittingDialogVisible = true;
        this.zIndexManager.assignIndex(DialogId.Fitting);
    };
    @action hideFittingDialog = () => {
        this.fittingDialogVisible = false;
        this.zIndexManager.removeIndex(DialogId.Fitting);
    };

    // Distance Measuring dialog
    @observable distanceMeasuringDialogVisible: boolean = false;
    @action showDistanceMeasuringDialog = () => {
        this.distanceMeasuringDialogVisible = true;
        this.zIndexManager.assignIndex(DialogId.DistanceMeasure);
    };
    @action hideDistanceMeasuringDialog = () => {
        this.distanceMeasuringDialogVisible = false;
        this.zIndexManager.removeIndex(DialogId.DistanceMeasure);
    };
}
