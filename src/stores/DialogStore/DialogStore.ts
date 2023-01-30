import {TabId} from "@blueprintjs/core";
import {action, makeObservable,observable} from "mobx";

import {FileInfoType} from "components";
import {Snippet} from "models";
import {SnippetStore} from "stores";

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
    };
    @action hideRegionDialog = () => {
        this.regionDialogVisible = false;
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
    };
    @action hideAboutDialog = () => {
        this.aboutDialogVisible = false;
    };

    // Preference
    @observable preferenceDialogVisible: boolean;
    @action showPreferenceDialog = () => {
        this.preferenceDialogVisible = true;
    };
    @action hidePreferenceDialog = () => {
        this.preferenceDialogVisible = false;
    };

    // Layout
    @observable saveLayoutDialogVisible: boolean;
    @observable deleteLayoutDialogVisible: boolean;
    @action showSaveLayoutDialog = () => {
        this.saveLayoutDialogVisible = true;
    };
    @action hideSaveLayoutDialog = () => {
        this.saveLayoutDialogVisible = false;
    };
    @action showDeleteLayoutDialog = () => {
        this.deleteLayoutDialogVisible = true;
    };
    @action hideDeleteLayoutDialog = () => {
        this.deleteLayoutDialogVisible = false;
    };

    // File Browser
    @observable fileBrowserDialogVisible: boolean = false;
    @action showFileBrowserDialog = () => {
        this.fileBrowserDialogVisible = true;
    };
    @action hideFileBrowserDialog = () => {
        this.fileBrowserDialogVisible = false;
    };

    // File Info
    @observable fileInfoDialogVisible: boolean = false;
    @observable selectedFileInfoDialogTab: TabId = FileInfoType.IMAGE_HEADER;
    @action showFileInfoDialog = () => {
        this.fileInfoDialogVisible = true;
    };
    @action hideFileInfoDialog = () => {
        this.fileInfoDialogVisible = false;
    };
    @action setSelectedFileInfoDialogTab = (newId: TabId) => {
        this.selectedFileInfoDialogTab = newId;
    };

    // Contour dialog
    @observable contourDialogVisible: boolean = false;
    @action showContourDialog = () => {
        this.contourDialogVisible = true;
    };
    @action hideContourDialog = () => {
        this.contourDialogVisible = false;
    };

    // Vector overlay dialog
    @observable vectorOverlayDialogVisible: boolean = false;
    @action showVectorOverlayDialog = () => {
        this.vectorOverlayDialogVisible = true;
    };
    @action hideVectorOverlayDialog = () => {
        this.vectorOverlayDialogVisible = false;
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
    };
    @action hideCodeSnippetDialog = () => {
        this.codeSnippetDialogVisible = false;
    };

    // External page dialog
    @observable externalPageDialogVisible: boolean = false;
    @observable externalPageDialogUrl: string;
    @observable externalPageDialogTitle: string;
    @action showExternalPageDialog = (url: string, title: string) => {
        this.externalPageDialogUrl = url;
        this.externalPageDialogTitle = title;
        this.externalPageDialogVisible = true;
    };
    @action hideExternalPageDialog = () => {
        this.externalPageDialogVisible = false;
    };

    // Stokes dialog
    @observable stokesDialogVisible: boolean = false;
    @action showStokesDialog = () => {
        this.stokesDialogVisible = true;
    };
    @action hideStokesDialog = () => {
        this.stokesDialogVisible = false;
    };

    // Catalog query dialog
    @observable catalogQueryDialogVisible: boolean = false;
    @action showCatalogQueryDialog = () => {
        this.catalogQueryDialogVisible = true;
    };
    @action hideCatalogQueryDialog = () => {
        this.catalogQueryDialogVisible = false;
    };

    // Fitting dialog
    @observable fittingDialogVisible: boolean = false;
    @action showFittingDialog = () => {
        this.fittingDialogVisible = true;
    };
    @action hideFittingDialog = () => {
        this.fittingDialogVisible = false;
    };

    // Distance Measuring dialog
    @observable distanceMeasuringDialogVisible: boolean = false;
    @action showDistanceMeasuringDialog = () => {
        this.distanceMeasuringDialogVisible = true;
    };
    @action hideDistanceMeasuringDialog = () => {
        this.distanceMeasuringDialogVisible = false;
    };
}
