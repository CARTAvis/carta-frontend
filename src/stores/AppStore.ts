import * as _ from "lodash";
import {action, autorun, computed, makeObservable, observable, ObservableMap, runInAction, when} from "mobx";
import * as Long from "long";
import {Classes, Colors, IOptionProps, setHotkeysDialogProps} from "@blueprintjs/core";
import {Utils} from "@blueprintjs/table";
import * as AST from "ast_wrapper";
import * as CARTACompute from "carta_computation";
import {CARTA} from "carta-protobuf";
import {
    AlertStore,
    AnimationMode,
    AnimatorStore,
    BrowserMode,
    CatalogProfileStore,
    CatalogStore,
    CatalogUpdateMode,
    CURSOR_REGION_ID,
    DialogStore,
    DistanceMeasuringStore,
    FileBrowserStore,
    FrameInfo,
    FrameStore,
    HelpStore,
    LayoutStore,
    LogEntry,
    LogStore,
    OverlayStore,
    PreferenceKeys,
    PreferenceStore,
    RegionFileType,
    RegionStore,
    SnippetStore,
    SpatialProfileStore,
    SpectralProfileStore,
    WidgetsStore
} from ".";
import {clamp, distinct, getColorForTheme, GetRequiredTiles, getTimestamp, mapToObject} from "utilities";
import {ApiService, BackendService, ConnectionStatus, ScriptingService, TileService, TileStreamDetails} from "services";
import {CatalogInfo, CatalogType, FileId, FrameView, ImagePanelMode, Point2D, PresetLayout, RegionId, Theme, TileCoordinate, WCSMatchingType, Zoom, SpectralType} from "models";
import {HistogramWidgetStore, SpatialProfileWidgetStore, SpectralProfileWidgetStore, StatsWidgetStore, StokesAnalysisWidgetStore} from "./widgets";
import {getImageViewCanvas, ImageViewLayer} from "components";
import {AppToaster, ErrorToast, SuccessToast, WarningToast} from "components/Shared";
import {ProtobufProcessing} from "utilities";
import GitCommit from "../static/gitInfo";

interface FrameOption extends IOptionProps {
    hasZAxis: boolean;
}

interface ViewUpdate {
    tiles: TileCoordinate[];
    fileId: number;
    channel: number;
    stokes: number;
    focusPoint: Point2D;
}

interface ChannelUpdate {
    frame: FrameStore;
    channel: number;
    stokes: number;
}

const IMPORT_REGION_BATCH_SIZE = 100;

export class AppStore {
    private static staticInstance: AppStore;

    static get Instance() {
        return AppStore.staticInstance || new AppStore();
    }

    // Backend services
    readonly backendService: BackendService;
    readonly tileService: TileService;
    readonly scriptingService: ScriptingService;
    readonly apiService: ApiService;

    // Other stores
    readonly alertStore: AlertStore;
    readonly animatorStore: AnimatorStore;
    readonly catalogStore: CatalogStore;
    readonly dialogStore: DialogStore;
    readonly fileBrowserStore: FileBrowserStore;
    readonly helpStore: HelpStore;
    readonly layoutStore: LayoutStore;
    readonly snippetStore: SnippetStore;
    readonly logStore: LogStore;
    readonly overlayStore: OverlayStore;
    readonly preferenceStore: PreferenceStore;
    readonly widgetsStore: WidgetsStore;

    // WebAssembly Module status
    @observable astReady: boolean;
    @observable cartaComputeReady: boolean;
    // Frames
    @observable frames: FrameStore[];
    @observable activeFrame: FrameStore;
    @observable hoveredFrame: FrameStore;
    @observable contourDataSource: FrameStore;
    @observable syncContourToFrame: boolean;
    @observable syncFrameToContour: boolean;

    // Profiles and region data
    @observable spatialProfiles: Map<string, SpatialProfileStore>;
    @observable spectralProfiles: Map<FileId, ObservableMap<RegionId, SpectralProfileStore>>;
    @observable regionStats: Map<number, ObservableMap<number, ObservableMap<number, CARTA.RegionStatsData>>>;
    @observable regionHistograms: Map<number, ObservableMap<number, ObservableMap<number, CARTA.IRegionHistogramData>>>;

    // Reference images
    @observable spatialReference: FrameStore;
    @observable spectralReference: FrameStore;
    @observable rasterScalingReference: FrameStore;

    // ImageViewer
    @observable activeLayer: ImageViewLayer;
    @observable cursorFrozen: boolean;
    @observable toolbarExpanded: boolean;

    private appContainer: HTMLElement;
    private fileCounter = 0;
    private previousConnectionStatus: ConnectionStatus;

    public getAppContainer = (): HTMLElement => {
        return this.appContainer;
    };

    public setAppContainer = (container: HTMLElement) => {
        this.appContainer = container;
    };

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
        const requiresAutoFit = this.preferenceStore.zoomMode === Zoom.FIT && this.overlayStore.fullViewWidth <= 1 && this.overlayStore.fullViewHeight <= 1;
        this.overlayStore.setViewDimension(w, h);

