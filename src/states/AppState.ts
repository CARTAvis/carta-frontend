import {action, autorun, computed, observable} from "mobx";
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
import * as _ from "lodash";
import {LogState} from "./LogState";

export class AppState {
    // Backend service
    @observable backendService: BackendService;
    @observable compressionQuality: number;
    // WebAssembly Module status
    @observable astReady: boolean;
    // Frames
    @observable frames: FrameState[];
    @observable activeFrame: FrameState;
    // Error alerts
    @observable alertState: AlertState;
    // Logs
    @observable logState: LogState;

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
    @action loadFile = (directory: string, file: string, hdu: string, fileId: number) => {
        this.backendService.loadFile(directory, file, hdu, fileId, CARTA.RenderMode.RASTER).subscribe(ack => {
            let dimensionsString = `${ack.fileInfoExtended.width}\u00D7${ack.fileInfoExtended.height}`;
            if (ack.fileInfoExtended.dimensions > 2) {
                dimensionsString += `\u00D7${ack.fileInfoExtended.depth}`;
                if (ack.fileInfoExtended.dimensions > 3) {
                    dimensionsString += ` (${ack.fileInfoExtended.stokes} Stokes cubes)`;
                }
            }
            this.logState.addInfo(`Loaded file ${ack.fileInfo.name} with dimensions ${dimensionsString}`, ["file"]);
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

            // Place frame in frame array (replace frame with the same ID if it exists)
            const existingFrameIndex = this.frames.findIndex(f => f.frameInfo.fileId === fileId);
            if (existingFrameIndex !== -1) {
                this.frames[existingFrameIndex] = newFrame;
            }
            else {
                this.frames.push(newFrame);
            }
            this.activeFrame = newFrame;

            this.updateTitle();
            this.fileBrowserState.hideFileBrowser();
        }, err => {
            this.alertState.showAlert(`Error loading file: ${err}`);
        });
    };

    @action appendFile = (directory: string, file: string, hdu: string) => {
        const currentIdList = this.frames.map(frame => frame.frameInfo.fileId).sort();
        this.loadFile(directory, file, hdu, currentIdList.pop() + 1);
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
            this.logState.addWarning(`Problem processing WCS info in file ${frame.frameInfo.fileInfo.name}`, ["ast"]);
            frame.wcsInfo = AST.initDummyFrame();
            // Clear formatting for labels and cursor, to use image coordinates
            this.overlayState.axis[0].labelFormat = "";
            this.overlayState.axis[1].labelFormat = "";
            this.overlayState.axis[0].cursorFormat = "";
            this.overlayState.axis[1].cursorFormat = "";
        }
        else {
            frame.wcsInfo = initResult;
            frame.validWcs = true;
            // Specify degrees and single decimals for WCS info
            this.overlayState.axis[0].labelFormat = "d.1";
            this.overlayState.axis[1].labelFormat = "d.1";
            this.overlayState.axis[0].cursorFormat = "d.1";
            this.overlayState.axis[1].cursorFormat = "d.1";
            console.log("Initialised WCS info from frame");
        }
    };

    constructor() {
        this.logState = new LogState();
        this.backendService = new BackendService(this.logState);
        this.astReady = false;
        this.spatialProfiles = new Map<number, SpatialProfileState>();
        this.frames = [];
        this.activeFrame = null;
        this.alertState = new AlertState();
        this.overlayState = new OverlayState();
        this.layoutSettings = new LayoutState();
        this.urlConnectDialogVisible = false;
        this.compressionQuality = 11;

        const throttledSetView = _.throttle((view: FrameView, fileId: number) => {
            const quality = this.compressionQuality;
            this.backendService.setImageView(fileId, Math.floor(view.xMin), Math.ceil(view.xMax), Math.floor(view.yMin), Math.ceil(view.yMax), view.mip, quality);
        }, 200);

        autorun(() => {
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
                    const reqWidth = reqView.xMax - reqView.xMin;
                    const reqHeight = reqView.yMax - reqView.yMin;
                    // Add an extra padding on either side to avoid spamming backend
                    const padFraction = 0.05;
                    const paddedView = {
                        xMin: Math.max(0, reqView.xMin - padFraction * reqWidth),
                        xMax: Math.min(reqView.xMax + padFraction * reqWidth, this.activeFrame.frameInfo.fileInfoExtended.width),
                        yMin: Math.max(0, reqView.yMin - padFraction * reqHeight),
                        yMax: Math.min(reqView.yMax + padFraction * reqHeight, this.activeFrame.frameInfo.fileInfoExtended.height),
                        mip: reqView.mip
                    };
                    throttledSetView(paddedView, this.activeFrame.frameInfo.fileId);
                }
            }
        });

        this.backendService.getRasterStream().subscribe(rasterImageData => {
            const updatedFrame = this.getFrame(rasterImageData.fileId);
            if (updatedFrame) {
                updatedFrame.updateFromRasterData(rasterImageData);
            }
        });

        this.backendService.getRegionHistogramStream().subscribe(regionHistogramData => {
            if (!regionHistogramData) {
                return;
            }
            const updatedFrame = this.getFrame(regionHistogramData.fileId);
            // Update channel histograms
            if (updatedFrame && regionHistogramData.regionId === -1 && updatedFrame.stokes === regionHistogramData.stokes) {
                const channelHist = regionHistogramData.histograms.filter(hist => hist.channel === updatedFrame.channel);
                if (channelHist.length) {
                    updatedFrame.updateChannelHistogram(channelHist[0] as CARTA.Histogram);
                }
            }
        });

        autorun(() => {
            if (this.astReady) {
                this.logState.addInfo("AST library loaded", ["ast"]);
            }
        });

    }

    @computed get zfpReady() {
        return (this.backendService && this.backendService.zfpReady);
    }

    @action setActiveFrame(fileId: number) {
        const requiredFrame = this.getFrame(fileId);
        if (requiredFrame) {
            this.activeFrame = requiredFrame;
            this.updateTitle();
        }
        else {
            console.log(`Can't find required frame ${fileId}`);
        }
    }

    private getFrame(fileId: number) {
        return this.frames.find(f => f.frameInfo.fileId === fileId);
    }

    private updateTitle() {
        const imageViewComponents = this.layoutSettings.layout.root.getItemsById("imageView");
        if (imageViewComponents.length) {
            if (this.activeFrame) {
                imageViewComponents[0].setTitle(this.activeFrame.frameInfo.fileInfo.name);
            }
            else {
                imageViewComponents[0].setTitle("No image loaded");
            }
        }
    }
}
