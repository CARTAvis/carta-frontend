import * as _ from "lodash";
import * as AST from "ast_wrapper";
import * as Long from "long";
import {action, autorun, computed, observable, ObservableMap} from "mobx";
import {IOptionProps} from "@blueprintjs/core";
import {Utils} from "@blueprintjs/table";
import {CARTA} from "carta-protobuf";
import {
    AlertStore,
    AnimationMode,
    AnimationState,
    AnimatorStore,
    BrowserMode,
    CURSOR_REGION_ID,
    dayPalette,
    DialogStore,
    FileBrowserStore,
    FrameInfo,
    FrameStore,
    LayoutStore,
    LogEntry,
    LogStore,
    nightPalette,
    OverlayStore,
    PreferenceKeys,
    PreferenceStore,
    RasterRenderType,
    RegionFileType,
    RegionStore,
    SpatialProfileStore,
    SpectralProfileStore,
    WidgetsStore,
    HelpStore
} from ".";
import {GetRequiredTiles} from "utilities";
import {BackendService, ConnectionStatus, TileService, TileStreamDetails} from "services";
import {FrameView, Point2D, ProtobufProcessing, Theme, TileCoordinate} from "models";
import {HistogramWidgetStore, RegionWidgetStore, SpatialProfileWidgetStore, SpectralProfileWidgetStore, StatsWidgetStore, StokesAnalysisWidgetStore} from "./widgets";
import {AppToaster} from "../components/Shared";
import {Subject} from "rxjs";

export class AppStore {
    // Backend services
    backendService: BackendService;
    tileService: TileService;

    // WebAssembly Module status
    @observable astReady: boolean;
    @observable cartaComputeReady: boolean;
    // Frames
    @observable frames: FrameStore[];
    @observable activeFrame: FrameStore;
    // Animation
    @observable animatorStore: AnimatorStore;
    // Error alerts
    readonly alertStore: AlertStore;
    // Logs
    readonly logStore: LogStore;
    // User preference
    @observable preferenceStore: PreferenceStore;
    // Layouts
    readonly layoutStore: LayoutStore;
    // Dialogs
    readonly dialogStore: DialogStore;
    // Overlay
    readonly overlayStore: OverlayStore;
    // File Browser
    readonly fileBrowserStore: FileBrowserStore;
    // Widgets
    readonly widgetsStore: WidgetsStore;
    // Help
    @observable helpStore: HelpStore;

    // Profiles and region data
    @observable spatialProfiles: Map<string, SpatialProfileStore>;
    @observable spectralProfiles: Map<number, ObservableMap<number, SpectralProfileStore>>;
    @observable regionStats: Map<number, ObservableMap<number, CARTA.RegionStatsData>>;
    @observable regionHistograms: Map<number, ObservableMap<number, CARTA.IRegionHistogramData>>;

    // Spatial WCS reference
    @observable spatialReference: FrameStore;

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

    // Auth
    @observable username: string = "";
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

            // Init layout/preference store after connection is built
            const supportsServerLayout = ack.serverFeatureFlags & CARTA.ServerFeatureFlags.USER_LAYOUTS ? true : false;
            this.layoutStore.initUserDefinedLayouts(supportsServerLayout, ack.userLayouts);
            const supportsServerPreference = ack.serverFeatureFlags & CARTA.ServerFeatureFlags.USER_PREFERENCES ? true : false;
            this.preferenceStore.initUserDefinedPreferences(supportsServerPreference, ack.userPreferences);
            this.tileService.setCache(this.preferenceStore.gpuTileCache, this.preferenceStore.systemTileCache);
            this.layoutStore.applyLayout(this.preferenceStore.layout);

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

    // Dark theme
    @computed get darkTheme(): boolean {
        return this.preferenceStore.isDarkTheme;
    }

    // Frame actions
    @computed get activeFrameIndex(): number {
        if (!this.activeFrame) {
            return -1;
        }
        return this.frames.findIndex((frame) => frame.frameInfo.fileId === this.activeFrame.frameInfo.fileId);
    }

    @computed get frameNum(): number {
        return this.frames.length;
    }

    @computed get frameNames(): IOptionProps [] {
        let names: IOptionProps [] = [];
        this.frames.forEach(frame => names.push({label: frame.frameInfo.fileInfo.name, value: frame.frameInfo.fileId}));
        return names;
    }

