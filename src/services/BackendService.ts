import {action, autorun, computed, observable} from "mobx";
import * as Long from "long";
import {CARTA} from "carta-protobuf";

const ZstdCodec = require("zstd-codec").ZstdCodec;
import {Observable, Observer, Subject, throwError} from "rxjs";
import {LogStore, PreferenceStore, RegionStore} from "stores";
import {DecompressionService} from "./DecompressionService";
import {length2D, subtract2D} from "../utilities";

export enum ConnectionStatus {
    CLOSED = 0,
    PENDING = 1,
    ACTIVE = 2,
}

export const INVALID_ANIMATION_ID = -1;

let ZstdApi: any;

ZstdCodec.run(zstd => {
    ZstdApi = new zstd.Simple();
});

type HandlerFunction = (eventId: number, parsedMessage: any) => void;

export class BackendService {
    private static readonly IcdVersion = 9;
    private static readonly DefaultFeatureFlags = CARTA.ClientFeatureFlags.WEB_ASSEMBLY | CARTA.ClientFeatureFlags.WEB_GL;
    @observable connectionStatus: ConnectionStatus;
    @observable loggingEnabled: boolean;
    @observable connectionDropped: boolean;
    @observable sessionId: number;
    @observable endToEndPing: number;

    private connection: WebSocket;
    private lastPingTime: number;
    private lastPongTime: number;
    private autoReconnect: boolean;
    private observerRequestMap: Map<number, Observer<any>>;
    private eventCounter: number;
    private animationId: number;
    private readonly rasterStream: Subject<CARTA.RasterImageData>;
    private readonly rasterTileStream: Subject<CARTA.RasterTileData>;
    private readonly histogramStream: Subject<CARTA.RegionHistogramData>;
    private readonly errorStream: Subject<CARTA.ErrorData>;
    private readonly spatialProfileStream: Subject<CARTA.SpatialProfileData>;
    private readonly spectralProfileStream: Subject<CARTA.SpectralProfileData>;
    private readonly statsStream: Subject<CARTA.RegionStatsData>;
    private readonly contourStream: Subject<CARTA.ContourImageData>;
    private readonly decompressionService: DecompressionService;
    private readonly subsetsRequired: number;
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
        this.endToEndPing = NaN;
        this.animationId = INVALID_ANIMATION_ID;
        this.connectionStatus = ConnectionStatus.CLOSED;
        this.rasterStream = new Subject<CARTA.RasterImageData>();
        this.rasterTileStream = new Subject<CARTA.RasterTileData>();
        this.histogramStream = new Subject<CARTA.RegionHistogramData>();
        this.errorStream = new Subject<CARTA.ErrorData>();
        this.spatialProfileStream = new Subject<CARTA.SpatialProfileData>();
        this.spectralProfileStream = new Subject<CARTA.SpectralProfileData>();
        this.statsStream = new Subject<CARTA.RegionStatsData>();
        this.contourStream = new Subject<CARTA.ContourImageData>();

        this.subsetsRequired = Math.min(navigator.hardwareConcurrency || 4, 4);
        if (process.env.NODE_ENV !== "test") {
            this.decompressionService = new DecompressionService(this.subsetsRequired);
        }

