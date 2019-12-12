import * as _ from "lodash";
import * as AST from "ast_wrapper";
import {action, autorun, computed, observable, ObservableMap} from "mobx";
import {IOptionProps} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {
    AlertStore,
    AnimationMode,
    AnimationState,
    AnimatorStore,
    BrowserMode,
    CURSOR_REGION_ID,
    dayPalette,
    FileBrowserStore,
    FrameInfo,
    FrameStore,
    LayoutStore,
    LogEntry,
    LogStore,
    nightPalette,
    OverlayStore,
    PreferenceStore,
    RasterRenderType, RegionFileType,
    RegionStore,
    SpatialProfileStore,
    SpectralProfileStore,
    WidgetsStore
} from ".";
import {GetRequiredTiles} from "utilities";
import {BackendService, ConnectionStatus, TileService} from "services";
import {FrameView, Point2D, ProtobufProcessing, Theme} from "models";
import {HistogramWidgetStore, RegionWidgetStore, SpatialProfileWidgetStore, SpectralProfileWidgetStore, StatsWidgetStore, StokesAnalysisWidgetStore} from "./widgets";
import {AppToaster} from "../components/Shared";

export class AppStore {
    // Backend services
    backendService: BackendService;
    tileService: TileService;

    @observable compressionQuality: number;
    // WebAssembly Module status
    @observable astReady: boolean;
    @observable cartaComputeReady: boolean;
    // Frames
    @observable frames: FrameStore[];
    @observable activeFrame: FrameStore;
    // Animation
    @observable animatorStore: AnimatorStore;
    // Error alerts
    @observable alertStore: AlertStore;
    // Logs
    @observable logStore: LogStore;
    // User preference
    @observable preferenceStore: PreferenceStore;
    // Layouts
    @observable layoutStore: LayoutStore;

    // Profiles and region data
    @observable spatialProfiles: Map<string, SpatialProfileStore>;
    @observable spectralProfiles: Map<number, ObservableMap<number, SpectralProfileStore>>;
    @observable regionStats: Map<number, ObservableMap<number, CARTA.RegionStatsData>>;
    @observable regionHistograms: Map<number, ObservableMap<number, CARTA.IRegionHistogramData>>;

    private appContainer: HTMLElement;
    private contourWebGLContext: WebGLRenderingContext;

    public getAppContainer = (): HTMLElement => {
        return this.appContainer;
    };

    public setAppContainer = (container: HTMLElement) => {
        this.appContainer = container;
    };

    public get ContourContext() {
        return this.contourWebGLContext;
    }

    public set ContourContext(gl: WebGLRenderingContext) {
        this.contourWebGLContext = gl;
    }

    // Splash screen
    @observable splashScreenVisible: boolean = true;
    @action showSplashScreen = () => {
        this.splashScreenVisible = true;
    };
    @action hideSplashScreen = () => {
        this.splashScreenVisible = false;
    };

    // Image view
    @action setImageViewDimensions = (w: number, h: number) => {
        this.overlayStore.setViewDimension(w, h);
    };

    // Image toolbar
    @observable imageToolbarVisible: boolean;
    @action showImageToolbar = () => {
        this.imageToolbarVisible = true;
    };
    @action hideImageToolbar = () => {
        this.imageToolbarVisible = false;
    };

    // Region dialog
    @observable regionDialogVisible: boolean;
    @action showRegionDialog = () => {
        console.log(`Showing dialog for ${this.activeFrame.regionSet.selectedRegion}`);
        this.regionDialogVisible = true;
    };
    @action hideRegionDialog = () => {
        this.regionDialogVisible = false;
    };

    // Overlay
    @observable overlayStore: OverlayStore;
    // File Browser
    @observable fileBrowserStore: FileBrowserStore;

    // Hotkey dialog
    @observable hotkeyDialogVisible: boolean;
    @action showHotkeyDialog = () => {
        this.hotkeyDialogVisible = true;
    };
    @action hideHotkeyDialog = () => {
        this.hotkeyDialogVisible = false;
    };

    // About dialog
    @observable aboutDialogVisible: boolean;
    @action showAboutDialog = () => {
        this.aboutDialogVisible = true;
    };
    @action hideAboutDialog = () => {
        this.aboutDialogVisible = false;
    };

    // User preference dialog
    @observable preferenceDialogVisible: boolean;
    @action showPreferenceDialog = () => {
        this.preferenceDialogVisible = true;
    };
    @action hidePreferenceDialog = () => {
        this.preferenceDialogVisible = false;
    };

    // Layout related dialogs
    @observable saveLayoutDialogVisible: boolean;
    @observable deleteLayoutDialogVisible: boolean;
    @action showSaveLayoutDialog = () => {
        this.saveLayoutDialogVisible = true;
    };
    @action hideSaveLayoutDialog = () => {
        this.saveLayoutDialogVisible = false;
    };
    @action showDeleteLayoutDialog = () => {
        this.deleteLayoutDialogVisible = true;
    };
    @action hideDeleteLayoutDialog = () => {
        this.deleteLayoutDialogVisible = false;
    };

