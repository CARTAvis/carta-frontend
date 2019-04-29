import {action, autorun, computed, observable} from "mobx";
import {CARTA} from "carta-protobuf";
import {Observable, Observer, Subject, throwError} from "rxjs";
import {LogStore, RegionStore} from "stores";
import {DecompressionService} from "./DecompressionService";

export enum ConnectionStatus {
    CLOSED = 0,
    PENDING = 1,
    ACTIVE = 2,
}

export enum EventType {
    RegisterViewer = 1,
    FileListRequest = 2,
    FileInfoRequest = 3,
    OpenFile = 4,
    SetImageView = 5,
    SetImageChannels = 6,
    SetCursor = 7,
    SetSpatialRequirements = 8,
    SetHistogramRequirements = 9,
    SetStatsRequirements = 10,
    SetRegion = 11,
    RemoveRegion = 12,
    CloseFile = 13,
    SetSpectralRequirements = 14,
    StartAnimation = 15,
    StartAnimationAck = 16,
    StopAnimation = 17,
    RegisterViewerAck = 18,
    FileListResponse = 19,
    FileInfoResponse = 20,
    OpenFileAck = 21,
    SetRegionAck = 22,
    RegionHistogramData = 23,
    RasterImageData = 24,
    SpatialProfileData = 25,
    SpectralProfileData = 26,
    RegionStatsData = 27,
    ErrorData = 28
}

export class BackendService {
    private static readonly IcdVersion = 2;

    @observable connectionStatus: ConnectionStatus;
    @observable loggingEnabled: boolean;
    @observable connectionDropped: boolean;
    @observable sessionId: number;
    @observable apiKey: string;
    @observable endToEndPing: number;

    private connection: WebSocket;
    private lastPingTime: number;
    private lastPongTime: number;
    private autoReconnect: boolean;
    private observerRequestMap: Map<number, Observer<any>>;
    private eventCounter: number;
    private readonly rasterStream: Subject<CARTA.RasterImageData>;
    private readonly histogramStream: Subject<CARTA.RegionHistogramData>;
    private readonly errorStream: Subject<CARTA.ErrorData>;
    private readonly spatialProfileStream: Subject<CARTA.SpatialProfileData>;
    private readonly spectralProfileStream: Subject<CARTA.SpectralProfileData>;
    private readonly statsStream: Subject<CARTA.RegionStatsData>;
    private readonly logEventList: EventType[];
    private readonly decompressionServce: DecompressionService;
    private readonly subsetsRequired: number;
    private totalDecompressionTime: number;
    private totalDecompressionMPix: number;
    private readonly logStore: LogStore;

    constructor(logStore: LogStore) {
        this.logStore = logStore;
        this.observerRequestMap = new Map<number, Observer<any>>();
        this.eventCounter = 1;
        this.endToEndPing = NaN;
        this.connectionStatus = ConnectionStatus.CLOSED;
        this.rasterStream = new Subject<CARTA.RasterImageData>();
        this.histogramStream = new Subject<CARTA.RegionHistogramData>();
        this.errorStream = new Subject<CARTA.ErrorData>();
        this.spatialProfileStream = new Subject<CARTA.SpatialProfileData>();
        this.spectralProfileStream = new Subject<CARTA.SpectralProfileData>();
        this.statsStream = new Subject<CARTA.RegionStatsData>();
        this.subsetsRequired = Math.min(navigator.hardwareConcurrency || 4, 4);
        if (process.env.NODE_ENV !== "test") {
            this.decompressionServce = new DecompressionService(this.subsetsRequired);
        }
        this.totalDecompressionTime = 0;
        this.totalDecompressionMPix = 0;
        this.logEventList = [
            EventType.RegisterViewer,
            EventType.RegisterViewerAck,
            EventType.OpenFile,
            EventType.OpenFileAck
        ];

        // Check local storage for a list of events to log to console
        const localStorageEventlist = localStorage.getItem("DEBUG_OVERRIDE_EVENT_LIST");
        if (localStorageEventlist) {
            try {
                const eventList = JSON.parse(localStorageEventlist);
                if (eventList && Array.isArray(eventList) && eventList.length) {
                    for (const eventName of eventList) {
                        const eventType = (<any> EventType)[eventName];
                        if (eventType !== undefined) {
                            this.logEventList.push(eventType);
                        }
                    }
                    console.log("Appending event log list from local storage");
                }
            } catch (e) {
                console.log("Invalid event list read from local storage");
            }
        }

        autorun(() => {
            if (this.zfpReady) {
                this.logStore.addInfo(`ZFP loaded with ${this.subsetsRequired} workers`, ["zfp"]);
            }
        });

        // check ping every 5 seconds
        setInterval(this.sendPing, 5000);
    }

    @computed get zfpReady() {
        return (this.decompressionServce && this.decompressionServce.zfpReady);
    }

