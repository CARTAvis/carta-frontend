import {action, autorun, computed, observable} from "mobx";
import {OverlayStore} from "./OverlayStore";
import {LayoutStore} from "./LayoutStore";
import {SpatialProfileStore} from "./SpatialProfileStore";
import {CursorInfo} from "../models/CursorInfo";
import {BackendService} from "../services/BackendService";
import {FileBrowserStore} from "./FileBrowserStore";
import {FrameInfo, FrameStore, FrameView} from "./FrameStore";
import {AlertStore} from "./AlertStore";
import {CARTA} from "carta-protobuf";
import * as AST from "ast_wrapper";
import * as _ from "lodash";
import {LogStore} from "./LogStore";
import {FloatingWidgetStore} from "./FloatingWidgetStore";

export class AppStore {
    // Backend service
    @observable backendService: BackendService;
    @observable compressionQuality: number;
    // WebAssembly Module status
    @observable astReady: boolean;
    // Frames
    @observable frames: FrameStore[];
    @observable activeFrame: FrameStore;
    // Error alerts
    @observable alertStore: AlertStore;
    // Logs
    @observable logStore: LogStore;

    // Cursor information
    @observable cursorInfo: CursorInfo;
    // Spatial profiles
    @observable spatialProfiles: Map<number, SpatialProfileStore>;

    // Image view
    @action setImageViewDimensions = (w: number, h: number) => {
        this.overlayStore.viewWidth = w;
        this.overlayStore.viewHeight = h;
    };

    // Overlay
    @observable overlayStore: OverlayStore;
    // Layout
    @observable layoutSettings: LayoutStore;
    // File Browser
    @observable fileBrowserStore: FileBrowserStore;

    // Additional Dialogs
    @observable urlConnectDialogVisible: boolean;
    @action showURLConnect = () => {
        this.urlConnectDialogVisible = true;
    };
    @action hideURLConnect = () => {
        this.urlConnectDialogVisible = false;
    };

    // Floating Widgets
    @observable floatingWidgetStore: FloatingWidgetStore;

    // Frame actions
    @action addFrame = (directory: string, file: string, hdu: string, fileId: number) => {
        this.backendService.loadFile(directory, file, hdu, fileId, CARTA.RenderMode.RASTER).subscribe(ack => {
            let dimensionsString = `${ack.fileInfoExtended.width}\u00D7${ack.fileInfoExtended.height}`;
            if (ack.fileInfoExtended.dimensions > 2) {
                dimensionsString += `\u00D7${ack.fileInfoExtended.depth}`;
                if (ack.fileInfoExtended.dimensions > 3) {
                    dimensionsString += ` (${ack.fileInfoExtended.stokes} Stokes cubes)`;
                }
            }
            this.logStore.addInfo(`Loaded file ${ack.fileInfo.name} with dimensions ${dimensionsString}`, ["file"]);
            let newFrame = new FrameStore(this.overlayStore);
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
            this.fileBrowserStore.hideFileBrowser();
        }, err => {
            this.alertStore.showAlert(`Error loading file: ${err}`);
        });
    };

    @action appendFile = (directory: string, file: string, hdu: string) => {
        const currentIdList = this.frames.map(frame => frame.frameInfo.fileId).sort();
        this.addFrame(directory, file, hdu, currentIdList.pop() + 1);
    };

    @action openFile = (directory: string, file: string, hdu: string) => {
        this.removeAllFrames();
        this.addFrame(directory, file, hdu, 0);
    };

    @action removeFrame = (fileId: number) => {
        if (this.frames.find(f => f.frameInfo.fileId === fileId)) {
            if (this.backendService.closeFile(fileId)) {
                if (this.activeFrame.frameInfo.fileId === fileId) {
                    this.activeFrame = null;
                }
                this.frames = this.frames.filter(f => f.frameInfo.fileId !== fileId);
            }
        }
    };

    @action removeAllFrames = () => {
        if (this.backendService.closeFile(-1)) {
            this.activeFrame = null;
            this.frames = [];
        }
    };

    @action loadWCS = (frame: FrameStore) => {
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
            this.logStore.addWarning(`Problem processing WCS info in file ${frame.frameInfo.fileInfo.name}`, ["ast"]);
            frame.wcsInfo = AST.initDummyFrame();
            // Clear formatting for labels and cursor, to use image coordinates
            this.overlayStore.axis[0].labelFormat = "";
            this.overlayStore.axis[1].labelFormat = "";
            this.overlayStore.axis[0].cursorFormat = "";
            this.overlayStore.axis[1].cursorFormat = "";
        }
        else {
            frame.wcsInfo = initResult;
            frame.validWcs = true;
            // Specify degrees and single decimals for WCS info
            this.overlayStore.axis[0].labelFormat = "d.1";
            this.overlayStore.axis[1].labelFormat = "d.1";
            this.overlayStore.axis[0].cursorFormat = "d.1";
            this.overlayStore.axis[1].cursorFormat = "d.1";
            console.log("Initialised WCS info from frame");
        }
    };

    @action shiftFrame = (delta: number) => {
        if (this.activeFrame) {
            const frameIds = this.frames.map(f => f.frameInfo.fileId).sort();
            const currentIndex = frameIds.indexOf(this.activeFrame.frameInfo.fileId);
            const requiredIndex = (this.frames.length + currentIndex + delta) % this.frames.length;
            this.setActiveFrame(frameIds[requiredIndex]);
        }
    };

    @action nextFrame = () => {
        this.shiftFrame(+1);
    };

    @action prevFrame = () => {
        this.shiftFrame(-1);
    };

    constructor() {
        this.logStore = new LogStore();
        this.backendService = new BackendService(this.logStore);
        this.astReady = false;
        this.spatialProfiles = new Map<number, SpatialProfileStore>();
        this.frames = [];
        this.activeFrame = null;
        this.alertStore = new AlertStore();
        this.overlayStore = new OverlayStore();
        this.layoutSettings = new LayoutStore();
        this.floatingWidgetStore = new FloatingWidgetStore();
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
                this.logStore.addInfo("AST library loaded", ["ast"]);
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