    @computed get frameChannels(): number [] {
        return this.frames.map(frame => frame.channel);
    }

    @computed get frameStokes(): number [] {
        return this.frames.map(frame => frame.stokes);
    }

    @computed get spatialGroup(): FrameStore[] {
        if (!this.frames || !this.frames.length || !this.activeFrame) {
            return [];
        }

        const activeGroupFrames = [];
        for (const frame of this.frames) {
            const groupMember = (frame === this.activeFrame)                                                 // Frame is active
                || (frame === this.activeFrame.spatialReference)                                             // Frame is the active frame's reference
                || (frame.spatialReference === this.activeFrame)                                             // Frame is a secondary image of the active frame
                || (frame.spatialReference && frame.spatialReference === this.activeFrame.spatialReference); // Frame has the same reference as the active frame

            if (groupMember) {
                activeGroupFrames.push(frame);
            }
        }

        return activeGroupFrames;
    }

    @computed get contourFrames(): FrameStore[] {
        return this.spatialGroup.filter(f => f.contourConfig.enabled && f.contourConfig.visible);
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

            // First image defaults to spatial reference
            if (this.frames.length === 1) {
                this.setSpatialReference(this.frames[0]);
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

    @action closeCurrentFile = (confirmClose: boolean = true) => {
        // Display confirmation if image has secondary images
        if (confirmClose && this.activeFrame && this.activeFrame.secondaryImages && this.activeFrame.secondaryImages.length) {
            const numSecondaries = this.activeFrame.secondaryImages.length;
            this.alertStore.showInteractiveAlert(
                `${numSecondaries} image${numSecondaries > 1 ? "s that are" : " that is"} spatially matched to this image will be unmatched and regions will be removed.`,
                (confirmed => {
                    if (confirmed) {
                        this.removeFrame(this.activeFrame);
                    }
                }));
        } else {
            this.removeFrame(this.activeFrame);
        }
    };

    @action removeFrame = (frame: FrameStore) => {
        if (frame) {
            // Unlink any associated secondary images
            if (frame.secondaryImages) {
                // Create a copy of the array, since clearing the spatial reference will modify it
                const secondaryImages = frame.secondaryImages.slice();
                for (const f of secondaryImages) {
                    f.clearSpatialReference();
                }
            }

            const removedFrameIsSpatialReference = frame === this.spatialReference;
            const fileId = frame.frameInfo.fileId;

            // adjust requirements for stores
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.statsWidgets, fileId);
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.histogramWidgets, fileId);
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.spectralProfileWidgets, fileId);
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.stokesAnalysisWidgets, fileId);

