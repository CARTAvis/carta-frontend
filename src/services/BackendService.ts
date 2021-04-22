import {action, observable, makeObservable, runInAction} from "mobx";
import {CARTA} from "carta-protobuf";
import {Observable, Observer, Subject, throwError} from "rxjs";
import {AppStore, PreferenceStore, RegionStore} from "stores";
import {ApiService} from "./ApiService";
import {mapToObject} from "utilities";

export enum ConnectionStatus {
    CLOSED = 0,
    PENDING = 1,
    ACTIVE = 2,
}

export const INVALID_ANIMATION_ID = -1;

type HandlerFunction = (eventId: number, parsedMessage: any) => void;

export class BackendService {
    private static staticInstance: BackendService;

    static get Instance() {
        if (!BackendService.staticInstance) {
            BackendService.staticInstance = new BackendService();
        }
        return BackendService.staticInstance;
    }

    private static readonly IcdVersion = 20;
    private static readonly DefaultFeatureFlags = CARTA.ClientFeatureFlags.WEB_ASSEMBLY | CARTA.ClientFeatureFlags.WEB_GL;
    @observable connectionStatus: ConnectionStatus;
    readonly loggingEnabled: boolean;
    @observable connectionDropped: boolean;
    @observable endToEndPing: number;

    public animationId: number;
    public sessionId: number;
    public serverFeatureFlags: number;
    public grpcPort: number;
    public serverUrl: string;

    private connection: WebSocket;
    private lastPingTime: number;
    private lastPongTime: number;
    private autoReconnect: boolean;
    private observerRequestMap: Map<number, Observer<any>>;
    private eventCounter: number;

    readonly rasterTileStream: Subject<CARTA.RasterTileData>;
    readonly rasterSyncStream: Subject<CARTA.RasterTileSync>;
    readonly histogramStream: Subject<CARTA.RegionHistogramData>;
    readonly errorStream: Subject<CARTA.ErrorData>;
    readonly spatialProfileStream: Subject<CARTA.SpatialProfileData>;
    readonly spectralProfileStream: Subject<CARTA.SpectralProfileData>;
    readonly statsStream: Subject<CARTA.RegionStatsData>;
    readonly contourStream: Subject<CARTA.ContourImageData>;
    readonly catalogStream: Subject<CARTA.CatalogFilterResponse>;
    readonly momentProgressStream: Subject<CARTA.MomentProgress>;
    readonly reconnectStream: Subject<void>;
    readonly scriptingStream: Subject<CARTA.ScriptingRequest>;
    readonly progressStream: Subject<CARTA.Progress>;
    private readonly decoderMap: Map<CARTA.EventType, {messageClass: any, handler: HandlerFunction}>;