    // Auth dialog
    @observable authDialogVisible: boolean = false;
    @observable username: string = "";
    @action showAuthDialog = () => {
        this.authDialogVisible = true;
    };
    @action hideAuthDialog = () => {
        this.authDialogVisible = false;
    };
    @action setUsername = (username: string) => {
        this.username = username;
    };

    @action connectToServer = (socketName: string = "socket") => {
        let wsURL = `${location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}/${socketName}`;
        if (process.env.NODE_ENV === "development") {
            wsURL = process.env.REACT_APP_DEFAULT_ADDRESS ? process.env.REACT_APP_DEFAULT_ADDRESS : wsURL;
        } else {
            wsURL = process.env.REACT_APP_DEFAULT_ADDRESS_PROD ? process.env.REACT_APP_DEFAULT_ADDRESS_PROD : wsURL;
        }

        // Check for URL query parameters as a final override
        const url = new URL(window.location.href);
        const socketUrl = url.searchParams.get("socketUrl");

        if (socketUrl) {
            wsURL = socketUrl;
            console.log(`Connecting to override URL: ${wsURL}`);
        } else {
            console.log(`Connecting to default URL: ${wsURL}`);
        }

        const folderSearchParam = url.searchParams.get("folder");
        const fileSearchParam = url.searchParams.get("file");

        let connected = false;
        let autoFileLoaded = false;

        AST.onReady.then(() => {
            AST.setPalette(this.darkTheme ? nightPalette : dayPalette);
            this.astReady = true;
            if (this.backendService.connectionStatus === ConnectionStatus.ACTIVE && !autoFileLoaded && fileSearchParam) {
                this.addFrame(folderSearchParam, fileSearchParam, "", 0);
            }
        });

        this.backendService.connect(wsURL).subscribe(ack => {
            console.log(`Connected with session ID ${ack.sessionId}`);
            connected = true;
            this.logStore.addInfo(`Connected to server ${wsURL}`, ["network"]);

            if (this.astReady && fileSearchParam) {
                autoFileLoaded = true;
                this.addFrame(folderSearchParam, fileSearchParam, "", 0);
            }
            if (this.preferenceStore.autoLaunch) {
                this.fileBrowserStore.showFileBrowser(BrowserMode.File);
            }
        }, err => console.log(err));
    };

    // Tasks
    @observable taskProgress: number;
    @observable taskStartTime: number;
    @observable taskCurrentTime: number;
    @observable fileLoading: boolean;
    @observable resumingSession: boolean;

    @action restartTaskProgress = () => {
        this.taskProgress = 0;
        this.taskStartTime = performance.now();
    };

    @action updateTaskProgress = (progress: number) => {
        this.taskProgress = progress;
        this.taskCurrentTime = performance.now();
    };

    @computed get estimatedTaskRemainingTime(): number {
        if (this.taskProgress <= 0 || this.taskProgress >= 1) {
            return undefined;
        }
        const dt = this.taskCurrentTime - this.taskStartTime;
        const estimatedFinishTime = dt / this.taskProgress;
        return estimatedFinishTime - dt;
    }

    // Keyboard shortcuts
    @computed get modifierString() {
        // Modifier string for shortcut keys.
        // - OSX/iOS use '⌘'
        // - Windows/Linux uses 'Ctrl + '
        // - Browser uses 'alt +' for compatibility reasons
        if (process.env.REACT_APP_TARGET === "linux") {
            return "ctrl + ";
        } else if (process.env.REACT_APP_TARGET === "darwin") {
            return "cmd +";
        }
        return "alt + ";
    }

    // Widgets
    @observable widgetsStore: WidgetsStore;

    // Dark theme
    @computed get darkTheme(): boolean {
        return this.preferenceStore.isDarkTheme;
    }

    // Frame actions
    @computed get frameNum(): number {
        return this.frames.length;
    }

    @computed get frameNames(): IOptionProps [] {
        let names: IOptionProps [] = [];
        if (this.frameNum > 0) {
            this.frames.forEach(frame => names.push({label: frame.frameInfo.fileInfo.name, value: frame.frameInfo.fileId}));
        }
        return names;
    }

