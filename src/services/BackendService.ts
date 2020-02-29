import {action, observable} from "mobx";
import {CARTA} from "carta-protobuf";
import {Observable, Observer, Subject, throwError} from "rxjs";
import {LogStore, PreferenceStore, RegionStore} from "stores";

export enum ConnectionStatus {
    CLOSED = 0,
    PENDING = 1,
    ACTIVE = 2,
}

export const INVALID_ANIMATION_ID = -1;

type HandlerFunction = (eventId: number, parsedMessage: any) => void;

export class BackendService {
    private static readonly IcdVersion = 12;
    private static readonly DefaultFeatureFlags = CARTA.ClientFeatureFlags.WEB_ASSEMBLY | CARTA.ClientFeatureFlags.WEB_GL;
    @observable connectionStatus: ConnectionStatus;
    readonly loggingEnabled: boolean;
    @observable connectionDropped: boolean;
    @observable endToEndPing: number;

    public animationId: number;

    private connection: WebSocket;
    private lastPingTime: number;
    private lastPongTime: number;
    private autoReconnect: boolean;
    private observerRequestMap: Map<number, Observer<any>>;
    private eventCounter: number;
    private sessionId: number;
    // TODO: These can be readonly instead of private to get rid of boilerplate gets
    private readonly rasterTileStream: Subject<CARTA.RasterTileData>;
    readonly rasterSyncStream: Subject<CARTA.RasterTileSync>;
    private readonly histogramStream: Subject<CARTA.RegionHistogramData>;
    private readonly errorStream: Subject<CARTA.ErrorData>;
    private readonly spatialProfileStream: Subject<CARTA.SpatialProfileData>;
    private readonly spectralProfileStream: Subject<CARTA.SpectralProfileData>;
    private readonly statsStream: Subject<CARTA.RegionStatsData>;
    private readonly contourStream: Subject<CARTA.ContourImageData>;
    private readonly reconnectStream: Subject<void>;
    private readonly logStore: LogStore;
    private readonly preferenceStore: PreferenceStore;
    private readonly handlerMap: Map<CARTA.EventType, HandlerFunction>;
    private readonly decoderMap: Map<CARTA.EventType, any>;

    constructor(logStore: LogStore, preferenceStore: PreferenceStore) {
        this.logStore = logStore;
        this.preferenceStore = preferenceStore;
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
        this.reconnectStream = new Subject<void>();

        // Construct handler and decoder maps
        this.handlerMap = new Map<CARTA.EventType, HandlerFunction>([
            [CARTA.EventType.REGISTER_VIEWER_ACK, this.onRegisterViewerAck],
            [CARTA.EventType.FILE_LIST_RESPONSE, this.onSimpleMappedResponse],
            [CARTA.EventType.REGION_LIST_RESPONSE, this.onSimpleMappedResponse],
            [CARTA.EventType.FILE_INFO_RESPONSE, this.onSimpleMappedResponse],
            [CARTA.EventType.REGION_FILE_INFO_RESPONSE, this.onSimpleMappedResponse],
            [CARTA.EventType.OPEN_FILE_ACK, this.onSimpleMappedResponse],
            [CARTA.EventType.IMPORT_REGION_ACK, this.onSimpleMappedResponse],
            [CARTA.EventType.EXPORT_REGION_ACK, this.onSimpleMappedResponse],
            [CARTA.EventType.SET_REGION_ACK, this.onSimpleMappedResponse],
            [CARTA.EventType.SET_USER_LAYOUT_ACK, this.onSimpleMappedResponse],
            [CARTA.EventType.SET_USER_PREFERENCES_ACK, this.onSimpleMappedResponse],
            [CARTA.EventType.RESUME_SESSION_ACK, this.onSimpleMappedResponse],
            [CARTA.EventType.START_ANIMATION_ACK, this.onStartAnimationAck],
            [CARTA.EventType.RASTER_TILE_DATA, this.onStreamedRasterTileData],
            [CARTA.EventType.REGION_HISTOGRAM_DATA, this.onStreamedRegionHistogramData],
            [CARTA.EventType.ERROR_DATA, this.onStreamedErrorData],
            [CARTA.EventType.SPATIAL_PROFILE_DATA, this.onStreamedSpatialProfileData],
            [CARTA.EventType.SPECTRAL_PROFILE_DATA, this.onStreamedSpectralProfileData],
            [CARTA.EventType.REGION_STATS_DATA, this.onStreamedRegionStatsData],
            [CARTA.EventType.CONTOUR_IMAGE_DATA, this.onStreamedContourData],
            [CARTA.EventType.RASTER_TILE_SYNC, this.onStreamedRasterSync]
        ]);

        this.decoderMap = new Map<CARTA.EventType, any>([
            [CARTA.EventType.REGISTER_VIEWER_ACK, CARTA.RegisterViewerAck],
            [CARTA.EventType.FILE_LIST_RESPONSE, CARTA.FileListResponse],
            [CARTA.EventType.REGION_LIST_RESPONSE, CARTA.RegionListResponse],
            [CARTA.EventType.FILE_INFO_RESPONSE, CARTA.FileInfoResponse],
            [CARTA.EventType.REGION_FILE_INFO_RESPONSE, CARTA.RegionFileInfoResponse],
            [CARTA.EventType.OPEN_FILE_ACK, CARTA.OpenFileAck],
            [CARTA.EventType.IMPORT_REGION_ACK, CARTA.ImportRegionAck],
            [CARTA.EventType.EXPORT_REGION_ACK, CARTA.ExportRegionAck],
            [CARTA.EventType.SET_REGION_ACK, CARTA.SetRegionAck],
            [CARTA.EventType.RESUME_SESSION_ACK, CARTA.ResumeSessionAck],
            [CARTA.EventType.START_ANIMATION_ACK, CARTA.StartAnimationAck],
            [CARTA.EventType.RASTER_TILE_DATA, CARTA.RasterTileData],
            [CARTA.EventType.REGION_HISTOGRAM_DATA, CARTA.RegionHistogramData],
            [CARTA.EventType.ERROR_DATA, CARTA.ErrorData],
            [CARTA.EventType.SPATIAL_PROFILE_DATA, CARTA.SpatialProfileData],
            [CARTA.EventType.SPECTRAL_PROFILE_DATA, CARTA.SpectralProfileData],
            [CARTA.EventType.REGION_STATS_DATA, CARTA.RegionStatsData],
            [CARTA.EventType.CONTOUR_IMAGE_DATA, CARTA.ContourImageData],
            [CARTA.EventType.SET_USER_LAYOUT_ACK, CARTA.SetUserLayoutAck],
            [CARTA.EventType.SET_USER_PREFERENCES_ACK, CARTA.SetUserPreferencesAck],
            [CARTA.EventType.RASTER_TILE_SYNC, CARTA.RasterTileSync]
        ]);

        // check ping every 5 seconds
        setInterval(this.sendPing, 5000);
    }

