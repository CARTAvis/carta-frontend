import {action, observable} from "mobx";
import {OverlaySettings} from "./OverlaySettings";
import {LayoutState} from "./LayoutState";

export class AppState {
    // WebAssembly Module status
    @observable astReady = false;

    // Overlay
    @observable overlaySettings = new OverlaySettings();

    // Layout
    @observable layoutSettings = new LayoutState();

    // Menu
    @observable overlaySettingsDialogVisible = false;

    @action showOverlaySettings = () => {
        this.overlaySettingsDialogVisible = true;
    };
    @action hideOverlaySettings = () => {
        this.overlaySettingsDialogVisible = false;
    };
}
