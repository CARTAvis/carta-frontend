import {action, observable} from "mobx";
import {OverlayState} from "./OverlayState";
import {LayoutState} from "./LayoutState";
import {SpatialProfileState} from "./SpatialProfileState";
import {CursorInfo} from "../models/CursorInfo";
import {BackendService} from "../services/BackendService";
import {FileBrowserState} from "./FileBrowserState";
import {FrameState} from "./FrameState";

export class AppState {
    // Backend service
    @observable backendService: BackendService;
    // WebAssembly Module status
    @observable astReady = false;
    @observable wcsInfo = 0;

    // Frames
    @observable frames: FrameState[];
    @observable activeFrame: number;

    // Cursor information
    @observable cursorInfo: CursorInfo;

    // Spatial profiles
    @observable spatialProfiles = new Map<number, SpatialProfileState>();

    // Overlay
    @observable overlayState = new OverlayState();

    // Layout
    @observable layoutSettings = new LayoutState();

    // File Browser
    @observable fileBrowserState: FileBrowserState;

    // Additional Dialogs
    @observable urlConnectDialogVisible = false;
    @action showURLConnect = () => {
        this.urlConnectDialogVisible = true;
    };
    @action hideURLConnect = () => {
        this.urlConnectDialogVisible = false;
    };
}
