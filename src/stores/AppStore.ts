import * as _ from "lodash";
import * as AST from "ast_wrapper";
import {action, autorun, computed, observable} from "mobx";
import {CARTA} from "carta-protobuf";
import {AlertStore, AnimationState, AnimatorStore, FrameInfo, FrameStore, FileBrowserStore, LogEntry, LogStore, OverlayStore, SpatialProfileStore, SpectralProfileStore, WidgetsStore, dayPalette, nightPalette} from ".";
import {BackendService} from "services";
import {CursorInfo, FrameView} from "models";
import {smoothStepOffset} from "utilities";

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
    // Profiles
    @observable spatialProfiles: Map<string, SpatialProfileStore>;
    @observable spectralProfiles: Map<string, SpectralProfileStore>;

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

    // Tasks
    @observable taskProgress: number;
    @observable taskStartTime: number;
    @observable taskCurrentTime: number;

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
        let modString = "alt + ";
        if (process.env.REACT_APP_TARGET === "linux") {
            modString = "ctrl + ";
        } else if (process.env.REACT_APP_TARGET === "darwin") {
            modString = "cmd +";
        }
        return modString;
    }

    // Widgets
    @observable widgetsStore: WidgetsStore;

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
            const histogram = {channel: -2, numBins: -1} as CARTA.SetHistogramRequirements.HistogramConfig;
            this.backendService.setHistogramRequirements(frame.frameInfo.fileId, -2, [histogram]);
            this.restartTaskProgress();
        }
    };

    @action cancelCubeHistogramRequest = (fileId: number = -1) => {
        const frame = this.getFrame(fileId);
        if (frame && frame.renderConfig.cubeHistogramProgress < 1.0) {
            frame.renderConfig.updateCubeHistogram(null, 0);
            this.backendService.setHistogramRequirements(frame.frameInfo.fileId, -2, []);
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

    constructor() {
        this.logStore = new LogStore();
        this.backendService = new BackendService(this.logStore);
        this.astReady = false;
        this.spatialProfiles = new Map<string, SpatialProfileStore>();
        this.spectralProfiles = new Map<string, SpectralProfileStore>();
        this.frames = [];
        this.activeFrame = null;
        this.animatorStore = new AnimatorStore(this);
        this.alertStore = new AlertStore();
        this.overlayStore = new OverlayStore();
        this.widgetsStore = new WidgetsStore(this);
        this.urlConnectDialogVisible = false;
        this.compressionQuality = 11;
        this.darkTheme = false;

        const throttledSetView = _.throttle((fileId: number, view: FrameView, quality: number) => {
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

                let adjustedQuality = smoothStepOffset(this.activeFrame.zoomLevel, 0.9, 4, 11, 21);
                adjustedQuality = Math.round(adjustedQuality);

                // Calculate if new data is required
                const updateRequiredChannels = this.activeFrame.requiredChannel !== this.activeFrame.channel || this.activeFrame.requiredStokes !== this.activeFrame.stokes;
                // Don't auto-update when animation is playing
                if (this.animatorStore.animationState === AnimationState.STOPPED && updateRequiredChannels) {
                    throttledSetChannels(this.activeFrame.frameInfo.fileId, this.activeFrame.requiredChannel, this.activeFrame.requiredStokes);
                }

                const updateRequiredView = (croppedReq.mip < currentView.mip) || (croppedReq.xMin < currentView.xMin || croppedReq.xMax > currentView.xMax || croppedReq.yMin < currentView.yMin || croppedReq.yMax > currentView.yMax);
                const updateCompressionQuality = (adjustedQuality > this.activeFrame.currentCompressionQuality);
                if (updateRequiredView || updateCompressionQuality) {
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
                    throttledSetView(this.activeFrame.frameInfo.fileId, paddedView, adjustedQuality);
                }
            }
        });

        // Update cursor profiles
        autorun(() => {
            if (this.activeFrame && this.cursorInfo && this.cursorInfo.posImageSpace) {
                const pos = {x: Math.round(this.cursorInfo.posImageSpace.x), y: Math.round(this.cursorInfo.posImageSpace.y)};
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

        // Set spatial and spectral requirements of cursor region on file load
        autorun(() => {
            if (this.activeFrame) {
                let profileConfig = new CARTA.SetSpectralRequirements.SpectralConfig({coordinate: "z", statsTypes: [CARTA.StatsType.None]});
                this.backendService.setSpatialRequirements(this.activeFrame.frameInfo.fileId, 0, ["x", "y"]);
                this.backendService.setSpectralRequirements(this.activeFrame.frameInfo.fileId, 0, [profileConfig]);
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

        // Subscribe to frontend streams
        this.backendService.getSpatialProfileStream().subscribe(this.handleSpatialProfileStream);
        this.backendService.getSpectralProfileStream().subscribe(this.handleSpectralProfileStream);
        this.backendService.getRegionHistogramStream().subscribe(this.handleRegionHistogramStream);
        this.backendService.getRasterStream().subscribe(this.handleRasterImageStream);
        this.backendService.getErrorStream().subscribe(this.handleErrorStream);
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
            const key = `${spectralProfileData.fileId}-${spectralProfileData.regionId}`;
            let profileStore = this.spectralProfiles.get(key);
            if (!profileStore) {
                profileStore = new SpectralProfileStore(spectralProfileData.fileId, spectralProfileData.regionId);
                this.spectralProfiles.set(key, profileStore);
            }

            profileStore.channelValues = spectralProfileData.channelVals;
            profileStore.stokes = spectralProfileData.stokes;
            const profileMap = new Map<string, CARTA.SpectralProfile>();
            for (let profile of spectralProfileData.profiles) {
                profileMap.set(profile.coordinate, profile as CARTA.SpectralProfile);
            }
            profileStore.setProfiles(profileMap);
        }
    };

    handleRegionHistogramStream = (regionHistogramData: CARTA.RegionHistogramData) => {
        if (!regionHistogramData) {
            return;
        }
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

    handleRasterImageStream = (rasterImageData: CARTA.RasterImageData) => {
        const updatedFrame = this.getFrame(rasterImageData.fileId);
        if (updatedFrame) {
            updatedFrame.updateFromRasterData(rasterImageData);
            if (this.animatorStore.animationState === AnimationState.PLAYING) {
                this.animatorStore.removeFromRequestQueue(updatedFrame.channel, updatedFrame.stokes);
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
}
