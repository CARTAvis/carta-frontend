import {action, autorun, observable} from "mobx";
import {OverlayState} from "./OverlayState";
import {LayoutState} from "./LayoutState";
import {SpatialProfileState} from "./SpatialProfileState";
import {CursorInfo} from "../models/CursorInfo";
import {BackendService} from "../services/BackendService";
import {FileBrowserState} from "./FileBrowserState";
import {FrameInfo, FrameState, FrameView} from "./FrameState";
import {AlertState} from "./AlertState";
import {CARTA} from "carta-protobuf";
import * as AST from "ast_wrapper";
import {update} from "plotly.js";

export class AppState {
    // Backend service
    @observable backendService: BackendService;
    // WebAssembly Module status
    @observable astReady: boolean;

    // Frames
    @observable frames: FrameState[];
    @observable activeFrame: FrameState;

    // Error alerts
    @observable alertState: AlertState;

    // Cursor information
    @observable cursorInfo: CursorInfo;

    // Spatial profiles
    @observable spatialProfiles: Map<number, SpatialProfileState>;

    // Image view
    @action setImageViewDimensions = (w: number, h: number) => {
        this.overlayState.viewWidth = w;
        this.overlayState.viewHeight = h;
    };

    // Overlay
    @observable overlayState: OverlayState;

    // Layout
    @observable layoutSettings: LayoutState;

    // File Browser
    @observable fileBrowserState: FileBrowserState;

    // Additional Dialogs
    @observable urlConnectDialogVisible: boolean;
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
            let newFrame = new FrameState(this.overlayState);
            newFrame.frameInfo = new FrameInfo();
            newFrame.frameInfo.fileId = ack.fileId;
            newFrame.frameInfo.fileInfo = ack.fileInfo as CARTA.FileInfo;
            newFrame.frameInfo.fileInfoExtended = ack.fileInfoExtended as CARTA.FileInfoExtended;
            newFrame.frameInfo.renderMode = CARTA.RenderMode.RASTER;
            newFrame.fitZoom();
            newFrame.currentFrameView = {
                xMin: 0,
                xMax: 0,
                yMin: 0,
                yMax: 0,
                mip: 999
            };
            newFrame.valid = true;

            this.loadWCS(newFrame);
            if (this.frames.length) {
                this.frames[0] = newFrame;
            }
            else {
                this.frames.push(newFrame);
            }
            this.activeFrame = newFrame;
            const imageViewComponents = this.layoutSettings.layout.root.getItemsById("imageView");
            if (imageViewComponents.length) {
                imageViewComponents[0].setTitle(ack.fileInfo.name);
            }
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

            if (entry.entryType === CARTA.EntryType.STRING) {
                value = `'${value}'`;
            }

            let name = entry.name;
            while (name.length < 8) {
                name += " ";
            }

            let entryString = `${name}=  ${value}`;
            while (entryString.length < 80) {
                entryString += " ";
            }
            headerString += entryString;
        }

        const initResult = AST.initFrame(headerString);
        if (!initResult) {
            this.alertState.showAlert("Problem processing WCS info");
        }
        else {
            frame.wcsInfo = initResult;
            console.log("Initialised WCS info from frame");
        }
    };

    constructor() {
        this.backendService = new BackendService();
        this.astReady = false;
        this.spatialProfiles = new Map<number, SpatialProfileState>();
        this.frames = [];
        this.activeFrame = null;
        this.alertState = new AlertState();
        this.overlayState = new OverlayState();
        this.layoutSettings = new LayoutState();
        this.urlConnectDialogVisible = false;

        const onRequiredViewUpdated = autorun(() => {
            if (this.activeFrame) {
                // Calculate new required frame view (cropped to file size)
                const reqView = this.activeFrame.requiredFrameView;
                const currentView = this.activeFrame.currentFrameView;
                const croppedReq: FrameView = {
                    xMin: Math.max(0, reqView.xMin),
                    xMax: Math.min(this.activeFrame.frameInfo.fileInfoExtended.width, reqView.xMax),
                    yMin: Math.max(0, reqView.yMin),
                    yMax: Math.min(this.activeFrame.frameInfo.fileInfoExtended.height, reqView.yMax),
                    mip: reqView.mip
                };

                // Calculate if new data is required
                const updateRequired = (croppedReq.mip < currentView.mip) || (croppedReq.xMin < currentView.xMin || croppedReq.xMax > currentView.xMax || croppedReq.yMin < currentView.yMin || croppedReq.yMax > currentView.yMax);
                if (updateRequired) {
                    this.backendService.setImageView(0, Math.floor(croppedReq.xMin), Math.ceil(croppedReq.xMax), Math.floor(croppedReq.yMin), Math.ceil(croppedReq.yMax), croppedReq.mip);
                }
            }
        }, {delay: 16});

        this.backendService.getRasterStream().subscribe(rasterImageData => {
            if (this.activeFrame) {
                this.activeFrame.updateFromRasterData(rasterImageData);
            }
        });

    }
}