    @action addFrame = (directory: string, file: string, hdu: string, fileId: number) => {
        this.fileLoading = true;
        this.backendService.loadFile(directory, file, hdu, fileId, CARTA.RenderMode.RASTER).subscribe(ack => {
            this.fileLoading = false;
            let dimensionsString = `${ack.fileInfoExtended.width}\u00D7${ack.fileInfoExtended.height}`;
            if (ack.fileInfoExtended.dimensions > 2) {
                dimensionsString += `\u00D7${ack.fileInfoExtended.depth}`;
                if (ack.fileInfoExtended.dimensions > 3) {
                    dimensionsString += ` (${ack.fileInfoExtended.stokes} Stokes cubes)`;
                }
            }
            this.logStore.addInfo(`Loaded file ${ack.fileInfo.name} with dimensions ${dimensionsString}`, ["file"]);
            const frameInfo: FrameInfo = {
                fileId: ack.fileId,
                directory,
                hdu,
                fileInfo: new CARTA.FileInfo(ack.fileInfo),
                fileInfoExtended: new CARTA.FileInfoExtended(ack.fileInfoExtended),
                fileFeatureFlags: ack.fileFeatureFlags,
                renderMode: CARTA.RenderMode.RASTER
            };

            // Clear existing tile cache if it exists
            this.tileService.clearCompressedCache(fileId);

            let newFrame = new FrameStore(this.preferenceStore, this.overlayStore, this.logStore, frameInfo, this.backendService, this.ContourContext);

            // clear existing requirements for the frame
            this.spectralRequirements.delete(ack.fileId);
            this.spatialRequirements.delete(ack.fileId);
            this.statsRequirements.delete(ack.fileId);
            this.histogramRequirements.delete(ack.fileId);

            // Place frame in frame array (replace frame with the same ID if it exists)
            const existingFrameIndex = this.frames.findIndex(f => f.frameInfo.fileId === fileId);
            if (existingFrameIndex !== -1) {
                this.frames[existingFrameIndex].clearContours(false);
                this.frames[existingFrameIndex] = newFrame;
            } else {
                this.frames.push(newFrame);
            }
            this.setActiveFrame(newFrame.frameInfo.fileId);
            this.fileBrowserStore.hideFileBrowser();
        }, err => {
            this.alertStore.showAlert(`Error loading file: ${err}`);
            this.fileLoading = false;
        });
    };

    @action appendFile = (directory: string, file: string, hdu: string) => {
        // Stop animations playing before loading a new frame
        if (this.animatorStore.animationState === AnimationState.PLAYING) {
            this.animatorStore.stopAnimation();
        }
        const currentIdList = this.frames.map(frame => frame.frameInfo.fileId).sort((a, b) => a - b);
        const newId = currentIdList.pop() + 1;
        this.addFrame(directory, file, hdu, newId);
    };

    @action openFile = (directory: string, file: string, hdu: string) => {
        // Stop animations playing before loading a new frame
        if (this.animatorStore.animationState === AnimationState.PLAYING) {
            this.animatorStore.stopAnimation();
        }
        this.removeAllFrames();
        this.addFrame(directory, file, hdu, 0);
    };

