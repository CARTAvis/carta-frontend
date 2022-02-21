import {action, makeObservable, observable, runInAction} from "mobx";
import {CARTA} from "carta-protobuf";
import {Subject, throwError} from "rxjs";
import {AppStore, PreferenceStore, RegionStore} from "stores";
import {mapToObject} from "utilities";
import {ApiService} from "./ApiService";
import {TelemetryAction, TelemetryService} from "./TelemetryService";

export enum ConnectionStatus {
    CLOSED = 0,
    PENDING = 1,
    ACTIVE = 2
}

export const INVALID_ANIMATION_ID = -1;

type HandlerFunction = (eventId: number, parsedMessage: any) => void;

interface IBackendResponse {
    success?: boolean;
    message?: string;
}

// Deferred class adapted from https://stackoverflow.com/a/58610922/1727322
export class Deferred<T> {
    private _resolve: (value: T) => void = () => {};
    private _reject: (reason: any) => void = () => {};

    private _promise: Promise<T> = new Promise<T>((resolve, reject) => {
        this._reject = reject;
        this._resolve = resolve;
    });

    public get promise(): Promise<T> {
        return this._promise;
    }

    public resolve(value: T) {
        this._resolve(value);
    }

    public reject(reason: any) {
        this._reject(reason);
    }
}

export class BackendService {
    private static staticInstance: BackendService;

    static get Instance() {
        if (!BackendService.staticInstance) {
            BackendService.staticInstance = new BackendService();
        }
        return BackendService.staticInstance;
    }

    private static readonly IcdVersion = 25;
    private static readonly DefaultFeatureFlags = CARTA.ClientFeatureFlags.WEB_ASSEMBLY | CARTA.ClientFeatureFlags.WEB_GL;
    private static readonly MaxConnectionAttempts = 15;
    private static readonly ConnectionAttemptDelay = 1000;

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
    private deferredMap: Map<number, Deferred<IBackendResponse>>;
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
    readonly scriptingStream: Subject<CARTA.ScriptingRequest>;
    readonly listProgressStream: Subject<CARTA.ListProgress>;
    readonly pvProgressStream: Subject<CARTA.PvProgress>;
    private readonly decoderMap: Map<CARTA.EventType, {messageClass: any; handler: HandlerFunction}>;