        // Construct handler and decoder maps
        this.handlerMap = new Map<CARTA.EventType, HandlerFunction>([
            [CARTA.EventType.REGISTER_VIEWER_ACK, this.onSimpleMappedResponse],
            [CARTA.EventType.FILE_LIST_RESPONSE, this.onSimpleMappedResponse],
            [CARTA.EventType.REGION_LIST_RESPONSE, this.onSimpleMappedResponse],
            [CARTA.EventType.FILE_INFO_RESPONSE, this.onSimpleMappedResponse],
            [CARTA.EventType.REGION_FILE_INFO_RESPONSE, this.onSimpleMappedResponse],
            [CARTA.EventType.OPEN_FILE_ACK, this.onSimpleMappedResponse],
            [CARTA.EventType.IMPORT_REGION_ACK, this.onSimpleMappedResponse],
            [CARTA.EventType.EXPORT_REGION_ACK, this.onSimpleMappedResponse],
            [CARTA.EventType.SET_REGION_ACK, this.onSimpleMappedResponse],
            [CARTA.EventType.START_ANIMATION_ACK, this.onStartAnimationAck],
            [CARTA.EventType.RASTER_IMAGE_DATA, this.onStreamedRasterImageData],
            [CARTA.EventType.RASTER_TILE_DATA, this.onStreamedRasterTileData],
            [CARTA.EventType.REGION_HISTOGRAM_DATA, this.onStreamedRegionHistogramData],
            [CARTA.EventType.ERROR_DATA, this.onStreamedErrorData],
            [CARTA.EventType.SPATIAL_PROFILE_DATA, this.onStreamedSpatialProfileData],
            [CARTA.EventType.SPECTRAL_PROFILE_DATA, this.onStreamedSpectralProfileData],
            [CARTA.EventType.REGION_STATS_DATA, this.onStreamedRegionStatsData],
            [CARTA.EventType.CONTOUR_IMAGE_DATA, this.onStreamedContourData],
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
            [CARTA.EventType.START_ANIMATION_ACK, CARTA.StartAnimationAck],
            [CARTA.EventType.RASTER_IMAGE_DATA, CARTA.RasterImageData],
            [CARTA.EventType.RASTER_TILE_DATA, CARTA.RasterTileData],
            [CARTA.EventType.REGION_HISTOGRAM_DATA, CARTA.RegionHistogramData],
            [CARTA.EventType.ERROR_DATA, CARTA.ErrorData],
            [CARTA.EventType.SPATIAL_PROFILE_DATA, CARTA.SpatialProfileData],
            [CARTA.EventType.SPECTRAL_PROFILE_DATA, CARTA.SpectralProfileData],
            [CARTA.EventType.REGION_STATS_DATA, CARTA.RegionStatsData],
            [CARTA.EventType.CONTOUR_IMAGE_DATA, CARTA.ContourImageData],
        ]);

        autorun(() => {
            if (this.zfpReady) {
                this.logStore.addInfo(`ZFP loaded with ${this.subsetsRequired} workers`, ["zfp"]);
            }
        });