    getRasterTileStream() {
        return this.rasterTileStream;
    }

    getRegionHistogramStream() {
        return this.histogramStream;
    }

    getErrorStream() {
        return this.errorStream;
    }

    getSpatialProfileStream() {
        return this.spatialProfileStream;
    }

    getSpectralProfileStream() {
        return this.spectralProfileStream;
    }

    getRegionStatsStream() {
        return this.statsStream;
    }

    getContourStream() {
        return this.contourStream;
    }

    getReconnectStream() {
        return this.reconnectStream;
    }

    @action("connect")
    connect(url: string, autoConnect: boolean = true): Observable<CARTA.RegisterViewerAck> {
        if (this.connection) {
            this.connection.onclose = null;
            this.connection.close();
        }

        this.autoReconnect = autoConnect;
        this.connectionDropped = false;
        this.connectionStatus = ConnectionStatus.PENDING;
        this.connection = new WebSocket(url);
        this.connection.binaryType = "arraybuffer";
        this.connection.onmessage = this.messageHandler.bind(this);
        this.connection.onclose = (ev: CloseEvent) => {
            this.connectionStatus = ConnectionStatus.CLOSED;
            // Reconnect to the same URL if Websocket is closed
            if (!ev.wasClean && this.autoReconnect) {
                setTimeout(() => {
                    const newConnection = new WebSocket(url);
                    newConnection.binaryType = "arraybuffer";
                    newConnection.onopen = this.connection.onopen;
                    newConnection.onerror = this.connection.onerror;
                    newConnection.onclose = this.connection.onclose;
                    newConnection.onmessage = this.connection.onmessage;
                    this.connection = newConnection;
                }, 1000);
            }
        };

        const obs = new Observable<CARTA.RegisterViewerAck>(observer => {
            this.connection.onopen = () => {
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
                } else {
                    observer.error("Could not connect");
                }
            };

            this.connection.onerror = (ev => observer.error(ev));
        });

