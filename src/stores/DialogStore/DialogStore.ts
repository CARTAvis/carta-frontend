import {TabId} from "@blueprintjs/core";
import {action, makeObservable, observable} from "mobx";

import {FileInfoType} from "components";
import {WorkspaceDialogMode} from "components/Dialogs/WorkspaceDialog/WorkspaceDialogComponent";
import {Snippet} from "models";
import {AppStore, SnippetStore, WidgetsStore} from "stores";

interface ZIndexUpdate {
    id: string;
    zIndex: number;
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

    // dynamic zIndex
    private addDialog = (id: string) => {
        const appStore = AppStore.Instance;
        let zIndexNew = appStore.floatingObjs.length + 1;
        let zIndexUpdate : ZIndexUpdate  = { id: id, zIndex: zIndexNew };
        appStore.floatingObjs.push(zIndexUpdate);
    }

    private removeDialog = (id: string) => {
        const appStore = AppStore.Instance;
        appStore.floatingObjs = appStore.floatingObjs.filter(w => w.id !== id);
    }

    @action updateSelectDialogzIndex = (id: string) => {
        const appStore = AppStore.Instance;
        const selectedObjIndex = appStore.floatingObjs.findIndex(w => w.id === id);
        const selectedObj = appStore.floatingObjs[selectedObjIndex];
        const NFloatingObj = appStore.floatingObjs.length;
        if (NFloatingObj > 1 && selectedObjIndex >= 0 && selectedObj.zIndex < NFloatingObj) {
            for (let i = 0; i < NFloatingObj; i++) {
                let currentObjzIndex = appStore.floatingObjs[i].zIndex;
                if (currentObjzIndex >= selectedObj.zIndex) {
                    appStore.floatingObjs[i].zIndex = currentObjzIndex - 1;
                }
            }
            appStore.floatingObjs[selectedObjIndex].zIndex = appStore.floatingObjs.length;
        }
        console.log('gg');
        appStore.floatingObjs.map(w => console.log(w.id, w.zIndex));
        // update floatingWidget's zIndex 
        const floatingWidgets = WidgetsStore.Instance.floatingWidgets;
        const N = floatingWidgets.length;
        if (N >= 1) {
            for (let i = 0; i < N; i++) {
                let counterpartId = appStore.floatingObjs.findIndex(w => w.id === floatingWidgets[i].id);
                floatingWidgets[i].zIndex = appStore.floatingObjs[counterpartId].zIndex;
            }
        }        
    };

    @action updateDialogzIndexOnRemove(dialogzIndex: number) {
        const appStore = AppStore.Instance;
        const NFloatingObj = appStore.floatingObjs.length;
        if (dialogzIndex < NFloatingObj) {
            for (let index = 0; index < NFloatingObj; index++) {
                const zIndex = appStore.floatingObjs[index].zIndex;
                if (zIndex > dialogzIndex) {
                    appStore.floatingObjs[index].zIndex = zIndex - 1;
                }
            }
        }
        // update floatingWidget's zIndex
        const floatingWidgets = WidgetsStore.Instance.floatingWidgets;
        const N = floatingWidgets.length;
        if (N >= 1) {
            for (let i = 0; i < N; i++) {
                let counterpartId = appStore.floatingObjs.findIndex(w => w.id === floatingWidgets[i].id);
                floatingWidgets[i].zIndex = appStore.floatingObjs[counterpartId].zIndex;
            }
        }
    }

    // Region
    @observable regionDialogVisible: boolean;
    @action showRegionDialog = () => {
        this.regionDialogVisible = true;
        this.addDialog("region-dialog");
    };
    @action hideRegionDialog = () => {
        this.regionDialogVisible = false;
        this.removeDialog("region-dialog");
    };

    // Hotkey
    @observable hotkeyDialogVisible: boolean;
    @action showHotkeyDialog = () => {
        this.hotkeyDialogVisible = true;
        this.addDialog("hotkey-dialog");
    };
    @action hideHotkeyDialog = () => {
        this.hotkeyDialogVisible = false;
        this.removeDialog("hotkey-dialog");
    };

    // About
    @observable aboutDialogVisible: boolean;
    @action showAboutDialog = () => {
        this.aboutDialogVisible = true;
        this.addDialog("about-dialog");
    };
    @action hideAboutDialog = () => {
        this.aboutDialogVisible = false;
        this.removeDialog("about-dialog");
    };

    // Preference
    @observable preferenceDialogVisible: boolean;
    @action showPreferenceDialog = () => {
        this.preferenceDialogVisible = true;
        this.addDialog("preference-dialog");
    };
    @action hidePreferenceDialog = () => {
        this.preferenceDialogVisible = false;
        this.removeDialog("preference-dialog");
    };

    // Layout
    @observable saveLayoutDialogVisible: boolean;
    @action showSaveLayoutDialog = (oldLayoutName?: string) => {
        this.saveLayoutDialogVisible = true;
        AppStore.Instance.layoutStore.setOldLayoutName(oldLayoutName);
        this.addDialog("saveLayout-dialog");
    };
    @action hideSaveLayoutDialog = () => {
        this.saveLayoutDialogVisible = false;
        this.removeDialog("saveLayout-dialog");
    };

