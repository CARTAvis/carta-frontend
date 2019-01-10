import {action, autorun, computed, observable} from "mobx";
import {CARTA} from "carta-protobuf";
import {Observable, Observer, throwError, Subject} from "rxjs";
import {LogStore} from "stores";
import {DecompressionService} from "./DecompressionService";

export enum ConnectionStatus {
    CLOSED = 0,
    PENDING = 1,
    ACTIVE = 2,
    DROPPED = 3
}

export enum EventNames {
    RegisterViewer = "REGISTER_VIEWER",
    FileListRequest = "FILE_LIST_REQUEST",
    FileInfoRequest = "FILE_INFO_REQUEST",
    OpenFile = "OPEN_FILE",
    CloseFile = "CLOSE_FILE",
    SetImageView = "SET_IMAGE_VIEW",
    SetImageChannels = "SET_IMAGE_CHANNELS",
    SetCursor = "SET_CURSOR",
    SetSpatialRequirements = "SET_SPATIAL_REQUIREMENTS",
    SetSpectralRequirements = "SET_SPECTRAL_REQUIREMENTS",
    SetHistogramRequirements = "SET_HISTOGRAM_REQUIREMENTS",
    RegisterViewerAck = "REGISTER_VIEWER_ACK",
    FileListResponse = "FILE_LIST_RESPONSE",
    FileInfoResponse = "FILE_INFO_RESPONSE",
    OpenFileAck = "OPEN_FILE_ACK",
    RasterImageData = "RASTER_IMAGE_DATA",
    RegionHistogramData = "REGION_HISTOGRAM_DATA",
    ErrorData = "ERROR_DATA",
    SpatialProfileData = "SPATIAL_PROFILE_DATA",
    SpectralProfileData = "SPECTRAL_PROFILE_DATA"
}

export class BackendService {
    @observable connectionStatus: ConnectionStatus;
    @observable loggingEnabled: boolean;
    @observable sessionId: string;
    @observable apiKey: string;
    private connection: WebSocket;
    private observerRequestMap: Map<number, Observer<any>>;
    private eventCounter: number;
    private readonly rasterStream: Subject<CARTA.RasterImageData>;
    private readonly histogramStream: Subject<CARTA.RegionHistogramData>;
    private readonly errorStream: Subject<CARTA.ErrorData>;
    private readonly spatialProfileStream: Subject<CARTA.SpatialProfileData>;
    private readonly spectralProfileStream: Subject<CARTA.SpectralProfileData>;
    private readonly logEventList: EventNames[];
    private readonly decompressionServce: DecompressionService;
    private readonly subsetsRequired: number;
    private totalDecompressionTime: number;
    private totalDecompressionMPix: number;
    private readonly logStore: LogStore;

