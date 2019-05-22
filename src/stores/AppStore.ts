import * as _ from "lodash";
import * as AST from "ast_wrapper";
import {action, autorun, computed, observable, ObservableMap} from "mobx";
import {CARTA} from "carta-protobuf";
import {AlertStore, AnimationState, AnimatorStore, dayPalette, FileBrowserStore, FrameInfo, FrameStore, LogEntry, LogStore, nightPalette, OverlayStore, RegionStore, SpatialProfileStore, SpectralProfileStore, WidgetsStore} from ".";
import {BackendService} from "services";
import {CursorInfo, FrameView, Point2D} from "models";
import {GetRequiredTiles, smoothStepOffset} from "utilities";
import {HistogramWidgetStore, RegionWidgetStore, SpectralProfileWidgetStore, StatsWidgetStore} from "./widgets";
import {TileService} from "../services/TileService";

const CURSOR_DEBOUNCE_TIME = 200;
const CURSOR_THROTTLE_TIME = 200;
const IMAGE_THROTTLE_TIME = 200;
const REQUIREMENTS_CHECK_INTERVAL = 200;

export class AppStore {
    // Backend services
    backendService: BackendService;
    tileService: TileService;

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
    // Profiles and region data
    @observable spatialProfiles: Map<string, SpatialProfileStore>;
    @observable spectralProfiles: Map<number, ObservableMap<number, SpectralProfileStore>>;
    @observable regionStats: Map<number, ObservableMap<number, CARTA.RegionStatsData>>;
    @observable regionHistograms: Map<number, ObservableMap<number, CARTA.IRegionHistogramData>>;

    // Image view
    @action setImageViewDimensions = (w: number, h: number) => {
        this.overlayStore.viewWidth = w;
        this.overlayStore.viewHeight = h;
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
    // Additional Dialogs
    @observable urlConnectDialogVisible: boolean;
    @action showURLConnect = () => {
        this.urlConnectDialogVisible = true;
    };
    @action hideURLConnect = () => {
        this.urlConnectDialogVisible = false;
    };

    @observable hotkeyDialogVisible: boolean;
    @action showHotkeyDialog = () => {
        this.hotkeyDialogVisible = true;
    };
    @action hideHotkeyDialog = () => {
        this.hotkeyDialogVisible = false;
    };

    @observable aboutDialogVisible: boolean;
    @action showAboutDialog = () => {
        this.aboutDialogVisible = true;
    };
    @action hideAboutDialog = () => {
        this.aboutDialogVisible = false;
    };

    @observable apiKey: string;
    @action applyApiKey = (newKey: string, forceReload: boolean = true) => {
        if (newKey) {
            localStorage.setItem("API_KEY", newKey);
            this.apiKey = newKey;
        } else {
            localStorage.removeItem("API_KEY");
        }
        if (forceReload) {
            location.reload();
        }
    };
    @observable apiKeyDialogVisible: boolean;
    @action showApiKeyDialog = () => {
        this.apiKeyDialogVisible = true;
    };
    @action hideApiKeyDialog = () => {
        this.apiKeyDialogVisible = false;
    };

    // Tasks
    @observable taskProgress: number;
    @observable taskStartTime: number;
    @observable taskCurrentTime: number;
    @observable fileLoading: boolean;

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
    @observable darkTheme: boolean;

    // Frame actions
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
                fileInfo: new CARTA.FileInfo(ack.fileInfo),
                fileInfoExtended: new CARTA.FileInfoExtended(ack.fileInfoExtended),
                renderMode: CARTA.RenderMode.RASTER
            };

            let newFrame = new FrameStore(this.overlayStore, frameInfo, this.backendService);
            newFrame.fitZoom();
            this.loadWCS(newFrame);

            // clear existing requirements for the frame
            this.spectralRequirements.delete(ack.fileId);
            this.statsRequirements.delete(ack.fileId);
            this.histogramRequirements.delete(ack.fileId);