    // Workspace
    @observable workspaceDialogMode = WorkspaceDialogMode.Hidden;
    @action showWorkspaceDialog = (mode = WorkspaceDialogMode.Save) => {
        this.fileBrowserDialogVisible = false;
        this.workspaceDialogMode = mode;
        this.addDialog("workspace-dialog");
    };
    @action hideWorkspaceDialog = () => {
        this.workspaceDialogMode = WorkspaceDialogMode.Hidden;
        this.removeDialog("workspace-dialog");
    };

    // Workspace sharing
    @observable shareWorkspaceDialogVisible: boolean;
    @action showShareWorkspaceDialog = () => {
        this.shareWorkspaceDialogVisible = true;
        this.addDialog("shareWork-dialog");
    };
    @action hideShareWorkspaceDialog = () => {
        this.shareWorkspaceDialogVisible = false;
        this.removeDialog("shareWork-dialog");
    };

    // File Browser
    @observable fileBrowserDialogVisible: boolean = false;
    @action showFileBrowserDialog = () => {
        this.workspaceDialogMode = WorkspaceDialogMode.Hidden;
        this.fileBrowserDialogVisible = true;
        this.addDialog("fileBrowser-dialog");
    };
    @action hideFileBrowserDialog = () => {
        this.fileBrowserDialogVisible = false;
        this.removeDialog("fileBrowser-dialog");
    };

    // File Info
    @observable fileInfoDialogVisible: boolean = false;
    @observable selectedFileInfoDialogTab: TabId = FileInfoType.IMAGE_HEADER;
    @action showFileInfoDialog = () => {
        this.fileInfoDialogVisible = true;
        this.addDialog("fileInfo-dialog");
    };
    @action hideFileInfoDialog = () => {
        this.fileInfoDialogVisible = false;
        this.removeDialog("fileInfo-dialog");
    };
    @action setSelectedFileInfoDialogTab = (newId: TabId) => {
        this.selectedFileInfoDialogTab = newId;
    };

    // Contour dialog
    @observable contourDialogVisible: boolean = false;
    @action showContourDialog = () => {
        this.contourDialogVisible = true;
        this.addDialog("contour-dialog");
    };
    @action hideContourDialog = () => {
        this.contourDialogVisible = false;
        this.removeDialog("contour-dialog");
    };

    // Vector overlay dialog
    @observable vectorOverlayDialogVisible: boolean = false;
    @action showVectorOverlayDialog = () => {
        this.vectorOverlayDialogVisible = true;
        this.addDialog("vector-dialog");
    };
    @action hideVectorOverlayDialog = () => {
        this.vectorOverlayDialogVisible = false;
        this.removeDialog("vector-dialog");
    };

    // Code snippet dialog
    @observable codeSnippetDialogVisible: boolean = false;
    @action showExistingCodeSnippet = (snippet: Snippet, name: string) => {
        if (snippet) {
            SnippetStore.Instance.setActiveSnippet(snippet, name);
        }
        this.codeSnippetDialogVisible = true;
    };

    @action showNewCodeSnippet = () => {
        SnippetStore.Instance.clearActiveSnippet();
        this.codeSnippetDialogVisible = true;
    };

    @action showCodeSnippetDialog = () => {
        this.codeSnippetDialogVisible = true;
        this.addDialog("code-snippet-dialog");
    };
    @action hideCodeSnippetDialog = () => {
        this.codeSnippetDialogVisible = false;
        this.removeDialog("code-snippet-dialog");
    };

    // External page dialog
    @observable externalPageDialogVisible: boolean = false;
    @observable externalPageDialogUrl: string;
    @observable externalPageDialogTitle: string;
    @action showExternalPageDialog = (url: string, title: string) => {
        this.externalPageDialogUrl = url;
        this.externalPageDialogTitle = title;
        this.externalPageDialogVisible = true;
        this.addDialog("externalPage-dialog");
    };
    @action hideExternalPageDialog = () => {
        this.externalPageDialogVisible = false;
        this.removeDialog("externalPage-dialog");
    };

    // Stokes dialog
    @observable stokesDialogVisible: boolean = false;
    @action showStokesDialog = () => {
        this.stokesDialogVisible = true;
        this.addDialog("stokes-dialog");
    };
    @action hideStokesDialog = () => {
        this.stokesDialogVisible = false;
        this.removeDialog("stokes-dialog");
    };

    // Catalog query dialog
    @observable catalogQueryDialogVisible: boolean = false;
    @action showCatalogQueryDialog = () => {
        this.catalogQueryDialogVisible = true;
        this.addDialog("catalogQuery-dialog");
    };
    @action hideCatalogQueryDialog = () => {
        this.catalogQueryDialogVisible = false;
        this.removeDialog("catalogQuery-dialog");
    };

    // Fitting dialog
    @observable fittingDialogVisible: boolean = false;
    @action showFittingDialog = () => {
        this.fittingDialogVisible = true;
        this.addDialog("fitting-dialog");
    };
    @action hideFittingDialog = () => {
        this.fittingDialogVisible = false;
        this.removeDialog("fitting-dialog");
    };

    // Distance Measuring dialog
    @observable distanceMeasuringDialogVisible: boolean = false;
    @action showDistanceMeasuringDialog = () => {
        this.distanceMeasuringDialogVisible = true;
        this.addDialog("distanceMeasure-dialog");
    };
    @action hideDistanceMeasuringDialog = () => {
        this.distanceMeasuringDialogVisible = false;
        this.removeDialog("distanceMeasure-dialog");
    };
}