    constructor(logStore: LogStore) {
        this.logStore = logStore;
        this.observerRequestMap = new Map<number, Observer<any>>();
        this.eventCounter = 1;
        this.connectionStatus = ConnectionStatus.CLOSED;
        this.rasterStream = new Subject<CARTA.RasterImageData>();
        this.histogramStream = new Subject<CARTA.RegionHistogramData>();
        this.errorStream = new Subject<CARTA.ErrorData>();
        this.spatialProfileStream = new Subject<CARTA.SpatialProfileData>();
        this.spectralProfileStream = new Subject<CARTA.SpectralProfileData>();
        this.subsetsRequired = Math.min(navigator.hardwareConcurrency || 4, 4);
        if (process.env.NODE_ENV !== "test") {
            this.decompressionServce = new DecompressionService(this.subsetsRequired);
        }
        this.totalDecompressionTime = 0;
        this.totalDecompressionMPix = 0;
        this.logEventList = [
            EventNames.RegisterViewer,
            EventNames.RegisterViewerAck,
            EventNames.OpenFile,
            EventNames.OpenFileAck,
        ];

        // Check local storage for a list of events to log to console
        const localStorageEventlist = localStorage.getItem("DEBUG_OVERRIDE_EVENT_LIST");
        if (localStorageEventlist) {
            try {
                const eventList = JSON.parse(localStorageEventlist);
                if (eventList && Array.isArray(eventList) && eventList.length) {
                    this.logEventList = eventList;
                    console.log("Overriding event log list from local storage");
                }
            }
            catch (e) {
                console.log("Invalid event list read from local storage");
            }
        }

        autorun(() => {
            if (this.zfpReady) {
                this.logStore.addInfo(`ZFP loaded with ${this.subsetsRequired} workers`, ["zfp"]);
            }
        });
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

    @action("connect")
    connect(url: string, apiKey: string): Observable<string> {
        if (this.connection) {
            this.connection.close();
        }

        this.connection = new WebSocket(url);
        this.connectionStatus = ConnectionStatus.PENDING;
        this.connection.binaryType = "arraybuffer";
        this.connection.onmessage = this.messageHandler.bind(this);
        this.connection.onclose = (ev: CloseEvent) => {
            // Reconnect to the same URL if Websocket is closed
            if (!ev.wasClean) {
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

        const obs = new Observable<string>(observer => {
            this.connection.onopen = () => {
                this.connectionStatus = ConnectionStatus.ACTIVE;
                const message = CARTA.RegisterViewer.create({sessionId: "", apiKey: apiKey});
                const requestId = this.eventCounter;
                this.logEvent(EventNames.RegisterViewer, requestId, message, false);
                if (this.sendEvent(EventNames.RegisterViewer, CARTA.RegisterViewer.encode(message).finish())) {
                    this.observerRequestMap.set(requestId, observer);
                }
                else {
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

    @action("file list")
    getFileList(directory: string): Observable<CARTA.FileListResponse> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        }
        else {
            const message = CARTA.FileListRequest.create({directory});
            const requestId = this.eventCounter;
            this.logEvent(EventNames.FileListRequest, requestId, message, false);
            if (this.sendEvent(EventNames.FileListRequest, CARTA.FileListRequest.encode(message).finish())) {
                return new Observable<CARTA.FileListResponse>(observer => {
                    this.observerRequestMap.set(requestId, observer);
                });
            }
            else {
                return throwError(new Error("Could not send event"));
            }
        }
    }

    @action("file info")
    getFileInfo(directory: string, file: string, hdu: string): Observable<CARTA.FileInfoResponse> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        }
        else {
            const message = CARTA.FileInfoRequest.create({directory, file, hdu});
            const requestId = this.eventCounter;
            this.logEvent(EventNames.FileInfoRequest, requestId, message, false);
            if (this.sendEvent(EventNames.FileInfoRequest, CARTA.FileInfoRequest.encode(message).finish())) {
                return new Observable<CARTA.FileInfoResponse>(observer => {
                    this.observerRequestMap.set(requestId, observer);
                });
            }
            else {
                return throwError(new Error("Could not send event"));
            }
        }
    }

    @action("load file")
    loadFile(directory: string, file: string, hdu: string, fileId: number, renderMode: CARTA.RenderMode): Observable<CARTA.OpenFileAck> {
        if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
            return throwError(new Error("Not connected"));
        }
        else {
            const message = CARTA.OpenFile.create({directory, file, hdu, fileId, renderMode});
            const requestId = this.eventCounter;
            this.logEvent(EventNames.OpenFile, requestId, message, false);
            if (this.sendEvent(EventNames.OpenFile, CARTA.OpenFile.encode(message).finish())) {
                return new Observable<CARTA.OpenFileAck>(observer => {
                    this.observerRequestMap.set(requestId, observer);
                });
            }
            else {
                return throwError(new Error("Could not send event"));
            }
        }
    }

    @action("close file")
    closeFile(fileId: number): boolean {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            const message = CARTA.CloseFile.create({fileId});
            this.logEvent(EventNames.CloseFile, this.eventCounter, message, false);
            if (this.sendEvent(EventNames.CloseFile, CARTA.CloseFile.encode(message).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("set image view")
    setImageView(fileId: number, xMin: number, xMax: number, yMin: number, yMax: number, mip: number, compressionQuality: number): boolean {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            const message = CARTA.SetImageView.create({fileId, imageBounds: {xMin, xMax, yMin, yMax}, mip, compressionType: CARTA.CompressionType.ZFP, compressionQuality, numSubsets: this.subsetsRequired});
            this.logEvent(EventNames.SetImageView, this.eventCounter, message, false);
            if (this.sendEvent(EventNames.SetImageView, CARTA.SetImageView.encode(message).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("set channels")
    setChannels(fileId: number, channel: number, stokes: number): boolean {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            const message = CARTA.SetImageChannels.create({fileId, channel, stokes});
            this.logEvent(EventNames.SetImageChannels, this.eventCounter, message, false);
            if (this.sendEvent(EventNames.SetImageChannels, CARTA.SetImageChannels.encode(message).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("set cursor")
    setCursor(fileId: number, x: number, y: number): boolean {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            const message = CARTA.SetCursor.create({fileId, point: {x, y}});
            this.logEvent(EventNames.SetCursor, this.eventCounter, message, false);
            if (this.sendEvent(EventNames.SetCursor, CARTA.SetCursor.encode(message).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("set spatial requirements")
    setSpatialRequirements(fileId: number, regionId: number, spatialProfiles: string[]) {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            const message = CARTA.SetSpatialRequirements.create({fileId, regionId, spatialProfiles});
            this.logEvent(EventNames.SetSpatialRequirements, this.eventCounter, message, false);
            if (this.sendEvent(EventNames.SetSpatialRequirements, CARTA.SetSpatialRequirements.encode(message).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("set spectral requirements")
    setSpectralRequirements(fileId: number, regionId: number, spectralProfiles: CARTA.SetSpectralRequirements.SpectralConfig[]) {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            const message = CARTA.SetSpectralRequirements.create({fileId, regionId, spectralProfiles});
            this.logEvent(EventNames.SetSpectralRequirements, this.eventCounter, message, false);
            if (this.sendEvent(EventNames.SetSpectralRequirements, CARTA.SetSpectralRequirements.encode(message).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("set histogram requirements")
    setHistogramRequirements(fileId: number, regionId: number, histograms: CARTA.SetHistogramRequirements.HistogramConfig[]) {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            const message = CARTA.SetHistogramRequirements.create({fileId, regionId, histograms});
            this.logEvent(EventNames.SetHistogramRequirements, this.eventCounter, message, false);
            if (this.sendEvent(EventNames.SetHistogramRequirements, CARTA.SetHistogramRequirements.encode(message).finish())) {
                return true;
            }
        }
        return false;
    }

    private messageHandler(event: MessageEvent) {
        if (event.data.byteLength < 40) {
            console.log("Unknown event format");
            return;
        }

        const eventName = this.getEventName(new Uint8Array(event.data, 0, 32));
        const eventId = new Uint32Array(event.data, 32, 1)[0];
        const eventData = new Uint8Array(event.data, 36);

        try {
            let parsedMessage;
            if (eventName === EventNames.RegisterViewerAck) {
                parsedMessage = CARTA.RegisterViewerAck.decode(eventData);
                this.onRegisterViewerAck(eventId, parsedMessage);
            }
            else if (eventName === EventNames.FileListResponse) {
                parsedMessage = CARTA.FileListResponse.decode(eventData);
                this.onFileListResponse(eventId, parsedMessage);
            }
            else if (eventName === EventNames.FileInfoResponse) {
                parsedMessage = CARTA.FileInfoResponse.decode(eventData);
                this.onFileInfoResponse(eventId, parsedMessage);
            }
            else if (eventName === EventNames.OpenFileAck) {
                parsedMessage = CARTA.OpenFileAck.decode(eventData);
                this.onFileOpenAck(eventId, parsedMessage);
            }
            else if (eventName === EventNames.RasterImageData) {
                parsedMessage = CARTA.RasterImageData.decode(eventData);
                this.onStreamedRasterImageData(eventId, parsedMessage);
            }
            else if (eventName === EventNames.RegionHistogramData) {
                parsedMessage = CARTA.RegionHistogramData.decode(eventData);
                this.onStreamedRegionHistogramData(eventId, parsedMessage);
            }
            else if (eventName === EventNames.ErrorData) {
                parsedMessage = CARTA.ErrorData.decode(eventData);
                this.onStreamedErrorData(eventId, parsedMessage);
            }
            else if (eventName === EventNames.SpatialProfileData) {
                parsedMessage = CARTA.SpatialProfileData.decode(eventData);
                this.onStreamedSpatialProfileData(eventId, parsedMessage);
            }
            else if (eventName === EventNames.SpectralProfileData) {
                parsedMessage = CARTA.SpectralProfileData.decode(eventData);
                this.onStreamedSpectralProfileData(eventId, parsedMessage);
            }
            else {
                console.log(`Unsupported event response ${eventName}`);
            }
            this.logEvent(eventName, eventId, parsedMessage);

        } catch (e) {
            console.log(e);
        }
    }

    private onRegisterViewerAck(eventId: number, response: CARTA.RegisterViewerAck) {
        const observer = this.observerRequestMap.get(eventId);
        if (observer) {
            if (response.success) {
                observer.next(response.sessionId);
            }
            else {
                observer.error(response.message);
                this.observerRequestMap.delete(eventId);
            }
        }
        else {
            console.log(`Can't find observable for request ${eventId}`);
        }
    }

    private onFileListResponse(eventId: number, response: CARTA.FileListResponse) {
        const observer = this.observerRequestMap.get(eventId);
        if (observer) {
            if (response.success) {
                observer.next(response);
            }
            else {
                observer.error(response.message);
            }
            observer.complete();
            this.observerRequestMap.delete(eventId);
        }
        else {
            console.log(`Can't find observable for request ${eventId}`);
        }
    }

    private onFileInfoResponse(eventId: number, response: CARTA.FileInfoResponse) {
        const observer = this.observerRequestMap.get(eventId);
        if (observer) {
            if (response.success) {
                observer.next(response);
            }
            else {
                observer.error(response.message);
            }
            observer.complete();
            this.observerRequestMap.delete(eventId);
        }
        else {
            console.log(`Can't find observable for request ${eventId}`);
        }
    }

    private onFileOpenAck(eventId: number, ack: CARTA.OpenFileAck) {
        const observer = this.observerRequestMap.get(eventId);
        if (observer) {
            if (ack.success) {
                observer.next(ack);
            }
            else {
                observer.error(ack.message);
            }
            observer.complete();
            this.observerRequestMap.delete(eventId);
        }
        else {
            console.log(`Can't find observable for request ${eventId}`);
        }
    }

    private onStreamedRasterImageData(eventId: number, rasterImageData: CARTA.RasterImageData) {
        if (rasterImageData.compressionType === CARTA.CompressionType.NONE) {
            this.rasterStream.next(rasterImageData);
        }
        else {
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

    private sendEvent(eventName: EventNames, payload: Uint8Array): boolean {

        if (this.connection.readyState === WebSocket.OPEN) {
            let eventData = new Uint8Array(32 + 4 + payload.byteLength);
            eventData.set(this.stringToUint8Array(eventName, 32));
            eventData.set(new Uint8Array(new Uint32Array([this.eventCounter]).buffer), 32);
            eventData.set(payload, 36);
            this.connection.send(eventData);
            this.eventCounter++;
            return true;
        }
        else {
            console.log("Error sending event");
            this.eventCounter++;
            return false;
        }
    }

    private stringToUint8Array(str: string, padLength: number): Uint8Array {
        const bytes = new Uint8Array(padLength);
        for (let i = 0; i < Math.min(str.length, padLength); i++) {
            const charCode = str.charCodeAt(i);
            bytes[i] = (charCode <= 0xFF ? charCode : 0);
        }
        return bytes;
    }

    private getEventName(byteArray: Uint8Array) {
        if (!byteArray || byteArray.length < 32) {
            return "";
        }
        const nullIndex = byteArray.indexOf(0);
        if (nullIndex >= 0) {
            byteArray = byteArray.slice(0, byteArray.indexOf(0));
        }
        return String.fromCharCode.apply(null, byteArray);
    }

    private logEvent(eventName: EventNames, eventId: number, message: any, incoming: boolean = true) {
        if (this.loggingEnabled && this.logEventList.indexOf(eventName) >= 0) {
            if (incoming) {
                if (eventId === 0) {
                    console.log(`<== ${eventName} [Stream]`);
                }
                else {
                    console.log(`<== ${eventName} [${eventId}]`);
                }
            }
            else {
                console.log(`${eventName} [${eventId}] ==>`);
            }
            console.log(message);
            console.log("\n");
        }
    }
}