    private constructor() {
        makeObservable(this);
        this.loggingEnabled = true;
        this.observerRequestMap = new Map<number, Observer<any>>();
        this.eventCounter = 1;
        this.sessionId = 0;
        this.endToEndPing = NaN;
        this.animationId = INVALID_ANIMATION_ID;
        this.connectionStatus = ConnectionStatus.CLOSED;
        this.rasterTileStream = new Subject<CARTA.RasterTileData>();
        this.rasterSyncStream = new Subject<CARTA.RasterTileSync>();
        this.histogramStream = new Subject<CARTA.RegionHistogramData>();
        this.errorStream = new Subject<CARTA.ErrorData>();
        this.spatialProfileStream = new Subject<CARTA.SpatialProfileData>();
        this.spectralProfileStream = new Subject<CARTA.SpectralProfileData>();
        this.statsStream = new Subject<CARTA.RegionStatsData>();
        this.contourStream = new Subject<CARTA.ContourImageData>();
        this.scriptingStream = new Subject<CARTA.ScriptingRequest>();
        this.catalogStream = new Subject<CARTA.CatalogFilterResponse>();
        this.momentProgressStream = new Subject<CARTA.MomentProgress>();
        this.reconnectStream = new Subject<void>();
        this.progressStream = new Subject<CARTA.Progress>();

        // Construct handler and decoder maps
        this.decoderMap = new Map<CARTA.EventType, { messageClass: any, handler: HandlerFunction }>([
            [CARTA.EventType.REGISTER_VIEWER_ACK, {messageClass: CARTA.RegisterViewerAck, handler: this.onRegisterViewerAck}],
            [CARTA.EventType.FILE_LIST_RESPONSE, {messageClass: CARTA.FileListResponse, handler: this.onSimpleMappedResponse}],
            [CARTA.EventType.REGION_LIST_RESPONSE, {messageClass: CARTA.RegionListResponse, handler: this.onSimpleMappedResponse}],
            [CARTA.EventType.CATALOG_LIST_RESPONSE, {messageClass: CARTA.CatalogListResponse, handler: this.onSimpleMappedResponse}],
            [CARTA.EventType.FILE_LIST_PROGRESS, {messageClass: CARTA.Progress, handler: this.onStreameProgress}],
            [CARTA.EventType.REGION_LIST_PROGRESS, {messageClass: CARTA.Progress, handler: this.onStreameProgress}],
            [CARTA.EventType.CATALOG_LIST_PROGRESS, {messageClass: CARTA.Progress, handler: this.onStreameProgress}],
            [CARTA.EventType.FILE_INFO_RESPONSE, {messageClass: CARTA.FileInfoResponse, handler: this.onSimpleMappedResponse}],
            [CARTA.EventType.REGION_FILE_INFO_RESPONSE, {messageClass: CARTA.RegionFileInfoResponse, handler: this.onSimpleMappedResponse}],
            [CARTA.EventType.CATALOG_FILE_INFO_RESPONSE, {messageClass: CARTA.CatalogFileInfoResponse, handler: this.onSimpleMappedResponse}],
            [CARTA.EventType.OPEN_FILE_ACK, {messageClass: CARTA.OpenFileAck, handler: this.onSimpleMappedResponse}],
            [CARTA.EventType.SAVE_FILE_ACK, {messageClass: CARTA.SaveFileAck, handler: this.onSimpleMappedResponse}],
            [CARTA.EventType.OPEN_CATALOG_FILE_ACK, {messageClass: CARTA.OpenCatalogFileAck, handler: this.onSimpleMappedResponse}],
            [CARTA.EventType.IMPORT_REGION_ACK, {messageClass: CARTA.ImportRegionAck, handler: this.onSimpleMappedResponse}],
            [CARTA.EventType.EXPORT_REGION_ACK, {messageClass: CARTA.ExportRegionAck, handler: this.onSimpleMappedResponse}],
            [CARTA.EventType.SET_REGION_ACK, {messageClass: CARTA.SetRegionAck, handler: this.onSimpleMappedResponse}],
            [CARTA.EventType.RESUME_SESSION_ACK, {messageClass: CARTA.ResumeSessionAck, handler: this.onSimpleMappedResponse}],
            [CARTA.EventType.START_ANIMATION_ACK, {messageClass: CARTA.StartAnimationAck, handler: this.onStartAnimationAck}],
            [CARTA.EventType.RASTER_TILE_DATA, {messageClass: CARTA.RasterTileData, handler: this.onStreamedRasterTileData}],
            [CARTA.EventType.REGION_HISTOGRAM_DATA, {messageClass: CARTA.RegionHistogramData, handler: this.onStreamedRegionHistogramData}],
            [CARTA.EventType.ERROR_DATA, {messageClass: CARTA.ErrorData, handler: this.onStreamedErrorData}],
            [CARTA.EventType.SPATIAL_PROFILE_DATA, {messageClass: CARTA.SpatialProfileData, handler: this.onStreamedSpatialProfileData}],
            [CARTA.EventType.SPECTRAL_PROFILE_DATA, {messageClass: CARTA.SpectralProfileData, handler: this.onStreamedSpectralProfileData}],
            [CARTA.EventType.REGION_STATS_DATA, {messageClass: CARTA.RegionStatsData, handler: this.onStreamedRegionStatsData}],
            [CARTA.EventType.CONTOUR_IMAGE_DATA, {messageClass: CARTA.ContourImageData, handler: this.onStreamedContourData}],
            [CARTA.EventType.CATALOG_FILTER_RESPONSE, {messageClass: CARTA.CatalogFilterResponse, handler: this.onStreamedCatalogData}],
            [CARTA.EventType.RASTER_TILE_SYNC, {messageClass: CARTA.RasterTileSync, handler: this.onStreamedRasterSync}],
            [CARTA.EventType.MOMENT_PROGRESS, {messageClass: CARTA.MomentProgress, handler: this.onStreamedMomentProgress}],
            [CARTA.EventType.MOMENT_RESPONSE, {messageClass: CARTA.MomentResponse, handler: this.onSimpleMappedResponse}],
            [CARTA.EventType.SCRIPTING_REQUEST, {messageClass: CARTA.ScriptingRequest, handler: this.onScriptingRequest}],
            [CARTA.EventType.SPECTRAL_LINE_RESPONSE, {messageClass: CARTA.SpectralLineResponse, handler: this.onSimpleMappedResponse}],
            [CARTA.EventType.CONCAT_STOKES_FILES_ACK, {messageClass: CARTA.ConcatStokesFilesAck, handler: this.onSimpleMappedResponse}]
        ]);

        // check ping every 5 seconds
        setInterval(this.sendPing, 5000);
    }

