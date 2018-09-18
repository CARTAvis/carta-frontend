import {action, autorun, computed, observable} from "mobx";
import {OverlayStore} from "./OverlayStore";
import {LayoutStore} from "./LayoutStore";
import {SpatialProfileStore} from "./SpatialProfileStore";
import {FileBrowserStore} from "./FileBrowserStore";
import {FrameInfo, FrameStore, FrameView} from "./FrameStore";
import {AlertStore} from "./AlertStore";
import {LogEntry, LogStore} from "./LogStore";
import {FloatingWidgetStore} from "./FloatingWidgetStore";
import {BackendService} from "../services/BackendService";
import {CursorInfo} from "../models/CursorInfo";
import {CARTA} from "carta-protobuf";
import * as AST from "ast_wrapper";
import * as _ from "lodash";
import {ImageViewComponent} from "../components/ImageView/ImageViewComponent";
import {AnimationState, AnimatorStore} from "./AnimatorStore";
import SpatialProfile = CARTA.SpatialProfile;

export class AppStore {
    // Backend service
    @observable backendService: BackendService;
    @observable compressionQuality: number;
    // WebAssembly Module status
    @observable astReady: boolean;
    // Frames
    @observable frames: FrameStore[];
    @observable activeFrame: FrameStore;
    // Animation
    @observable animatorStore: AnimatorStore;
    // Error alerts
    @observable alertStore: AlertStore;
    // Logs
    @observable logStore: LogStore;

