import {action, observable} from "mobx";
import {AppStore} from "stores";

export class DialogStore {
    private readonly appStore: AppStore;
    
    // Region
    @observable regionDialogVisible: boolean;
    @action showRegionDialog = () => {
        console.log(`Showing dialog for ${this.appStore.activeFrame.regionSet.selectedRegion}`);
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

    constructor(appStore: AppStore) {
        this.appStore = appStore;
    }

}
