import {TabId} from "@blueprintjs/core";
import {action, makeObservable, observable} from "mobx";

import {FileInfoType} from "components";
import {
    AboutDialogComponent,
    CatalogQueryDialogComponent,
    CodeSnippetDialogComponent,
    ContourDialogComponent,
    DistanceMeasuringDialog,
    ExternalPageDialogComponent,
    FileBrowserDialogComponent,
    FileInfoDialogComponent,
    FittingDialogComponent,
    PreferenceDialogComponent,
    RegionDialogComponent,
    SaveLayoutDialogComponent,
    StokesDialogComponent,
    VectorOverlayDialogComponent
} from "components/Dialogs";
import {WorkspaceDialogMode} from "components/Dialogs/WorkspaceDialog/WorkspaceDialogComponent";
import {Snippet} from "models";
import {AppStore, SnippetStore} from "stores";
import {addFloatingObjzIndex, removeFloatingObjzIndex} from "utilities";

export enum WorkSpaceId {
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

    // Region
    @observable regionDialogVisible: boolean;
    @action showRegionDialog = () => {
        this.regionDialogVisible = true;
        addFloatingObjzIndex(RegionDialogComponent.DialogId);
    };
    @action hideRegionDialog = () => {
        this.regionDialogVisible = false;
        removeFloatingObjzIndex(RegionDialogComponent.DialogId);
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
        addFloatingObjzIndex(AboutDialogComponent.DialogId);
    };
    @action hideAboutDialog = () => {
        this.aboutDialogVisible = false;
        removeFloatingObjzIndex(AboutDialogComponent.DialogId);
    };

    // Preference
    @observable preferenceDialogVisible: boolean;
    @action showPreferenceDialog = () => {
        this.preferenceDialogVisible = true;
        addFloatingObjzIndex(PreferenceDialogComponent.DialogId);
    };
    @action hidePreferenceDialog = () => {
        this.preferenceDialogVisible = false;
        removeFloatingObjzIndex(PreferenceDialogComponent.DialogId);
    };

    // Layout
    @observable saveLayoutDialogVisible: boolean;
    @action showSaveLayoutDialog = (oldLayoutName?: string) => {
        this.saveLayoutDialogVisible = true;
        AppStore.Instance.layoutStore.setOldLayoutName(oldLayoutName);
        addFloatingObjzIndex(SaveLayoutDialogComponent.DialogId);
    };
    @action hideSaveLayoutDialog = () => {
        this.saveLayoutDialogVisible = false;
        removeFloatingObjzIndex(SaveLayoutDialogComponent.DialogId);
    };

    // Workspace
    @observable workspaceDialogMode = WorkspaceDialogMode.Hidden;
    @action showWorkspaceDialog = (mode = WorkspaceDialogMode.Save) => {
        this.fileBrowserDialogVisible = false;
        this.workspaceDialogMode = mode;
        addFloatingObjzIndex(WorkSpaceId.Workspace);
    };
    @action hideWorkspaceDialog = () => {
        this.workspaceDialogMode = WorkspaceDialogMode.Hidden;
        removeFloatingObjzIndex(WorkSpaceId.Workspace);
    };

    // Workspace sharing
    @observable shareWorkspaceDialogVisible: boolean;
    @action showShareWorkspaceDialog = () => {
        this.shareWorkspaceDialogVisible = true;
        addFloatingObjzIndex(WorkSpaceId.ShareWorkspace);
    };
    @action hideShareWorkspaceDialog = () => {
        this.shareWorkspaceDialogVisible = false;
        removeFloatingObjzIndex(WorkSpaceId.ShareWorkspace);
    };

    // File Browser
    @observable fileBrowserDialogVisible: boolean = false;
    @action showFileBrowserDialog = () => {
        this.workspaceDialogMode = WorkspaceDialogMode.Hidden;
        this.fileBrowserDialogVisible = true;
        addFloatingObjzIndex(FileBrowserDialogComponent.DialogId);
    };
    @action hideFileBrowserDialog = () => {
        this.fileBrowserDialogVisible = false;
        removeFloatingObjzIndex(FileBrowserDialogComponent.DialogId);
    };

    // File Info
    @observable fileInfoDialogVisible: boolean = false;
    @observable selectedFileInfoDialogTab: TabId = FileInfoType.IMAGE_HEADER;
    @action showFileInfoDialog = () => {
        this.fileInfoDialogVisible = true;
        addFloatingObjzIndex(FileInfoDialogComponent.DialogId);
    };
    @action hideFileInfoDialog = () => {
        this.fileInfoDialogVisible = false;
        removeFloatingObjzIndex(FileInfoDialogComponent.DialogId);
    };
    @action setSelectedFileInfoDialogTab = (newId: TabId) => {
        this.selectedFileInfoDialogTab = newId;
    };