        // check ping every 5 seconds
        setInterval(this.sendPing, 5000);
    }

    @computed get zfpReady() {
        return (this.decompressionService && this.decompressionService.zfpReady);
    }

    getRasterStream() {
        return this.rasterStream;
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
                const message = CARTA.RegisterViewer.create({sessionId: 0, clientFeatureFlags: BackendService.DefaultFeatureFlags});
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

        obs.subscribe(ack => {
            console.log(`Connected with session ID ${ack.sessionId}`);
            this.sessionId = ack.sessionId;
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

    @action("set image view")
    setImageView(fileId: number, xMin: number, xMax: number, yMin: number, yMax: number, mip: number, compressionQuality: number): boolean {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            const message = CARTA.SetImageView.create({fileId, imageBounds: {xMin, xMax, yMin, yMax}, mip, compressionType: CARTA.CompressionType.ZFP, compressionQuality, numSubsets: this.subsetsRequired});
            this.logEvent(CARTA.EventType.SET_IMAGE_VIEW, this.eventCounter, message, false);
            if (this.sendEvent(CARTA.EventType.SET_IMAGE_VIEW, CARTA.SetImageView.encode(message).finish())) {
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
            if (animationMessage.imageView) {
                animationMessage.imageView.numSubsets = this.subsetsRequired;
            }
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

    private onStartAnimationAck(eventId: number, ack: CARTA.StartAnimationAck) {
        const observer = this.observerRequestMap.get(eventId);
        if (observer) {
            if (ack.success) {
                this.animationId = ack.animationId;
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

    private onStreamedRasterImageData(eventId: number, rasterImageData: CARTA.RasterImageData) {
        // Skip animation data for previous animations
        if (rasterImageData.animationId !== this.animationId) {
            return;
        }
        // Flow control
        const flowControlMessage: CARTA.IAnimationFlowControl = {
            fileId: rasterImageData.fileId,
            animationId: rasterImageData.animationId,
            receivedFrame: {
                channel: rasterImageData.channel,
                stokes: rasterImageData.stokes
            },
            timestamp: Long.fromNumber(Date.now())
        };

        this.sendAnimationFlowControl(flowControlMessage);

        // Decompression
        if (rasterImageData.compressionType === CARTA.CompressionType.NONE) {
            this.rasterStream.next(rasterImageData);
        } else {
            this.decompressionService.decompressRasterData(rasterImageData).then(decompressedMessage => {
                this.rasterStream.next(decompressedMessage);
            });
        }
    }

    private onStreamedRasterTileData(eventId: number, rasterTileData: CARTA.RasterTileData) {
        this.rasterTileStream.next(rasterTileData);
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
        const tStart = performance.now();
        let vertexCounter = 0;
        let compressedSize = 0;
        for (const contourSet of contourData.contourSets) {
            compressedSize += contourSet.rawCoordinates.byteLength;
            contourSet.rawCoordinates = ZstdApi.decompress(contourSet.rawCoordinates);

            // TODO: This should be done in WebAssembly! Far too slow in JS. Eventually WebAssembly will also support SSE
            const floatCoordinates = new Float32Array(contourSet.rawCoordinates.buffer);
            const shuffledBytes = new Uint8Array(16);
            const shuffledIntegers = new Int32Array(shuffledBytes.buffer);
            let counter = 0;

            let v = 0;
            const N = floatCoordinates.length;
            const blockedLength = 4 * Math.floor(N / 4);

            // Un-shuffle data and convert from int to float based on decimation factor
            for (v = 0; v < blockedLength; v += 4) {
                const i = 4 * v;
                shuffledBytes[0] = contourSet.rawCoordinates[i];
                shuffledBytes[1] = contourSet.rawCoordinates[i + 4];
                shuffledBytes[2] = contourSet.rawCoordinates[i + 8];
                shuffledBytes[3] = contourSet.rawCoordinates[i + 12];
                shuffledBytes[4] = contourSet.rawCoordinates[i + 1];
                shuffledBytes[5] = contourSet.rawCoordinates[i + 5];
                shuffledBytes[6] = contourSet.rawCoordinates[i + 9];
                shuffledBytes[7] = contourSet.rawCoordinates[i + 13];
                shuffledBytes[8] = contourSet.rawCoordinates[i + 2];
                shuffledBytes[9] = contourSet.rawCoordinates[i + 6];
                shuffledBytes[10] = contourSet.rawCoordinates[i + 10];
                shuffledBytes[11] = contourSet.rawCoordinates[i + 14];
                shuffledBytes[12] = contourSet.rawCoordinates[i + 3];
                shuffledBytes[13] = contourSet.rawCoordinates[i + 7];
                shuffledBytes[14] = contourSet.rawCoordinates[i + 11];
                shuffledBytes[15] = contourSet.rawCoordinates[i + 15];

                floatCoordinates[v] = shuffledIntegers[0] / contourSet.decimationFactor;
                floatCoordinates[v + 1] = shuffledIntegers[1] / contourSet.decimationFactor;
                floatCoordinates[v + 2] = shuffledIntegers[2] / contourSet.decimationFactor;
                floatCoordinates[v + 3] = shuffledIntegers[3] / contourSet.decimationFactor;
                counter += 16;
            }

            const remainingBytes = contourSet.rawCoordinates.slice(v * 4);
            const remainingIntegers = new Int32Array(remainingBytes.buffer);
            for (let i = 0; i < remainingIntegers.length; i++, v++) {
                floatCoordinates[v] = remainingIntegers[i] / contourSet.decimationFactor;
            }

            let lastX = 0;
            let lastY = 0;

            for (let i = 0; i < N - 1; i += 2) {
                const deltaX = floatCoordinates[i];
                const deltaY = floatCoordinates[i + 1];
                lastX += deltaX;
                lastY += deltaY;
                floatCoordinates[i] = lastX;
                floatCoordinates[i + 1] = lastY;
            }
            vertexCounter += floatCoordinates.length / 2;
        }
        const tEnd = performance.now();
        const dt = tEnd - tStart;
        const uncompressedSize = vertexCounter * 2 * 4;
        console.log(`Decompressed and un-shuffled ${vertexCounter} vertices  in ${dt} ms. ${(uncompressedSize * 1e-3).toFixed(2)} kB uncompressed, ${(compressedSize * 1e-3).toFixed(2)} kB compressed (${(100 * compressedSize / uncompressedSize).toFixed(2)}%)`);
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