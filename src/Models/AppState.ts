import {action, observable} from "mobx";
import {OverlaySettings} from "./OverlaySettings";

export class AppState {
    @observable astReady = false;
    @observable overlaySettings: OverlaySettings;

    @observable overlaySettingsDialogVisible = false;

    @action showOverlaySettings = () => {
        this.overlaySettingsDialogVisible = true;
    };

    @action hideOverlaySettings = () => {
        this.overlaySettingsDialogVisible = false;
    };
}