    // Contour dialog
    @observable contourDialogVisible: boolean = false;
    @action showContourDialog = () => {
        this.contourDialogVisible = true;
        addFloatingObjzIndex(ContourDialogComponent.DialogId);
    };
    @action hideContourDialog = () => {
        this.contourDialogVisible = false;
        removeFloatingObjzIndex(ContourDialogComponent.DialogId);
    };

    // Vector overlay dialog
    @observable vectorOverlayDialogVisible: boolean = false;
    @action showVectorOverlayDialog = () => {
        this.vectorOverlayDialogVisible = true;
        addFloatingObjzIndex(VectorOverlayDialogComponent.DialogId);
    };
    @action hideVectorOverlayDialog = () => {
        this.vectorOverlayDialogVisible = false;
        removeFloatingObjzIndex(VectorOverlayDialogComponent.DialogId);
    };

    // Code snippet dialog
    @observable codeSnippetDialogVisible: boolean = false;
    @action showExistingCodeSnippet = (snippet: Snippet, name: string) => {
        if (snippet) {
            SnippetStore.Instance.setActiveSnippet(snippet, name);
        }
        this.codeSnippetDialogVisible = true;
        addFloatingObjzIndex(CodeSnippetDialogComponent.DialogId);
    };

    @action showNewCodeSnippet = () => {
        SnippetStore.Instance.clearActiveSnippet();
        this.codeSnippetDialogVisible = true;
        addFloatingObjzIndex(CodeSnippetDialogComponent.DialogId);
    };

    @action showCodeSnippetDialog = () => {
        this.codeSnippetDialogVisible = true;
        addFloatingObjzIndex(CodeSnippetDialogComponent.DialogId);
    };
    @action hideCodeSnippetDialog = () => {
        this.codeSnippetDialogVisible = false;
        removeFloatingObjzIndex(CodeSnippetDialogComponent.DialogId);
    };

    // External page dialog
    @observable externalPageDialogVisible: boolean = false;
    @observable externalPageDialogUrl: string;
    @observable externalPageDialogTitle: string;
    @action showExternalPageDialog = (url: string, title: string) => {
        this.externalPageDialogUrl = url;
        this.externalPageDialogTitle = title;
        this.externalPageDialogVisible = true;
        addFloatingObjzIndex(ExternalPageDialogComponent.DialogId);
    };
    @action hideExternalPageDialog = () => {
        this.externalPageDialogVisible = false;
        removeFloatingObjzIndex(ExternalPageDialogComponent.DialogId);
    };

    // Stokes dialog
    @observable stokesDialogVisible: boolean = false;
    @action showStokesDialog = () => {
        this.stokesDialogVisible = true;
        addFloatingObjzIndex(StokesDialogComponent.DialogId);
    };
    @action hideStokesDialog = () => {
        this.stokesDialogVisible = false;
        removeFloatingObjzIndex(StokesDialogComponent.DialogId);
    };

    // Catalog query dialog
    @observable catalogQueryDialogVisible: boolean = false;
    @action showCatalogQueryDialog = () => {
        this.catalogQueryDialogVisible = true;
        addFloatingObjzIndex(CatalogQueryDialogComponent.DialogId);
    };
    @action hideCatalogQueryDialog = () => {
        this.catalogQueryDialogVisible = false;
        removeFloatingObjzIndex(CatalogQueryDialogComponent.DialogId);
    };

    // Fitting dialog
    @observable fittingDialogVisible: boolean = false;
    @action showFittingDialog = () => {
        this.fittingDialogVisible = true;
        addFloatingObjzIndex(FittingDialogComponent.DialogId);
    };
    @action hideFittingDialog = () => {
        this.fittingDialogVisible = false;
        removeFloatingObjzIndex(FittingDialogComponent.DialogId);
    };

    // Distance Measuring dialog
    @observable distanceMeasuringDialogVisible: boolean = false;
    @action showDistanceMeasuringDialog = () => {
        this.distanceMeasuringDialogVisible = true;
        addFloatingObjzIndex(DistanceMeasuringDialog.DialogId);
    };
    @action hideDistanceMeasuringDialog = () => {
        this.distanceMeasuringDialogVisible = false;
        removeFloatingObjzIndex(DistanceMeasuringDialog.DialogId);
    };
}
