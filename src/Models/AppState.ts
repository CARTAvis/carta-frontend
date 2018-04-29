import {observable} from "mobx";
import {OverlaySettings} from "./OverlaySettings";

export class AppState {
    @observable astReady = false;
    @observable overlaySettings = new OverlaySettings();
}