    private constructor() {
        makeObservable(this);
        this.loggingEnabled = true;
        this.deferredMap = new Map<number, Deferred<IBackendResponse>>();

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
        this.listProgressStream = new Subject<CARTA.ListProgress>();
        this.pvProgressStream = new Subject<CARTA.PvProgress>();

        // Construct handler and decoder maps
        this.decoderMap = new Map<CARTA.EventType, {messageClass: any; handler: HandlerFunction}>([
            [CARTA.EventType.REGISTER_VIEWER_ACK, {messageClass: CARTA.RegisterViewerAck, handler: this.onRegisterViewerAck}],
            [CARTA.EventType.FILE_LIST_RESPONSE, {messageClass: CARTA.FileListResponse, handler: this.onDeferredResponse}],
            [CARTA.EventType.REGION_LIST_RESPONSE, {messageClass: CARTA.RegionListResponse, handler: this.onDeferredResponse}],
            [CARTA.EventType.CATALOG_LIST_RESPONSE, {messageClass: CARTA.CatalogListResponse, handler: this.onDeferredResponse}],
            [CARTA.EventType.FILE_LIST_PROGRESS, {messageClass: CARTA.ListProgress, handler: this.onStreamedListProgress}],
            [CARTA.EventType.FILE_INFO_RESPONSE, {messageClass: CARTA.FileInfoResponse, handler: this.onDeferredResponse}],
            [CARTA.EventType.REGION_FILE_INFO_RESPONSE, {messageClass: CARTA.RegionFileInfoResponse, handler: this.onDeferredResponse}],
            [CARTA.EventType.CATALOG_FILE_INFO_RESPONSE, {messageClass: CARTA.CatalogFileInfoResponse, handler: this.onDeferredResponse}],
            [CARTA.EventType.OPEN_FILE_ACK, {messageClass: CARTA.OpenFileAck, handler: this.onDeferredResponse}],
            [CARTA.EventType.SAVE_FILE_ACK, {messageClass: CARTA.SaveFileAck, handler: this.onDeferredResponse}],
            [CARTA.EventType.OPEN_CATALOG_FILE_ACK, {messageClass: CARTA.OpenCatalogFileAck, handler: this.onDeferredResponse}],
            [CARTA.EventType.IMPORT_REGION_ACK, {messageClass: CARTA.ImportRegionAck, handler: this.onDeferredResponse}],
            [CARTA.EventType.EXPORT_REGION_ACK, {messageClass: CARTA.ExportRegionAck, handler: this.onDeferredResponse}],
            [CARTA.EventType.SET_REGION_ACK, {messageClass: CARTA.SetRegionAck, handler: this.onDeferredResponse}],
            [CARTA.EventType.RESUME_SESSION_ACK, {messageClass: CARTA.ResumeSessionAck, handler: this.onDeferredResponse}],
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
            [CARTA.EventType.MOMENT_RESPONSE, {messageClass: CARTA.MomentResponse, handler: this.onDeferredResponse}],
            [CARTA.EventType.SCRIPTING_REQUEST, {messageClass: CARTA.ScriptingRequest, handler: this.onScriptingRequest}],
            [CARTA.EventType.SPLATALOGUE_PONG, {messageClass: CARTA.SpectralLineResponse, handler: this.onDeferredResponse}],
            [CARTA.EventType.SPECTRAL_LINE_RESPONSE, {messageClass: CARTA.SpectralLineResponse, handler: this.onDeferredResponse}],
            [CARTA.EventType.CONCAT_STOKES_FILES_ACK, {messageClass: CARTA.ConcatStokesFilesAck, handler: this.onDeferredResponse}],
            [CARTA.EventType.PV_PROGRESS, {messageClass: CARTA.PvProgress, handler: this.onStreamedPvProgress}],
            [CARTA.EventType.PV_RESPONSE, {messageClass: CARTA.PvResponse, handler: this.onDeferredResponse}]
        ]);

        // check ping every 5 seconds
        setInterval(this.sendPing, 5000);
    }

    @action("connect")
    async connect(url: string): Promise<CARTA.IRegisterViewerAck> {
        if (this.connection) {
            this.connection.onclose = null;
            this.connection.close();
        }

        const isReconnection: boolean = url === this.serverUrl;
        let connectionAttempts = 0;
        const apiService = ApiService.Instance;
        this.connectionDropped = false;
        this.connectionStatus = ConnectionStatus.PENDING;
        this.serverUrl = url;
        this.connection = new WebSocket(apiService.accessToken ? url + `?token=${apiService.accessToken}` : url);
        this.connection.binaryType = "arraybuffer";
        this.connection.onmessage = this.messageHandler.bind(this);
        this.connection.onclose = (ev: CloseEvent) =>
            runInAction(() => {
                // Only change to closed connection if the connection was originally active or this is a reconnection
                if (this.connectionStatus === ConnectionStatus.ACTIVE || isReconnection || connectionAttempts >= BackendService.MaxConnectionAttempts) {
                    this.connectionStatus = ConnectionStatus.CLOSED;
                } else {
                    connectionAttempts++;
                    setTimeout(() => {
                        const newConnection = new WebSocket(apiService.accessToken ? url + `?token=${apiService.accessToken}` : url);
                        newConnection.binaryType = "arraybuffer";
                        newConnection.onopen = this.connection.onopen;
                        newConnection.onerror = this.connection.onerror;
                        newConnection.onclose = this.connection.onclose;
                        newConnection.onmessage = this.connection.onmessage;
                        this.connection = newConnection;
                    }, BackendService.ConnectionAttemptDelay);
                }
            });

        this.deferredMap.clear();
        this.eventCounter = 1;
        const requestId = this.eventCounter;

        const deferredResponse = new Deferred<CARTA.IRegisterViewerAck>();
        this.deferredMap.set(requestId, deferredResponse);

        this.connection.onopen = action(() => {
            if (this.connectionStatus === ConnectionStatus.CLOSED) {
                this.connectionDropped = true;
            }
            this.connectionStatus = ConnectionStatus.ACTIVE;
            const message = CARTA.RegisterViewer.create({sessionId: this.sessionId, clientFeatureFlags: BackendService.DefaultFeatureFlags});
            // observer map is cleared, so that old subscriptions don't get incorrectly fired

            this.logEvent(CARTA.EventType.REGISTER_VIEWER, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.REGISTER_VIEWER, CARTA.RegisterViewer.encode(message).finish())) {
                this.deferredMap.set(requestId, deferredResponse);
            } else {
                throw new Error("Could not send event");
            }
        });

