import {action, observable} from "mobx";
import {OverlaySettings} from "./OverlaySettings";

export class AppState {
    @observable astReady = false;
    @observable overlaySettings: OverlaySettings;

    @observable overlaySettingsDialogVisible = true;

    @action showOverlaySettings = () => {
        this.overlaySettingsDialogVisible = true;
    };

    @action hideOverlaySettings = () => {
        this.overlaySettingsDialogVisible = false;
    };

    @action testUpdate = (val: boolean) => {
        this.overlaySettings.title.visible = val;
    }
}