        if (requiresAutoFit) {
            for (const frame of this.frames) {
                frame.fitZoom();
            }
        }
    };

    // Auth
    @observable username: string = "";
    @action setUsername = (username: string) => {
        this.username = username;
    };

    private connectToServer = async () => {
        // Remove query parameters, replace protocol and remove trailing /
        let wsURL = window.location.href.replace(window.location.search, "").replace(/^http/, "ws").replace(/\/$/, "");
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

        try {
            await AST.onReady;
            this.setAstReady(true);
            const ack = await this.backendService.connect(wsURL);
            console.log(`Connected with session ID ${ack.sessionId}`);
            this.logStore.addInfo(`Connected to server ${wsURL} with session ID ${ack.sessionId}`, ["network"]);
        } catch (err) {
            console.error(err);
        }
    };

    private loadDefaultFiles = async () => {
        const url = new URL(window.location.href);
        const folderSearchParam = url.searchParams.get("folder");

        let fileList: string[];
        if (url.searchParams.has("files")) {
            let filesString = url.searchParams.get("files");
            // Strip the padding [] if it exists
            if (filesString.startsWith("[") && filesString.endsWith("]")) {
                filesString = filesString.slice(1, -1);
            }
            fileList = filesString.split(",")?.map(file => file.trim());
        } else if (url.searchParams.has("file")) {
            fileList = [url.searchParams.get("file")];
        }

        try {
            if (fileList?.length) {
                const frames: FrameStore[] = [];
                for (const file of fileList) {
                    frames.push(await this.loadFile(folderSearchParam, file, ""));
                }

                // Auto-fit loaded frames after panel configuration has been updated.
                if (this.preferenceStore.zoomMode === Zoom.FIT) {
                    this.autoFitImages(frames);
                }
            } else if (this.preferenceStore.autoLaunch) {
                if (folderSearchParam) {
                    this.fileBrowserStore.setStartingDirectory(folderSearchParam);
                }
                this.fileBrowserStore.showFileBrowser(BrowserMode.File);
            }
        } catch (err) {
            console.error(err);
        }
    };

    @action autoFitImages(frames: FrameStore[]) {
        // Frames that have a spatial reference are not auto-fitted.
        for (const frame of frames) {
            if (frame && !frame.spatialReference) {
                frame.fitZoom();
            }
        }
    }

    @action handleThemeChange = (darkMode: boolean) => {
        this.systemTheme = darkMode ? "dark" : "light";
    };

    // Tasks
    @observable taskProgress: number;
    @observable taskStartTime: number;
    @observable taskCurrentTime: number;
    @observable fileLoading: boolean;
    @observable fileSaving: boolean;
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

    @action startFileLoading = () => {
        this.fileLoading = true;
    };

    @action endFileLoading = () => {
        this.fileLoading = false;
    };

    @action startFileSaving = () => {
        this.fileSaving = true;
    };

    @action endFileSaving = () => {
        this.fileSaving = false;
    };

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

    // System theme, based on media query
    @observable systemTheme: string;

    // Apply dark theme if it is forced or the system theme is dark
    @computed get darkTheme(): boolean {
        if (this.preferenceStore.theme === Theme.AUTO) {
            return this.systemTheme === Theme.DARK;
        } else {
            return this.preferenceStore.theme === Theme.DARK;
        }
    }

    @computed get openFileDisabled(): boolean {
        return this.backendService?.connectionStatus !== ConnectionStatus.ACTIVE || this.fileLoading;
    }

    @computed get appendFileDisabled(): boolean {
        return this.openFileDisabled || !this.activeFrame;
    }

    // Frame actions
    @computed get activeFrameFileId(): number {
        return this.activeFrame?.frameInfo.fileId;
    }

    @computed get activeFrameIndex(): number {
        if (!this.activeFrame) {
            return -1;
        }
        return this.frames.findIndex(frame => frame.frameInfo.fileId === this.activeFrame.frameInfo.fileId);
    }

    @computed get frameNum(): number {
        return this.frames.length;
    }

    @computed get frameMap(): Map<number, FrameStore> {
        const frameMap = new Map<number, FrameStore>();

        for (const frame of this.frames) {
            frameMap.set(frame.frameInfo.fileId, frame);
        }

        return frameMap;
    }

    @computed get catalogNum(): number {
        return this.catalogStore.catalogProfileStores.size;
    }

    @computed get catalogNextFileId(): number {
        let id = 1;
        const currentCatalogIds = Array.from(this.catalogStore.catalogProfileStores.keys());
        while (currentCatalogIds?.includes(id) && currentCatalogIds.length) {
            id += 1;
        }
        return id;
    }

    @computed get frameNames(): IOptionProps[] {
        return this.frames?.map((frame, index) => {
            return {
                label: index + ": " + frame.filename,
                value: frame.frameInfo.fileId
            };
        });
    }

    @computed get frameOptions(): FrameOption[] {
        return this.frames?.map((frame, index) => {
            return {
                label: index + ": " + frame.filename,
                value: frame.frameInfo.fileId,
                hasZAxis: frame?.channelInfo !== undefined && frame?.channelInfo !== null
            };
        });
    }

    @computed get frameChannels(): number[] {
        return this.frames.map(frame => frame.requiredChannel);
    }

    @computed get frameStokes(): number[] {
        return this.frames.map(frame => frame.requiredStokes);
    }

    private spatialGroup(baseFrame: FrameStore): FrameStore[] {
        if (!this.frames || !this.frames.length || !this.activeFrame) {
            return [];
        }

        const baseGroupFrames = [];
        for (const frame of this.frames) {
            const groupMember =
                frame === baseFrame || // Frame is the base
                frame === baseFrame.spatialReference || // Frame is the active frame's reference
                frame.spatialReference === baseFrame || // Frame is a secondary image of the active frame
                (frame.spatialReference && frame.spatialReference === baseFrame.spatialReference); // Frame has the same reference as the base frame

            if (groupMember) {
                baseGroupFrames.push(frame);
            }
        }

        return baseGroupFrames;
    }

    @computed get spatialAndSpectalMatchedFileIds(): number[] {
        let matchedIds = [];
        if (this.spatialReference) {
            matchedIds.push(this.spatialReference.frameInfo.fileId);
        }

        const spatialMatchedFileIds = this.spatialReference?.spatialSiblings?.map(matchedFrame => {
            return matchedFrame.frameInfo.fileId;
        });
        const spectralMatchedFileIds = this.spatialReference?.spectralSiblings?.map(matchedFrame => {
            return matchedFrame.frameInfo.fileId;
        });
        spatialMatchedFileIds?.forEach(spatialMatchedFileId => {
            if (spectralMatchedFileIds?.includes(spatialMatchedFileId)) {
                matchedIds.push(spatialMatchedFileId);
            }
        });
        return matchedIds;
    }

    // Calculates which frames have a contour visible as a function of each visible frame
    @computed get contourFrames(): Map<FrameStore, FrameStore[]> {
        const frameMap = new Map<FrameStore, FrameStore[]>();
        for (const frame of this.visibleFrames) {
            const group = this.spatialGroup(frame).filter(f => f.contourConfig.enabled && f.contourConfig.visible);
            frameMap.set(frame, group);
        }
        return frameMap;
    }

    @action addFrame = (ack: CARTA.IOpenFileAck, directory: string, hdu: string): boolean => {
        if (!ack) {
            return false;
        }

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
            renderMode: CARTA.RenderMode.RASTER,
            beamTable: ack.beamTable
        };

        let newFrame = new FrameStore(frameInfo);

        // Place frame in frame array (replace frame with the same ID if it exists)
        const existingFrameIndex = this.frames.findIndex(f => f.frameInfo.fileId === ack.fileId);
        if (existingFrameIndex !== -1) {
            this.frames[existingFrameIndex].clearContours(false);
            this.frames[existingFrameIndex] = newFrame;
        } else {
            this.frames.push(newFrame);
        }

        // First image defaults to spatial reference and contour source
        if (this.frames.length === 1) {
            this.setSpatialReference(this.frames[0]);
            this.setRasterScalingReference(this.frames[0]);
            this.setContourDataSource(this.frames[0]);
        }

        // Use this image as a spectral reference if it has a spectral axis and there isn't an existing spectral reference
        if (newFrame.frameInfo.fileInfoExtended.depth > 1 && (this.frames.length === 1 || !this.spectralReference)) {
            this.setSpectralReference(newFrame);
        }

        this.setActiveFrame(newFrame);
        // init image associated catalog
        this.catalogStore.updateImageAssociatedCatalogId(newFrame.frameInfo.fileId, []);

        // Set animation mode to frame if the new image is 2D, or to channel if the image is 3D and there are no other frames
        if (newFrame.frameInfo.fileInfoExtended.depth <= 1 && newFrame.frameInfo.fileInfoExtended.stokes <= 1) {
            this.animatorStore.setAnimationMode(AnimationMode.FRAME);
        } else if (newFrame.frameInfo.fileInfoExtended.depth > 1) {
            this.animatorStore.setAnimationMode(AnimationMode.CHANNEL);
        } else if (newFrame.frameInfo.fileInfoExtended.stokes > 1) {
            this.animatorStore.setAnimationMode(AnimationMode.STOKES);
        }

        if (this.frames.length > 1) {
            if (this.preferenceStore.autoWCSMatching & WCSMatchingType.SPATIAL && this.spatialReference !== newFrame) {
                this.setSpatialMatchingEnabled(newFrame, true);
            }
            if (this.preferenceStore.autoWCSMatching & WCSMatchingType.SPECTRAL && this.spectralReference !== newFrame && newFrame.frameInfo.fileInfoExtended.depth > 1) {
                this.setSpectralMatchingEnabled(newFrame, true);
            }
        }
        this.fileBrowserStore.saveStartingDirectory(newFrame.frameInfo.directory);

        return true;
    };

    loadFile = async (path: string, filename: string, hdu: string) => {
        this.startFileLoading();

        if (!filename) {
            const lastDirSeparator = path.lastIndexOf("/");
            if (lastDirSeparator >= 0) {
                filename = path.substring(lastDirSeparator + 1);
                path = path.substring(0, lastDirSeparator);
            }
        } else if (!path && filename.includes("/")) {
            const lastDirSeparator = filename.lastIndexOf("/");
            if (lastDirSeparator >= 0) {
                path = filename.substring(0, lastDirSeparator);
                filename = filename.substring(lastDirSeparator + 1);
            }
        }

        // Separate HDU and filename if no HDU is specified
        if (!hdu?.length) {
            const hduRegex = /^(.*)\[(\S+)]$/;
            const matches = hduRegex.exec(filename);
            // Three matching groups. Second is filename, third is HDU
            if (matches?.length === 3) {
                filename = matches[1];
                hdu = matches[2];
            }
        }

        try {
            const ack = await this.backendService.loadFile(path, filename, hdu, this.fileCounter, CARTA.RenderMode.RASTER);
            this.fileCounter++;
            if (!this.addFrame(ack, path, hdu)) {
                AppToaster.show({icon: "warning-sign", message: "Load file failed.", intent: "danger", timeout: 3000});
            }
            this.endFileLoading();
            this.fileBrowserStore.hideFileBrowser();
            WidgetsStore.ResetWidgetPlotXYBounds(this.widgetsStore.spatialProfileWidgets);
            WidgetsStore.ResetWidgetPlotXYBounds(this.widgetsStore.spectralProfileWidgets);
            WidgetsStore.ResetWidgetPlotXYBounds(this.widgetsStore.stokesAnalysisWidgets);
            // Ensure loading finishes before next file is added
            await this.delay(10);
            return this.getFrame(ack.fileId);
        } catch (err) {
            this.alertStore.showAlert(`Error loading file: ${err}`);
            this.endFileLoading();
            throw err;
        }
    };

    loadConcatStokes = async (stokesFiles: CARTA.IStokesFile[], directory: string, hdu: string) => {
        this.startFileLoading();
        try {
            const ack = await this.backendService.loadStokeFiles(stokesFiles, this.fileCounter, CARTA.RenderMode.RASTER);
            this.fileCounter++;
            if (!this.addFrame(ack.openFileAck, directory, hdu)) {
                AppToaster.show({icon: "warning-sign", message: "Load file failed.", intent: "danger", timeout: 3000});
            }
            this.endFileLoading();
            this.fileBrowserStore.hideFileBrowser();
            AppStore.Instance.dialogStore.hideStokesDialog();
            WidgetsStore.ResetWidgetPlotXYBounds(this.widgetsStore.spatialProfileWidgets);
            WidgetsStore.ResetWidgetPlotXYBounds(this.widgetsStore.spectralProfileWidgets);
            WidgetsStore.ResetWidgetPlotXYBounds(this.widgetsStore.stokesAnalysisWidgets);
            return ack.openFileAck.fileId;
        } catch (err) {
            console.log(err);
            this.alertStore.showAlert(`Error loading files: ${err}`);
            this.endFileLoading();
            throw err;
        }
    };

    @action appendConcatFile = (stokesFiles: CARTA.IStokesFile[], directory: string, hdu: string) => {
        // Stop animations playing before loading a new frame
        this.animatorStore.stopAnimation();
        return this.loadConcatStokes(stokesFiles, directory, hdu);
    };

    @action openConcatFile = (stokesFiles: CARTA.IStokesFile[], directory: string, hdu: string) => {
        this.removeAllFrames();
        return this.loadConcatStokes(stokesFiles, directory, hdu);
    };

    /**
     * Appends a file at the given path to the list of existing open files
     * @access public
     * @async
     * @param path - path to the parent directory of the file to open, or of the file itself
     * @param {string=} filename - filename of the file to open
     * @param {string=} hdu - HDU to open. If left blank, the first image HDU will be opened
     * @return {Promise<FrameStore>} [async] the FrameStore the opened file
     */
    @action appendFile = async (path: string, filename: string, hdu: string) => {
        // Stop animations playing before loading a new frame
        this.animatorStore.stopAnimation();
        return this.loadFile(path, filename, hdu);
    };

    /**
     * Closes all existing files and opens a file at the given path
     * @param path - path to the parent directory of the file to open, or of the file itself
     * @param {string=} filename - filename of the file to open
     * @param {string=} hdu - HDU to open. If left blank, the first image HDU will be opened
     * @return {Promise<FrameStore>} [async] the FrameStore of the opened file
     */
    @action openFile = (path: string, filename?: string, hdu?: string) => {
        this.removeAllFrames();
        return this.loadFile(path, filename, hdu);
    };

    saveFile = async (directory: string, filename: string, fileType: CARTA.FileType, regionId?: number, channels?: number[], stokes?: number[], shouldDropDegenerateAxes?: boolean) => {
        if (!this.activeFrame) {
            throw new Error("No active image");
        }
        this.startFileSaving();
        const fileId = this.activeFrame.frameInfo.fileId;
        try {
            const ack = await this.backendService.saveFile(fileId, directory, filename, fileType, regionId, channels, stokes, !shouldDropDegenerateAxes);
            AppToaster.show({icon: "saved", message: `${filename} saved.`, intent: "success", timeout: 3000});
            this.fileBrowserStore.hideFileBrowser();
            this.endFileSaving();
            return ack.fileId;
        } catch (err) {
            console.error(err);
            AppToaster.show({icon: "warning-sign", message: err, intent: "danger", timeout: 3000});
            this.endFileSaving();
            throw err;
        }
    };

    @action closeFile = async (frame: FrameStore, confirmClose: boolean = true) => {
        if (!frame) {
            return;
        }
        // Display confirmation if image has secondary images
        const secondaries = frame.secondarySpatialImages.concat(frame.secondarySpectralImages).filter(distinct);
        const numSecondaries = secondaries.length;

        if (confirmClose && numSecondaries) {
            const confirmed = await this.alertStore.showInteractiveAlert(`${numSecondaries} image${numSecondaries > 1 ? "s that are" : " that is"} matched to this image will be unmatched.`);
            if (confirmed) {
                this.removeFrame(frame);
            }
        } else {
            this.removeFrame(frame);
        }
    };

    /**
     * Closes the currently active image
     * @param confirmClose [boolean=] - Flag indicating whether to display a confirmation dialog before closing
     */
    @action closeCurrentFile = (confirmClose: boolean = false) => {
        if (!this.appendFileDisabled) {
            this.closeFile(this.activeFrame, confirmClose);
        }
    };

    @action closeOtherFiles = (frame: FrameStore, confirmClose: boolean = true) => {
        const otherFiles = this.frames.filter(f => f !== frame);
        for (const f of otherFiles) {
            this.closeFile(f, confirmClose);
        }
    };

    @action removeFrame = (frame: FrameStore) => {
        if (frame) {
            // Stop animations playing before removing frame
            this.animatorStore.stopAnimation();
            // Unlink any associated secondary images
            // Create a copy of the array, since clearing the spatial reference will modify it
            const secondarySpatialImages = frame.secondarySpatialImages.slice();
            for (const f of secondarySpatialImages) {
                f.clearSpatialReference();
            }
            // Create a copy of the array, since clearing the spatial reference will modify it
            const secondarySpectralImages = frame.secondarySpectralImages.slice();
            for (const f of secondarySpectralImages) {
                f.clearSpectralReference();
            }

            const removedFrameIsSpatialReference = frame === this.spatialReference;
            const removedFrameIsSpectralReference = frame === this.spectralReference;
            const removedFrameIsRasterScalingReference = frame === this.rasterScalingReference;
            const fileId = frame.frameInfo.fileId;

            // adjust requirements for stores
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.statsWidgets, fileId);
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.histogramWidgets, fileId);
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.spatialProfileWidgets, fileId);
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.spectralProfileWidgets, fileId);
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.stokesAnalysisWidgets, fileId);

            // clear existing requirements for the frame
            this.spectralRequirements.delete(fileId);
            this.spatialRequirements.delete(fileId);
            this.statsRequirements.delete(fileId);
            this.histogramRequirements.delete(fileId);

            this.tileService.handleFileClosed(fileId);

            if (this.backendService.closeFile(fileId)) {
                frame.clearSpatialReference();
                frame.clearSpectralReference();
                frame.clearContours(false);
                this.frames = this.frames.filter(f => f.frameInfo.fileId !== fileId);
                const firstFrame = this.frames.length ? this.frames[0] : null;
                // Clean up if frame is active
                if (this.activeFrame.frameInfo.fileId === fileId) {
                    this.activeFrame = firstFrame;
                }
                // Clean up if frame is contour data source
                if (this.contourDataSource.frameInfo.fileId === fileId) {
                    this.contourDataSource = firstFrame;
                }
                // Clean up if frame is currently spatial reference
                if (removedFrameIsSpatialReference) {
                    const newReference = firstFrame;
                    if (newReference) {
                        this.setSpatialReference(newReference);
                    } else {
                        this.clearSpatialReference();
                    }
                }
                // Clean up if frame is currently spectral reference
                if (removedFrameIsSpectralReference) {
                    // New spectral reference must have spectral axis
                    const spectralFrames = this.frames.filter(f => f.frameInfo.fileInfoExtended.depth > 1);
                    const newReference = spectralFrames.length ? spectralFrames[0] : null;
                    if (newReference) {
                        this.setSpectralReference(newReference);
                    } else {
                        this.clearSpectralReference();
                    }
                }

                if (removedFrameIsRasterScalingReference) {
                    const newReference = firstFrame;
                    if (newReference) {
                        this.setRasterScalingReference(newReference);
                    } else {
                        this.clearRasterScalingReference();
                    }
                }

                // TODO: check this
                this.tileService.handleFileClosed(fileId);
                // Clean up if frame has associated catalog files
                if (this.catalogNum) {
                    CatalogStore.Instance.closeAssociatedCatalog(fileId);
                    if (firstFrame) {
                        CatalogStore.Instance.resetActiveCatalogFile(firstFrame.frameInfo.fileId);
                    }
                }
            }
        }
    };

    @action removeAllFrames = () => {
        // Stop animations playing before removing frames
        this.animatorStore.stopAnimation();
        if (this.backendService.closeFile(-1)) {
            this.activeFrame = null;
            this.tileService.clearCompressedCache(-1);
            this.frames.forEach(frame => {
                frame.clearContours(false);
                const fileId = frame.frameInfo.fileId;
                this.tileService.handleFileClosed(fileId);
                if (this.catalogNum) {
                    CatalogStore.Instance.closeAssociatedCatalog(fileId);
                }
            });
            this.frames = [];
            // adjust requirements for stores
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.statsWidgets);
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.histogramWidgets);
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.spatialProfileWidgets);
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.spectralProfileWidgets);
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.stokesAnalysisWidgets);
        }
    };

    @action shiftFrame = (delta: number) => {
        if (this.activeFrame && this.frames.length > 1) {
            const frameIds = this.frames.map(f => f.frameInfo.fileId);
            const currentIndex = frameIds.indexOf(this.activeFrame.frameInfo.fileId);
            const requiredIndex = (this.frames.length + currentIndex + delta) % this.frames.length;
            this.setActiveFrameByIndex(requiredIndex);
        }
    };

    @action nextFrame = () => {
        this.shiftFrame(+1);
    };

    @action prevFrame = () => {
        this.shiftFrame(-1);
    };

    // Open catalog file
    appendCatalog = async (directory: string, file: string, previewDataSize: number, type: CARTA.CatalogFileType) => {
        return new Promise<number>((resolve, reject) => {
            if (!this.activeFrame) {
                AppToaster.show(ErrorToast("Please load the image file"));
                throw new Error("No image file");
            }
            if (!(type === CARTA.CatalogFileType.VOTable)) {
                AppToaster.show(ErrorToast("Catalog type not supported"));
                throw new Error("Catalog type not supported");
            }
            this.startFileLoading();

            const frame = this.activeFrame;
            const fileId = this.catalogNextFileId;

            this.backendService.loadCatalogFile(directory, file, fileId, previewDataSize).then(
                ack =>
                    runInAction(() => {
                        this.endFileLoading();
                        if (frame && ack.success && ack.dataSize) {
                            let catalogInfo: CatalogInfo = {fileId, directory, fileInfo: ack.fileInfo, dataSize: ack.dataSize};
                            const columnData = ProtobufProcessing.ProcessCatalogData(ack.previewData);
                            let catalogWidgetId = this.updateCatalogProfile(fileId, frame);
                            if (catalogWidgetId) {
                                this.catalogStore.catalogWidgets.set(fileId, catalogWidgetId);
                                this.catalogStore.addCatalog(fileId, ack.dataSize);
                                this.fileBrowserStore.hideFileBrowser();
                                const catalogProfileStore = new CatalogProfileStore(catalogInfo, ack.headers, columnData, CatalogType.FILE);
                                this.catalogStore.catalogProfileStores.set(fileId, catalogProfileStore);
                                resolve(fileId);
                            } else {
                                reject();
                            }
                        } else {
                            reject();
                        }
                    }),
                error => {
                    console.error(error);
                    AppToaster.show(ErrorToast(error));
                    this.endFileLoading();
                    reject(error);
                }
            );
        });
    };

    updateCatalogProfile = (fileId: number, frame: FrameStore): string => {
        let catalogWidgetId;
        // update image associated catalog file
        let associatedCatalogFiles = [];
        const catalogStore = CatalogStore.Instance;
        const catalogComponentSize = catalogStore.catalogProfiles.size;
        let currentAssociatedCatalogFile = catalogStore.imageAssociatedCatalogId.get(frame.frameInfo.fileId);
        if (currentAssociatedCatalogFile?.length) {
            associatedCatalogFiles = currentAssociatedCatalogFile;
        } else {
            // new image append
            catalogStore.catalogProfiles.forEach((value, componentId) => {
                catalogStore.catalogProfiles.set(componentId, fileId);
            });
        }
        associatedCatalogFiles.push(fileId);
        catalogStore.updateImageAssociatedCatalogId(AppStore.Instance.activeFrame.frameInfo.fileId, associatedCatalogFiles);

        if (catalogComponentSize === 0) {
            const catalog = this.widgetsStore.createFloatingCatalogWidget(fileId);
            catalogWidgetId = catalog.widgetStoreId;
            catalogStore.catalogProfiles.set(catalog.widgetComponentId, fileId);
        } else {
            catalogWidgetId = this.widgetsStore.addCatalogWidget(fileId);
            const key = catalogStore.catalogProfiles.keys().next().value;
            catalogStore.catalogProfiles.set(key, fileId);
        }
        return catalogWidgetId;
    };

    @action removeCatalog(fileId: number, catalogWidgetId: string, catalogComponentId?: string) {
        if (fileId > -1 && this.backendService.closeCatalogFile(fileId)) {
            const catalogStore = CatalogStore.Instance;
            // close all associated catalog plots widgets
            catalogStore.clearCatalogPlotsByFileId(fileId);
            // remove catalog overlay widget store
            this.catalogStore.catalogWidgets.delete(fileId);
            this.widgetsStore.catalogWidgets.delete(catalogWidgetId);
            // remove overlay
            catalogStore.removeCatalog(fileId, catalogComponentId);
            // remove profile store
            catalogStore.catalogProfileStores.delete(fileId);

            if (!this.activeFrame) {
                return;
            }
        }
    }

    @action sendCatalogFilter(catalogFilter: CARTA.CatalogFilterRequest) {
        if (!this.activeFrame) {
            return;
        }
        this.backendService.setCatalogFilterRequest(catalogFilter);
    }

    @action reorderFrame = (oldIndex: number, newIndex: number, length: number) => {
        if (
            !Number.isInteger(oldIndex) ||
            oldIndex < 0 ||
            oldIndex >= this.frameNum ||
            !Number.isInteger(newIndex) ||
            newIndex < 0 ||
            newIndex >= this.frameNum ||
            !Number.isInteger(length) ||
            length <= 0 ||
            length >= this.frameNum ||
            oldIndex === newIndex
        ) {
            return;
        }
        this.frames = Utils.reorderArray(this.frames, oldIndex, newIndex, length);
    };

    // Region file actions
    importRegion = async (directory: string, file: string, type: CARTA.FileType | CARTA.CatalogFileType) => {
        if (!this.activeFrame || !(type === CARTA.FileType.CRTF || type === CARTA.FileType.DS9_REG)) {
            AppToaster.show(ErrorToast("Region type not supported"));
            return;
        }

        // ensure that the same frame is used in the callback, to prevent issues when the active frame changes while the region is being imported
        const frame = this.activeFrame;
        try {
            const ack = await this.backendService.importRegion(directory, file, type, frame.frameInfo.fileId);
            if (frame && ack.success && ack.regions) {
                const regions = Object.entries(ack.regions);
                const regionStyleMap = new Map<string, CARTA.IRegionStyle>(Object.entries(ack.regionStyles));
                let startIndex = 0;
                while (startIndex < regions.length) {
                    this.addRegionsInBatch(regions, regionStyleMap, startIndex, IMPORT_REGION_BATCH_SIZE);
                    startIndex += IMPORT_REGION_BATCH_SIZE;
                    await this.delay(0);
                }
                this.fileBrowserStore.setImportingRegions(false);
                this.fileBrowserStore.resetLoadingStates();
                this.fileBrowserStore.hideFileBrowser();
            }
        } catch (err) {
            console.error(err);
            AppToaster.show(ErrorToast(err));
        }
    };

    @action addRegionsInBatch = (regions: [string, CARTA.IRegionInfo][], regionStyleMap: Map<string, CARTA.IRegionStyle>, startIndex: number, count: number) => {
        if (!regions || !regionStyleMap || !isFinite(startIndex)) {
            return;
        }

        const frame = this.activeFrame;
        const batchEnd = Math.min(startIndex + count, regions.length);
        for (let i = startIndex; i < batchEnd; i++) {
            const [regionIdString, regionInfo] = regions[i];
            const styleInfo = regionStyleMap.get(regionIdString);
            frame.regionSet.addExistingRegion(regionInfo.controlPoints as Point2D[], regionInfo.rotation, regionInfo.regionType, parseInt(regionIdString), styleInfo?.name, styleInfo?.color, styleInfo?.lineWidth, styleInfo?.dashList);
        }
        this.fileBrowserStore.updateLoadingState(batchEnd / regions.length, batchEnd, regions.length);
    };

    exportRegions = async (directory: string, file: string, coordType: CARTA.CoordinateType, fileType: RegionFileType, exportRegions: number[]) => {
        const frame = this.activeFrame;
        // Prevent exporting if only the cursor region exists
        if (!frame.regionSet?.regions || frame.regionSet.regions.length <= 1 || exportRegions?.length < 1) {
            return;
        }

        const regionStyles = new Map<number, CARTA.IRegionStyle>();
        for (const region of exportRegions.map(value => frame.regionSet.regions[value])) {
            regionStyles.set(region.regionId, {
                name: region.name,
                color: region.color,
                lineWidth: region.lineWidth,
                dashList: region.dashLength ? [region.dashLength] : []
            });
        }

        try {
            await this.backendService.exportRegion(directory, file, fileType, coordType, frame.frameInfo.fileId, regionStyles);
            AppToaster.show(SuccessToast("saved", `Exported regions for ${frame.filename} using ${coordType === CARTA.CoordinateType.WORLD ? "world" : "pixel"} coordinates`));
            this.fileBrowserStore.hideFileBrowser();
        } catch (err) {
            console.error(err);
            AppToaster.show(ErrorToast(err));
        }
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

    @action requestMoment = async (message: CARTA.IMomentRequest, frame: FrameStore) => {
        if (!message || !frame) {
            return;
        }

        this.startFileLoading();
        // clear previously generated moment images under this frame
        if (frame.momentImages && frame.momentImages.length > 0) {
            frame.momentImages.forEach(momentFrame => this.closeFile(momentFrame));
        }
        frame.removeMomentImage();

        this.restartTaskProgress();

        try {
            const ack = await this.backendService.requestMoment(message);
            if (!ack.cancel && ack.openFileAcks) {
                for (const openFileAck of ack.openFileAcks) {
                    if (this.addFrame(CARTA.OpenFileAck.create(openFileAck), this.fileBrowserStore.startingDirectory, "")) {
                        this.fileCounter++;
                        frame.addMomentImage(this.frames.find(f => f.frameInfo.fileId === openFileAck.fileId));
                    } else {
                        AppToaster.show({icon: "warning-sign", message: "Load file failed.", intent: "danger", timeout: 3000});
                    }
                }
            }
            frame.resetMomentRequestState();
            this.endFileLoading();
        } catch (err) {
            frame.resetMomentRequestState();
            this.endFileLoading();
            console.error(err);
        }
    };

    @action cancelRequestingMoment = (fileId: number = -1) => {
        const frame = this.getFrame(fileId);
        if (frame && frame.requestingMomentsProgress < 1.0) {
            this.backendService.cancelRequestingMoment(fileId);
        }
    };

    @action setAstReady = (val: boolean) => {
        this.astReady = val;
    };

    @action setDarkTheme = () => {
        this.setTheme(Theme.DARK);
    };

    @action setLightTheme = () => {
        this.setTheme(Theme.LIGHT);
    };

    @action setAutoTheme = () => {
        this.setTheme(Theme.AUTO);
    };

    @action setTheme = (theme: string) => {
        if (Theme.isValid(theme)) {
            this.preferenceStore.setPreference(PreferenceKeys.GLOBAL_THEME, theme);
            this.updateASTColors();
        }
    };

    private updateASTColors() {
        if (this.astReady) {
            const astColors = [
                getColorForTheme(this.overlayStore.global.color),
                getColorForTheme(this.overlayStore.title.color),
                getColorForTheme(this.overlayStore.grid.color),
                getColorForTheme(this.overlayStore.border.color),
                getColorForTheme(this.overlayStore.ticks.color),
                getColorForTheme(this.overlayStore.axes.color),
                getColorForTheme(this.overlayStore.numbers.color),
                getColorForTheme(this.overlayStore.labels.color),
                getColorForTheme(this.activeFrame ? this.activeFrame.distanceMeasuring?.color : DistanceMeasuringStore.DEFAULT_COLOR)
            ];
            AST.setColors(astColors);
        }
    }

    @action toggleCursorFrozen = () => {
        this.cursorFrozen = !this.cursorFrozen;
    };

    @action setCursorFrozen = (val: boolean) => {
        this.cursorFrozen = val;
    };

    @action toggleToolbarExpanded = () => {
        this.toolbarExpanded = !this.toolbarExpanded;
    };

    @action setToolbarExpanded = (val: boolean) => {
        this.toolbarExpanded = val;
    };

    @action updateActiveLayer = (layer: ImageViewLayer) => {
        this.activeLayer = layer;
    };

    @action toggleActiveLayer = () => {
        this.activeLayer = this.activeLayer === ImageViewLayer.RegionCreating ? ImageViewLayer.RegionMoving : ImageViewLayer.RegionCreating;
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
        CARTA.StatsType.Max,
        CARTA.StatsType.Extrema
    ];
    private static readonly CursorThrottleTime = 200;
    private static readonly CursorThrottleTimeRotated = 100;
    private static readonly ImageThrottleTime = 50;
    private static readonly ImageChannelThrottleTime = 500;
    private static readonly RequirementsCheckInterval = 200;

    private spectralRequirements: Map<number, Map<number, CARTA.SetSpectralRequirements>>;
    private spatialRequirements: Map<number, Map<number, CARTA.SetSpatialRequirements>>;
    private statsRequirements: Map<number, Map<number, CARTA.SetStatsRequirements>>;
    private histogramRequirements: Map<number, Map<number, CARTA.SetHistogramRequirements>>;
    private pendingChannelHistograms: Map<string, CARTA.IRegionHistogramData>;

    @action updateChannels = (updates: ChannelUpdate[]) => {
        if (!updates || !updates.length) {
            return;
        }

        for (const update of updates) {
            const frame = update.frame;
            if (!frame) {
                return;
            }

            frame.channel = update.channel;
            frame.stokes = update.stokes;

            if (this.visibleFrames.includes(frame)) {
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
            } else {
                this.tileService.updateHiddenFileChannels(frame.frameInfo.fileId, frame.channel, frame.stokes);
            }
        }
    };

    private updateViews = (updates: ViewUpdate[]) => {
        for (const update of updates) {
            this.updateView(update.tiles, update.fileId, update.channel, update.stokes, update.focusPoint);
        }
    };

    private updateView = (tiles: TileCoordinate[], fileId: number, channel: number, stokes: number, focusPoint: Point2D) => {
        const isAnimating = this.animatorStore.serverAnimationActive;
        if (isAnimating) {
            this.backendService.addRequiredTiles(
                fileId,
                tiles.map(t => t.encode()),
                this.preferenceStore.animationCompressionQuality
            );
        } else {
            this.tileService.requestTiles(tiles, fileId, channel, stokes, focusPoint, this.preferenceStore.imageCompressionQuality);
        }
    };

    private initCarta = async (isAstReady: boolean, isZfpReady: boolean, isCartaComputeReady: boolean, isApiServiceAuthenticated: boolean) => {
        if (isAstReady && isZfpReady && isCartaComputeReady && isApiServiceAuthenticated) {
            try {
                await this.connectToServer();
                await this.preferenceStore.fetchPreferences();
                await this.fileBrowserStore.restoreStartingDirectory();
                await this.layoutStore.fetchLayouts();
                await this.snippetStore.fetchSnippets();

                this.tileService.setCache(this.preferenceStore.gpuTileCache, this.preferenceStore.systemTileCache);
                if (!this.layoutStore.applyLayout(this.preferenceStore.layout)) {
                    AlertStore.Instance.showAlert(`Applying preference layout "${this.preferenceStore.layout}" failed! Resetting preference layout to default.`);
                    this.layoutStore.applyLayout(PresetLayout.DEFAULT);
                    this.preferenceStore.setPreference(PreferenceKeys.GLOBAL_LAYOUT, PresetLayout.DEFAULT);
                }
                await this.loadDefaultFiles();
                this.setCursorFrozen(this.preferenceStore.isCursorFrozen);
                this.updateASTColors();
            } catch (err) {
                console.error(err);
            }
        }
    };

    private constructor() {
        makeObservable(this);
        AppStore.staticInstance = this;
        window["app"] = this;
        window["carta"] = this;
        // Assign service instances
        this.backendService = BackendService.Instance;
        this.tileService = TileService.Instance;
        this.scriptingService = ScriptingService.Instance;
        this.apiService = ApiService.Instance;

        // Assign lower level store instances
        this.alertStore = AlertStore.Instance;
        this.animatorStore = AnimatorStore.Instance;
        this.catalogStore = CatalogStore.Instance;
        this.dialogStore = DialogStore.Instance;
        this.fileBrowserStore = FileBrowserStore.Instance;
        this.helpStore = HelpStore.Instance;
        this.layoutStore = LayoutStore.Instance;
        this.snippetStore = SnippetStore.Instance;
        this.logStore = LogStore.Instance;
        this.preferenceStore = PreferenceStore.Instance;
        this.overlayStore = OverlayStore.Instance;
        this.widgetsStore = WidgetsStore.Instance;

        this.astReady = false;
        this.cartaComputeReady = false;
        this.spatialProfiles = new Map<string, SpatialProfileStore>();
        this.spectralProfiles = new Map<FileId, ObservableMap<RegionId, SpectralProfileStore>>();
        this.regionStats = new Map<number, ObservableMap<number, ObservableMap<number, CARTA.RegionStatsData>>>();
        this.regionHistograms = new Map<number, ObservableMap<number, ObservableMap<number, CARTA.IRegionHistogramData>>>();
        this.pendingChannelHistograms = new Map<string, CARTA.IRegionHistogramData>();

        this.frames = [];
        this.activeFrame = null;
        this.hoveredFrame = null;
        this.contourDataSource = null;
        this.syncFrameToContour = true;
        this.syncContourToFrame = true;
        this.initRequirements();
        this.activeLayer = ImageViewLayer.RegionMoving;
        this.toolbarExpanded = true;

        AST.onReady.then(
            action(() => {
                this.setAstReady(true);
                this.logStore.addInfo("AST library loaded", ["ast"]);
            })
        );

        CARTACompute.onReady.then(
            action(() => {
                this.cartaComputeReady = true;
                this.logStore.addInfo("Compute module loaded", ["compute"]);
            })
        );

        // Log the frontend git commit hash
        this.logStore.addDebug(`Current frontend version: ${GitCommit.logMessage}`, ["version"]);
        this.previousConnectionStatus = ConnectionStatus.CLOSED;

        // Adjust document background when theme changes
        autorun(() => {
            document.body.style.backgroundColor = this.darkTheme ? Colors.DARK_GRAY4 : Colors.WHITE;
            const className = this.darkTheme ? Classes.DARK : "";
            setHotkeysDialogProps({className});
        });

        // Watch for system theme preference changes
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        if (mediaQuery) {
            if (mediaQuery.addEventListener) {
                mediaQuery.addEventListener("change", changeEvent => this.handleThemeChange(changeEvent.matches));
            } else if (mediaQuery.addListener) {
                // Workaround for Safari
                // @ts-ignore
                mediaQuery.addListener(changeEvent => handleThemeChange(changeEvent.matches));
            }
        }
        this.handleThemeChange(mediaQuery.matches);

        // Display toasts when connection status changes
        autorun(() => {
            const newConnectionStatus = this.backendService.connectionStatus;
            const userString = this.username ? ` as ${this.username}` : "";
            switch (newConnectionStatus) {
                case ConnectionStatus.ACTIVE:
                    AppToaster.clear();
                    if (this.backendService.connectionDropped) {
                        AppToaster.show(WarningToast(`Reconnected to server${userString}. Some errors may occur`));
                    } else {
                        AppToaster.show(SuccessToast("swap-vertical", `Connected to CARTA server${userString}`));
                    }
                    break;
                case ConnectionStatus.CLOSED:
                    if (this.previousConnectionStatus === ConnectionStatus.ACTIVE || this.previousConnectionStatus === ConnectionStatus.PENDING) {
                        AppToaster.show(ErrorToast("Disconnected from server"));
                        this.alertStore
                            .showRetryAlert("You have been disconnected from the server. Do you want to reconnect? Please note that temporary images such as moment images or PV images generated via the GUI will be unloaded.")
                            .then(this.onReconnectAlertClosed);
                    }
                    break;
                default:
                    break;
            }
            this.previousConnectionStatus = newConnectionStatus;
        });

        // Throttled functions for use in autoruns
        const throttledSetViews = _.throttle(this.updateViews, AppStore.ImageThrottleTime);
        const throttledSetChannels = _.throttle(this.updateChannels, AppStore.ImageChannelThrottleTime);
        const throttledSetCursorRotated = _.throttle(this.setCursor, AppStore.CursorThrottleTimeRotated);
        const throttledSetCursor = _.throttle(this.setCursor, AppStore.CursorThrottleTime);
        // Low-bandwidth mode
        const throttledSetCursorLowBandwidth = _.throttle(this.setCursor, AppStore.CursorThrottleTime * 2);

        // Update frame view for each visible frame
        autorun(() => {
            // Ignore view changes when zooming if preference not set
            if (this.activeFrame && (!this.activeFrame.zooming || this.preferenceStore.streamContoursWhileZooming)) {
                // Group all view updates for visible images into one throttled call
                const viewUpdates: ViewUpdate[] = [];
                for (const frame of this.visibleFrames) {
                    const reqView = frame.requiredFrameView;
                    let croppedReq: FrameView = {
                        xMin: Math.max(0, reqView.xMin),
                        xMax: Math.min(frame.frameInfo.fileInfoExtended.width, reqView.xMax),
                        yMin: Math.max(0, reqView.yMin),
                        yMax: Math.min(frame.frameInfo.fileInfoExtended.height, reqView.yMax),
                        mip: reqView.mip
                    };

                    const imageSize: Point2D = {x: frame.frameInfo.fileInfoExtended.width, y: frame.frameInfo.fileInfoExtended.height};
                    const tiles = GetRequiredTiles(croppedReq, imageSize, {x: 256, y: 256});
                    const midPointImageCoords = {x: (reqView.xMax + reqView.xMin) / 2.0, y: (reqView.yMin + reqView.yMax) / 2.0};
                    const tileSizeFullRes = reqView.mip * 256;
                    const midPointTileCoords = {x: midPointImageCoords.x / tileSizeFullRes - 0.5, y: midPointImageCoords.y / tileSizeFullRes - 0.5};
                    if (tiles.length) {
                        viewUpdates.push({tiles, fileId: frame.frameInfo.fileId, channel: frame.channel, stokes: frame.stokes, focusPoint: midPointTileCoords});
                    }
                }
                throttledSetViews(viewUpdates);

                // TODO: this should be separate
                if (!this.activeFrame) {
                    this.widgetsStore.updateImageWidgetTitle(this.layoutStore.dockedLayout);
                }
            }
        });

        // TODO: Move setChannels actions to AppStore and remove this autorun
        // Update channels when manually changed
        autorun(() => {
            if (this.activeFrame) {
                const updates: ChannelUpdate[] = [];
                // Calculate if new data is required for the active channel
                const updateRequiredChannels = this.activeFrame.requiredChannel !== this.activeFrame.channel || this.activeFrame.requiredStokes !== this.activeFrame.stokes;
                // Don't auto-update when animation is playing
                if (!this.animatorStore.animationActive && updateRequiredChannels) {
                    updates.push({frame: this.activeFrame, channel: this.activeFrame.requiredChannel, stokes: this.activeFrame.requiredStokes});
                }

                // Update any sibling channels
                this.activeFrame.spectralSiblings.forEach(frame => {
                    const siblingUpdateRequired = frame.requiredChannel !== frame.channel || frame.requiredStokes !== frame.stokes;
                    if (siblingUpdateRequired) {
                        updates.push({frame, channel: frame.requiredChannel, stokes: frame.requiredStokes});
                    }
                });

                if (updates.length) {
                    throttledSetChannels(updates);
                }
            }
        });

        // Update cursor profiles
        autorun(() => {
            const pos = this.hoveredFrame?.cursorInfo?.posImageSpace;
            if (pos) {
                if (this.preferenceStore.lowBandwidthMode) {
                    throttledSetCursorLowBandwidth(this.hoveredFrame.frameInfo.fileId, pos);
                } else if (this.hoveredFrame.frameInfo.fileFeatureFlags & CARTA.FileFeatureFlags.ROTATED_DATASET) {
                    throttledSetCursorRotated(this.hoveredFrame.frameInfo.fileId, pos);
                } else {
                    throttledSetCursor(this.hoveredFrame.frameInfo.fileId, pos);
                }
            }
        });

        // Set overlay defaults from current frame
        autorun(() => {
            if (this.activeFrame) {
                this.overlayStore.setDefaultsFromAST(this.activeFrame);
            }
        });

        // Update image panel page buttons
        autorun(() => {
            if (this.activeFrame && this.numImageColumns && this.numImageRows) {
                this.widgetsStore.updateImagePanelPageButtons();
            }
        });

        // Update requirements every 200 ms
        setInterval(this.recalculateRequirements, AppStore.RequirementsCheckInterval);

        // Subscribe to frontend streams
        this.backendService.spatialProfileStream.subscribe(this.handleSpatialProfileStream);
        this.backendService.spectralProfileStream.subscribe(this.handleSpectralProfileStream);
        this.backendService.histogramStream.subscribe(this.handleRegionHistogramStream);
        this.backendService.contourStream.subscribe(this.handleContourImageStream);
        this.backendService.catalogStream.subscribe(this.handleCatalogFilterStream);
        this.backendService.errorStream.subscribe(this.handleErrorStream);
        this.backendService.statsStream.subscribe(this.handleRegionStatsStream);
        this.backendService.momentProgressStream.subscribe(this.handleMomentProgressStream);
        this.backendService.scriptingStream.subscribe(this.handleScriptingRequest);
        this.tileService.tileStream.subscribe(this.handleTileStream);
        this.backendService.listProgressStream.subscribe(this.handleFileProgressStream);

        // Set auth token from URL if it exists
        const url = new URL(window.location.href);
        const authTokenParam = url.searchParams.get("token");
        if (authTokenParam) {
            this.apiService.setToken(authTokenParam);
        }

        autorun(() => {
            this.initCarta(this.astReady, this.tileService?.zfpReady, this.cartaComputeReady, this.apiService?.authenticated);
        });

        autorun(() => {
            if (this.backendService.connectionStatus === ConnectionStatus.ACTIVE) {
                setTimeout(this.hideSplashScreen, 500);
            } else {
                this.showSplashScreen();
            }
        });

        autorun(() => {
            this.activateStatsPanel(this.preferenceStore.statsPanelEnabled);
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

            // Update cursor value from profile if it is the cursor data
            if (spatialProfileData.regionId === 0) {
                this.getFrame(spatialProfileData.fileId).setCursorValue({x: spatialProfileData.x, y: spatialProfileData.y}, spatialProfileData.channel, spatialProfileData.value);
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
            frameHistogramMap = new ObservableMap<number, ObservableMap<number, CARTA.IRegionHistogramData>>();
            this.regionHistograms.set(regionHistogramData.fileId, frameHistogramMap);
        }

        let regionHistogramMap = frameHistogramMap.get(regionHistogramData.regionId);

        if (!regionHistogramMap) {
            regionHistogramMap = new ObservableMap<number, CARTA.IRegionHistogramData>();
            frameHistogramMap.set(regionHistogramData.regionId, regionHistogramMap);
        }

        regionHistogramMap.set(regionHistogramData.stokes, regionHistogramData);
        // TODO: update histograms directly if the image is not active!

        // Add histogram to pending histogram list
        if (regionHistogramData.regionId === -1) {
            const key = `${regionHistogramData.fileId}_${regionHistogramData.stokes}_${regionHistogramData.channel}`;
            this.pendingChannelHistograms.set(key, regionHistogramData);
        } else if (regionHistogramData.regionId === -2) {
            // Update cube histogram if it is still required
            const updatedFrame = this.getFrame(regionHistogramData.fileId);
            if (updatedFrame) {
                const cubeHist = regionHistogramData.histograms;
                if (cubeHist && (updatedFrame.renderConfig.useCubeHistogram || updatedFrame.renderConfig.useCubeHistogramContours)) {
                    updatedFrame.renderConfig.updateCubeHistogram(cubeHist, regionHistogramData.progress);
                    this.updateTaskProgress(regionHistogramData.progress);
                }
            }
        }
    };

    @action handleTileStream = (tileStreamDetails: TileStreamDetails) => {
        if (this.animatorStore.serverAnimationActive) {
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
                frame.setChannels(tileStreamDetails.channel, tileStreamDetails.stokes, false);
                frame.channel = tileStreamDetails.channel;
                frame.stokes = tileStreamDetails.stokes;
            }
        }

        // Apply pending channel histogram
        const key = `${tileStreamDetails.fileId}_${tileStreamDetails.stokes}_${tileStreamDetails.channel}`;
        const pendingHistogram = this.pendingChannelHistograms.get(key);
        if (pendingHistogram?.histograms) {
            const updatedFrame = this.getFrame(pendingHistogram.fileId);
            const channelHist = pendingHistogram.histograms;
            if (updatedFrame && channelHist) {
                updatedFrame.renderConfig.setStokes(pendingHistogram.stokes);
                updatedFrame.renderConfig.setHistChannel(pendingHistogram.channel);
                updatedFrame.renderConfig.updateChannelHistogram(channelHist);
                updatedFrame.channel = tileStreamDetails.channel;
                updatedFrame.stokes = tileStreamDetails.stokes;
            }
            this.pendingChannelHistograms.delete(key);
        }
    };

    @action handleRegionStatsStream = (regionStatsData: CARTA.RegionStatsData) => {
        if (!regionStatsData) {
            return;
        }

        let frameStatsMap = this.regionStats.get(regionStatsData.fileId);
        if (!frameStatsMap) {
            frameStatsMap = new ObservableMap<number, ObservableMap<number, CARTA.RegionStatsData>>();
            this.regionStats.set(regionStatsData.fileId, frameStatsMap);
        }

        let regionStatsMap = frameStatsMap.get(regionStatsData.regionId);
        if (!regionStatsMap) {
            regionStatsMap = new ObservableMap<number, CARTA.RegionStatsData>();
            frameStatsMap.set(regionStatsData.regionId, regionStatsMap);
        }

        regionStatsMap.set(regionStatsData.stokes, regionStatsData);
    };

    handleContourImageStream = (contourImageData: CARTA.ContourImageData) => {
        const updatedFrame = this.getFrame(contourImageData.fileId);
        if (updatedFrame) {
            updatedFrame.updateFromContourData(contourImageData);
        }
    };

    @action handleCatalogFilterStream = (catalogFilter: CARTA.CatalogFilterResponse) => {
        const catalogFileId = catalogFilter.fileId;
        const catalogProfileStore = this.catalogStore.catalogProfileStores.get(catalogFileId);
        const catalogWidgetStoreId = this.catalogStore.catalogWidgets.get(catalogFileId);

        const progress = catalogFilter.progress;
        if (catalogProfileStore) {
            const catalogData = ProtobufProcessing.ProcessCatalogData(catalogFilter.columns);
            catalogProfileStore.updateCatalogData(catalogFilter, catalogData);
            catalogProfileStore.setProgress(progress);
            if (progress === 1) {
                catalogProfileStore.setLoadingDataStatus(false);
                catalogProfileStore.setUpdatingDataStream(false);
            }

            if (catalogProfileStore.updateMode === CatalogUpdateMode.ViewUpdate) {
                const catalogWidgetStore = this.widgetsStore.catalogWidgets.get(catalogWidgetStoreId);
                const xColumn = catalogWidgetStore.xAxis;
                const yColumn = catalogWidgetStore.yAxis;
                const frame = this.getFrame(this.catalogStore.getFrameIdByCatalogId(catalogFileId));
                if (xColumn && yColumn && frame) {
                    const coords = catalogProfileStore.get2DPlotData(xColumn, yColumn, catalogData);
                    const wcs = frame.validWcs ? frame.wcsInfo : 0;
                    this.catalogStore.convertToImageCoordinate(
                        catalogFileId,
                        coords.wcsX,
                        coords.wcsY,
                        wcs,
                        coords.xHeaderInfo.units,
                        coords.yHeaderInfo.units,
                        catalogProfileStore.catalogCoordinateSystem.system,
                        catalogFilter.subsetEndIndex,
                        catalogFilter.subsetDataSize
                    );
                }
            }
        }
    };

    handleMomentProgressStream = (momentProgress: CARTA.MomentProgress) => {
        if (!momentProgress) {
            return;
        }
        const frame = this.getFrame(momentProgress.fileId);
        if (frame) {
            frame.updateRequestingMomentsProgress(momentProgress.progress);
            this.updateTaskProgress(momentProgress.progress);
        }
    };

    handleFileProgressStream = (fileProgress: CARTA.ListProgress) => {
        if (!fileProgress) {
            return;
        }
        this.fileBrowserStore.updateLoadingState(fileProgress.percentage, fileProgress.checkedCount, fileProgress.totalCount);
        this.fileBrowserStore.showLoadingDialog();
        this.updateTaskProgress(fileProgress.percentage);
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

    handleScriptingRequest = (request: CARTA.IScriptingRequest) => {
        this.scriptingService.handleScriptingRequest(request).then(this.backendService.sendScriptingResponse);
    };

    // endregion

    onReconnectAlertClosed = async () => {
        try {
            const ack = await this.backendService.connect(this.backendService.serverUrl);
            if (ack.sessionType === CARTA.SessionType.RESUMED) {
                console.log(`Reconnected with session ID ${ack.sessionId}`);
                this.logStore.addInfo(`Reconnected to server with session ID ${ack.sessionId}`, ["network"]);
                this.resumeSession();
            }
        } catch (err) {
            console.log(err);
        }
    };

    @action private resumeSession = async () => {
        // Some things should be reset when the user reconnects
        this.animatorStore.stopAnimation();
        this.tileService.clearRequestQueue();

        // Ignore & remove generated in-memory images(moments/PV, fileId >= 1000)
        const inMemoryImages = this.frames.filter(frame => frame.frameInfo.fileId >= 1000);
        inMemoryImages.forEach(frame => this.removeFrame(frame));

        const images: CARTA.IImageProperties[] = this.frames.map(frame => {
            const info = frame.frameInfo;

            let regions = new Map<string, CARTA.IRegionInfo>();
            // Spatially matched images don't have their own regions
            if (!frame.spatialReference) {
                regions = new Map<string, CARTA.IRegionInfo>();

                for (const region of frame.regionSet.regions) {
                    regions.set(region.regionId.toFixed(), {
                        regionType: region.regionType,
                        controlPoints: region.controlPoints,
                        rotation: region.rotation
                    });
                }
            }

            let contourSettings: CARTA.ISetContourParameters;
            if (frame.contourConfig.enabled) {
                contourSettings = {
                    fileId: frame.frameInfo.fileId,
                    levels: frame.contourConfig.levels,
                    smoothingMode: frame.contourConfig.smoothingMode,
                    smoothingFactor: frame.contourConfig.smoothingFactor,
                    decimationFactor: this.preferenceStore.contourDecimation,
                    compressionLevel: this.preferenceStore.contourCompressionLevel,
                    contourChunkSize: this.preferenceStore.contourChunkSize
                };
            }

            return {
                file: info.fileInfo.name,
                directory: info.directory,
                hdu: info.hdu,
                fileId: info.fileId,
                renderMode: info.renderMode,
                channel: frame.requiredChannel,
                stokes: frame.requiredStokes,
                regions: mapToObject(regions),
                contourSettings,
                stokesFiles: frame.stokesFiles
            };
        });

        const catalogFiles: CARTA.IOpenCatalogFile[] = [];

        this.catalogStore.catalogProfileStores.forEach(profileStore => {
            const catalogInfo = profileStore.catalogInfo;
            const existingEntry = catalogFiles.find(entry => entry.fileId === catalogInfo.fileId);
            // Skip duplicates
            if (existingEntry) {
                return;
            }
            catalogFiles.push({
                fileId: catalogInfo.fileId,
                name: catalogInfo.fileInfo.name,
                directory: catalogInfo.directory
            });
        });

        this.resumingSession = true;

        try {
            await this.backendService.resumeSession({images, catalogFiles});
            this.onSessionResumed();
        } catch (err) {
            console.error(err);
            this.alertStore.showAlert("Error resuming session");
        }
    };

    @action private onSessionResumed = () => {
        console.log(`Resumed successfully`);
        // Clear requirements once session has resumed
        this.initRequirements();
        this.resumingSession = false;
        this.backendService.connectionDropped = false;
    };

    @action setActiveFrame(frame: FrameStore) {
        if (!frame) {
            return;
        }

        // Ignore changes when animating
        if (this.animatorStore.serverAnimationActive) {
            return;
        }

        this.changeActiveFrame(frame);
    }

    @action setActiveFrameById(fileId: number) {
        const requiredFrame = this.getFrame(fileId);
        if (requiredFrame) {
            this.setActiveFrame(requiredFrame);
        } else {
            console.log(`Can't find required frame ${fileId}`);
        }
    }

    @action setActiveFrameByIndex(index: number) {
        if (index >= 0 && this.frames.length > index) {
            this.setActiveFrame(this.frames[index]);
        } else {
            console.log(`Invalid frame index ${index}`);
        }
    }

    private changeActiveFrame(frame: FrameStore) {
        if (frame !== this.activeFrame) {
            // Set overlay defaults from current frame
            this.overlayStore.setDefaultsFromAST(frame);
        }
        this.activeFrame = frame;
        this.widgetsStore.updateImageWidgetTitle(this.layoutStore.dockedLayout);
        this.catalogStore.resetActiveCatalogFile(frame.frameInfo.fileId);
        if (this.syncContourToFrame) {
            this.contourDataSource = frame;
        }
    }

    @action setHoveredFrame(frame: FrameStore) {
        if (!frame) {
            return;
        }
        this.hoveredFrame = frame;
    }

    @action setContourDataSource = (frame: FrameStore) => {
        this.contourDataSource = frame;
        if (this.syncFrameToContour) {
            this.setActiveFrame(frame);
        }
    };

    @computed get frameLockedToContour() {
        return this.syncFrameToContour && this.syncContourToFrame;
    }

    @action toggleFrameContourLock = () => {
        if (this.frameLockedToContour) {
            this.syncFrameToContour = false;
            this.syncContourToFrame = false;
        } else {
            this.syncContourToFrame = true;
            this.syncFrameToContour = true;
            this.contourDataSource = this.activeFrame;
        }
    };

    getFrame(fileId: number) {
        if (fileId === -1) {
            return this.activeFrame;
        }
        return this.frames.find(f => f.frameInfo.fileId === fileId);
    }

    getFrameName(fileId: number) {
        return this.getFrame(fileId)?.filename;
    }

    getFrameIndex(fileId: number): number {
        return this.frames?.findIndex(frame => frame?.frameInfo.fileId === fileId);
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

    private setCursor = (fileId: number, pos: Point2D) => {
        const frame = this.getFrame(fileId);
        frame?.updateCursorRegion(pos);
    };

    @action setSpatialReference = (frame: FrameStore) => {
        const oldRef = this.spatialReference;

        // check if the new reference is currently a secondary image of the existing reference
        const newRefIsSecondary = oldRef && oldRef.secondarySpatialImages.includes(frame);

        this.spatialReference = frame;

        // Maintain link between old and new references
        if (newRefIsSecondary) {
            oldRef.setSpatialReference(frame);
        }

        for (const f of this.frames) {
            // The reference image can't reference itself
            if (f === frame) {
                f.clearSpatialReference();
            } else if (f.spatialReference) {
                f.setSpatialReference(frame);
            }
        }

        if (oldRef?.secondarySpatialImages.length) {
            oldRef.secondarySpatialImages = [];
        }
    };

    @action clearSpatialReference = () => {
        this.spatialReference = null;
        for (const f of this.frames) {
            f.clearSpatialReference();
        }
    };

    @action setSpatialMatchingEnabled = (frame: FrameStore, val: boolean) => {
        if (!frame || frame === this.spatialReference) {
            return;
        }

        if (val) {
            if (!frame.setSpatialReference(this.spatialReference)) {
                AppToaster.show(WarningToast(`Could not enable spatial matching of ${frame.filename} to reference image ${this.spatialReference.filename}. No valid transform was found.`));
            }
        } else {
            frame.clearSpatialReference();
        }
    };

    @action toggleSpatialMatching = (frame: FrameStore) => {
        if (!frame || frame === this.spatialReference) {
            return;
        }

        this.setSpatialMatchingEnabled(frame, !frame.spatialReference);
    };

    @action setSpectralReference = (frame: FrameStore) => {
        const oldRef = this.spectralReference;

        // check if the new reference is currently a secondary image of the existing reference
        const newRefIsSecondary = oldRef && oldRef.secondarySpectralImages.includes(frame);

        this.spectralReference = frame;

        // Maintain link between old and new references
        if (newRefIsSecondary) {
            oldRef.setSpectralReference(frame);
        }

        for (const f of this.frames) {
            // The reference image can't reference itself
            if (f === frame) {
                f.clearSpectralReference();
            } else if (f.spectralReference) {
                f.setSpectralReference(frame);
            }
        }
    };

    @action clearSpectralReference = () => {
        this.spectralReference = null;
        for (const f of this.frames) {
            f.clearSpectralReference();
        }
    };

    @action setSpectralMatchingEnabled = (frame: FrameStore, val: boolean) => {
        if (!frame || frame === this.spectralReference) {
            return;
        }

        if (val) {
            if (!frame.setSpectralReference(this.spectralReference)) {
                AppToaster.show(WarningToast(`Could not enable spectral matching (velocity system) of ${frame.filename} to reference image ${this.spectralReference.filename}. No valid transform was found`));
            }
        } else {
            frame.clearSpectralReference();
        }
    };

    @action toggleSpectralMatching = (frame: FrameStore) => {
        if (!frame || frame === this.spectralReference) {
            return;
        }

        this.setSpectralMatchingEnabled(frame, !frame.spectralReference);
    };

    setSpectralMatchingType = (spectralMatchingType: SpectralType) => {
        this.preferenceStore.setPreference(PreferenceKeys.GLOBAL_SPECTRAL_MATCHING_TYPE, spectralMatchingType);
        for (const f of this.frames) {
            if (f.spectralReference) {
                this.setSpectralMatchingEnabled(f, true);
            }
        }
    };

    @action setRasterScalingReference = (frame: FrameStore) => {
        const oldRef = this.rasterScalingReference;

        // check if the new reference is currently a secondary image of the existing reference
        const newRefIsSecondary = oldRef && oldRef.secondaryRasterScalingImages.includes(frame);

        this.rasterScalingReference = frame;

        // Maintain link between old and new references
        if (newRefIsSecondary) {
            oldRef.setRasterScalingReference(frame);
        }

        for (const f of this.frames) {
            // The reference image can't reference itself
            if (f === frame) {
                f.clearRasterScalingReference();
            } else if (f.rasterScalingReference) {
                f.setRasterScalingReference(frame);
            }
        }
    };

    @action clearRasterScalingReference = () => {
        this.rasterScalingReference = null;
        for (const f of this.frames) {
            f.clearRasterScalingReference();
        }
    };

    @action setRasterScalingMatchingEnabled = (frame: FrameStore, val: boolean) => {
        if (!frame || frame === this.rasterScalingReference) {
            return;
        }

        if (val) {
            frame.setRasterScalingReference(this.rasterScalingReference);
        } else {
            frame.clearRasterScalingReference();
        }
    };

    @action toggleRasterScalingMatching = (frame: FrameStore) => {
        if (!frame || frame === this.rasterScalingReference) {
            return;
        }

        this.setRasterScalingMatchingEnabled(frame, !frame.rasterScalingReference);
    };

    @action setMatchingEnabled = (spatial: boolean, spectral: boolean) => {
        this.setSpatialMatchingEnabled(this.activeFrame, spatial);
        this.setSpectralMatchingEnabled(this.activeFrame, spectral);
    };

    @computed get numImagePages() {
        if (this.numImageColumns <= 0 || this.numImageRows <= 0 || !this.frames) {
            return 0;
        }

        return Math.ceil(this.frames.length / this.imagesPerPage);
    }

    @computed get currentImagePage() {
        if (!this.frames?.length || !this.activeFrame) {
            return 0;
        }

        const index = this.frames.indexOf(this.activeFrame);
        return Math.floor(index / this.imagesPerPage);
    }

    @computed get visibleFrames(): FrameStore[] {
        if (!this.frames?.length) {
            return [];
        }

        const pageIndex = clamp(this.currentImagePage, 0, this.numImagePages);
        const firstFrameIndex = pageIndex * this.imagesPerPage;
        const indexUpperBound = Math.min(firstFrameIndex + this.imagesPerPage, this.frames.length);
        const pageFrames = [];
        for (let i = firstFrameIndex; i < indexUpperBound; i++) {
            pageFrames.push(this.frames[i]);
        }
        return pageFrames;
    }

    @computed get numImageColumns() {
        switch (this.imagePanelMode) {
            case ImagePanelMode.None:
                return 1;
            case ImagePanelMode.Fixed:
                return Math.max(1, this.preferenceStore.imagePanelColumns);
            default:
                const numImages = this.frames?.length ?? 0;
                return clamp(numImages, 1, this.preferenceStore.imagePanelColumns);
        }
    }

    @computed get numImageRows() {
        switch (this.imagePanelMode) {
            case ImagePanelMode.None:
                return 1;
            case ImagePanelMode.Fixed:
                return Math.max(1, this.preferenceStore.imagePanelRows);
            default:
                const numImages = this.frames?.length ?? 0;
                return clamp(Math.ceil(numImages / this.preferenceStore.imagePanelColumns), 1, this.preferenceStore.imagePanelRows);
        }
    }

    @computed get imagesPerPage() {
        return this.numImageColumns * this.numImageRows;
    }

    @computed get imagePanelMode() {
        const preferenceStore = PreferenceStore.Instance;
        return preferenceStore.imageMultiPanelEnabled ? preferenceStore.imagePanelMode : ImagePanelMode.None;
    }

    exportImage = (): boolean => {
        if (this.activeFrame) {
            const index = this.visibleFrames.indexOf(this.activeFrame);
            if (index === -1) {
                return false;
            }
            const backgroundColor = this.preferenceStore.transparentImageBackground ? "rgba(255, 255, 255, 0)" : this.darkTheme ? Colors.DARK_GRAY3 : Colors.LIGHT_GRAY5;
            const composedCanvas = getImageViewCanvas(this.overlayStore.padding, this.overlayStore.colorbar.position, backgroundColor);
            if (composedCanvas) {
                composedCanvas.toBlob(blob => {
                    const link = document.createElement("a") as HTMLAnchorElement;
                    const joinedNames = this.visibleFrames.map(f => f.filename).join("-");
                    // Trim filename to 230 characters in total to prevent browser errors
                    link.download = `${joinedNames}-image-${getTimestamp()}`.substring(0, 225) + ".png";
                    link.href = URL.createObjectURL(blob);
                    link.dispatchEvent(new MouseEvent("click"));
                }, "image/png");
                return true;
            }
        }
        return false;
    };

    getImageDataUrl = (backgroundColor: string) => {
        if (this.activeFrame) {
            const composedCanvas = getImageViewCanvas(this.overlayStore.padding, this.overlayStore.colorbar.position, backgroundColor);
            if (composedCanvas) {
                return composedCanvas.toDataURL();
            }
        }
        return null;
    };

    delay(time: number) {
        return new Promise(resolve => {
            setTimeout(resolve, time);
        });
    }

    // Waits for image data to be ready. This consists of three steps:
    // 1. Wait 25 ms to allow other commands that may request new data to execute
    // 2. Use a MobX "when" to wait until no tiles or contours are required
    // 3. Wait 25 ms to allow for re-rendering of tiles
    waitForImageData = async () => {
        await this.delay(25);
        return new Promise<void>(resolve => {
            when(
                () => {
                    const tilesLoading = this.tileService.remainingTiles > 0;
                    const contoursLoading = this.activeFrame && this.activeFrame.contourProgress >= 0 && this.activeFrame.contourProgress < 1;
                    return !tilesLoading && !contoursLoading;
                },
                async () => {
                    await this.delay(25);
                    resolve();
                }
            );
        });
    };

    fetchParameter = (val: any) => {
        if (val && val instanceof Map) {
            const obj = {};
            const map = val as Map<any, any>;
            for (let [key, value] of map) {
                obj[key] = value;
            }
            return obj;
        }
        return val;
    };

    getFileList = async (directory: string) => {
        return await this.backendService.getFileList(directory);
    };

    // region requirements calculations

    private initRequirements = () => {
        this.spectralRequirements = new Map<number, Map<number, CARTA.SetSpectralRequirements>>();
        this.spatialRequirements = new Map<number, Map<number, CARTA.SetSpatialRequirements>>();
        this.statsRequirements = new Map<number, Map<number, CARTA.SetStatsRequirements>>();
        this.histogramRequirements = new Map<number, Map<number, CARTA.SetHistogramRequirements>>();
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

        const updatedRequirements = StatsWidgetStore.CalculateRequirementsMap(this.widgetsStore.statsWidgets);
        const diffList = StatsWidgetStore.DiffStatsRequirements(this.statsRequirements, updatedRequirements);
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

        const updatedRequirements = HistogramWidgetStore.CalculateRequirementsMap(this.widgetsStore.histogramWidgets);
        const diffList = HistogramWidgetStore.DiffHistoRequirements(this.histogramRequirements, updatedRequirements);
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

        const updatedRequirements = SpectralProfileWidgetStore.CalculateRequirementsMap(this.widgetsStore.spectralProfileWidgets);
        if (this.widgetsStore.stokesAnalysisWidgets.size > 0) {
            StokesAnalysisWidgetStore.addToRequirementsMap(updatedRequirements, this.widgetsStore.stokesAnalysisWidgets);
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

        const updatedRequirements = SpatialProfileWidgetStore.CalculateRequirementsMap(this.widgetsStore.spatialProfileWidgets);
        const diffList = SpatialProfileWidgetStore.DiffSpatialRequirements(this.spatialRequirements, updatedRequirements);
        this.spatialRequirements = updatedRequirements;

        if (diffList.length) {
            diffList.forEach(requirements => this.backendService.setSpatialRequirements(requirements));
        }
    }

    // endregion

    private activateStatsPanel = (statsPanelEnabled: boolean) => {
        if (statsPanelEnabled) {
            import("stats-js")
                .then(({default: Stats}) => {
                    const stats = new Stats();
                    stats.showPanel(this.preferenceStore.statsPanelMode); // 0: fps, 1: ms, 2: mb, 3+: custom
                    document.body.appendChild(stats.dom);
                    function animate() {
                        stats.begin();
                        // monitored code goes here
                        stats.end();
                        requestAnimationFrame(animate);
                    }
                    requestAnimationFrame(animate);
                    stats.dom.style.right = "0";
                    stats.dom.style.left = "initial";
                })
                .catch(err => {
                    console.log(err);
                });
        }
    };

    // Reset spectral profile's progress to 0 instead of cleaning the entire out-dated profile to avoid flashy effect in spectral profiler.
    // Flashy effect: render empty profile and then render the coming profile, repeatedly.
    public resetCursorRegionSpectralProfileProgress = (fileId: FileId) => {
        this.spectralProfiles.get(fileId)?.get(CURSOR_REGION_ID)?.resetProfilesProgress();
    };

    public resetRegionSpectralProfileProgress = (regionId: RegionId) => {
        this.spectralProfiles?.forEach(regionProfileStoreMap => {
            regionProfileStoreMap.get(regionId)?.resetProfilesProgress();
        });
    };

    // helper function for getting the current devicePixelRatio value
    get pixelRatio() {
        return devicePixelRatio;
    }
}