            // Place frame in frame array (replace frame with the same ID if it exists)
            const existingFrameIndex = this.frames.findIndex(f => f.frameInfo.fileId === fileId);
            if (existingFrameIndex !== -1) {
                this.frames[existingFrameIndex] = newFrame;
            } else {
                this.frames.push(newFrame);
            }
            this.setActiveFrame(newFrame.frameInfo.fileId);
            this.fileBrowserStore.hideFileBrowser();
        }, err => {
            this.alertStore.showAlert(`Error loading file: ${err}`);
        });
    };
    @action appendFile = (directory: string, file: string, hdu: string) => {
        const currentIdList = this.frames.map(frame => frame.frameInfo.fileId).sort((a, b) => a - b);
        const newId = currentIdList.pop() + 1;
        this.addFrame(directory, file, hdu, newId);
    };
    @action openFile = (directory: string, file: string, hdu: string) => {
        this.removeAllFrames();
        this.addFrame(directory, file, hdu, 0);
    };
    @action removeFrame = (fileId: number) => {
        if (this.frames.find(f => f.frameInfo.fileId === fileId)) {
            // adjust requirements for stores
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.statsWidgets, fileId);
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.histogramWidgets, fileId);
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.spectralProfileWidgets, fileId);

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
            // adjust requirements for stores
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.statsWidgets);
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.histogramWidgets);
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.spectralProfileWidgets);
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
            if (entry.name.match(/(CTYPE|CDELT|CRPIX|CRVAL|CUNIT|NAXIS|CROTA)[3-9]/)) {
                continue;
            }

            let value = entry.value;
            if (entry.name.toUpperCase() === "NAXIS") {
                value = "2";
            }

            if (entry.name.toUpperCase() === "WCSAXES") {
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
        } else {
            frame.wcsInfo = initResult;
            frame.validWcs = true;
            this.overlayStore.setDefaultsFromAST(frame);
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
        this.darkTheme = true;
    };

    @action setLightTheme = () => {
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

    public static readonly DEFAULT_STATS_TYPES = [CARTA.StatsType.NumPixels, CARTA.StatsType.Sum, CARTA.StatsType.Mean, CARTA.StatsType.RMS, CARTA.StatsType.Sigma, CARTA.StatsType.SumSq, CARTA.StatsType.Min, CARTA.StatsType.Max];
    private spectralRequirements: Map<number, Map<number, CARTA.SetSpectralRequirements>>;
    private statsRequirements: Map<number, Array<number>>;
    private histogramRequirements: Map<number, Array<number>>;

    constructor() {
        const existingKey = localStorage.getItem("API_KEY");
        if (existingKey) {
            this.apiKey = existingKey;
        }

        this.logStore = new LogStore();
        this.backendService = new BackendService(this.logStore);
        this.tileService = new TileService(this.backendService);
        this.astReady = false;
        this.spatialProfiles = new Map<string, SpatialProfileStore>();
        this.spectralProfiles = new Map<number, ObservableMap<number, SpectralProfileStore>>();
        this.regionStats = new Map<number, ObservableMap<number, CARTA.RegionStatsData>>();
        this.regionHistograms = new Map<number, ObservableMap<number, CARTA.IRegionHistogramData>>();
        this.frames = [];
        this.activeFrame = null;
        this.animatorStore = new AnimatorStore(this);
        this.alertStore = new AlertStore();
        this.overlayStore = new OverlayStore();
        this.widgetsStore = new WidgetsStore(this);
        this.urlConnectDialogVisible = false;
        this.compressionQuality = 11;
        this.darkTheme = false;
        this.spectralRequirements = new Map<number, Map<number, CARTA.SetSpectralRequirements>>();
        this.statsRequirements = new Map<number, Array<number>>();
        this.histogramRequirements = new Map<number, Array<number>>();

        const throttledSetView = _.throttle((fileId: number, view: FrameView, quality: number) => {
            this.backendService.setImageView(fileId, Math.floor(view.xMin), Math.ceil(view.xMax), Math.floor(view.yMin), Math.ceil(view.yMax), view.mip, quality);
        }, IMAGE_THROTTLE_TIME * 100);

        const throttledSetChannels = _.throttle((fileId: number, channel: number, stokes: number) => {
            this.backendService.setChannels(fileId, channel, stokes);
        }, IMAGE_THROTTLE_TIME);

        const debouncedSetCursor = _.debounce((fileId: number, x: number, y: number) => {
            const frame = this.getFrame(fileId);
            if (frame && frame.regionSet.regions[0]) {
                frame.regionSet.regions[0].setControlPoint(0, {x, y});
            }
        }, CURSOR_DEBOUNCE_TIME);

        const throttledSetCursor = _.throttle((fileId: number, x: number, y: number) => {
            const frame = this.getFrame(fileId);
            if (frame && frame.regionSet.regions[0]) {
                frame.regionSet.regions[0].setControlPoint(0, {x, y});
            }
        }, CURSOR_THROTTLE_TIME);

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

                let adjustedQuality = smoothStepOffset(this.activeFrame.zoomLevel, 0.9, 4, 11, 21);
                adjustedQuality = Math.round(adjustedQuality);

                const imageSize: Point2D = {x: this.activeFrame.frameInfo.fileInfoExtended.width, y: this.activeFrame.frameInfo.fileInfoExtended.height};
                const tiles = GetRequiredTiles(croppedReq, imageSize, {x: 256, y: 256});
                const midPointImageCoords = {x: (reqView.xMax + reqView.xMin) / 2.0, y: (reqView.yMin + reqView.yMax) / 2.0};
                // TODO: dynamic tile size
                const tileSizeFullRes = reqView.mip * 256;
                const midPointTileCoords = {x: midPointImageCoords.x / tileSizeFullRes, y: midPointImageCoords.y / tileSizeFullRes};
                this.tileService.requestTiles(tiles, this.activeFrame.frameInfo.fileId, this.activeFrame.channel, this.activeFrame.stokes, midPointTileCoords, this.activeFrame.currentCompressionQuality);

                // Calculate if new data is required
                const updateRequiredChannels = this.activeFrame.requiredChannel !== this.activeFrame.channel || this.activeFrame.requiredStokes !== this.activeFrame.stokes;
                // Don't auto-update when animation is playing
                if (this.animatorStore.animationState === AnimationState.STOPPED && updateRequiredChannels) {
                    throttledSetChannels(this.activeFrame.frameInfo.fileId, this.activeFrame.requiredChannel, this.activeFrame.requiredStokes);
                }

                // const updateRequiredView = (croppedReq.mip < currentView.mip) || (croppedReq.xMin < currentView.xMin || croppedReq.xMax > currentView.xMax || croppedReq.yMin < currentView.yMin || croppedReq.yMax > currentView.yMax);
                // const updateCompressionQuality = (adjustedQuality > this.activeFrame.currentCompressionQuality);
                // if (updateRequiredView || updateCompressionQuality) {
                //     const reqWidth = reqView.xMax - reqView.xMin;
                //     const reqHeight = reqView.yMax - reqView.yMin;
                //     // Add an extra padding on either side to avoid spamming backend
                //     const padFraction = 0.05;
                //     const paddedView = {
                //         xMin: Math.max(0, reqView.xMin - padFraction * reqWidth),
                //         xMax: Math.min(reqView.xMax + padFraction * reqWidth, this.activeFrame.frameInfo.fileInfoExtended.width),
                //         yMin: Math.max(0, reqView.yMin - padFraction * reqHeight),
                //         yMax: Math.min(reqView.yMax + padFraction * reqHeight, this.activeFrame.frameInfo.fileInfoExtended.height),
                //         mip: reqView.mip
                //     };
                //
                //     throttledSetView(this.activeFrame.frameInfo.fileId, paddedView, adjustedQuality);
                // }
            }
        });

        // Update cursor profiles
        autorun(() => {
            if (this.activeFrame && this.cursorInfo && this.cursorInfo.posImageSpace) {
                const pos = {x: Math.round(this.cursorInfo.posImageSpace.x), y: Math.round(this.cursorInfo.posImageSpace.y)};
                if (pos.x >= 0 && pos.x <= this.activeFrame.frameInfo.fileInfoExtended.width - 1 && pos.y >= 0 && pos.y < this.activeFrame.frameInfo.fileInfoExtended.height - 1) {
                    if (this.activeFrame.frameInfo.fileInfo.type === CARTA.FileType.HDF5) {
                        throttledSetCursor(this.activeFrame.frameInfo.fileId, pos.x, pos.y);
                    } else {
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
            }
        }, {delay: 33});

        // Set spatial and spectral requirements of cursor region on file load
        autorun(() => {
            if (this.activeFrame) {
                this.backendService.setSpatialRequirements(this.activeFrame.frameInfo.fileId, 0, ["x", "y"]);
            }
        });

        // Set overlay defaults from current frame
        autorun(() => {
            if (this.activeFrame) {
                this.overlayStore.setDefaultsFromAST(this.activeFrame);
            }
        });

        autorun(() => {
            if (this.astReady) {
                this.logStore.addInfo("AST library loaded", ["ast"]);
            }
        });

        // Set palette if theme changes
        autorun(() => {
            AST.setPalette(this.darkTheme ? nightPalette : dayPalette);
        });

        // Update requirements every 200 ms
        setInterval(this.recalculateSpectralRequirements, REQUIREMENTS_CHECK_INTERVAL);
        setInterval(this.recalculateStatsRequirements, REQUIREMENTS_CHECK_INTERVAL);
        setInterval(this.recalculateHistogramRequirements, REQUIREMENTS_CHECK_INTERVAL);

        // Subscribe to frontend streams
        this.backendService.getSpatialProfileStream().subscribe(this.handleSpatialProfileStream);
        this.backendService.getSpectralProfileStream().subscribe(this.handleSpectralProfileStream);
        this.backendService.getRegionHistogramStream().subscribe(this.handleRegionHistogramStream);
        this.backendService.getRasterStream().subscribe(this.handleRasterImageStream);
        this.backendService.getErrorStream().subscribe(this.handleErrorStream);
        this.backendService.getRegionStatsStream().subscribe(this.handleRegionStatsStream);
    }

    // region Subscription handlers
    handleSpatialProfileStream = (spatialProfileData: CARTA.SpatialProfileData) => {
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
                profileMap.set(profile.coordinate, profile as CARTA.SpatialProfile);
            }
            profileStore.setProfiles(profileMap);
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
                profileStore.setProfile(profile);
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
                    updatedFrame.renderConfig.updateChannelHistogram(channelHist as CARTA.Histogram);
                }
            } else if (regionHistogramData.regionId === -2) {
                // Update cube histogram if it is still required
                const cubeHist = regionHistogramData.histograms[0];
                if (cubeHist && updatedFrame.renderConfig.useCubeHistogram) {
                    updatedFrame.renderConfig.updateCubeHistogram(cubeHist as CARTA.Histogram, regionHistogramData.progress);
                    this.updateTaskProgress(regionHistogramData.progress);
                }
            }
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
        const updatedFrame = this.getFrame(rasterImageData.fileId);
        if (updatedFrame) {
            updatedFrame.updateFromRasterData(rasterImageData);
            if (this.animatorStore.animationState === AnimationState.PLAYING) {
                updatedFrame.requiredChannel = rasterImageData.channel;
                updatedFrame.requiredStokes = rasterImageData.stokes;
                this.animatorStore.incrementFlowCounter(updatedFrame.frameInfo.fileId, updatedFrame.channel, updatedFrame.stokes);
            }
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

    // endregion

    @computed get zfpReady() {
        return (this.backendService && this.backendService.zfpReady);
    }

    @action setActiveFrame(fileId: number) {
        const requiredFrame = this.getFrame(fileId);
        if (requiredFrame) {
            this.activeFrame = requiredFrame;
            this.widgetsStore.updateImageWidgetTitle();
            this.setCursorFrozen(false);
        } else {
            console.log(`Can't find required frame ${fileId}`);
        }
    }

    @action setActiveFrameByIndex(index: number) {
        if (index >= 0 && this.frames.length > index) {
            this.activeFrame = this.frames[index];
            this.widgetsStore.updateImageWidgetTitle();
            this.setCursorFrozen(false);
        } else {
            console.log(`Invalid frame index ${index}`);
        }
    }

    getFrame(fileId: number) {
        if (fileId === -1) {
            return this.activeFrame;
        }
        return this.frames.find(f => f.frameInfo.fileId === fileId);
    }

    @action deleteSelectedRegion = () => {
        if (this.activeFrame && this.activeFrame.regionSet) {
            const fileId = this.activeFrame.frameInfo.fileId;
            let region: RegionStore;
            region = this.activeFrame.regionSet.selectedRegion;
            if (region) {
                const regionId = region.regionId;
                WidgetsStore.RemoveRegionFromRegionWidgets(this.widgetsStore.statsWidgets, fileId, regionId);
                WidgetsStore.RemoveRegionFromRegionWidgets(this.widgetsStore.histogramWidgets, fileId, regionId);
                WidgetsStore.RemoveRegionFromRegionWidgets(this.widgetsStore.spectralProfileWidgets, fileId, regionId);
                // delete region
                this.activeFrame.regionSet.deleteRegion(region);
            }
        }
    };

    @action deselectRegion = () => {
        if (this.activeFrame && this.activeFrame.regionSet) {
            this.activeFrame.regionSet.deselectRegion();
        }
    };

    // region requirements calculations

    recalculateStatsRequirements = () => {
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
    };

    recalculateHistogramRequirements = () => {
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
    };

    recalculateSpectralRequirements = () => {
        if (!this.activeFrame) {
            return;
        }

        const updatedRequirements = SpectralProfileWidgetStore.CalculateRequirementsMap(this.activeFrame, this.widgetsStore.spectralProfileWidgets);
        const diffList = SpectralProfileWidgetStore.DiffSpectralRequirements(this.spectralRequirements, updatedRequirements);
        this.spectralRequirements = updatedRequirements;

        if (diffList.length) {
            diffList.forEach(requirements => this.backendService.setSpectralRequirements(requirements));
        }
    };

    // endregion
}