            if (this.backendService.closeFile(fileId)) {
                frame.clearSpatialReference();
                frame.clearContours(false);
                this.frames = this.frames.filter(f => f.frameInfo.fileId !== fileId);
                // Clean up if frame is active
                if (this.activeFrame.frameInfo.fileId === fileId) {
                    this.activeFrame = this.frames.length ? this.frames[0] : null;
                }
                // Clean up if frame is currently spatial reference
                if (removedFrameIsSpatialReference) {
                    const newReference = this.frames.length ? this.frames[0] : null;
                    if (newReference) {
                        this.setSpatialReference(newReference);
                    } else {
                        this.clearSpatialReference();
                    }
                }
                this.tileService.handleFileClosed(fileId);

            }
        }
    };

    @action removeAllFrames = () => {
        if (this.backendService.closeFile(-1)) {
            this.activeFrame = null;
            this.tileService.clearCompressedCache(-1);
            this.frames.forEach(frame => {
                frame.clearContours(false);
                this.tileService.handleFileClosed(frame.frameInfo.fileId);
            });
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

    @action reorderFrame = (oldIndex: number, newIndex: number, length: number) => {
        if (!Number.isInteger(oldIndex) || oldIndex < 0 || oldIndex >= this.frameNum ||
            !Number.isInteger(newIndex) || newIndex < 0 || newIndex >= this.frameNum ||
            !Number.isInteger(length) || length <= 0 || length >= this.frameNum ||
            oldIndex === newIndex) {
            return;
        }
        this.frames = Utils.reorderArray(this.frames, oldIndex, newIndex, length);
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
                        frame.regionSet.addExistingRegion(region.regionInfo.controlPoints as Point2D[], region.regionInfo.rotation, region.regionInfo.regionType, region.regionId, region.regionInfo.regionName);
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
        this.preferenceStore.setPreference(PreferenceKeys.GLOBAL_THEME, Theme.DARK);
    };

    @action setLightTheme = () => {
        this.preferenceStore.setPreference(PreferenceKeys.GLOBAL_THEME, Theme.LIGHT);
    };

    @action toggleCursorFrozen = () => {
        if (this.activeFrame) {
            this.activeFrame.cursorFrozen = !this.activeFrame.cursorFrozen;
        }
    };

    public static readonly DEFAULT_STATS_TYPES = [
        CARTA.StatsType.NumPixels,
        CARTA.StatsType.Sum,
        CARTA.StatsType.FluxDensity,
        CARTA.StatsType.Mean,
        CARTA.StatsType.RMS,
        CARTA.StatsType.Sigma,
        CARTA.StatsType.SumSq,
        CARTA.StatsType.Min,
        CARTA.StatsType.Max
    ];
    private static readonly CursorThrottleTime = 200;
    private static readonly CursorThrottleTimeRotated = 100;
    private static readonly ImageThrottleTime = 200;
    private static readonly ImageChannelThrottleTime = 500;
    private static readonly RequirementsCheckInterval = 200;

    private spectralRequirements: Map<number, Map<number, CARTA.SetSpectralRequirements>>;
    private spatialRequirements: Map<number, Map<number, CARTA.SetSpatialRequirements>>;
    private statsRequirements: Map<number, Array<number>>;
    private histogramRequirements: Map<number, Array<number>>;
    private pendingChannelHistograms: Map<string, CARTA.IRegionHistogramData>;

    throttledSetChannels = _.throttle((fileId: number, channel: number, stokes: number) => {
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
        this.tileService.requestTiles(tiles, frame.frameInfo.fileId, frame.channel, frame.stokes, midPointTileCoords, this.preferenceStore.imageCompressionQuality, true);
    }, AppStore.ImageChannelThrottleTime);

    throttledSetView = _.throttle((tiles: TileCoordinate[], fileId: number, channel: number, stokes: number, focusPoint: Point2D) => {
        const isAnimating = (this.animatorStore.animationState !== AnimationState.STOPPED && this.animatorStore.animationMode !== AnimationMode.FRAME);
        if (isAnimating) {
            this.backendService.addRequiredTiles(fileId, tiles.map(t => t.encode()), this.preferenceStore.animationCompressionQuality);
        } else {
            this.tileService.requestTiles(tiles, fileId, channel, stokes, focusPoint, this.preferenceStore.imageCompressionQuality);
        }
    }, AppStore.ImageChannelThrottleTime);

    constructor() {
        this.alertStore = new AlertStore();
        this.layoutStore = new LayoutStore(this, this.alertStore);
        this.preferenceStore = new PreferenceStore(this);
        this.logStore = new LogStore();
        this.backendService = new BackendService(this.logStore, this.preferenceStore);
        this.tileService = new TileService(this.backendService);
        this.astReady = false;
        this.cartaComputeReady = false;
        this.spatialProfiles = new Map<string, SpatialProfileStore>();
        this.spectralProfiles = new Map<number, ObservableMap<number, SpectralProfileStore>>();
        this.regionStats = new Map<number, ObservableMap<number, CARTA.RegionStatsData>>();
        this.regionHistograms = new Map<number, ObservableMap<number, CARTA.IRegionHistogramData>>();
        this.pendingChannelHistograms = new Map<string, CARTA.IRegionHistogramData>();

        this.frames = [];
        this.activeFrame = null;
        this.fileBrowserStore = new FileBrowserStore(this, this.backendService);
        this.animatorStore = new AnimatorStore(this);
        this.overlayStore = new OverlayStore(this, this.preferenceStore);
        this.widgetsStore = new WidgetsStore(this);
        this.initRequirements();
        this.dialogStore = new DialogStore(this);
        this.helpStore = new HelpStore();

        const throttledSetCursorRotated = _.throttle(this.setCursor, AppStore.CursorThrottleTimeRotated);
        const throttledSetCursor = _.throttle(this.setCursor, AppStore.CursorThrottleTime);
        // Low-bandwidth mode
        const throttledSetCursorLowBandwidth = _.throttle(this.setCursor, AppStore.CursorThrottleTime * 2);

        // Update frame view
        autorun(() => {
            if (this.activeFrame && (this.preferenceStore.streamContoursWhileZooming || !this.activeFrame.zooming)) {
                // Trigger update raster view/title when switching layout
                const layout = this.layoutStore.dockedLayout;
                this.widgetsStore.updateImageWidgetTitle();

                const reqView = this.activeFrame.requiredFrameView;
                let croppedReq: FrameView = {
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
                this.throttledSetView(tiles, this.activeFrame.frameInfo.fileId, this.activeFrame.channel, this.activeFrame.stokes, midPointTileCoords);
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
                    this.throttledSetChannels(this.activeFrame.frameInfo.fileId, this.activeFrame.requiredChannel, this.activeFrame.requiredStokes);
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
        this.backendService.getContourStream().subscribe(this.handleContourImageStream);
        this.backendService.getErrorStream().subscribe(this.handleErrorStream);
        this.backendService.getRegionStatsStream().subscribe(this.handleRegionStatsStream);
        this.backendService.getReconnectStream().subscribe(this.handleReconnectStream);
        this.tileService.tileStream.subscribe(this.handleTileStream);

        // Auth and connection
        if (process.env.REACT_APP_AUTHENTICATION === "true") {
            this.dialogStore.showAuthDialog();
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

        // Add histogram to pending histogram list
        if (updatedFrame && regionHistogramData.regionId === -1) {
            regionHistogramData.histograms.forEach(histogram => {
                const key = `${regionHistogramData.fileId}_${regionHistogramData.stokes}_${histogram.channel}`;
                this.pendingChannelHistograms.set(key, regionHistogramData);
            });
        } else if (updatedFrame && regionHistogramData.regionId === -2) {
            // Update cube histogram if it is still required
            const cubeHist = regionHistogramData.histograms[0];
            if (cubeHist && (updatedFrame.renderConfig.useCubeHistogram || updatedFrame.renderConfig.useCubeHistogramContours)) {
                updatedFrame.renderConfig.updateCubeHistogram(cubeHist, regionHistogramData.progress);
                this.updateTaskProgress(regionHistogramData.progress);
            }
        }
    };

    @action handleTileStream = (tileStreamDetails: TileStreamDetails) => {
        if (this.animatorStore.animationState === AnimationState.PLAYING && this.animatorStore.animationMode !== AnimationMode.FRAME) {
            // Flow control
            const flowControlMessage: CARTA.IAnimationFlowControl = {
                fileId: tileStreamDetails.fileId,
                animationId: 0,
                receivedFrame: {
                    channel: tileStreamDetails.channel,
                    stokes: tileStreamDetails.stokes
                },
                timestamp: Long.fromNumber(Date.now())
            };

            this.backendService.sendAnimationFlowControl(flowControlMessage);

            const frame = this.getFrame(tileStreamDetails.fileId);
            if (frame) {
                frame.setChannels(tileStreamDetails.channel, tileStreamDetails.stokes);
                frame.channel = tileStreamDetails.channel;
                frame.stokes = tileStreamDetails.stokes;
            }
        }

        // Apply pending channel histogram
        const key = `${tileStreamDetails.fileId}_${tileStreamDetails.stokes}_${tileStreamDetails.channel}`;
        const pendingHistogram = this.pendingChannelHistograms.get(key);
        if (pendingHistogram && pendingHistogram.histograms && pendingHistogram.histograms.length) {
            const updatedFrame = this.getFrame(pendingHistogram.fileId);
            const channelHist = pendingHistogram.histograms.find(hist => hist.channel === updatedFrame.requiredChannel);
            if (updatedFrame && channelHist) {
                updatedFrame.renderConfig.setStokes(pendingHistogram.stokes);
                updatedFrame.renderConfig.updateChannelHistogram(channelHist);
            }
            this.pendingChannelHistograms.delete(key);
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
        return (this.tileService && this.tileService.workersReady);
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
        this.widgetsStore.updateSpectralRelatedWidgetsSpectralSettings();
    }

    getFrame(fileId: number) {
        if (fileId === -1) {
            return this.activeFrame;
        }
        return this.frames.find(f => f.frameInfo.fileId === fileId);
    }

    @computed get selectedRegion(): RegionStore {
        if (this.activeFrame && this.activeFrame.regionSet && this.activeFrame.regionSet.selectedRegion && this.activeFrame.regionSet.selectedRegion.regionId !== 0) {
            return this.activeFrame.regionSet.selectedRegion;
        }
        return null;
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

    @action setSpatialReference = (frame: FrameStore) => {
        this.spatialReference = frame;

        for (const f of this.frames) {
            // The reference image can't reference itself
            if (f === frame) {
                f.clearSpatialReference();
            } else if (f.spatialReference) {
                f.setSpatialReference(frame);
            }
        }
    };

    @action clearSpatialReference = () => {
        this.spatialReference = null;
        for (const f of this.frames) {
            f.clearSpatialReference();
        }
    };

    @action toggleSpatialMatching = (frame: FrameStore) => {
        if (!frame || frame === this.spatialReference) {
            return;
        }

        if (frame.spatialReference) {
            frame.clearSpatialReference();
        } else {
            if (!frame.setSpatialReference(this.spatialReference)) {
                AppToaster.show({
                    icon: "warning-sign",
                    message: `Could not enable spatial matching of ${frame.frameInfo.fileInfo.name} to reference image ${this.spatialReference.frameInfo.fileInfo.name}. No valid transform was found`,
                    intent: "warning",
                    timeout: 3000
                });
            }
        }
    };

    // region requirements calculations

    @observable requiredFrame: FrameStore;

    @action setRequiredFrame(frame: FrameStore) {
        this.requiredFrame = frame;
    }

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
        if (!this.requiredFrame) {
            return;
        }

        const updatedRequirements = RegionWidgetStore.CalculateRequirementsArray(this.requiredFrame, this.widgetsStore.statsWidgets);
        const diffList = StatsWidgetStore.DiffRequirementsArray(this.statsRequirements, updatedRequirements);
        this.statsRequirements = updatedRequirements;

        if (diffList.length) {
            for (const requirements of diffList) {
                this.backendService.setStatsRequirements(requirements);
            }
        }
    }

    private recalculateHistogramRequirements() {
        if (!this.requiredFrame) {
            return;
        }

        const updatedRequirements = RegionWidgetStore.CalculateRequirementsArray(this.requiredFrame, this.widgetsStore.histogramWidgets);
        const diffList = HistogramWidgetStore.DiffRequirementsArray(this.histogramRequirements, updatedRequirements);
        this.histogramRequirements = updatedRequirements;

        if (diffList.length) {
            for (const requirements of diffList) {
                this.backendService.setHistogramRequirements(requirements);
            }
        }
    }

    private recalculateSpectralRequirements() {
        if (!this.requiredFrame) {
            return;
        }

        const updatedRequirements = SpectralProfileWidgetStore.CalculateRequirementsMap(this.requiredFrame, this.widgetsStore.spectralProfileWidgets);
        if (this.requiredFrame.hasStokes && this.widgetsStore.stokesAnalysisWidgets.size > 0) {
            StokesAnalysisWidgetStore.addToRequirementsMap(this.requiredFrame, updatedRequirements, this.widgetsStore.stokesAnalysisWidgets);
        }
        const diffList = SpectralProfileWidgetStore.DiffSpectralRequirements(this.spectralRequirements, updatedRequirements);
        this.spectralRequirements = updatedRequirements;

        if (diffList.length) {
            diffList.forEach(requirements => this.backendService.setSpectralRequirements(requirements));
        }
    }

    private recalculateSpatialRequirements() {
        if (!this.requiredFrame) {
            return;
        }

        const updatedRequirements = SpatialProfileWidgetStore.CalculateRequirementsMap(this.requiredFrame, this.widgetsStore.spatialProfileWidgets);
        const diffList = SpatialProfileWidgetStore.DiffSpatialRequirements(this.spatialRequirements, updatedRequirements);
        this.spatialRequirements = updatedRequirements;

        if (diffList.length) {
            diffList.forEach(requirements => this.backendService.setSpatialRequirements(requirements));
        }
    }

    // endregion
}