    @action("connect")
    connect(url: string, autoConnect: boolean = true): Observable<CARTA.RegisterViewerAck> {
        if (this.connection) {
            this.connection.onclose = null;
            this.connection.close();
        }

        const apiService = ApiService.Instance;
        this.autoReconnect = autoConnect;
        this.connectionDropped = false;
        this.connectionStatus = ConnectionStatus.PENDING;
        this.serverUrl = url;
        this.connection = new WebSocket(apiService.accessToken ? url + `?token=${apiService.accessToken}` : url);
        this.connection.binaryType = "arraybuffer";
        this.connection.onmessage = this.messageHandler.bind(this);
        this.connection.onclose = (ev: CloseEvent) => runInAction(()=>{
            // Only change to closed connection if the connection was originally active
            if (this.connectionStatus === ConnectionStatus.ACTIVE) {
                this.connectionStatus = ConnectionStatus.CLOSED;
            }
            // Reconnect to the same URL if Websocket is closed
            if (!ev.wasClean && this.autoReconnect) {
                setTimeout(() => {
                    const newConnection = new WebSocket(apiService.accessToken ? url + `?token=${apiService.accessToken}` : url);
                    newConnection.binaryType = "arraybuffer";
                    newConnection.onopen = this.connection.onopen;
                    newConnection.onerror = this.connection.onerror;
                    newConnection.onclose = this.connection.onclose;
                    newConnection.onmessage = this.connection.onmessage;
                    this.connection = newConnection;
                }, 1000);
            }
        });

        return new Observable<CARTA.RegisterViewerAck>(observer => {
            this.connection.onopen = action(() => {
                if (this.connectionStatus === ConnectionStatus.CLOSED) {
                    this.connectionDropped = true;
                }
                this.connectionStatus = ConnectionStatus.ACTIVE;
                this.autoReconnect = true;
                const message = CARTA.RegisterViewer.create({sessionId: this.sessionId, clientFeatureFlags: BackendService.DefaultFeatureFlags});
                // observer map is cleared, so that old subscriptions don't get incorrectly fired
                this.observerRequestMap.clear();
                this.eventCounter = 1;
                const requestId = this.eventCounter;
                this.logEvent(CARTA.EventType.REGISTER_VIEWER, requestId, message, false);
                if (this.sendEvent(CARTA.EventType.REGISTER_VIEWER, CARTA.RegisterViewer.encode(message).finish())) {
                    this.observerRequestMap.set(requestId, observer);
                }
            });

            this.connection.onerror = (ev => {
                AppStore.Instance.logStore.addInfo(`Connecting to server ${url} failed. Retrying...`, ["network"]);
                console.log(ev);
            });
        });
    }

    sendPing = () => {
        if (this.connection && this.connectionStatus === ConnectionStatus.ACTIVE) {
            this.lastPingTime = performance.now();
            this.connection.send("PING");
        }
    };

    @action updateEndToEndPing = () => {
        this.endToEndPing = this.lastPongTime - this.lastPingTime;
    };

