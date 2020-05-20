import {action, observable} from "mobx";
import {AppStore} from "stores";
import {TabId} from "@blueprintjs/core";
import {FileInfoType} from "../components";

export class DialogStore {
    private static staticInstance: DialogStore;

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
    
    // Auth
    @observable authDialogVisible: boolean = false;
    @action showAuthDialog = () => {
        this.authDialogVisible = true;
    };
    @action hideAuthDialog = () => {
        this.authDialogVisible = false;
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
    @observable selectedFileInfoDialogTab: TabId = FileInfoType.IMAGE_FILE;
    @action showFileInfoDialog = () => {
        this.fileInfoDialogVisible = true;
    };
    @action hideFileInfoDialog = () => {
        this.fileInfoDialogVisible = false;
    };
    @action setSelectedFileInfoDialogTab = (newId: TabId) => {
        this.selectedFileInfoDialogTab = newId;
    };

    // Overlay Settings
    @observable overlaySettingsDialogVisible = false;

    @action showOverlaySettings = () => {
        this.overlaySettingsDialogVisible = true;
    };

    @action hideOverlaySettings = () => {
        this.overlaySettingsDialogVisible = false;
    };

    // Contour dialog
    @observable contourDialogVisible: boolean = false;
    @action showContourDialog = () => {
        this.contourDialogVisible = true;
    };
    @action hideContourDialog = () => {
        this.contourDialogVisible = false;
    };

    // Debug execution dialog
    @observable debugExecutionDialogVisible: boolean = false;
    @action showDebugExecutionDialog = () => {
        this.debugExecutionDialogVisible = true;
    };
    @action hideDebugExecutionDialog = () => {
        this.debugExecutionDialogVisible = false;
    };
}