    getRasterStream() {
        return this.rasterStream;
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

    @action("connect")
    connect(url: string, apiKey: string, autoConnect: boolean = true): Observable<number> {
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

        this.apiKey = apiKey;

        const obs = new Observable<number>(observer => {
            this.connection.onopen = () => {
                if (this.connectionStatus === ConnectionStatus.CLOSED) {
                    this.connectionDropped = true;
                }
                this.connectionStatus = ConnectionStatus.ACTIVE;
                this.autoReconnect = true;

                const message = CARTA.RegisterViewer.create({sessionId: 0, apiKey: apiKey});
                const requestId = this.eventCounter;
                this.logEvent(EventType.RegisterViewer, requestId, message, false);
                if (this.sendEvent(EventType.RegisterViewer, CARTA.RegisterViewer.encode(message).finish())) {
                    this.observerRequestMap.set(requestId, observer);
                } else {
                    observer.error("Could not connect");
                }
            };

            this.connection.onerror = (ev => observer.error(ev));
        });

        obs.subscribe(res => {
            console.log(`Connected with session ID ${res}`);
            this.sessionId = res;
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
            this.logEvent(EventType.FileListRequest, requestId, message, false);
            if (this.sendEvent(EventType.FileListRequest, CARTA.FileListRequest.encode(message).finish())) {
                return new Observable<CARTA.FileListResponse>(observer => {
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
            this.logEvent(EventType.FileInfoRequest, requestId, message, false);
            if (this.sendEvent(EventType.FileInfoRequest, CARTA.FileInfoRequest.encode(message).finish())) {
                return new Observable<CARTA.FileInfoResponse>(observer => {
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
            this.logEvent(EventType.OpenFile, requestId, message, false);
            if (this.sendEvent(EventType.OpenFile, CARTA.OpenFile.encode(message).finish())) {
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
            this.logEvent(EventType.CloseFile, this.eventCounter, message, false);
            if (this.sendEvent(EventType.CloseFile, CARTA.CloseFile.encode(message).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("set image view")
    setImageView(fileId: number, xMin: number, xMax: number, yMin: number, yMax: number, mip: number, compressionQuality: number): boolean {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            const message = CARTA.SetImageView.create({fileId, imageBounds: {xMin, xMax, yMin, yMax}, mip, compressionType: CARTA.CompressionType.ZFP, compressionQuality, numSubsets: this.subsetsRequired});
            this.logEvent(EventType.SetImageView, this.eventCounter, message, false);
            if (this.sendEvent(EventType.SetImageView, CARTA.SetImageView.encode(message).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("set channels")
    setChannels(fileId: number, channel: number, stokes: number): boolean {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            const message = CARTA.SetImageChannels.create({fileId, channel, stokes});
            this.logEvent(EventType.SetImageChannels, this.eventCounter, message, false);
            if (this.sendEvent(EventType.SetImageChannels, CARTA.SetImageChannels.encode(message).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("set cursor")
    setCursor(fileId: number, x: number, y: number): boolean {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            const message = CARTA.SetCursor.create({fileId, point: {x, y}});
            this.logEvent(EventType.SetCursor, this.eventCounter, message, false);
            if (this.sendEvent(EventType.SetCursor, CARTA.SetCursor.encode(message).finish())) {
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
            this.logEvent(EventType.SetRegion, requestId, message, false);
            if (this.sendEvent(EventType.SetRegion, CARTA.SetRegion.encode(message).finish())) {
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
            this.logEvent(EventType.RemoveRegion, this.eventCounter, message, false);
            if (this.sendEvent(EventType.RemoveRegion, CARTA.RemoveRegion.encode(message).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("set spatial requirements")
    setSpatialRequirements(fileId: number, regionId: number, spatialProfiles: string[]) {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            const message = CARTA.SetSpatialRequirements.create({fileId, regionId, spatialProfiles});
            this.logEvent(EventType.SetSpatialRequirements, this.eventCounter, message, false);
            if (this.sendEvent(EventType.SetSpatialRequirements, CARTA.SetSpatialRequirements.encode(message).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("set spectral requirements")
    setSpectralRequirements(requirementsMessage: CARTA.ISetSpectralRequirements) {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            this.logEvent(EventType.SetSpectralRequirements, this.eventCounter, requirementsMessage, false);
            if (this.sendEvent(EventType.SetSpectralRequirements, CARTA.SetSpectralRequirements.encode(requirementsMessage).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("set stats requirements")
    setStatsRequirements(requirementsMessage: CARTA.ISetStatsRequirements) {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            this.logEvent(EventType.SetStatsRequirements, this.eventCounter, requirementsMessage, false);
            if (this.sendEvent(EventType.SetStatsRequirements, CARTA.SetStatsRequirements.encode(requirementsMessage).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("set histogram requirements")
    setHistogramRequirements(requirementsMessage: CARTA.ISetHistogramRequirements) {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            this.logEvent(EventType.SetHistogramRequirements, this.eventCounter, requirementsMessage, false);
            if (this.sendEvent(EventType.SetHistogramRequirements, CARTA.SetHistogramRequirements.encode(requirementsMessage).finish())) {
                return true;
            }
        }
        return false;
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

        const eventType: EventType = eventHeader16[0];
        const eventIcdVersion = eventHeader16[1];
        const eventId = eventHeader32[0];

        if (eventIcdVersion !== BackendService.IcdVersion) {
            console.warn(`Server event has ICD version ${eventIcdVersion}, which differs from frontend version ${BackendService.IcdVersion}. Errors may occur`);
        }

        try {
            let parsedMessage;
            if (eventType === EventType.RegisterViewerAck) {
                parsedMessage = CARTA.RegisterViewerAck.decode(eventData);
                this.onRegisterViewerAck(eventId, parsedMessage);
            } else if (eventType === EventType.FileListResponse) {
                parsedMessage = CARTA.FileListResponse.decode(eventData);
                this.onFileListResponse(eventId, parsedMessage);
            } else if (eventType === EventType.FileInfoResponse) {
                parsedMessage = CARTA.FileInfoResponse.decode(eventData);
                this.onFileInfoResponse(eventId, parsedMessage);
            } else if (eventType === EventType.OpenFileAck) {
                parsedMessage = CARTA.OpenFileAck.decode(eventData);
                this.onFileOpenAck(eventId, parsedMessage);
            } else if (eventType === EventType.SetRegionAck) {
                parsedMessage = CARTA.SetRegionAck.decode(eventData);
                this.onSetRegionAck(eventId, parsedMessage);
            } else if (eventType === EventType.RasterImageData) {
                parsedMessage = CARTA.RasterImageData.decode(eventData);
                this.onStreamedRasterImageData(eventId, parsedMessage);
            } else if (eventType === EventType.RegionHistogramData) {
                parsedMessage = CARTA.RegionHistogramData.decode(eventData);
                this.onStreamedRegionHistogramData(eventId, parsedMessage);
            } else if (eventType === EventType.ErrorData) {
                parsedMessage = CARTA.ErrorData.decode(eventData);
                this.onStreamedErrorData(eventId, parsedMessage);
            } else if (eventType === EventType.SpatialProfileData) {
                parsedMessage = CARTA.SpatialProfileData.decode(eventData);
                this.onStreamedSpatialProfileData(eventId, parsedMessage);
            } else if (eventType === EventType.SpectralProfileData) {
                parsedMessage = CARTA.SpectralProfileData.decode(eventData);
                this.onStreamedSpectralProfileData(eventId, parsedMessage);
            } else if (eventType === EventType.RegionStatsData) {
                parsedMessage = CARTA.RegionStatsData.decode(eventData);
                this.onStreamedRegionStatsData(eventId, parsedMessage);
            } else {
                console.log(`Unsupported event response ${eventType}`);
            }
            this.logEvent(eventType, eventId, parsedMessage);

        } catch (e) {
            console.log(e);
        }
    }

    private onRegisterViewerAck(eventId: number, response: CARTA.RegisterViewerAck) {
        const observer = this.observerRequestMap.get(eventId);
        if (observer) {
            if (response.success) {
                observer.next(response.sessionId);
            } else {
                observer.error(response.message);
                this.observerRequestMap.delete(eventId);
            }
        } else {
            console.log(`Can't find observable for request ${eventId}`);
        }
    }

    private onFileListResponse(eventId: number, response: CARTA.FileListResponse) {
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

    private onFileInfoResponse(eventId: number, response: CARTA.FileInfoResponse) {
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

    private onFileOpenAck(eventId: number, ack: CARTA.OpenFileAck) {
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

    private onSetRegionAck(eventId: number, ack: CARTA.SetRegionAck) {
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

    private onStreamedRasterImageData(eventId: number, rasterImageData: CARTA.RasterImageData) {
        if (rasterImageData.compressionType === CARTA.CompressionType.NONE) {
            this.rasterStream.next(rasterImageData);
        } else {
            const t0 = performance.now();
            this.decompressionServce.decompressRasterData(rasterImageData).then(decompressedMessage => {
                const t1 = performance.now();
                const sizeMpix = decompressedMessage.imageData[0].length / 4e6;
                const dt = t1 - t0;
                this.totalDecompressionMPix += sizeMpix;
                this.totalDecompressionTime += dt;
                const speed = sizeMpix / dt * 1e3;
                const averageSpeed = this.totalDecompressionMPix / this.totalDecompressionTime * 1e3;
                this.logStore.addDebug(`Decompressed ${sizeMpix.toFixed(2)} MPix in ${dt.toFixed(2)} ms (${speed.toFixed(2)} MPix/s); Average speed: ${averageSpeed.toFixed(2)} MPix/s`, ["zfp"]);
                this.rasterStream.next(decompressedMessage);
            });
        }
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

    private sendEvent(eventType: EventType, payload: Uint8Array): boolean {
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

    private logEvent(eventType: EventType, eventId: number, message: any, incoming: boolean = true) {
        const eventName = EventType[eventType];
        if (this.loggingEnabled && this.logEventList.indexOf(eventType) >= 0) {
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