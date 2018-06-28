import {action, observable} from "mobx";
import {OverlayState} from "./OverlayState";
import {LayoutState} from "./LayoutState";
import {SpatialProfileState} from "./SpatialProfileState";
import {CursorInfo} from "../models/CursorInfo";
import {BackendService} from "../services/BackendService";
import {FileBrowserState} from "./FileBrowserState";
import {FrameInfo, FrameState} from "./FrameState";
import {AlertState} from "./AlertState";
import {CARTA} from "carta-protobuf";
import * as AST from "ast_wrapper";

export class AppState {
    // Backend service
    @observable backendService: BackendService;
    // WebAssembly Module status
    @observable astReady = false;

    // Frames
    @observable frames = new Array<FrameState>();
    @observable activeFrame: number;

    // Error alerts
    @observable alertState = new AlertState();

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

    // Frame actions
    @action loadFile = (directory: string, file: string, hdu: string) => {
        this.backendService.loadFile(directory, file, hdu, 0, CARTA.RenderMode.RASTER).subscribe(ack => {
            console.log("Loaded");
            let newFrame = new FrameState();
            newFrame.frameInfo = new FrameInfo();
            newFrame.frameInfo.fileId = ack.fileId;
            newFrame.frameInfo.fileInfo = ack.fileInfo as CARTA.FileInfo;
            newFrame.frameInfo.fileInfoExtended = ack.fileInfoExtended as CARTA.FileInfoExtended;
            newFrame.frameInfo.renderMode = CARTA.RenderMode.RASTER;
            newFrame.valid = true;

            this.loadWCS(newFrame);
            if (this.frames.length) {
                this.frames[0] = newFrame;
            }
            else {
                this.frames.push(newFrame);
            }
            this.activeFrame = 0;
            this.fileBrowserState.hideFileBrowser();
        }, err => {
            this.alertState.showAlert(`Error loading file: ${err}`);
        });
    };

    @action loadWCS = (frame: FrameState) => {
        let headerString = "";

        for (let entry of frame.frameInfo.fileInfoExtended.headerEntries) {
            // Skip empty header entries
            if (!entry.value.length) {
                continue;
            }

            // Skip higher dimensions
            if (entry.name.match(/(CTYPE|CDELT|CRPIX|CRVAL|NAXIS|CROTA)[3-9]/)) {
                continue;
            }

            let value = entry.value;
            if (entry.name.toUpperCase() === "NAXIS") {
                value = "2";
            }

            let entryString = `${entry.name}  =  ${value}`;
            while (entryString.length < 80) {
                entryString += " ";
            }
            headerString += entryString;
        }
        headerString += "END";
        console.log(headerString);

        const initResult = AST.initFrame(headerString);
        if (!initResult) {
            console.error("Problem processing WCS info");
        }
        else {
            frame.wcsInfo = initResult;
            console.log("Initialised WCS info from frame");
        }
    };
}