        return obs;
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
    exportRegion(directory: string, file: string, type: CARTA.FileType, coordType: CARTA.CoordinateType, fileId: number, regionId: number[]): Observable<CARTA.ExportRegionAck> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        } else {
            const message = CARTA.ExportRegion.create({directory, file, type, fileId, regionId, coordType});
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
                regionType: region.regionType,
                regionName: region.name,
                controlPoints: region.controlPoints.map(point => ({x: point.x, y: point.y})),
                rotation: region.rotation
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

    @action("set user preferences")
    setUserPreferences(preferencesMap: { [k: string]: string }): Observable<CARTA.SetUserPreferencesAck> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        } else {
            const message = CARTA.SetUserPreferences.create({preferenceMap: preferencesMap});
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.SET_USER_PREFERENCES, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.SET_USER_PREFERENCES, CARTA.SetUserPreferences.encode(message).finish())) {
                return new Observable<CARTA.SetUserPreferencesAck>(observer => {
                    this.observerRequestMap.set(requestId, observer);
                });
            } else {
                return throwError(new Error("Could not send event"));
            }
        }
    }

    @action("set user layout")
    setUserLayout(name: string, value: string): Observable<CARTA.SetUserLayoutAck> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        } else {
            const message = CARTA.SetUserLayout.create({name, value});
            const requestId = this.eventCounter;
            this.logEvent(CARTA.EventType.SET_USER_LAYOUT, requestId, message, false);
            if (this.sendEvent(CARTA.EventType.SET_USER_LAYOUT, CARTA.SetUserLayout.encode(message).finish())) {
                return new Observable<CARTA.SetUserLayoutAck>(observer => {
                    this.observerRequestMap.set(requestId, observer);
                });
            } else {
                return throwError(new Error("Could not send event"));
            }
        }
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

    @action("authenticate")
    authenticate = (username: string, password: string) => {
        let authUrl = `${window.location.protocol}//${window.location.hostname}/carta_auth/`;
        // Check for URL query parameters as a final override
        const url = new URL(window.location.href);
        const queryUrl = url.searchParams.get("authUrl");

        if (queryUrl) {
            authUrl = queryUrl;
        }

        return fetch(authUrl, {
            headers: {
                "Content-Type": "application/json"
            },
            method: "POST",
            body: JSON.stringify({username, password})
        });
    };

    @action("set auth token")
    setAuthToken = (token: string) => {
        document.cookie = `CARTA-Authorization=${token}; path=/`;
    };

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
            const messageClass = this.decoderMap.get(eventType);
            if (messageClass) {
                const parsedMessage = messageClass.decode(eventData);
                if (parsedMessage) {
                    this.logEvent(eventType, eventId, parsedMessage);
                    const handler = this.handlerMap.get(eventType);
                    if (handler) {
                        handler.call(this, eventId, parsedMessage);
                    } else {
                        console.log(`Missing handler for event response ${eventType}`);
                    }
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
        this.onSimpleMappedResponse(eventId, ack);

        // use the reconnect stream when the session type is resumed
        if (ack.success && ack.sessionType === CARTA.SessionType.RESUMED) {
            this.reconnectStream.next();
        }
    }

    private onStartAnimationAck(eventId: number, ack: CARTA.StartAnimationAck) {
        this.animationId = ack.success ? ack.animationId : INVALID_ANIMATION_ID;
        const observer = this.observerRequestMap.get(eventId);
        if (observer) {
            if (ack.success) {
                observer.next(ack);
            } else {
                observer.error(ack.message);
            }
            observer.complete();
            this.observerRequestMap.delete(eventId);
        } else {
            console.log(`Can't find observable for request ${eventId}`);
        }
    }

    private onStreamedRasterTileData(eventId: number, rasterTileData: CARTA.RasterTileData) {
        this.rasterTileStream.next(rasterTileData);
    }

    private onStreamedRasterSync(eventId: number, rasterTileSync: CARTA.RasterTileSync) {
        this.rasterSyncStream.next(rasterTileSync);
    }

    private onStreamedRegionHistogramData(eventId: number, regionHistogramData: CARTA.RegionHistogramData) {
        this.histogramStream.next(regionHistogramData);
    }

    private onStreamedErrorData(eventId: number, errorData: CARTA.ErrorData) {
        this.errorStream.next(errorData);
    }

    private onStreamedSpatialProfileData(eventId: number, spatialProfileData: CARTA.SpatialProfileData) {
        this.spatialProfileStream.next(spatialProfileData);
    }

    private onStreamedSpectralProfileData(eventId: number, spectralProfileData: CARTA.SpectralProfileData) {
        this.spectralProfileStream.next(spectralProfileData);
    }

    private onStreamedRegionStatsData(eventId: number, regionStatsData: CARTA.RegionStatsData) {
        this.statsStream.next(regionStatsData);
    }

    private onStreamedContourData(eventId: number, contourData: CARTA.ContourImageData) {
        this.contourStream.next(contourData);
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
        if (this.loggingEnabled && this.preferenceStore.isEventLoggingEnabled(eventType)) {
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