    // Cursor information
    @observable cursorInfo: CursorInfo;
    @observable cursorFrozen: boolean;
    // Spatial profiles
    @observable spatialProfiles: Map<string, SpatialProfileStore>;
    @observable spatialProfileWidgets: Map<string, { fileId: number, regionId: number, coordinate: string }>;

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
    // Dark theme
    @observable darkTheme: boolean;

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
            this.overlayStore.numbers.axis[0].format = "";
            this.overlayStore.numbers.axis[1].format = "";
        }
        else {
            frame.wcsInfo = initResult;
            frame.validWcs = true;
            // Specify degrees and single decimals for WCS info
            this.overlayStore.numbers.axis[0].format = "d.1";
            this.overlayStore.numbers.axis[1].format = "d.1";
            this.overlayStore.labels.axis[0].text = AST.getString(frame.wcsInfo, "Label(1)");
            this.overlayStore.labels.axis[1].text = AST.getString(frame.wcsInfo, "Label(2)");
            console.log("Initialised WCS info from frame");
        }
    };
    @action shiftFrame = (delta: number) => {
        if (this.activeFrame && this.frames.length > 1) {
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

    @action setDarkTheme = () => {
        this.darkTheme = true;
    };

    @action setLightTheme =  () => {
        this.darkTheme = false;
    };

    @action setCursorInfo = (cursorInfo: CursorInfo) => {
        this.cursorInfo = cursorInfo;
    };

    @action setCursorFrozen = (frozen: boolean) => {
        this.cursorFrozen = frozen;
    };

    @action toggleCursorFrozen = () => {
        this.cursorFrozen = !this.cursorFrozen;
    };

    constructor() {
        this.logStore = new LogStore();
        this.backendService = new BackendService(this.logStore);
        this.astReady = false;
        this.spatialProfiles = new Map<string, SpatialProfileStore>();
        this.spatialProfileWidgets = new Map<string, { fileId: number, regionId: number, coordinate: string }>();
        this.frames = [];
        this.activeFrame = null;
        this.animatorStore = new AnimatorStore(this);
        this.alertStore = new AlertStore();
        this.overlayStore = new OverlayStore();
        this.layoutSettings = new LayoutStore();
        this.floatingWidgetStore = new FloatingWidgetStore();
        this.urlConnectDialogVisible = false;
        this.compressionQuality = 11;
        this.darkTheme = false;

        const throttledSetView = _.throttle((fileId: number, view: FrameView) => {
            const quality = this.compressionQuality;
            this.backendService.setImageView(fileId, Math.floor(view.xMin), Math.ceil(view.xMax), Math.floor(view.yMin), Math.ceil(view.yMax), view.mip, quality);
        }, 200);

        const throttledSetChannels = _.throttle((fileId: number, channel: number, stokes: number) => {
            this.backendService.setChannels(fileId, channel, stokes);
        }, 200);

        const debouncedSetCursor = _.debounce((fileId: number, x: number, y: number) => {
            this.backendService.setCursor(fileId, x, y);
        }, 200);

        // Update frame view
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
                const updateRequiredChannels = this.activeFrame.requiredChannel !== this.activeFrame.channel || this.activeFrame.requiredStokes !== this.activeFrame.stokes;
                // Don't auto-update when animation is playing
                if (this.animatorStore.animationState === AnimationState.STOPPED && updateRequiredChannels) {
                    throttledSetChannels(this.activeFrame.frameInfo.fileId, this.activeFrame.requiredChannel, this.activeFrame.requiredStokes);
                }

                const updateRequiredView = (croppedReq.mip < currentView.mip) || (croppedReq.xMin < currentView.xMin || croppedReq.xMax > currentView.xMax || croppedReq.yMin < currentView.yMin || croppedReq.yMax > currentView.yMax);
                if (updateRequiredView) {
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
                    throttledSetView(this.activeFrame.frameInfo.fileId, paddedView);
                }
            }
        });

        // Update cursor profiles
        autorun(() => {
            if (this.activeFrame && this.cursorInfo && this.cursorInfo.posImageSpace) {
                const pos = this.cursorInfo.posImageSpace;
                if (pos.x >= 0 && pos.x <= this.activeFrame.frameInfo.fileInfoExtended.width - 1 && pos.y >= 0 && pos.y < this.activeFrame.frameInfo.fileInfoExtended.height - 1) {
                    debouncedSetCursor(this.activeFrame.frameInfo.fileId, pos.x, pos.y);

                    let keyStruct = {fileId: this.activeFrame.frameInfo.fileId, regionId: 0};
                    const key = `${keyStruct.fileId}-${keyStruct.regionId}`;
                    const profileStore = this.spatialProfiles.get(key);
                    if (profileStore) {
                        profileStore.x = pos.x;
                        profileStore.y = pos.y;
                        profileStore.approximate = true;
                    }
                }
            }
        }, {delay: 33});

        // Set spatial requirements of cursor region on file load
        autorun(() => {
            if (this.activeFrame) {
                this.backendService.setSpatialRequirements(this.activeFrame.frameInfo.fileId, 0, ["x", "y"]);
            }
        });

        // Subscribe to the spatial profile data stream
        this.backendService.getSpatialProfileStream().subscribe(spatialProfileData => {
            if (this.frames.find(frame => frame.frameInfo.fileId === spatialProfileData.fileId)) {
                const key = `${spatialProfileData.fileId}-${spatialProfileData.regionId}`;
                let profileStore = this.spatialProfiles.get(key);
                if (!profileStore) {
                    profileStore = new SpatialProfileStore(spatialProfileData.fileId, spatialProfileData.regionId);
                    this.spatialProfiles.set(key, profileStore);
                }

                profileStore.channel = spatialProfileData.channel;
                profileStore.stokes = spatialProfileData.stokes;
                profileStore.x = spatialProfileData.x;
                profileStore.y = spatialProfileData.y;
                profileStore.approximate = false;
                const profileMap = new Map<string, CARTA.SpatialProfile>();
                for (let profile of spatialProfileData.profiles) {
                    profileMap.set(profile.coordinate, profile as SpatialProfile);
                }
                profileStore.setProfiles(profileMap);
            }
        });

        this.backendService.getRasterStream().subscribe(rasterImageData => {
            const updatedFrame = this.getFrame(rasterImageData.fileId);
            if (updatedFrame) {
                updatedFrame.updateFromRasterData(rasterImageData);
                if (this.animatorStore.animationState === AnimationState.PLAYING) {
                    this.animatorStore.removeFromRequestQueue(updatedFrame.channel, updatedFrame.stokes);
                }
                // if there's a valid channel histogram bundled into the message, update it
                if (rasterImageData.channelHistogramData) {
                    // Update channel histograms
                    if (rasterImageData.channelHistogramData.regionId === -1) {
                        const channelHist = rasterImageData.channelHistogramData.histograms.find(hist => hist.channel === updatedFrame.requiredChannel);
                        if (channelHist) {
                            updatedFrame.updateChannelHistogram(channelHist as CARTA.Histogram);
                        }
                    }
                }
            }
        });

        this.backendService.getRegionHistogramStream().subscribe(regionHistogramData => {
            if (!regionHistogramData) {
                return;
            }
            const updatedFrame = this.getFrame(regionHistogramData.fileId);
            // Update channel histograms
            if (updatedFrame && regionHistogramData.regionId === -1 && regionHistogramData.stokes === updatedFrame.requiredStokes) {
                const channelHist = regionHistogramData.histograms.find(hist => hist.channel === updatedFrame.requiredChannel);
                if (channelHist) {
                    updatedFrame.updateChannelHistogram(channelHist as CARTA.Histogram);
                }
            }
        });

        this.backendService.getErrorStream().subscribe(errorData => {
            if (!errorData) {
                return;
            }
            const logEntry: LogEntry = {
                level: errorData.severity,
                message: errorData.message,
                tags: errorData.tags.concat(["server-sent"]),
                title: null
            };

            this.logStore.addLog(logEntry);
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

    @action addSpatialProfileWidget(id: string, fileId: number, regionId: number, coordinate: string) {
        this.spatialProfileWidgets.set(id, {fileId, regionId, coordinate});
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

    @action setActiveFrameByIndex(index: number) {
        if (index >= 0 && this.frames.length > index) {
            this.activeFrame = this.frames[index];
            this.updateTitle();
        }
        else {
            console.log(`Invalid frame index ${index}`);
        }
    }

    private getFrame(fileId: number) {
        return this.frames.find(f => f.frameInfo.fileId === fileId);
    }

    private updateTitle() {
        let newTitle;
        if (this.activeFrame) {
            newTitle = this.activeFrame.frameInfo.fileInfo.name;
        }
        else {
            newTitle = "No image loaded";
        }

        // Update GL title by searching for image-view components
        const imageViewComponents = this.layoutSettings.layout.root.getItemsByFilter((item: any) => item.config.component === ImageViewComponent.WIDGET_CONFIG.type);
        if (imageViewComponents.length) {
            imageViewComponents[0].setTitle(newTitle);
        }

        // Update floating window title
        const imageViewWidget = this.floatingWidgetStore.widgets.find(w => w.type === ImageViewComponent.WIDGET_CONFIG.type);
        if (imageViewWidget) {
            this.floatingWidgetStore.setWidgetTitle(imageViewWidget.id, newTitle);
        }
    }
}