        this.connection.onerror = ev => {
            AppStore.Instance.logStore.addInfo(`Connecting to server ${url} failed.`, ["network"]);
            console.log(ev);
        };

        return await deferredResponse.promise;
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

    async getFileList(directory: string, filterMode: CARTA.FileListFilterMode): Promise<CARTA.IFileListResponse> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            throw new Error("Not connected");
        } else {
            const message = CARTA.FileListRequest.create({directory, filterMode});
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.FILE_LIST_REQUEST, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.FILE_LIST_REQUEST, CARTA.FileListRequest.encode(message).finish())) {
                const deferredResponse = new Deferred<CARTA.IFileListResponse>();
                this.deferredMap.set(requestId, deferredResponse);
                return await deferredResponse.promise;
            } else {
                throw new Error("Could not send event");
            }
        }
    }

    async getRegionList(directory: string, filterMode: CARTA.FileListFilterMode): Promise<CARTA.IRegionListResponse> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            throw new Error("Not connected");
        } else {
            const message = CARTA.RegionListRequest.create({directory, filterMode});
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.REGION_LIST_REQUEST, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.REGION_LIST_REQUEST, CARTA.RegionListRequest.encode(message).finish())) {
                const deferredResponse = new Deferred<CARTA.IRegionListResponse>();
                this.deferredMap.set(requestId, deferredResponse);
                return await deferredResponse.promise;
            } else {
                throw new Error("Could not send event");
            }
        }
    }

    async getCatalogList(directory: string, filterMode: CARTA.FileListFilterMode): Promise<CARTA.ICatalogListResponse> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            throw new Error("Not connected");
        } else {
            const message = CARTA.CatalogListRequest.create({directory, filterMode});
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.CATALOG_LIST_REQUEST, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.CATALOG_LIST_REQUEST, CARTA.CatalogListRequest.encode(message).finish())) {
                const deferredResponse = new Deferred<CARTA.ICatalogListResponse>();
                this.deferredMap.set(requestId, deferredResponse);
                return await deferredResponse.promise;
            } else {
                throw new Error("Could not send event");
            }
        }
    }

    async getFileInfo(directory: string, file: string, hdu: string): Promise<CARTA.IFileInfoResponse> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            throw new Error("Not connected");
        } else {
            const message = CARTA.FileInfoRequest.create({directory, file, hdu});
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.FILE_INFO_REQUEST, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.FILE_INFO_REQUEST, CARTA.FileInfoRequest.encode(message).finish())) {
                const deferredResponse = new Deferred<CARTA.IFileInfoResponse>();
                this.deferredMap.set(requestId, deferredResponse);
                return await deferredResponse.promise;
            } else {
                throw new Error("Could not send event");
            }
        }
    }

    async getRegionFileInfo(directory: string, file: string): Promise<CARTA.IRegionFileInfoResponse> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            throw new Error("Not connected");
        } else {
            const message = CARTA.RegionFileInfoRequest.create({directory, file});
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.REGION_FILE_INFO_REQUEST, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.REGION_FILE_INFO_REQUEST, CARTA.RegionFileInfoRequest.encode(message).finish())) {
                const deferredResponse = new Deferred<CARTA.IRegionFileInfoResponse>();
                this.deferredMap.set(requestId, deferredResponse);
                return await deferredResponse.promise;
            } else {
                throw new Error("Could not send event");
            }
        }
    }

    async getCatalogFileInfo(directory: string, name: string): Promise<CARTA.ICatalogFileInfoResponse> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            throw new Error("Not connected");
        } else {
            const message = CARTA.CatalogFileInfoRequest.create({directory, name});
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.CATALOG_FILE_INFO_REQUEST, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.CATALOG_FILE_INFO_REQUEST, CARTA.CatalogFileInfoRequest.encode(message).finish())) {
                const deferredResponse = new Deferred<CARTA.ICatalogFileInfoResponse>();
                this.deferredMap.set(requestId, deferredResponse);
                return await deferredResponse.promise;
            } else {
                throw new Error("Could not send event");
            }
        }
    }

    async importRegion(directory: string, file: string, type: CARTA.FileType, fileId: number): Promise<CARTA.IImportRegionAck> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            throw new Error("Not connected");
        } else {
            const message = CARTA.ImportRegion.create({directory, file, type, groupId: fileId});
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.IMPORT_REGION, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.IMPORT_REGION, CARTA.ImportRegion.encode(message).finish())) {
                const deferredResponse = new Deferred<CARTA.IImportRegionAck>();
                this.deferredMap.set(requestId, deferredResponse);
                return await deferredResponse.promise;
            } else {
                throw new Error("Could not send event");
            }
        }
    }

    async exportRegion(directory: string, file: string, type: CARTA.FileType, coordType: CARTA.CoordinateType, fileId: number, regionStyles: Map<number, CARTA.IRegionStyle>): Promise<CARTA.IExportRegionAck> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            throw new Error("Not connected");
        } else {
            const message = CARTA.ExportRegion.create({directory, file, type, fileId, regionStyles: mapToObject(regionStyles), coordType});
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.EXPORT_REGION, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.EXPORT_REGION, CARTA.ExportRegion.encode(message).finish())) {
                const deferredResponse = new Deferred<CARTA.IExportRegionAck>();
                this.deferredMap.set(requestId, deferredResponse);
                return await deferredResponse.promise;
            } else {
                throw new Error("Could not send event");
            }
        }
    }

    async loadFile(directory: string, file: string, hdu: string, fileId: number, imageArithmetic: boolean): Promise<CARTA.IOpenFileAck> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            throw new Error("Not connected");
        } else {
            const message = CARTA.OpenFile.create({
                directory,
                file,
                hdu,
                fileId,
                lelExpr: imageArithmetic,
                renderMode: CARTA.RenderMode.RASTER
            });
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.OPEN_FILE, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.OPEN_FILE, CARTA.OpenFile.encode(message).finish())) {
                const deferredResponse = new Deferred<CARTA.IOpenFileAck>();
                this.deferredMap.set(requestId, deferredResponse);
                return await deferredResponse.promise;
            } else {
                throw new Error("Could not send event");
            }
        }
    }

    async loadStokeFiles(stokesFiles: CARTA.IStokesFile[], fileId: number, renderMode: CARTA.RenderMode): Promise<CARTA.IConcatStokesFilesAck> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            throw new Error("Not connected");
        } else {
            const concatStokes: CARTA.IConcatStokesFiles = {
                stokesFiles: stokesFiles,
                fileId: fileId,
                renderMode: renderMode
            };
            const message = CARTA.ConcatStokesFiles.create(concatStokes);
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.CONCAT_STOKES_FILES, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.CONCAT_STOKES_FILES, CARTA.ConcatStokesFiles.encode(message).finish())) {
                const deferredResponse = new Deferred<CARTA.IConcatStokesFilesAck>();
                this.deferredMap.set(requestId, deferredResponse);
                return await deferredResponse.promise;
            } else {
                throw new Error("Could not send event");
            }
        }
    }

    async loadCatalogFile(directory: string, name: string, fileId: number, previewDataSize: number): Promise<CARTA.IOpenCatalogFileAck> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            throw new Error("Not connected");
        } else {
            const message = CARTA.OpenCatalogFile.create({directory, name, fileId, previewDataSize});
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.OPEN_CATALOG_FILE, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.OPEN_CATALOG_FILE, CARTA.OpenCatalogFile.encode(message).finish())) {
                const deferredResponse = new Deferred<CARTA.IOpenCatalogFileAck>();
                this.deferredMap.set(requestId, deferredResponse);
                return await deferredResponse.promise;
            } else {
                throw new Error("Could not send event");
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

    async saveFile(fileId: number, outputFileDirectory: string, outputFileName: string, outputFileType: CARTA.FileType, regionId?: number, channels?: number[], stokes?: number[], keepDegenerate?: boolean): Promise<CARTA.ISaveFileAck> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            throw new Error("Not connected");
        } else {
            const message = CARTA.SaveFile.create({fileId, outputFileDirectory, outputFileName, outputFileType, regionId, channels, stokes, keepDegenerate});
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.SAVE_FILE, this.eventCounter, message, false);
            if (this.sendEvent(CARTA.EventType.SAVE_FILE, CARTA.SaveFile.encode(message).finish())) {
                const deferredResponse = new Deferred<CARTA.ISaveFileAck>();
                this.deferredMap.set(requestId, deferredResponse);
                return await deferredResponse.promise;
            } else {
                throw new Error("Could not send event");
            }
        }
    }

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

    async setRegion(fileId: number, regionId: number, region: RegionStore): Promise<CARTA.ISetRegionAck> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            throw new Error("Not connected");
        } else {
            const message = CARTA.SetRegion.create({
                fileId,
                regionId,
                regionInfo: {
                    regionType: region.regionType,
                    rotation: region.rotation,
                    controlPoints: region.controlPoints.slice()
                }
            });

            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.SET_REGION, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.SET_REGION, CARTA.SetRegion.encode(message).finish())) {
                const deferredResponse = new Deferred<CARTA.ISetRegionAck>();
                this.deferredMap.set(requestId, deferredResponse);
                return await deferredResponse.promise;
            } else {
                throw new Error("Could not send event");
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

    async startAnimation(animationMessage: CARTA.IStartAnimation): Promise<CARTA.IStartAnimationAck> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            throw new Error("Not connected");
        } else {
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.START_ANIMATION, requestId, animationMessage, false);
            if (this.sendEvent(CARTA.EventType.START_ANIMATION, CARTA.StartAnimation.encode(animationMessage).finish())) {
                const deferredResponse = new Deferred<CARTA.IStartAnimationAck>();
                this.deferredMap.set(requestId, deferredResponse);
                return await deferredResponse.promise;
            } else {
                throw new Error("Could not send event");
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

    async resumeSession(message: CARTA.IResumeSession): Promise<CARTA.IResumeSessionAck> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            throw new Error("Not connected");
        } else {
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.RESUME_SESSION, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.RESUME_SESSION, CARTA.ResumeSession.encode(message).finish())) {
                const deferredResponse = new Deferred<CARTA.IResumeSessionAck>();
                this.deferredMap.set(requestId, deferredResponse);
                return await deferredResponse.promise;
            } else {
                throw new Error("Could not send event");
            }
        }
    }

    @action("set auth token")
    setAuthToken = (token: string) => {
        document.cookie = `CARTA-Authorization=${token}; path=/`;
    };

    async requestMoment(message: CARTA.IMomentRequest): Promise<CARTA.IMomentResponse> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            throw new Error("Not connected");
        } else {
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.MOMENT_REQUEST, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.MOMENT_REQUEST, CARTA.MomentRequest.encode(message).finish())) {
                const deferredResponse = new Deferred<CARTA.IMomentResponse>();
                this.deferredMap.set(requestId, deferredResponse);
                return await deferredResponse.promise;
            } else {
                throw new Error("Could not send event");
            }
        }
    }

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

    @action("cancel requesting file list")
    cancelRequestingFileList(fileListType: CARTA.FileListType) {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        } else {
            const message = CARTA.StopFileList.create({fileListType: fileListType});
            this.logEvent(CARTA.EventType.STOP_FILE_LIST, this.eventCounter, message, false);
            if (this.sendEvent(CARTA.EventType.STOP_FILE_LIST, new Uint8Array())) {
                return true;
            }
            return throwError(new Error("Could not send event"));
        }
    }

    async pingSplatalogue(): Promise<CARTA.ISplataloguePong> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            throw new Error("Not connected");
        } else {
            const message = CARTA.SplataloguePing.create();
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.SPLATALOGUE_PING, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.SPLATALOGUE_PING, CARTA.SplataloguePing.encode(message).finish())) {
                const deferredResponse = new Deferred<CARTA.ISplataloguePong>();
                this.deferredMap.set(requestId, deferredResponse);
                return await deferredResponse.promise;
            } else {
                throw new Error("Could not send event");
            }
        }
    }

    async requestSpectralLine(frequencyRange: CARTA.DoubleBounds, intensityLimit: number): Promise<CARTA.ISpectralLineResponse> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            throw new Error("Not connected");
        } else {
            const message = CARTA.SpectralLineRequest.create({frequencyRange: frequencyRange, lineIntensityLowerLimit: intensityLimit});
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.SPECTRAL_LINE_REQUEST, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.SPECTRAL_LINE_REQUEST, CARTA.SpectralLineRequest.encode(message).finish())) {
                const deferredResponse = new Deferred<CARTA.ISpectralLineResponse>();
                this.deferredMap.set(requestId, deferredResponse);
                return await deferredResponse.promise;
            } else {
                throw new Error("Could not send event");
            }
        }
    }

    async requestPV(message: CARTA.IPvRequest): Promise<CARTA.IPvResponse> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            throw new Error("Not connected");
        } else {
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.PV_REQUEST, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.PV_REQUEST, CARTA.PvRequest.encode(message).finish())) {
                const deferredResponse = new Deferred<CARTA.IPvResponse>();
                this.deferredMap.set(requestId, deferredResponse);
                return await deferredResponse.promise;
            } else {
                throw new Error("Could not send event");
            }
        }
    }

    cancelRequestingPV(fileId: number) {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        } else {
            const message = CARTA.StopPvCalc.create({fileId});
            this.logEvent(CARTA.EventType.STOP_PV_CALC, this.eventCounter, message, false);
            if (this.sendEvent(CARTA.EventType.STOP_PV_CALC, CARTA.StopPvCalc.encode(message).finish())) {
                return true;
            }
            return throwError(new Error("Could not send event"));
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

    private onDeferredResponse(eventId: number, response: IBackendResponse) {
        const def = this.deferredMap.get(eventId);
        if (def) {
            if (response.success) {
                def.resolve(response);
            } else {
                def.reject(response.message);
            }
        } else {
            console.log(`Can't find deferred for request ${eventId}`);
        }
    }

    private onRegisterViewerAck(eventId: number, ack: CARTA.RegisterViewerAck) {
        this.sessionId = ack.sessionId;
        this.serverFeatureFlags = ack.serverFeatureFlags;
        this.grpcPort = ack.grpcPort;

        TelemetryService.Instance.addTelemetryEntry(TelemetryAction.Connection, {serverFeatureFlags: ack.serverFeatureFlags, platformInfo: ack.platformStrings});
        this.onDeferredResponse(eventId, ack);
    }

    private onStartAnimationAck(eventId: number, ack: CARTA.StartAnimationAck) {
        this.animationId = ack.success ? ack.animationId : INVALID_ANIMATION_ID;
        this.onDeferredResponse(eventId, ack);
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

    private onStreamedListProgress(_eventId: number, listProgress: CARTA.ListProgress) {
        this.listProgressStream.next(listProgress);
    }

    private onStreamedPvProgress(_eventId: number, pvProgress: CARTA.PvProgress) {
        this.pvProgressStream.next(pvProgress);
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
