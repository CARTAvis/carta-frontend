import {action, observable} from "mobx";
import {OverlaySettings} from "./OverlaySettings";
import {LayoutState} from "./LayoutState";
import {SpatialProfileState} from "./SpatialProfileState";
import {CursorInfo} from "./CursorInfo";

export class AppState {
    // WebAssembly Module status
    @observable astReady = false;
    @observable wcsInfo = 0;

    // Cursor information
    @observable cursorInfo: CursorInfo;

    // Spatial profiles
    @observable spatialProfiles = new Map<number, SpatialProfileState>();

    // Overlay
    @observable overlaySettings = new OverlaySettings();

    // Layout
    @observable layoutSettings = new LayoutState();

    // Menu
    @observable overlaySettingsDialogVisible = false;

    // Menu actions
    @action showOverlaySettings = () => {
        this.overlaySettingsDialogVisible = true;
    };
    @action hideOverlaySettings = () => {
        this.overlaySettingsDialogVisible = false;
    };
}