    @action("file list")
    getFileList(directory: string): Observable<CARTA.FileListResponse> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        } else {
            const message = CARTA.FileListRequest.create({directory});
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.FILE_LIST_REQUEST, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.FILE_LIST_REQUEST, CARTA.FileListRequest.encode(message).finish())) {
                return new Observable<CARTA.FileListResponse>(observer => {
                    this.observerRequestMap.set(requestId, observer);
                });
            } else {
                return throwError(new Error("Could not send event"));
            }
        }
    }

    @action("region list")
    getRegionList(directory: string): Observable<CARTA.RegionListResponse> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        } else {
            const message = CARTA.RegionListRequest.create({directory});
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.REGION_LIST_REQUEST, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.REGION_LIST_REQUEST, CARTA.RegionListRequest.encode(message).finish())) {
                return new Observable<CARTA.RegionListResponse>(observer => {
                    this.observerRequestMap.set(requestId, observer);
                });
            } else {
                return throwError(new Error("Could not send event"));
            }
        }
    }

    @action("catalog list")
    getCatalogList(directory: string): Observable<CARTA.CatalogListResponse> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        } else {
            const message = CARTA.CatalogListRequest.create({directory});
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.CATALOG_LIST_REQUEST, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.CATALOG_LIST_REQUEST, CARTA.CatalogListRequest.encode(message).finish())) {
                return new Observable<CARTA.CatalogListResponse>(observer => {
                    this.observerRequestMap.set(requestId, observer);
                });
            } else {
                return throwError(new Error("Could not send event"));
            }
        }
    }

    @action("file info")
    getFileInfo(directory: string, file: string, hdu: string): Observable<CARTA.FileInfoResponse> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        } else {
            const message = CARTA.FileInfoRequest.create({directory, file, hdu});
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.FILE_INFO_REQUEST, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.FILE_INFO_REQUEST, CARTA.FileInfoRequest.encode(message).finish())) {
                return new Observable<CARTA.FileInfoResponse>(observer => {
                    this.observerRequestMap.set(requestId, observer);
                });
            } else {
                return throwError(new Error("Could not send event"));
            }
        }
    }

    @action("region info")
    getRegionFileInfo(directory: string, file: string): Observable<CARTA.RegionFileInfoResponse> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        } else {
            const message = CARTA.RegionFileInfoRequest.create({directory, file});
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.REGION_FILE_INFO_REQUEST, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.REGION_FILE_INFO_REQUEST, CARTA.RegionFileInfoRequest.encode(message).finish())) {
                return new Observable<CARTA.RegionFileInfoResponse>(observer => {
                    this.observerRequestMap.set(requestId, observer);
                });
            } else {
                return throwError(new Error("Could not send event"));
            }
        }
    }

    @action("catalog info")
    getCatalogFileInfo(directory: string, name: string): Observable<CARTA.CatalogFileInfoResponse> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        } else {
            const message = CARTA.CatalogFileInfoRequest.create({directory, name});
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.CATALOG_FILE_INFO_REQUEST, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.CATALOG_FILE_INFO_REQUEST, CARTA.CatalogFileInfoRequest.encode(message).finish())) {
                return new Observable<CARTA.CatalogFileInfoResponse>(observer => {
                    this.observerRequestMap.set(requestId, observer);
                });
            } else {
                return throwError(new Error("Could not send event"));
            }
        }
    }

    @action("import region")
    importRegion(directory: string, file: string, type: CARTA.FileType, fileId: number): Observable<CARTA.ImportRegionAck> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        } else {
            const message = CARTA.ImportRegion.create({directory, file, type, groupId: fileId});
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.IMPORT_REGION, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.IMPORT_REGION, CARTA.ImportRegion.encode(message).finish())) {
                return new Observable<CARTA.ImportRegionAck>(observer => {
                    this.observerRequestMap.set(requestId, observer);
                });
            } else {
                return throwError(new Error("Could not send event"));
            }
        }
    }

    @action("export regions")
    exportRegion(directory: string, file: string, type: CARTA.FileType, coordType: CARTA.CoordinateType, fileId: number, regionStyles: Map<number, CARTA.IRegionStyle>): Observable<CARTA.ExportRegionAck> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        } else {
            const message = CARTA.ExportRegion.create({directory, file, type, fileId, regionStyles: mapToObject(regionStyles), coordType});
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.EXPORT_REGION, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.EXPORT_REGION, CARTA.ExportRegion.encode(message).finish())) {
                return new Observable<CARTA.ExportRegionAck>(observer => {
                    this.observerRequestMap.set(requestId, observer);
                });
            } else {
                return throwError(new Error("Could not send event"));
            }
        }
    }

    @action("load file")
    loadFile(directory: string, file: string, hdu: string, fileId: number, renderMode: CARTA.RenderMode): Observable<CARTA.OpenFileAck> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        } else {
            const message = CARTA.OpenFile.create({directory, file, hdu, fileId, renderMode});
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.OPEN_FILE, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.OPEN_FILE, CARTA.OpenFile.encode(message).finish())) {
                return new Observable<CARTA.OpenFileAck>(observer => {
                    this.observerRequestMap.set(requestId, observer);
                });
            } else {
                return throwError(new Error("Could not send event"));
            }
        }
    }

    @action("load individual stokes")
    loadStokeFiles(stokesFiles: CARTA.IStokesFile[], fileId: number, renderMode: CARTA.RenderMode): Observable<CARTA.ConcatStokesFilesAck> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        } else {
            const concatStokes: CARTA.IConcatStokesFiles= {
                stokesFiles: stokesFiles,
                fileId: fileId,
                renderMode: renderMode
            }
            const message = CARTA.ConcatStokesFiles.create(concatStokes);
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.CONCAT_STOKES_FILES, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.CONCAT_STOKES_FILES, CARTA.ConcatStokesFiles.encode(message).finish())) {
                return new Observable<CARTA.ConcatStokesFilesAck>(observer => {
                    this.observerRequestMap.set(requestId, observer);
                });
            } else {
                return throwError(new Error("Could not send event"));
            }
        }
    }

    @action("load catalog file")
    loadCatalogFile(directory: string, name: string, fileId: number, previewDataSize: number): Observable<CARTA.OpenCatalogFileAck> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        } else {
            const message = CARTA.OpenCatalogFile.create({directory, name, fileId, previewDataSize});
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.OPEN_CATALOG_FILE, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.OPEN_CATALOG_FILE, CARTA.OpenCatalogFile.encode(message).finish())) {
                return new Observable<CARTA.OpenCatalogFileAck>(observer => {
                    this.observerRequestMap.set(requestId, observer);
                });
            } else {
                return throwError(new Error("Could not send event"));
            }
        }
    }

    @action("close catalog file")
    closeCatalogFile(fileId: number): boolean {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            const message = CARTA.CloseCatalogFile.create({fileId});
            this.logEvent(CARTA.EventType.CLOSE_CATALOG_FILE, this.eventCounter, message, false);
            if (this.sendEvent(CARTA.EventType.CLOSE_CATALOG_FILE, CARTA.CloseCatalogFile.encode(message).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("save file")
    saveFile(fileId: number, outputFileDirectory: string, outputFileName: string, outputFileType: CARTA.FileType): Observable<CARTA.SaveFileAck> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        } else {
            const message = CARTA.SaveFile.create({fileId, outputFileDirectory, outputFileName, outputFileType});
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.SAVE_FILE, this.eventCounter, message, false);
            if (this.sendEvent(CARTA.EventType.SAVE_FILE, CARTA.SaveFile.encode(message).finish())) {
                return new Observable<CARTA.SaveFileAck>(observer => {
                    this.observerRequestMap.set(requestId, observer);
                });
            } else {
                return throwError(new Error("Could not send event"));
            }
        }
    }

    @action("close file")
    closeFile(fileId: number): boolean {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            const message = CARTA.CloseFile.create({fileId});
            this.logEvent(CARTA.EventType.CLOSE_FILE, this.eventCounter, message, false);
            if (this.sendEvent(CARTA.EventType.CLOSE_FILE, CARTA.CloseFile.encode(message).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("set channels")
    setChannels(fileId: number, channel: number, stokes: number, requiredTiles: CARTA.IAddRequiredTiles): boolean {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            const message = CARTA.SetImageChannels.create({fileId, channel, stokes, requiredTiles});
            this.logEvent(CARTA.EventType.SET_IMAGE_CHANNELS, this.eventCounter, message, false);
            if (this.sendEvent(CARTA.EventType.SET_IMAGE_CHANNELS, CARTA.SetImageChannels.encode(message).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("set cursor")
    setCursor(fileId: number, x: number, y: number): boolean {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            const message = CARTA.SetCursor.create({fileId, point: {x, y}});
            this.logEvent(CARTA.EventType.SET_CURSOR, this.eventCounter, message, false);
            if (this.sendEvent(CARTA.EventType.SET_CURSOR, CARTA.SetCursor.encode(message).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("set region")
    setRegion(fileId: number, regionId: number, region: RegionStore): Observable<CARTA.SetRegionAck> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        } else {
            const message = CARTA.SetRegion.create({
                fileId,
                regionId,
                regionInfo: {
                    regionType: region.regionType,
                    rotation: region.rotation,
                    controlPoints: region.controlPoints.slice(),
                }
            });

            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.SET_REGION, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.SET_REGION, CARTA.SetRegion.encode(message).finish())) {
                return new Observable<CARTA.SetRegionAck>(observer => {
                    this.observerRequestMap.set(requestId, observer);
                });
            } else {
                return throwError(new Error("Could not send event"));
            }
        }
    }

    @action("remove region")
    removeRegion(regionId: number) {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            const message = CARTA.RemoveRegion.create({regionId});
            this.logEvent(CARTA.EventType.REMOVE_REGION, this.eventCounter, message, false);
            if (this.sendEvent(CARTA.EventType.REMOVE_REGION, CARTA.RemoveRegion.encode(message).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("set catalog filter")
    setCatalogFilterRequest(filterRequest: CARTA.ICatalogFilterRequest) {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            this.logEvent(CARTA.EventType.CATALOG_FILTER_REQUEST, this.eventCounter, filterRequest, false);
            if (this.sendEvent(CARTA.EventType.CATALOG_FILTER_REQUEST, CARTA.CatalogFilterRequest.encode(filterRequest).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("set spatial requirements")
    setSpatialRequirements(requirementsMessage: CARTA.ISetSpectralRequirements) {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            this.logEvent(CARTA.EventType.SET_SPATIAL_REQUIREMENTS, this.eventCounter, requirementsMessage, false);
            if (this.sendEvent(CARTA.EventType.SET_SPATIAL_REQUIREMENTS, CARTA.SetSpatialRequirements.encode(requirementsMessage).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("set spectral requirements")
    setSpectralRequirements(requirementsMessage: CARTA.ISetSpectralRequirements) {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            this.logEvent(CARTA.EventType.SET_SPECTRAL_REQUIREMENTS, this.eventCounter, requirementsMessage, false);
            if (this.sendEvent(CARTA.EventType.SET_SPECTRAL_REQUIREMENTS, CARTA.SetSpectralRequirements.encode(requirementsMessage).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("set stats requirements")
    setStatsRequirements(requirementsMessage: CARTA.ISetStatsRequirements) {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            this.logEvent(CARTA.EventType.SET_STATS_REQUIREMENTS, this.eventCounter, requirementsMessage, false);
            if (this.sendEvent(CARTA.EventType.SET_STATS_REQUIREMENTS, CARTA.SetStatsRequirements.encode(requirementsMessage).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("set histogram requirements")
    setHistogramRequirements(requirementsMessage: CARTA.ISetHistogramRequirements) {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            this.logEvent(CARTA.EventType.SET_HISTOGRAM_REQUIREMENTS, this.eventCounter, requirementsMessage, false);
            if (this.sendEvent(CARTA.EventType.SET_HISTOGRAM_REQUIREMENTS, CARTA.SetHistogramRequirements.encode(requirementsMessage).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("add required tiles")
    addRequiredTiles(fileId: number, tiles: Array<number>, quality: number): boolean {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            const message = CARTA.AddRequiredTiles.create({fileId, tiles, compressionQuality: quality, compressionType: CARTA.CompressionType.ZFP});
            this.logEvent(CARTA.EventType.ADD_REQUIRED_TILES, this.eventCounter, message, false);
            if (this.sendEvent(CARTA.EventType.ADD_REQUIRED_TILES, CARTA.AddRequiredTiles.encode(message).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("remove required tiles")
    removeRequiredTiles(fileId: number, tiles: Array<number>): boolean {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            const message = CARTA.RemoveRequiredTiles.create({fileId, tiles});
            this.logEvent(CARTA.EventType.REMOVE_REQUIRED_TILES, this.eventCounter, message, false);
            if (this.sendEvent(CARTA.EventType.REMOVE_REQUIRED_TILES, CARTA.RemoveRequiredTiles.encode(message).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("start animation")
    startAnimation(animationMessage: CARTA.IStartAnimation): Observable<CARTA.StartAnimationAck> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        } else {
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.START_ANIMATION, requestId, animationMessage, false);
            if (this.sendEvent(CARTA.EventType.START_ANIMATION, CARTA.StartAnimation.encode(animationMessage).finish())) {
                return new Observable<CARTA.StartAnimationAck>(observer => {
                    this.observerRequestMap.set(requestId, observer);
                });
            } else {
                return throwError(new Error("Could not send event"));
            }
        }
    }

    @action("stop animation")
    stopAnimation(animationMessage: CARTA.IStopAnimation) {
        this.animationId = INVALID_ANIMATION_ID;
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            this.logEvent(CARTA.EventType.STOP_ANIMATION, this.eventCounter, animationMessage, false);
            if (this.sendEvent(CARTA.EventType.STOP_ANIMATION, CARTA.StopAnimation.encode(animationMessage).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("animation flow control")
    sendAnimationFlowControl(message: CARTA.IAnimationFlowControl) {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            this.logEvent(CARTA.EventType.ANIMATION_FLOW_CONTROL, this.eventCounter, message, false);
            if (this.sendEvent(CARTA.EventType.ANIMATION_FLOW_CONTROL, CARTA.AnimationFlowControl.encode(message).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("set contour parameters")
    setContourParameters(message: CARTA.ISetContourParameters) {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            this.logEvent(CARTA.EventType.SET_CONTOUR_PARAMETERS, this.eventCounter, message, false);
            if (this.sendEvent(CARTA.EventType.SET_CONTOUR_PARAMETERS, CARTA.SetContourParameters.encode(message).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("resume session")
    resumeSession(message: CARTA.IResumeSession): Observable<CARTA.ResumeSessionAck> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        } else {
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.RESUME_SESSION, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.RESUME_SESSION, CARTA.ResumeSession.encode(message).finish())) {
                return new Observable<CARTA.ResumeSessionAck>(observer => {
                    this.observerRequestMap.set(requestId, observer);
                });
            } else {
                return throwError(new Error("Could not send event"));
            }
        }
    }

    @action("set auth token")
    setAuthToken = (token: string) => {
        document.cookie = `CARTA-Authorization=${token}; path=/`;
    };

    @action("request moment")
    requestMoment(message: CARTA.IMomentRequest): Observable<CARTA.MomentResponse> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        } else {
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.MOMENT_REQUEST, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.MOMENT_REQUEST, CARTA.MomentRequest.encode(message).finish())) {
                return new Observable<CARTA.MomentResponse>(observer => {
                    this.observerRequestMap.set(requestId, observer);
                });
            } else {
                return throwError(new Error("Could not send event"));
            }
        }
    }

    @action("cancel requesting moment")
    cancelRequestingMoment(fileId: number) {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        } else {
            const message = CARTA.StopMomentCalc.create({fileId});
            this.logEvent(CARTA.EventType.STOP_MOMENT_CALC, this.eventCounter, message, false);
            if (this.sendEvent(CARTA.EventType.STOP_MOMENT_CALC, CARTA.StopMomentCalc.encode(message).finish())) {
                return true;
            }
            return throwError(new Error("Could not send event"));
        }
    }

    @action("cancel requesting files")
    cancelRequestingFiles() {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        } else {
            this.logEvent(CARTA.EventType.STOP_FILE_LIST, this.eventCounter, "", false);
            if (this.sendEvent(CARTA.EventType.STOP_FILE_LIST, new Uint8Array())) {
                return true;
            }
            return throwError(new Error("Could not send event"));
        }
    }

    @action("cancel requesting catalogs")
    cancelRequestingCatalogs() {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        } else {
            this.logEvent(CARTA.EventType.STOP_CATALOG_LIST, this.eventCounter, "", false);
            if (this.sendEvent(CARTA.EventType.STOP_CATALOG_LIST, new Uint8Array())) {
                return true;
            }
            return throwError(new Error("Could not send event"));
        }
    }

    @action("request spectral line")
    requestSpectralLine(frequencyRange: CARTA.DoubleBounds, intensityLimit: number): Observable<CARTA.SpectralLineResponse> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        } else {
            const message = CARTA.SpectralLineRequest.create({frequencyRange: frequencyRange, lineIntensityLowerLimit: intensityLimit});
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.SPECTRAL_LINE_REQUEST, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.SPECTRAL_LINE_REQUEST, CARTA.SpectralLineRequest.encode(message).finish())) {
                return new Observable<CARTA.SpectralLineResponse>(observer => {
                    this.observerRequestMap.set(requestId, observer);
                });
            } else {
                return throwError(new Error("Could not send event"));
            }
        }
    }

    @action("send scripting response")
    sendScriptingResponse = (message: CARTA.IScriptingResponse) => {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            this.logEvent(CARTA.EventType.SCRIPTING_RESPONSE, this.eventCounter, message, false);
            if (this.sendEvent(CARTA.EventType.SCRIPTING_RESPONSE, CARTA.ScriptingResponse.encode(message).finish())) {
                return true;
            }
        }
        return false;
    };

    public serverHasFeature(feature: CARTA.ServerFeatureFlags): boolean {
        return (this.serverFeatureFlags & feature) !== 0;
    }

    private messageHandler(event: MessageEvent) {
        if (event.data === "PONG") {
            this.lastPongTime = performance.now();
            this.updateEndToEndPing();
            return;
        } else if (event.data.byteLength < 8) {
            console.log("Unknown event format");
            return;
        }

        const eventHeader16 = new Uint16Array(event.data, 0, 2);
        const eventHeader32 = new Uint32Array(event.data, 4, 1);
        const eventData = new Uint8Array(event.data, 8);

        const eventType: CARTA.EventType = eventHeader16[0];
        const eventIcdVersion = eventHeader16[1];
        const eventId = eventHeader32[0];

        if (eventIcdVersion !== BackendService.IcdVersion) {
            console.warn(`Server event has ICD version ${eventIcdVersion}, which differs from frontend version ${BackendService.IcdVersion}. Errors may occur`);
        }
        try {
            const decoderEntry = this.decoderMap.get(eventType);
            if (decoderEntry) {
                const parsedMessage = decoderEntry.messageClass.decode(eventData);
                if (parsedMessage) {
                    this.logEvent(eventType, eventId, parsedMessage);
                    decoderEntry.handler.call(this, eventId, parsedMessage);
                } else {
                    console.log(`Unsupported event response ${eventType}`);
                }
            }
        } catch (e) {
            console.log(e);
        }
    }

    private onSimpleMappedResponse(eventId: number, response: any) {
        const observer = this.observerRequestMap.get(eventId);
        if (observer) {
            if (response.success) {
                observer.next(response);
            } else {
                observer.error(response.message);
            }
            observer.complete();
            this.observerRequestMap.delete(eventId);
        } else {
            console.log(`Can't find observable for request ${eventId}`);
        }
    }

    private onRegisterViewerAck(eventId: number, ack: CARTA.RegisterViewerAck) {
        this.sessionId = ack.sessionId;
        this.serverFeatureFlags = ack.serverFeatureFlags;
        this.grpcPort = ack.grpcPort;

        this.onSimpleMappedResponse(eventId, ack);

        // use the reconnect stream when the session type is resumed
        if (ack.success && ack.sessionType === CARTA.SessionType.RESUMED) {
            this.reconnectStream.next();
        }
    }

    private onStartAnimationAck(eventId: number, ack: CARTA.StartAnimationAck) {
        this.animationId = ack.success ? ack.animationId : INVALID_ANIMATION_ID;
        this.onSimpleMappedResponse(eventId, ack);
    }

    private onStreamedRasterTileData(_eventId: number, rasterTileData: CARTA.RasterTileData) {
        this.rasterTileStream.next(rasterTileData);
    }

    private onStreamedRasterSync(_eventId: number, rasterTileSync: CARTA.RasterTileSync) {
        this.rasterSyncStream.next(rasterTileSync);
    }

    private onStreamedRegionHistogramData(_eventId: number, regionHistogramData: CARTA.RegionHistogramData) {
        this.histogramStream.next(regionHistogramData);
    }

    private onStreamedErrorData(_eventId: number, errorData: CARTA.ErrorData) {
        this.errorStream.next(errorData);
    }

    private onStreamedSpatialProfileData(_eventId: number, spatialProfileData: CARTA.SpatialProfileData) {
        this.spatialProfileStream.next(spatialProfileData);
    }

    private onStreamedSpectralProfileData(_eventId: number, spectralProfileData: CARTA.SpectralProfileData) {
        this.spectralProfileStream.next(spectralProfileData);
    }

    private onStreamedRegionStatsData(_eventId: number, regionStatsData: CARTA.RegionStatsData) {
        this.statsStream.next(regionStatsData);
    }

    private onStreamedContourData(_eventId: number, contourData: CARTA.ContourImageData) {
        this.contourStream.next(contourData);
    }

    private onScriptingRequest(_eventId: number, scriptingRequest: CARTA.ScriptingRequest) {
        this.scriptingStream.next(scriptingRequest);
    }

    private onStreamedCatalogData(_eventId: number, catalogFilter: CARTA.CatalogFilterResponse) {
        this.catalogStream.next(catalogFilter);
    }

    private onStreamedMomentProgress(_eventId: number, momentProgress: CARTA.MomentProgress) {
        this.momentProgressStream.next(momentProgress);
    }

    private onStreameProgress(_eventId: number, progress: CARTA.Progress) {
        this.progressStream.next(progress);
    }

    private sendEvent(eventType: CARTA.EventType, payload: Uint8Array): boolean {
        if (this.connection.readyState === WebSocket.OPEN) {
            const eventData = new Uint8Array(8 + payload.byteLength);
            const eventHeader16 = new Uint16Array(eventData.buffer, 0, 2);
            const eventHeader32 = new Uint32Array(eventData.buffer, 4, 1);
            eventHeader16[0] = eventType;
            eventHeader16[1] = BackendService.IcdVersion;
            eventHeader32[0] = this.eventCounter;

            eventData.set(payload, 8);
            this.connection.send(eventData);
            this.eventCounter++;
            return true;
        } else {
            console.log("Error sending event");
            this.eventCounter++;
            return false;
        }
    }

    private logEvent(eventType: CARTA.EventType, eventId: number, message: any, incoming: boolean = true) {
        const eventName = CARTA.EventType[eventType];
        if (this.loggingEnabled && PreferenceStore.Instance.isEventLoggingEnabled(eventType)) {
            if (incoming) {
                if (eventId === 0) {
                    console.log(`<== ${eventName} [Stream]`);
                } else {
                    console.log(`<== ${eventName} [${eventId}]`);
                }
            } else {
                console.log(`${eventName} [${eventId}] ==>`);
            }
            console.log(message);
            console.log("\n");
        }
    }
}