import * as _ from "lodash";
import {action, autorun, computed, observable, ObservableMap, when, makeObservable, runInAction} from "mobx";
import * as Long from "long";
import {Classes, Colors, IOptionProps, setHotkeysDialogProps} from "@blueprintjs/core";
import {Utils} from "@blueprintjs/table";
import * as AST from "ast_wrapper";
import * as CARTACompute from "carta_computation";
import {CARTA} from "carta-protobuf";
import {
    AlertStore,
    AnimationMode,
    AnimationState,
    AnimatorStore,
    BrowserMode,
    CatalogInfo,
    CatalogProfileStore,
    CatalogStore,
    CatalogUpdateMode,
    dayPalette,
    DialogStore,
    FileBrowserStore,
    FrameInfo,
    FrameStore,
    HelpStore,
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
    WidgetsStore
} from ".";
import {distinct, GetRequiredTiles, mapToObject} from "utilities";
import {ApiService, BackendService, ConnectionStatus, ScriptingService, TileService, TileStreamDetails} from "services";
import {FrameView, Point2D, ProtobufProcessing, Theme, TileCoordinate, WCSMatchingType} from "models";
import {HistogramWidgetStore, RegionWidgetStore, SpatialProfileWidgetStore, SpectralProfileWidgetStore, StatsWidgetStore, StokesAnalysisWidgetStore} from "./widgets";
import {getImageCanvas, ImageViewLayer} from "components";
import {AppToaster, ErrorToast, SuccessToast, WarningToast} from "components/Shared";
import GitCommit from "../static/gitInfo";

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
    @observable contourDataSource: FrameStore;
    @observable syncContourToFrame: boolean;
    @observable syncFrameToContour: boolean;

    // Profiles and region data
    @observable spatialProfiles: Map<string, SpatialProfileStore>;
    @observable spectralProfiles: Map<number, ObservableMap<number, SpectralProfileStore>>;
    @observable regionStats: Map<number, ObservableMap<number, CARTA.RegionStatsData>>;
    @observable regionHistograms: Map<number, ObservableMap<number, CARTA.IRegionHistogramData>>;

    // Reference images
    @observable spatialReference: FrameStore;
    @observable spectralReference: FrameStore;
    @observable rasterScalingReference: FrameStore;

    // ImageViewer
    @observable activeLayer: ImageViewLayer;
    @observable cursorFrozen: boolean;

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
        // Remove query parameters, replace protocol and remove trailing /
        const baseUrl = window.location.href.replace(window.location.search, "").replace(/^http/, "ws").replace(/\/$/, "");
        let wsURL = `${baseUrl}/${socketName}`;
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

        let autoFileLoaded = false;

        AST.onReady.then(runInAction(() => {
            AST.setPalette(this.darkTheme ? nightPalette : dayPalette);
            this.astReady = true;
            if (this.backendService.connectionStatus === ConnectionStatus.ACTIVE && !autoFileLoaded && fileSearchParam) {
                this.loadFile(folderSearchParam, fileSearchParam, "");
            }
        }));

        this.backendService.connect(wsURL).subscribe(ack => {
            console.log(`Connected with session ID ${ack.sessionId}`);
            this.logStore.addInfo(`Connected to server ${wsURL} with session ID ${ack.sessionId}`, ["network"]);
            if (this.astReady && fileSearchParam) {
                autoFileLoaded = true;
                this.loadFile(folderSearchParam, fileSearchParam, "");
            }
            if (this.preferenceStore.autoLaunch && !fileSearchParam) {
                this.fileBrowserStore.showFileBrowser(BrowserMode.File);
            }
        }, err => console.log(err));
    };

    @action handleThemeChange = (darkMode: boolean) => {
        this.systemTheme = darkMode ? "dark" : "light";
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

    @action startFileLoading = () => {
        this.fileLoading = true;
    };

    @action endFileLoading = () => {
        this.fileLoading = false;
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

    @computed get frameMap(): Map<number, FrameStore> {
        const frameMap = new Map<number, FrameStore>();

        for (const frame of this.frames) {
            frameMap.set(frame.frameInfo.fileId, frame);
        }

        return frameMap;
    }

    // catalog
    @computed get catalogNum(): number {
        return this.catalogStore.catalogProfileStores.size;
    }

    @computed get frameNames(): IOptionProps [] {
        let names: IOptionProps [] = [];
        this.frames.forEach((frame, index) => names.push({label: index + ": " + frame.filename, value: frame.frameInfo.fileId}));
        return names;
    }

    @computed get frameChannels(): number [] {
        return this.frames.map(frame => frame.requiredChannel);
    }

    @computed get frameStokes(): number [] {
        return this.frames.map(frame => frame.requiredStokes);
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

    @action addFrame = (ack: CARTA.OpenFileAck, directory: string, hdu: string): boolean => {
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
            renderMode: CARTA.RenderMode.RASTER
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

        this.setActiveFrame(newFrame.frameInfo.fileId);

        // Set animation mode to frame if the new image is 2D, or to channel if the image is 3D and there are no other frames
        if (newFrame.frameInfo.fileInfoExtended.depth <= 1 && newFrame.frameInfo.fileInfoExtended.stokes <= 1) {
            this.animatorStore.setAnimationMode(AnimationMode.FRAME);
        } else if (newFrame.frameInfo.fileInfoExtended.depth > 1) {
            this.animatorStore.setAnimationMode(AnimationMode.CHANNEL);
        } else if (newFrame.frameInfo.fileInfoExtended.stokes > 1) {
            this.animatorStore.setAnimationMode(AnimationMode.STOKES);
        }

        if (this.frames.length > 1) {
            if ((this.preferenceStore.autoWCSMatching & WCSMatchingType.SPATIAL) && this.spatialReference !== newFrame) {
                this.setSpatialMatchingEnabled(newFrame, true);
            }
            if ((this.preferenceStore.autoWCSMatching & WCSMatchingType.SPECTRAL) && this.spectralReference !== newFrame && newFrame.frameInfo.fileInfoExtended.depth > 1) {
                this.setSpectralMatchingEnabled(newFrame, true);
            }
        }
        this.fileBrowserStore.saveStartingDirectory(newFrame.frameInfo.directory);

        return true;
    };

    @action loadFile = (directory: string, file: string, hdu: string) => {
        return new Promise<number>((resolve, reject) => {
            this.startFileLoading();

            if (!file) {
                const lastDirSeparator = directory.lastIndexOf("/");
                if (lastDirSeparator >= 0) {
                    file = directory.substring(lastDirSeparator + 1);
                    directory = directory.substring(0, lastDirSeparator);
                }
            } else if (!directory && file.includes("/")) {
                const lastDirSeparator = file.lastIndexOf("/");
                if (lastDirSeparator >= 0) {
                    directory = file.substring(0, lastDirSeparator);
                    file = file.substring(lastDirSeparator + 1);
                }
            }

            this.backendService.loadFile(directory, file, hdu, this.fileCounter, CARTA.RenderMode.RASTER).subscribe(ack => {
                if (!this.addFrame(ack, directory, hdu)) {
                    AppToaster.show({icon: "warning-sign", message: "Load file failed.", intent: "danger", timeout: 3000});
                }
                this.endFileLoading();
                this.fileBrowserStore.hideFileBrowser();
                resolve(ack.fileId);
            }, err => {
                this.alertStore.showAlert(`Error loading file: ${err}`);
                this.endFileLoading();
                reject(err);
            });

            this.fileCounter++;
        });
    };

    @action appendFile = (directory: string, file: string, hdu: string) => {
        // Stop animations playing before loading a new frame
        this.animatorStore.stopAnimation();
        // hide all catalog data
        if (this.catalogNum) {
            CatalogStore.Instance.resetDisplayedData([]);
        }
        return this.loadFile(directory, file, hdu);
    };

    @action openFile = (directory: string, file: string, hdu: string) => {
        this.removeAllFrames();
        return this.loadFile(directory, file, hdu);
    };

    @action saveFile = (directory: string, filename: string, fileType: CARTA.FileType) => {
        if (!this.activeFrame) {
            return;
        }
        const fileId = this.activeFrame.frameInfo.fileId;
        this.backendService.saveFile(fileId, directory, filename, fileType).subscribe(() => {
            AppToaster.show({icon: "saved", message: `${filename} saved.`, intent: "success", timeout: 3000});
            this.fileBrowserStore.hideFileBrowser();
        }, error => {
            console.error(error);
            AppToaster.show({icon: "warning-sign", message: error, intent: "danger", timeout: 3000});
        });
    };

    @action closeFile = (frame: FrameStore, confirmClose: boolean = true) => {
        if (!frame) {
            return;
        }
        // Display confirmation if image has secondary images
        const secondaries = frame.secondarySpatialImages.concat(frame.secondarySpectralImages).filter(distinct);
        const numSecondaries = secondaries.length;
        if (confirmClose && numSecondaries) {
            this.alertStore.showInteractiveAlert(`${numSecondaries} image${numSecondaries > 1 ? "s that are" : " that is"} matched to this image will be unmatched.`, confirmed => {
                if (confirmed) {
                    this.removeFrame(frame);
                }
            });
        } else {
            this.removeFrame(frame);
        }
    };

    @action closeCurrentFile = (confirmClose: boolean = true) => {
        this.closeFile(this.activeFrame, confirmClose);
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
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.spectralProfileWidgets);
            WidgetsStore.RemoveFrameFromRegionWidgets(this.widgetsStore.stokesAnalysisWidgets);
        }
    };

    @action shiftFrame = (delta: number) => {
        if (this.activeFrame && this.frames.length > 1) {
            const frameIds = this.frames.map(f => f.frameInfo.fileId).sort((a, b) => a - b);
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

    // Open catalog file
    @action appendCatalog = (directory: string, file: string, previewDataSize: number, type: CARTA.CatalogFileType) => {
        if (!this.activeFrame) {
            AppToaster.show(ErrorToast("Please load the image file"));
            return;
        }
        if (!(type === CARTA.CatalogFileType.VOTable)) {
            AppToaster.show(ErrorToast("`Catalog type not supported"));
            return;
        }
        this.startFileLoading();

        const frame = this.activeFrame;
        const fileId = this.catalogNum + 1;

        this.backendService.loadCatalogFile(directory, file, fileId, previewDataSize).subscribe(ack => runInAction(() => {
            this.endFileLoading();
            if (frame && ack.success && ack.dataSize) {
                let catalogInfo: CatalogInfo = {fileId, directory, fileInfo: ack.fileInfo, dataSize: ack.dataSize};
                let catalogWidgetId;
                const columnData = ProtobufProcessing.ProcessCatalogData(ack.previewData);

                // update image associated catalog file
                let associatedCatalogFiles = [];
                const catalogStore = CatalogStore.Instance;
                const catalogComponentSize = catalogStore.catalogProfiles.size;
                let currentAssociatedCatalogFile = catalogStore.activeCatalogFiles;
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
                if (catalogWidgetId) {
                    this.catalogStore.catalogWidgets.set(fileId, catalogWidgetId);
                    this.catalogStore.addCatalog(fileId);
                    this.fileBrowserStore.hideFileBrowser();

                    const catalogProfileStore = new CatalogProfileStore(catalogInfo, ack.headers, columnData);
                    catalogStore.catalogProfileStores.set(fileId, catalogProfileStore);
                }
            }
        }), error => {
            console.error(error);
            AppToaster.show(ErrorToast(error));
            this.endFileLoading();
        });
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
            catalogStore.removeCatalog(fileId);
            // remove profile store
            catalogStore.catalogProfileStores.delete(fileId);

            if (!this.activeFrame) {
                return;
            }
            // update associated image
            const fileIds = catalogStore.activeCatalogFiles;
            const activeImageId = AppStore.Instance.activeFrame.frameInfo.fileId;
            let associatedCatalogId = [];
            if (fileIds) {
                associatedCatalogId = fileIds.filter(catalogFileId => {
                    return catalogFileId !== fileId;
                });
                catalogStore.updateImageAssociatedCatalogId(activeImageId, associatedCatalogId);
            }

            // update catalogProfiles fileId            
            if (catalogComponentId && associatedCatalogId.length) {
                catalogStore.catalogProfiles.forEach((catalogFileId, componentId) => {
                    if (catalogFileId === fileId) {
                        catalogStore.catalogProfiles.set(componentId, associatedCatalogId[0]);
                    }
                });
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
        if (!Number.isInteger(oldIndex) || oldIndex < 0 || oldIndex >= this.frameNum ||
            !Number.isInteger(newIndex) || newIndex < 0 || newIndex >= this.frameNum ||
            !Number.isInteger(length) || length <= 0 || length >= this.frameNum ||
            oldIndex === newIndex) {
            return;
        }
        this.frames = Utils.reorderArray(this.frames, oldIndex, newIndex, length);
    };

    // Region file actions
    @action importRegion = (directory: string, file: string, type: CARTA.FileType | CARTA.CatalogFileType) => {
        if (!this.activeFrame || !(type === CARTA.FileType.CRTF || type === CARTA.FileType.DS9_REG)) {
            AppToaster.show(ErrorToast("Region type not supported"));
            return;
        }

        // ensure that the same frame is used in the callback, to prevent issues when the active frame changes while the region is being imported
        const frame = this.activeFrame;
        this.backendService.importRegion(directory, file, type, frame.frameInfo.fileId).subscribe(ack => {
            if (frame && ack.success && ack.regions) {
                const regionMap = new Map<string, CARTA.IRegionInfo>(Object.entries(ack.regions));
                const regionStyles = new Map<string, CARTA.IRegionStyle>(Object.entries(ack.regionStyles));
                regionMap.forEach((regionInfo, regionIdString) => {
                    const styleInfo = regionStyles.get(regionIdString);

                    frame.regionSet.addExistingRegion(
                        regionInfo.controlPoints as Point2D[],
                        regionInfo.rotation,
                        regionInfo.regionType,
                        parseInt(regionIdString),
                        styleInfo?.name,
                        styleInfo?.color,
                        styleInfo?.lineWidth,
                        styleInfo?.dashList
                    );
                });
            }
            this.fileBrowserStore.hideFileBrowser();
        }, error => {
            console.error(error);
            AppToaster.show(ErrorToast(error));
        });
    };

    @action exportRegions = (directory: string, file: string, coordType: CARTA.CoordinateType, fileType: RegionFileType) => {
        const frame = this.activeFrame;
        // Prevent exporting if only the cursor region exists
        if (!frame.regionSet.regions || frame.regionSet.regions.length <= 1) {
            return;
        }

        const regionStyles = new Map<number, CARTA.IRegionStyle>();
        for (const region of frame.regionSet.regions) {
            regionStyles.set(region.regionId, {
                name: region.name,
                color: region.color,
                lineWidth: region.lineWidth,
                dashList: region.dashLength ? [region.dashLength] : []
            });
        }
        this.backendService.exportRegion(directory, file, fileType, coordType, frame.frameInfo.fileId, regionStyles).subscribe(() => {
            AppToaster.show(SuccessToast("saved", `Exported regions for ${frame.filename} using ${coordType === CARTA.CoordinateType.WORLD ? "world" : "pixel"} coordinates`));
            this.fileBrowserStore.hideFileBrowser();
        }, error => {
            console.error(error);
            AppToaster.show(ErrorToast(error));
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

    @action requestMoment = (message: CARTA.IMomentRequest, frame: FrameStore) => {
        if (!message || !frame) {
            return;
        }

        this.startFileLoading();
        // clear previously generated moment images under this frame
        if (frame.momentImages && frame.momentImages.length > 0) {
            frame.momentImages.forEach(momentFrame => this.closeFile(momentFrame));
        }
        frame.removeMomentImage();

        this.backendService.requestMoment(message).subscribe(ack => {
            if (ack.success) {
                if (!ack.cancel && ack.openFileAcks) {
                    ack.openFileAcks.forEach(openFileAck => {
                        if (this.addFrame(CARTA.OpenFileAck.create(openFileAck), this.fileBrowserStore.startingDirectory, "")) {
                            this.fileCounter++;
                            frame.addMomentImage(this.frames.find(f => f.frameInfo.fileId === openFileAck.fileId));
                        } else {
                            AppToaster.show({icon: "warning-sign", message: "Load file failed.", intent: "danger", timeout: 3000});
                        }
                    });
                }
            } else {
                AppToaster.show({icon: "warning-sign", message: `Moment generation failed. ${ack?.message}`, intent: "danger", timeout: 3000});
            }
            frame.resetMomentRequestState();
            this.endFileLoading();
        }, error => {
            frame.resetMomentRequestState();
            this.endFileLoading();
            console.error(error);
        });
        this.restartTaskProgress();
    };

    @action cancelRequestingMoment = (fileId: number = -1) => {
        const frame = this.getFrame(fileId);
        if (frame && frame.requestingMomentsProgress < 1.0) {
            this.backendService.cancelRequestingMoment(fileId);
        }
    };

    @action setDarkTheme = () => {
        this.preferenceStore.setPreference(PreferenceKeys.GLOBAL_THEME, Theme.DARK);
    };

    @action setLightTheme = () => {
        this.preferenceStore.setPreference(PreferenceKeys.GLOBAL_THEME, Theme.LIGHT);
    };

    @action setAutoTheme = () => {
        this.preferenceStore.setPreference(PreferenceKeys.GLOBAL_THEME, Theme.AUTO);
    };

    @action toggleCursorFrozen = () => {
        this.cursorFrozen = !this.cursorFrozen;
    };

    @action updateActiveLayer = (layer: ImageViewLayer) => {
        this.activeLayer = layer;
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
    private static readonly ImageChannelThrottleTime = 500;
    private static readonly RequirementsCheckInterval = 200;

    private spectralRequirements: Map<number, Map<number, CARTA.SetSpectralRequirements>>;
    private spatialRequirements: Map<number, Map<number, CARTA.SetSpatialRequirements>>;
    private statsRequirements: Map<number, Array<number>>;
    private histogramRequirements: Map<number, Array<number>>;
    private pendingChannelHistograms: Map<string, CARTA.IRegionHistogramData>;

    throttledSetChannels = _.throttle((updates: { frame: FrameStore, channel: number, stokes: number }[]) => {
        if (!updates || !updates.length) {
            return;
        }

        updates.forEach(update => {
            const frame = update.frame;
            if (!frame) {
                return;
            }

            frame.channel = update.channel;
            frame.stokes = update.stokes;

            if (frame === this.activeFrame) {
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
                this.tileService.updateInactiveFileChannel(frame.frameInfo.fileId, frame.channel, frame.stokes);
            }
        });
    }, AppStore.ImageChannelThrottleTime);

    throttledSetView = _.throttle((tiles: TileCoordinate[], fileId: number, channel: number, stokes: number, focusPoint: Point2D) => {
        const isAnimating = (this.animatorStore.animationState !== AnimationState.STOPPED && this.animatorStore.animationMode !== AnimationMode.FRAME);
        if (isAnimating) {
            this.backendService.addRequiredTiles(fileId, tiles.map(t => t.encode()), this.preferenceStore.animationCompressionQuality);
        } else {
            this.tileService.requestTiles(tiles, fileId, channel, stokes, focusPoint, this.preferenceStore.imageCompressionQuality);
        }
    }, AppStore.ImageChannelThrottleTime);

    private constructor() {
        makeObservable(this);
        AppStore.staticInstance = this;
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
        this.logStore = LogStore.Instance;
        this.overlayStore = OverlayStore.Instance;
        this.preferenceStore = PreferenceStore.Instance;
        this.widgetsStore = WidgetsStore.Instance;

        this.astReady = false;
        this.cartaComputeReady = false;
        this.spatialProfiles = new Map<string, SpatialProfileStore>();
        this.spectralProfiles = new Map<number, ObservableMap<number, SpectralProfileStore>>();
        this.regionStats = new Map<number, ObservableMap<number, CARTA.RegionStatsData>>();
        this.regionHistograms = new Map<number, ObservableMap<number, CARTA.IRegionHistogramData>>();
        this.pendingChannelHistograms = new Map<string, CARTA.IRegionHistogramData>();

        this.frames = [];
        this.activeFrame = null;
        this.contourDataSource = null;
        this.syncFrameToContour = true;
        this.syncContourToFrame = true;
        this.initRequirements();
        this.activeLayer = ImageViewLayer.RegionMoving;

        AST.onReady.then(runInAction(() => {
            AST.setPalette(this.darkTheme ? nightPalette : dayPalette);
            this.astReady = true;
            this.logStore.addInfo("AST library loaded", ["ast"]);
        }));

        CARTACompute.onReady.then(action(() => {
            this.cartaComputeReady = true;
            this.logStore.addInfo("Compute module loaded", ["compute"]);
        }));

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
                    if (this.backendService.connectionDropped) {
                        AppToaster.show(WarningToast(`Reconnected to server${userString}. Some errors may occur`));
                    } else {
                        AppToaster.show(SuccessToast("swap-vertical", `Connected to CARTA server${userString}`));
                    }
                    break;
                case ConnectionStatus.CLOSED:
                    if (this.previousConnectionStatus === ConnectionStatus.ACTIVE) {
                        AppToaster.show(ErrorToast("Disconnected from server"));
                    }
                    break;
                default:
                    break;
            }
            this.previousConnectionStatus = newConnectionStatus;
        });

        const throttledSetCursorRotated = _.throttle(this.setCursor, AppStore.CursorThrottleTimeRotated);
        const throttledSetCursor = _.throttle(this.setCursor, AppStore.CursorThrottleTime);
        // Low-bandwidth mode
        const throttledSetCursorLowBandwidth = _.throttle(this.setCursor, AppStore.CursorThrottleTime * 2);

        // Update frame view
        autorun(() => {
            if (this.activeFrame && (this.preferenceStore.streamContoursWhileZooming || !this.activeFrame.zooming)) {
                // Trigger update raster view/title when switching layout
                this.widgetsStore.updateImageWidgetTitle(this.layoutStore.dockedLayout);

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

            if (!this.activeFrame) {
                this.widgetsStore.updateImageWidgetTitle(this.layoutStore.dockedLayout);
            }
        });

        // TODO: Move setChannels actions to AppStore and remove this autorun
        // Update channels when manually changed
        autorun(() => {
            if (this.activeFrame) {
                const updates = [];
                // Calculate if new data is required
                const updateRequiredChannels = this.activeFrame.requiredChannel !== this.activeFrame.channel || this.activeFrame.requiredStokes !== this.activeFrame.stokes;
                // Don't auto-update when animation is playing
                if (this.animatorStore.animationState === AnimationState.STOPPED && updateRequiredChannels) {
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
                    this.throttledSetChannels(updates);
                }
            }
        });

        // Update cursor profiles
        autorun(() => {
            if (this.activeFrame?.cursorInfo?.posImageSpace) {
                const pos = {x: Math.round(this.activeFrame.cursorInfo.posImageSpace.x), y: Math.round(this.activeFrame.cursorInfo.posImageSpace.y)};
                if (pos.x >= 0 && pos.x <= this.activeFrame.frameInfo.fileInfoExtended.width - 1 && pos.y >= 0 && pos.y <= this.activeFrame.frameInfo.fileInfoExtended.height - 1) {
                    if (this.preferenceStore.lowBandwidthMode) {
                        throttledSetCursorLowBandwidth(this.activeFrame.frameInfo.fileId, pos);
                    } else if (this.activeFrame.frameInfo.fileFeatureFlags & CARTA.FileFeatureFlags.ROTATED_DATASET) {
                        throttledSetCursorRotated(this.activeFrame.frameInfo.fileId, pos);
                    } else {
                        throttledSetCursor(this.activeFrame.frameInfo.fileId, pos);
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
        this.backendService.spatialProfileStream.subscribe(this.handleSpatialProfileStream);
        this.backendService.spectralProfileStream.subscribe(this.handleSpectralProfileStream);
        this.backendService.histogramStream.subscribe(this.handleRegionHistogramStream);
        this.backendService.contourStream.subscribe(this.handleContourImageStream);
        this.backendService.catalogStream.subscribe(this.handleCatalogFilterStream);
        this.backendService.errorStream.subscribe(this.handleErrorStream);
        this.backendService.statsStream.subscribe(this.handleRegionStatsStream);
        this.backendService.momentProgressStream.subscribe(this.handleMomentProgressStream);
        this.backendService.reconnectStream.subscribe(this.handleReconnectStream);
        this.backendService.scriptingStream.subscribe(this.handleScriptingRequest);
        this.tileService.tileStream.subscribe(this.handleTileStream);

        // Splash screen mask
        autorun(() => {
            if (this.astReady && this.zfpReady && this.cartaComputeReady && this.apiService.authenticated) {
                this.preferenceStore.fetchPreferences().then(() => {
                    this.layoutStore.fetchLayouts().then(() => {
                        // Attempt connection after authenticating
                        this.tileService.setCache(this.preferenceStore.gpuTileCache, this.preferenceStore.systemTileCache);
                        this.layoutStore.applyLayout(this.preferenceStore.layout);
                        this.cursorFrozen = this.preferenceStore.isCursorFrozen;
                        this.connectToServer();
                    });
                });
            }
        });

        autorun(() => {
            if (this.backendService.connectionStatus === ConnectionStatus.ACTIVE) {
                setTimeout(this.hideSplashScreen, 500);
            } else {
                this.showSplashScreen();
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
                this.activeFrame.setCursorValue({x: spatialProfileData.x, y: spatialProfileData.y}, spatialProfileData.channel, spatialProfileData.value);
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

        // TODO: update histograms directly if the image is not active!

        // Add histogram to pending histogram list
        if (regionHistogramData.regionId === -1) {
            regionHistogramData.histograms.forEach(histogram => {
                const key = `${regionHistogramData.fileId}_${regionHistogramData.stokes}_${histogram.channel}`;
                this.pendingChannelHistograms.set(key, regionHistogramData);
            });
        } else if (regionHistogramData.regionId === -2) {
            // Update cube histogram if it is still required
            const updatedFrame = this.getFrame(regionHistogramData.fileId);
            if (updatedFrame) {
                const cubeHist = regionHistogramData.histograms[0];
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
        if (pendingHistogram && pendingHistogram.histograms && pendingHistogram.histograms.length) {
            const updatedFrame = this.getFrame(pendingHistogram.fileId);
            const channelHist = pendingHistogram.histograms.find(hist => hist.channel === updatedFrame.channel);
            if (updatedFrame && channelHist) {
                updatedFrame.renderConfig.setStokes(pendingHistogram.stokes);
                updatedFrame.renderConfig.updateChannelHistogram(channelHist);
                updatedFrame.channel = tileStreamDetails.channel;
                updatedFrame.stokes = tileStreamDetails.stokes;
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

    @action handleCatalogFilterStream = (catalogFilter: CARTA.CatalogFilterResponse) => {
        const catalogFileId = catalogFilter.fileId;
        const catalogProfileStore = this.catalogStore.catalogProfileStores.get(catalogFileId);

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
                const xColumn = catalogProfileStore.xColumnRepresentation;
                const yColumn = catalogProfileStore.yColumnRepresentation;
                if (xColumn && yColumn) {
                    const coords = catalogProfileStore.get2DPlotData(xColumn, yColumn, catalogData);
                    const wcs = this.activeFrame.validWcs ? this.activeFrame.wcsInfo : 0;
                    this.catalogStore.updateCatalogData(catalogFileId, coords.wcsX, coords.wcsY, wcs, coords.xHeaderInfo.units, coords.yHeaderInfo.units, catalogProfileStore.catalogCoordinateSystem.system);
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

    handleScriptingRequest = (request: CARTA.IScriptingRequest) => {
        this.scriptingService.handleScriptingRequest(request).then(this.backendService.sendScriptingResponse);
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

            let regions = new Map<string, CARTA.IRegionInfo>();
            // Spatially matched images don't have their own regions
            if (!frame.spatialReference) {
                regions = new Map<string, CARTA.IRegionInfo>();

                for (const region of frame.regionSet.regions) {
                    regions.set(region.regionId.toFixed(), {
                        regionType: region.regionType,
                        controlPoints: region.controlPoints,
                        rotation: region.rotation,
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
                contourSettings
            };
        });

        const catalogFiles: CARTA.IOpenCatalogFile[] = [];

        this.catalogStore.catalogProfileStores.forEach((profileStore) => {
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

        this.backendService.resumeSession({images, catalogFiles}).subscribe(this.onSessionResumed, err => {
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
        // Ignore changes when animating
        if (this.animatorStore.serverAnimationActive) {
            return;
        }
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
        // Ignore changes when animating
        if (this.animatorStore.serverAnimationActive) {
            return;
        }
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
        this.widgetsStore.updateImageWidgetTitle(this.layoutStore.dockedLayout);
        this.catalogStore.resetActiveCatalogFile(frame.frameInfo.fileId);
        if (this.syncContourToFrame) {
            this.contourDataSource = frame;
        }
    }

    @action setContourDataSource = (frame: FrameStore) => {
        this.contourDataSource = frame;
        if (this.syncFrameToContour) {
            this.setActiveFrame(frame.frameInfo.fileId);
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
                AppToaster.show(WarningToast(`Could not enable spatial matching of ${frame.filename} to reference image ${this.spatialReference.filename}. No valid transform was found`));
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

    exportImage = (): boolean => {
        if (this.activeFrame) {
            const composedCanvas = getImageCanvas(this.overlayStore.padding);
            if (composedCanvas) {
                composedCanvas.toBlob((blob) => {
                    const now = new Date();
                    const timestamp = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
                    const link = document.createElement("a") as HTMLAnchorElement;
                    link.download = `${this.activeFrame.filename}-image-${timestamp}.png`;
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
            const composedCanvas = getImageCanvas(this.overlayStore.padding, backgroundColor);
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
        return new Promise(resolve => {
            when(() => {
                const tilesLoading = this.tileService.remainingTiles > 0;
                const contoursLoading = this.activeFrame && this.activeFrame.contourProgress >= 0 && this.activeFrame.contourProgress < 1;
                return !tilesLoading && !contoursLoading;
            }, async () => {
                await this.delay(25);
                resolve();
            });
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

        const updatedRequirements = RegionWidgetStore.CalculateRequirementsArray(this.widgetsStore.statsWidgets);
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

        const updatedRequirements = RegionWidgetStore.CalculateRequirementsArray(this.widgetsStore.histogramWidgets);
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

        const updatedRequirements = SpatialProfileWidgetStore.CalculateRequirementsMap(this.activeFrame, this.widgetsStore.spatialProfileWidgets);
        const diffList = SpatialProfileWidgetStore.DiffSpatialRequirements(this.spatialRequirements, updatedRequirements);
        this.spatialRequirements = updatedRequirements;

        if (diffList.length) {
            diffList.forEach(requirements => this.backendService.setSpatialRequirements(requirements));
        }
    }

    // endregion
}