    @action removeFrame = (fileId: number) => {
        const frame = this.frames.find(f => f.frameInfo.fileId === fileId);
        if (frame) {
            // adjust requirements for stores
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.statsWidgets, fileId);
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.histogramWidgets, fileId);
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.spectralProfileWidgets, fileId);
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.stokesAnalysisWidgets, fileId);

            if (this.backendService.closeFile(fileId)) {
                if (this.activeFrame.frameInfo.fileId === fileId) {
                    this.activeFrame = null;
                }
                frame.clearContours(false);
                this.tileService.clearCompressedCache(fileId);
                this.frames = this.frames.filter(f => f.frameInfo.fileId !== fileId);
            }
        }
    };

    @action removeAllFrames = () => {
        if (this.backendService.closeFile(-1)) {
            this.activeFrame = null;
            this.tileService.clearCompressedCache(-1);
            this.frames.forEach(frame => frame.clearContours(false));
            this.frames = [];
            // adjust requirements for stores
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.statsWidgets);
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.histogramWidgets);
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.spectralProfileWidgets);
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.stokesAnalysisWidgets);
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

    // Region file actions
    @action importRegion = (directory: string, file: string, type: CARTA.FileType) => {
        if (!this.activeFrame || !(type === CARTA.FileType.CRTF || type === CARTA.FileType.REG)) {
            AppToaster.show({icon: "warning-sign", message: `Region type not supported`, intent: "danger", timeout: 3000});
            return;
        }

        // ensure that the same frame is used in the callback, to prevent issues when the active frame changes while the region is being imported
        const frame = this.activeFrame;
        this.backendService.importRegion(directory, file, type, frame.frameInfo.fileId).subscribe(ack => {
            if (frame && ack.success && ack.regions) {
                for (const region of ack.regions) {
                    if (region.regionInfo) {
                        frame.regionSet.addExistingRegion(region.regionInfo.controlPoints as Point2D[], region.regionInfo.rotation, region.regionInfo.regionType, region.regionId);
                    }
                }
            }
            this.fileBrowserStore.hideFileBrowser();
        }, error => {
            console.error(error);
            AppToaster.show({icon: "warning-sign", message: error, intent: "danger", timeout: 3000});
        });
    };

    @action exportRegions = (directory: string, file: string, coordType: CARTA.CoordinateType, fileType: RegionFileType) => {
        const frame = this.activeFrame;
        // Prevent exporting if only the cursor region exists
        if (!frame.regionSet.regions || frame.regionSet.regions.length <= 1) {
            return;
        }

        const regionIds = frame.regionSet.regions.map(r => r.regionId).filter(id => id !== CURSOR_REGION_ID);
        this.backendService.exportRegion(directory, file, fileType, coordType, frame.frameInfo.fileId, regionIds).subscribe(() => {
            AppToaster.show({icon: "saved", message: `Exported regions for ${frame.frameInfo.fileInfo.name} using ${coordType === CARTA.CoordinateType.WORLD ? "world" : "pixel"} coordinates`, intent: "success", timeout: 3000});
            this.fileBrowserStore.hideFileBrowser();
        }, error => {
            console.error(error);
            AppToaster.show({icon: "warning-sign", message: error, intent: "danger", timeout: 3000});
        });
    };

    @action requestCubeHistogram = (fileId: number = -1) => {
        const frame = this.getFrame(fileId);
        if (frame && frame.renderConfig.cubeHistogramProgress < 1.0) {
            this.backendService.setHistogramRequirements({fileId: frame.frameInfo.fileId, regionId: -2, histograms: [{channel: -2, numBins: -1}]});
            this.restartTaskProgress();
        }
    };

    @action cancelCubeHistogramRequest = (fileId: number = -1) => {
        const frame = this.getFrame(fileId);
        if (frame && frame.renderConfig.cubeHistogramProgress < 1.0) {
            frame.renderConfig.updateCubeHistogram(null, 0);
            this.backendService.setHistogramRequirements({fileId: frame.frameInfo.fileId, regionId: -2, histograms: []});
        }
    };

    @action setDarkTheme = () => {
        this.preferenceStore.setTheme(Theme.DARK);
    };

    @action setLightTheme = () => {
        this.preferenceStore.setTheme(Theme.LIGHT);
    };

    @action toggleCursorFrozen = () => {
        if (this.activeFrame) {
            this.activeFrame.cursorFrozen = !this.activeFrame.cursorFrozen;
        }
    };

    public static readonly DEFAULT_STATS_TYPES = [CARTA.StatsType.NumPixels, CARTA.StatsType.Sum, CARTA.StatsType.Mean, CARTA.StatsType.RMS, CARTA.StatsType.Sigma, CARTA.StatsType.SumSq, CARTA.StatsType.Min, CARTA.StatsType.Max];
    private static readonly CursorThrottleTime = 200;
    private static readonly CursorThrottleTimeRotated = 100;
    private static readonly ImageThrottleTime = 200;
    private static readonly ImageChannelThrottleTime = 500;
    private static readonly RequirementsCheckInterval = 200;

    private spectralRequirements: Map<number, Map<number, CARTA.SetSpectralRequirements>>;
    private spatialRequirements: Map<number, Map<number, CARTA.SetSpatialRequirements>>;
    private statsRequirements: Map<number, Array<number>>;
    private histogramRequirements: Map<number, Array<number>>;
    private pendingHistogram: CARTA.RegionHistogramData;

    constructor() {
        this.alertStore = new AlertStore();
        this.layoutStore = new LayoutStore(this, this.alertStore);
        this.preferenceStore = new PreferenceStore(this, this.layoutStore);
        this.logStore = new LogStore();
        this.backendService = new BackendService(this.logStore, this.preferenceStore);
        this.tileService = new TileService(this.backendService, this.preferenceStore.GPUTileCache, this.preferenceStore.systemTileCache);
        this.astReady = false;
        this.cartaComputeReady = false;
        this.spatialProfiles = new Map<string, SpatialProfileStore>();
        this.spectralProfiles = new Map<number, ObservableMap<number, SpectralProfileStore>>();
        this.regionStats = new Map<number, ObservableMap<number, CARTA.RegionStatsData>>();
        this.regionHistograms = new Map<number, ObservableMap<number, CARTA.IRegionHistogramData>>();

        this.frames = [];
        this.activeFrame = null;
        this.fileBrowserStore = new FileBrowserStore(this.backendService);
        this.animatorStore = new AnimatorStore(this);
        this.overlayStore = new OverlayStore(this, this.preferenceStore);
        this.widgetsStore = new WidgetsStore(this, this.layoutStore);
        this.compressionQuality = this.preferenceStore.imageCompressionQuality;
        this.initRequirements();

        const throttledSetView = _.throttle((fileId: number, view: FrameView, quality: number) => {
            this.backendService.setImageView(fileId, Math.floor(view.xMin), Math.ceil(view.xMax), Math.floor(view.yMin), Math.ceil(view.yMax), view.mip, quality);
        }, AppStore.ImageThrottleTime);

        const throttledSetChannels = _.throttle((fileId: number, channel: number, stokes: number) => {
            const frame = this.getFrame(fileId);
            if (!frame) {
                return;
            }

            frame.channel = channel;
            frame.stokes = stokes;

            // Calculate new required frame view (cropped to file size)
            const reqView = frame.requiredFrameView;

            const croppedReq: FrameView = {
                xMin: Math.max(0, reqView.xMin),
                xMax: Math.min(frame.frameInfo.fileInfoExtended.width, reqView.xMax),
                yMin: Math.max(0, reqView.yMin),
                yMax: Math.min(frame.frameInfo.fileInfoExtended.height, reqView.yMax),
                mip: reqView.mip
            };
            const imageSize: Point2D = {x: frame.frameInfo.fileInfoExtended.width, y: frame.frameInfo.fileInfoExtended.height};
            const tiles = GetRequiredTiles(croppedReq, imageSize, {x: 256, y: 256});
            const midPointImageCoords = {x: (reqView.xMax + reqView.xMin) / 2.0, y: (reqView.yMin + reqView.yMax) / 2.0};
            // TODO: dynamic tile size
            const tileSizeFullRes = reqView.mip * 256;
            const midPointTileCoords = {x: midPointImageCoords.x / tileSizeFullRes - 0.5, y: midPointImageCoords.y / tileSizeFullRes - 0.5};
            this.tileService.requestTiles(tiles, frame.frameInfo.fileId, frame.channel, frame.stokes, midPointTileCoords, this.compressionQuality);
        }, AppStore.ImageChannelThrottleTime);

        const throttledSetCursorRotated = _.throttle(this.setCursor, AppStore.CursorThrottleTimeRotated);
        const throttledSetCursor = _.throttle(this.setCursor, AppStore.CursorThrottleTime);
        // Low-bandwidth mode
        const throttledSetCursorLowBandwidth = _.throttle(this.setCursor, AppStore.CursorThrottleTime * 2);

        // Update frame view outside of animation
        autorun(() => {
            if (this.activeFrame &&
                (this.preferenceStore.streamTilesWhileZooming || !this.activeFrame.zooming) &&
                (this.animatorStore.animationState === AnimationState.STOPPED || this.animatorStore.animationMode === AnimationMode.FRAME)) {
                // Trigger update raster view/title when switching layout
                const layout = this.layoutStore.dockedLayout;
                this.widgetsStore.updateImageWidgetTitle();

                // Calculate new required frame view (cropped to file size)
                const reqView = this.activeFrame.requiredFrameView;

                const croppedReq: FrameView = {
                    xMin: Math.max(0, reqView.xMin),
                    xMax: Math.min(this.activeFrame.frameInfo.fileInfoExtended.width, reqView.xMax),
                    yMin: Math.max(0, reqView.yMin),
                    yMax: Math.min(this.activeFrame.frameInfo.fileInfoExtended.height, reqView.yMax),
                    mip: reqView.mip
                };

                const imageSize: Point2D = {x: this.activeFrame.frameInfo.fileInfoExtended.width, y: this.activeFrame.frameInfo.fileInfoExtended.height};
                const tiles = GetRequiredTiles(croppedReq, imageSize, {x: 256, y: 256});
                const midPointImageCoords = {x: (reqView.xMax + reqView.xMin) / 2.0, y: (reqView.yMin + reqView.yMax) / 2.0};
                // TODO: dynamic tile size
                const tileSizeFullRes = reqView.mip * 256;
                const midPointTileCoords = {x: midPointImageCoords.x / tileSizeFullRes - 0.5, y: midPointImageCoords.y / tileSizeFullRes - 0.5};
                // TODO: throttle tile requests somehow
                this.tileService.requestTiles(tiles, this.activeFrame.frameInfo.fileId, this.activeFrame.channel, this.activeFrame.stokes, midPointTileCoords, this.compressionQuality);
            }
        });

        // Update frame view during animation
        autorun(() => {
            if (this.activeFrame && (this.animatorStore.animationState !== AnimationState.STOPPED && this.animatorStore.animationMode !== AnimationMode.FRAME)) {
                // Calculate new required frame view (cropped to file size)
                const reqView = this.activeFrame.requiredFrameView;

                const croppedReq: FrameView = {
                    xMin: Math.max(0, reqView.xMin),
                    xMax: Math.min(this.activeFrame.frameInfo.fileInfoExtended.width, reqView.xMax),
                    yMin: Math.max(0, reqView.yMin),
                    yMax: Math.min(this.activeFrame.frameInfo.fileInfoExtended.height, reqView.yMax),
                    mip: reqView.mip
                };
                throttledSetView(this.activeFrame.frameInfo.fileId, croppedReq, this.preferenceStore.animationCompressionQuality);
            }
        });

        // TODO: Move setChannels actions to AppStore and remove this autorun
        // Update channels when manually changed
        autorun(() => {
            if (this.activeFrame) {
                // Calculate if new data is required
                const updateRequiredChannels = this.activeFrame.requiredChannel !== this.activeFrame.channel || this.activeFrame.requiredStokes !== this.activeFrame.stokes;
                // Don't auto-update when animation is playing
                if (this.animatorStore.animationState === AnimationState.STOPPED && updateRequiredChannels) {
                    throttledSetChannels(this.activeFrame.frameInfo.fileId, this.activeFrame.requiredChannel, this.activeFrame.requiredStokes);
                }
            }
        });

        // Update cursor profiles
        autorun(() => {
            if (this.activeFrame && this.activeFrame.cursorInfo && this.activeFrame.cursorInfo.posImageSpace) {
                const pos = {x: Math.round(this.activeFrame.cursorInfo.posImageSpace.x), y: Math.round(this.activeFrame.cursorInfo.posImageSpace.y)};
                if (pos.x >= 0 && pos.x <= this.activeFrame.frameInfo.fileInfoExtended.width - 1 && pos.y >= 0 && pos.y <= this.activeFrame.frameInfo.fileInfoExtended.height - 1) {
                    if (this.preferenceStore.lowBandwidthMode) {
                        throttledSetCursorLowBandwidth(this.activeFrame.frameInfo.fileId, pos.x, pos.y);
                    } else if (this.activeFrame.frameInfo.fileFeatureFlags & CARTA.FileFeatureFlags.ROTATED_DATASET) {
                        throttledSetCursorRotated(this.activeFrame.frameInfo.fileId, pos.x, pos.y);
                    } else {
                        throttledSetCursor(this.activeFrame.frameInfo.fileId, pos.x, pos.y);
                    }
                }
            }
        });

        // Set overlay defaults from current frame
        autorun(() => {
            if (this.activeFrame) {
                this.overlayStore.setDefaultsFromAST(this.activeFrame);
            }
        });

        // Set palette if theme changes
        autorun(() => {
            AST.setPalette(this.darkTheme ? nightPalette : dayPalette);
        });

        // Update requirements every 200 ms
        setInterval(this.recalculateRequirements, AppStore.RequirementsCheckInterval);

        // Subscribe to frontend streams
        this.backendService.getSpatialProfileStream().subscribe(this.handleSpatialProfileStream);
        this.backendService.getSpectralProfileStream().subscribe(this.handleSpectralProfileStream);
        this.backendService.getRegionHistogramStream().subscribe(this.handleRegionHistogramStream);
        this.backendService.getRasterStream().subscribe(this.handleRasterImageStream);
        this.backendService.getContourStream().subscribe(this.handleContourImageStream);
        this.backendService.getErrorStream().subscribe(this.handleErrorStream);
        this.backendService.getRegionStatsStream().subscribe(this.handleRegionStatsStream);
        this.backendService.getReconnectStream().subscribe(this.handleReconnectStream);
        this.tileService.GetTileStream().subscribe(this.handleTileStream);

        // Auth and connection
        if (process.env.REACT_APP_AUTHENTICATION === "true") {
            this.authDialogVisible = true;
        } else {
            this.connectToServer();
        }

        // Splash screen mask
        autorun(() => {
            if (this.astReady && this.zfpReady && this.cartaComputeReady) {
                setTimeout(this.hideSplashScreen, 500);
            }
        });
    }

    // region Subscription handlers
    @action handleSpatialProfileStream = (spatialProfileData: CARTA.ISpatialProfileData) => {
        if (this.frames.find(frame => frame.frameInfo.fileId === spatialProfileData.fileId)) {
            const key = `${spatialProfileData.fileId}-${spatialProfileData.regionId}`;
            let profileStore = this.spatialProfiles.get(key);
            if (!profileStore) {
                profileStore = new SpatialProfileStore(spatialProfileData.fileId, spatialProfileData.regionId);
                this.spatialProfiles.set(key, profileStore);
            }
            profileStore.updateFromStream(spatialProfileData);

            // Update cursor value from profile if it matches the file and is the cursor data
            if (this.activeFrame && this.activeFrame.frameInfo.fileId === spatialProfileData.fileId && spatialProfileData.regionId === 0) {
                this.activeFrame.setCursorValue(spatialProfileData.value);
            }
        }
    };

    handleSpectralProfileStream = (spectralProfileData: CARTA.SpectralProfileData) => {
        if (this.frames.find(frame => frame.frameInfo.fileId === spectralProfileData.fileId)) {
            let frameMap = this.spectralProfiles.get(spectralProfileData.fileId);
            if (!frameMap) {
                frameMap = new ObservableMap<number, SpectralProfileStore>();
                this.spectralProfiles.set(spectralProfileData.fileId, frameMap);
            }
            let profileStore = frameMap.get(spectralProfileData.regionId);
            if (!profileStore) {
                profileStore = new SpectralProfileStore(spectralProfileData.fileId, spectralProfileData.regionId);
                frameMap.set(spectralProfileData.regionId, profileStore);
            }

            profileStore.stokes = spectralProfileData.stokes;
            for (let profile of spectralProfileData.profiles) {
                profileStore.setProfile(ProtobufProcessing.ProcessSpectralProfile(profile, spectralProfileData.progress));
            }
        }
    };

    handleRegionHistogramStream = (regionHistogramData: CARTA.RegionHistogramData) => {
        if (!regionHistogramData) {
            return;
        }

        let frameHistogramMap = this.regionHistograms.get(regionHistogramData.fileId);
        if (!frameHistogramMap) {
            frameHistogramMap = new ObservableMap<number, CARTA.IRegionHistogramData>();
            this.regionHistograms.set(regionHistogramData.fileId, frameHistogramMap);
        }

        frameHistogramMap.set(regionHistogramData.regionId, regionHistogramData);

        const updatedFrame = this.getFrame(regionHistogramData.fileId);
        if (updatedFrame && regionHistogramData.stokes === updatedFrame.requiredStokes && regionHistogramData.histograms && regionHistogramData.histograms.length) {
            if (regionHistogramData.regionId === -1) {
                // Update channel histograms
                const channelHist = regionHistogramData.histograms.find(hist => hist.channel === updatedFrame.requiredChannel);
                if (channelHist) {
                    if (!this.tileService.waitingForSync) {
                        updatedFrame.renderConfig.updateChannelHistogram(channelHist);
                    } else {
                        // Defer channel histogram update until tiles arrive
                        this.pendingHistogram = regionHistogramData;
                    }
                }
            } else if (regionHistogramData.regionId === -2) {
                // Update cube histogram if it is still required
                const cubeHist = regionHistogramData.histograms[0];
                if (cubeHist && updatedFrame.renderConfig.useCubeHistogram) {
                    updatedFrame.renderConfig.updateCubeHistogram(cubeHist, regionHistogramData.progress);
                    this.updateTaskProgress(regionHistogramData.progress);
                }
            }
        }
    };

    handleTileStream = (newTileCount: number) => {
        // Apply pending channel histogram
        if (this.pendingHistogram && this.pendingHistogram.regionId === -1 && this.pendingHistogram.histograms && this.pendingHistogram.histograms.length) {
            const updatedFrame = this.getFrame(this.pendingHistogram.fileId);
            const channelHist = this.pendingHistogram.histograms.find(hist => hist.channel === updatedFrame.requiredChannel);
            if (updatedFrame && channelHist) {
                updatedFrame.renderConfig.updateChannelHistogram(channelHist);
                this.pendingHistogram = null;
            }
        }

        // Switch to tiled rendering. TODO: ensure that the correct frame gets set to tiled
        if (this.activeFrame) {
            this.activeFrame.renderType = RasterRenderType.TILED;
        }
    };

    handleRegionStatsStream = (regionStatsData: CARTA.RegionStatsData) => {
        if (!regionStatsData) {
            return;
        }

        let frameStatsMap = this.regionStats.get(regionStatsData.fileId);
        if (!frameStatsMap) {
            frameStatsMap = new ObservableMap<number, CARTA.RegionStatsData>();
            this.regionStats.set(regionStatsData.fileId, frameStatsMap);
        }

        frameStatsMap.set(regionStatsData.regionId, regionStatsData);
    };

    handleRasterImageStream = (rasterImageData: CARTA.RasterImageData) => {
        // Only handle animation stream when in animating state, to prevent extraneous frames from being rendered
        if (this.animatorStore.animationState === AnimationState.PLAYING && this.animatorStore.animationMode !== AnimationMode.FRAME) {
            const updatedFrame = this.getFrame(rasterImageData.fileId);
            if (updatedFrame) {
                updatedFrame.updateFromRasterData(rasterImageData);
                updatedFrame.requiredChannel = rasterImageData.channel;
                updatedFrame.requiredStokes = rasterImageData.stokes;
                updatedFrame.renderType = RasterRenderType.ANIMATION;
            }
        }
    };

    handleContourImageStream = (contourImageData: CARTA.ContourImageData) => {
        const updatedFrame = this.getFrame(contourImageData.fileId);
        if (updatedFrame) {
            updatedFrame.updateFromContourData(contourImageData);
        }
    };

    handleErrorStream = (errorData: CARTA.ErrorData) => {
        if (errorData) {
            const logEntry: LogEntry = {
                level: errorData.severity,
                message: errorData.message,
                tags: errorData.tags.concat(["server-sent"]),
                title: null
            };
            this.logStore.addLog(logEntry);
        }
    };

    handleReconnectStream = () => {
        this.alertStore.showInteractiveAlert("You have reconnected to the CARTA server. Do you want to resume your session?", this.onResumeAlertClosed);
    };

    // endregion

    @action onResumeAlertClosed = (confirmed: boolean) => {
        if (!confirmed) {
            // TODO: How do we handle the situation where the user does not want to resume?
            return;
        }

        // Some things should be reset when the user reconnects
        this.animatorStore.stopAnimation();
        this.tileService.clearRequestQueue();

        const images: CARTA.IImageProperties[] = this.frames.map(frame => {
            const info = frame.frameInfo;

            const regions: CARTA.IRegionProperties[] = frame.regionSet.regions.map(region => {
                const regionInfo: CARTA.IRegionInfo = {
                    regionName: region.name,
                    regionType: region.regionType,
                    controlPoints: region.controlPoints,
                    rotation: region.rotation
                };

                return {
                    regionId: region.regionId,
                    regionInfo
                };
            });

            return {
                file: info.fileInfo.name,
                directory: info.directory,
                hdu: info.hdu,
                fileId: info.fileId,
                renderMode: info.renderMode,
                channel: frame.requiredChannel,
                stokes: frame.requiredStokes,
                regions
            };
        });

        this.resumingSession = true;

        this.backendService.resumeSession({images}).subscribe(this.onSessionResumed, err => {
            console.error(err);
            this.alertStore.showAlert("Error resuming session");
        });
    };

    @action private onSessionResumed = () => {
        console.log(`Resumed successfully`);
        // Clear requirements once session has resumed
        this.initRequirements();
        this.resumingSession = false;
        this.backendService.connectionDropped = false;
    };

    @computed get zfpReady() {
        return (this.backendService && this.backendService.zfpReady);
    }

    @action setActiveFrame(fileId: number) {
        // Disable rendering of old frame
        if (this.activeFrame && this.activeFrame.frameInfo.fileId !== fileId) {
            this.activeFrame.renderType = RasterRenderType.NONE;
        }

        const requiredFrame = this.getFrame(fileId);
        if (requiredFrame) {
            this.changeActiveFrame(requiredFrame);
        } else {
            console.log(`Can't find required frame ${fileId}`);
        }
    }

    @action setActiveFrameByIndex(index: number) {
        if (index >= 0 && this.frames.length > index) {
            this.changeActiveFrame(this.frames[index]);
        } else {
            console.log(`Invalid frame index ${index}`);
        }
    }

    private changeActiveFrame(frame: FrameStore) {
        if (frame !== this.activeFrame) {
            this.tileService.clearGPUCache();
            this.tileService.clearRequestQueue();
        }
        this.activeFrame = frame;
        this.widgetsStore.updateImageWidgetTitle();
    }

    getFrame(fileId: number) {
        if (fileId === -1) {
            return this.activeFrame;
        }
        return this.frames.find(f => f.frameInfo.fileId === fileId);
    }

    @action deleteSelectedRegion = () => {
        if (this.activeFrame && this.activeFrame.regionSet && this.activeFrame.regionSet.selectedRegion && !this.activeFrame.regionSet.selectedRegion.locked) {
            this.deleteRegion(this.activeFrame.regionSet.selectedRegion);
        }
    };

    @action deleteRegion = (region: RegionStore) => {
        if (region) {
            const frame = this.getFrame(region.fileId);
            const regionId = region.regionId;
            WidgetsStore.RemoveRegionFromRegionWidgets(this.widgetsStore.statsWidgets, region.fileId, regionId);
            WidgetsStore.RemoveRegionFromRegionWidgets(this.widgetsStore.histogramWidgets, region.fileId, regionId);
            WidgetsStore.RemoveRegionFromRegionWidgets(this.widgetsStore.spectralProfileWidgets, region.fileId, regionId);
            WidgetsStore.RemoveRegionFromRegionWidgets(this.widgetsStore.stokesAnalysisWidgets, region.fileId, regionId);
            // delete region
            if (frame) {
                frame.regionSet.deleteRegion(region);
            }
        }
    };

    @action deselectRegion = () => {
        if (this.activeFrame && this.activeFrame.regionSet) {
            this.activeFrame.regionSet.deselectRegion();
        }
    };

    private setCursor = (fileId: number, x: number, y: number) => {
        const frame = this.getFrame(fileId);
        if (frame && frame.regionSet.regions[0]) {
            frame.regionSet.regions[0].setControlPoint(0, {x, y});
        }
    };

    // region requirements calculations

    private initRequirements = () => {
        this.spectralRequirements = new Map<number, Map<number, CARTA.SetSpectralRequirements>>();
        this.spatialRequirements = new Map<number, Map<number, CARTA.SetSpatialRequirements>>();
        this.statsRequirements = new Map<number, Array<number>>();
        this.histogramRequirements = new Map<number, Array<number>>();
    };

    recalculateRequirements = () => {
        this.recalculateSpatialRequirements();
        this.recalculateSpectralRequirements();
        this.recalculateStatsRequirements();
        this.recalculateHistogramRequirements();
    };

    private recalculateStatsRequirements() {
        if (!this.activeFrame) {
            return;
        }

        const updatedRequirements = RegionWidgetStore.CalculateRequirementsArray(this.activeFrame, this.widgetsStore.statsWidgets);
        const diffList = StatsWidgetStore.DiffRequirementsArray(this.statsRequirements, updatedRequirements);
        this.statsRequirements = updatedRequirements;

        if (diffList.length) {
            for (const requirements of diffList) {
                this.backendService.setStatsRequirements(requirements);
            }
        }
    }

    private recalculateHistogramRequirements() {
        if (!this.activeFrame) {
            return;
        }

        const updatedRequirements = RegionWidgetStore.CalculateRequirementsArray(this.activeFrame, this.widgetsStore.histogramWidgets);
        const diffList = HistogramWidgetStore.DiffRequirementsArray(this.histogramRequirements, updatedRequirements);
        this.histogramRequirements = updatedRequirements;

        if (diffList.length) {
            for (const requirements of diffList) {
                this.backendService.setHistogramRequirements(requirements);
            }
        }
    }

    private recalculateSpectralRequirements() {
        if (!this.activeFrame) {
            return;
        }

        const updatedRequirements = SpectralProfileWidgetStore.CalculateRequirementsMap(this.activeFrame, this.widgetsStore.spectralProfileWidgets);
        if (this.widgetsStore.stokesAnalysisWidgets.size > 0) {
            StokesAnalysisWidgetStore.addToRequirementsMap(this.activeFrame, updatedRequirements, this.widgetsStore.stokesAnalysisWidgets);
        }
        const diffList = SpectralProfileWidgetStore.DiffSpectralRequirements(this.spectralRequirements, updatedRequirements);
        this.spectralRequirements = updatedRequirements;

        if (diffList.length) {
            diffList.forEach(requirements => this.backendService.setSpectralRequirements(requirements));
        }
    }

    private recalculateSpatialRequirements() {
        if (!this.activeFrame) {
            return;
        }

        const updatedRequirements = SpatialProfileWidgetStore.CalculateRequirementsMap(this.activeFrame, this.widgetsStore.spatialProfileWidgets);
        const diffList = SpatialProfileWidgetStore.DiffSpatialRequirements(this.spatialRequirements, updatedRequirements);
        this.spatialRequirements = updatedRequirements;

        if (diffList.length) {
            diffList.forEach(requirements => this.backendService.setSpatialRequirements(requirements));
        }
    }

    // endregion
}