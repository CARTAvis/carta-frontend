import {action, autorun, computed, observable} from "mobx";
import {CARTA} from "carta-protobuf";
import {Observable, Observer, throwError, Subject} from "rxjs";
import {DecompressionService} from "./DecompressionService";
import {LogStore} from "../stores/LogStore";

export enum ConnectionStatus {
    CLOSED = 0,
    PENDING = 1,
    ACTIVE = 2,
    DROPPED = 3
}

export class BackendService {
    @observable connectionStatus: ConnectionStatus;
    @observable loggingEnabled: boolean;
    @observable sessionId: string;
    @observable apiKey: string;
    private connection: WebSocket;
    private observerMap: Map<string, Observer<any>>;
    private readonly rasterStream: Subject<CARTA.RasterImageData>;
    private readonly histogramStream: Subject<CARTA.RegionHistogramData>;
    private readonly errorStream: Subject<CARTA.ErrorData>;
    private readonly spatialProfileStream: Subject<CARTA.SpatialProfileData>;
    private readonly logEventList: string[];
    private readonly decompressionServce: DecompressionService;
    private readonly subsetsRequired: number;
    private totalDecompressionTime: number;
    private totalDecompressionMPix: number;
    private readonly logStore: LogStore;

    constructor(logStore: LogStore) {
        this.logStore = logStore;
        this.observerMap = new Map<string, Observer<any>>();
        this.connectionStatus = ConnectionStatus.CLOSED;
        this.rasterStream = new Subject<CARTA.RasterImageData>();
        this.histogramStream = new Subject<CARTA.RegionHistogramData>();
        this.errorStream = new Subject<CARTA.ErrorData>();
        this.spatialProfileStream = new Subject<CARTA.SpatialProfileData>();
        this.subsetsRequired = Math.min(navigator.hardwareConcurrency || 4, 4);
        this.decompressionServce = new DecompressionService(this.subsetsRequired);
        this.totalDecompressionTime = 0;
        this.totalDecompressionMPix = 0;
        this.logEventList = [
            "REGISTER_VIEWER",
            "REGISTER_VIEWER_ACK",
            "OPEN_FILE",
            "OPEN_FILE_ACK",
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
                this.logEvent("REGISTER_VIEWER", message, false);
                if (this.sendEvent("REGISTER_VIEWER", 0, CARTA.RegisterViewer.encode(message).finish())) {
                    this.observerMap.set("REGISTER_VIEWER_ACK", observer);
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
            this.logEvent("FILE_LIST_REQUEST", message, false);
            if (this.sendEvent("FILE_LIST_REQUEST", 0, CARTA.FileListRequest.encode(message).finish())) {
                return new Observable<CARTA.FileListResponse>(observer => {
                    this.observerMap.set("FILE_LIST_RESPONSE", observer);
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
            this.logEvent("FILE_INFO_REQUEST", message, false);
            if (this.sendEvent("FILE_INFO_REQUEST", 0, CARTA.FileInfoRequest.encode(message).finish())) {
                return new Observable<CARTA.FileInfoResponse>(observer => {
                    this.observerMap.set("FILE_INFO_RESPONSE", observer);
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
            this.logEvent("OPEN_FILE", message, false);
            if (this.sendEvent("OPEN_FILE", 0, CARTA.OpenFile.encode(message).finish())) {
                return new Observable<CARTA.OpenFileAck>(observer => {
                    this.observerMap.set("OPEN_FILE_ACK", observer);
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
            this.logEvent("CLOSE_FILE", message, false);
            if (this.sendEvent("CLOSE_FILE", 0, CARTA.CloseFile.encode(message).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("set image view")
    setImageView(fileId: number, xMin: number, xMax: number, yMin: number, yMax: number, mip: number, compressionQuality: number): boolean {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            const message = CARTA.SetImageView.create({fileId, imageBounds: {xMin, xMax, yMin, yMax}, mip, compressionType: CARTA.CompressionType.ZFP, compressionQuality, numSubsets: this.subsetsRequired});
            this.logEvent("SET_IMAGE_VIEW", message, false);
            if (this.sendEvent("SET_IMAGE_VIEW", 0, CARTA.SetImageView.encode(message).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("set channels")
    setChannels(fileId: number, channel: number, stokes: number): boolean {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            const message = CARTA.SetImageChannels.create({fileId, channel, stokes});
            this.logEvent("SET_IMAGE_CHANNELS", message, false);
            if (this.sendEvent("SET_IMAGE_CHANNELS", 0, CARTA.SetImageChannels.encode(message).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("set cursor")
    setCursor(fileId: number, x: number, y: number): boolean {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            const message = CARTA.SetCursor.create({fileId, point: {x, y}});
            this.logEvent("SET_CURSOR", message, false);
            if (this.sendEvent("SET_CURSOR", 0, CARTA.SetCursor.encode(message).finish())) {
                return true;
            }
        }
        return false;
    }

    @action("set spatial requirements")
    setSpatialRequirements(fileId: number, regionId: number, spatialProfiles: string[]) {
        if (this.connectionStatus === ConnectionStatus.ACTIVE) {
            const message = CARTA.SetSpatialRequirements.create({fileId, regionId, spatialProfiles});
            this.logEvent("SET_SPATIAL_REQUIREMENTS", message, false);
            if (this.sendEvent("SET_SPATIAL_REQUIREMENTS", 0, CARTA.SetSpatialRequirements.encode(message).finish())) {
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
            if (eventName === "REGISTER_VIEWER_ACK") {
                parsedMessage = CARTA.RegisterViewerAck.decode(eventData);
                this.onRegisterViewerAck(parsedMessage);
            }
            else if (eventName === "FILE_LIST_RESPONSE") {
                parsedMessage = CARTA.FileListResponse.decode(eventData);
                this.onFileListResponse(parsedMessage);
            }
            else if (eventName === "FILE_INFO_RESPONSE") {
                parsedMessage = CARTA.FileInfoResponse.decode(eventData);
                this.onFileInfoResponse(parsedMessage);
            }
            else if (eventName === "OPEN_FILE_ACK") {
                parsedMessage = CARTA.OpenFileAck.decode(eventData);
                this.onFileOpenAck(parsedMessage);
            }
            else if (eventName === "RASTER_IMAGE_DATA") {
                parsedMessage = CARTA.RasterImageData.decode(eventData);
                this.onStreamedRasterImageData(parsedMessage);
            }
            else if (eventName === "REGION_HISTOGRAM_DATA") {
                parsedMessage = CARTA.RegionHistogramData.decode(eventData);
                this.onStreamedRegionHistogramData(parsedMessage);
            }
            else if (eventName === "ERROR_DATA") {
                parsedMessage = CARTA.ErrorData.decode(eventData);
                this.onStreamedErrorData(parsedMessage);
            }
            else if (eventName === "SPATIAL_PROFILE_DATA") {
                parsedMessage = CARTA.SpatialProfileData.decode(eventData);
                this.onStreamedSpatialProfileData(parsedMessage);
            }
            else {
                console.log(`Unsupported event response ${eventName}`);
            }
            this.logEvent(eventName, parsedMessage);

        } catch (e) {
            console.log(e);
        }
    }

    private onRegisterViewerAck(response: CARTA.RegisterViewerAck) {
        const observer = this.observerMap.get("REGISTER_VIEWER_ACK");
        if (observer) {
            if (response.success) {
                observer.next(response.sessionId);
            }
            else {
                observer.error(response.message);
            }
        }
    }

    private onFileListResponse(response: CARTA.FileListResponse) {
        const observer = this.observerMap.get("FILE_LIST_RESPONSE");
        if (observer) {
            if (response.success) {
                observer.next(response);
            }
            else {
                observer.error(response.message);
            }
            observer.complete();
        }
    }

    private onFileInfoResponse(response: CARTA.FileInfoResponse) {
        const observer = this.observerMap.get("FILE_INFO_RESPONSE");
        if (observer) {
            if (response.success) {
                observer.next(response);
            }
            else {
                observer.error(response.message);
            }
            observer.complete();
        }
    }

    private onFileOpenAck(ack: CARTA.OpenFileAck) {
        const observer = this.observerMap.get("OPEN_FILE_ACK");
        if (observer) {
            if (ack.success) {
                observer.next(ack);
            }
            else {
                observer.error(ack.message);
            }
            observer.complete();
        }
    }

    private onStreamedRasterImageData(rasterImageData: CARTA.RasterImageData) {
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

    private onStreamedRegionHistogramData(regionHistogramData: CARTA.RegionHistogramData) {
        this.histogramStream.next(regionHistogramData);
    }

    private onStreamedErrorData(errorData: CARTA.ErrorData) {
        this.errorStream.next(errorData);
    }

    onStreamedSpatialProfileData(spatialProfileData: CARTA.SpatialProfileData) {
        this.spatialProfileStream.next(spatialProfileData);
    }

    private sendEvent(eventName: string, eventId: number, payload: Uint8Array): boolean {
        if (this.connection.readyState === WebSocket.OPEN) {
            let eventData = new Uint8Array(32 + 4 + payload.byteLength);
            eventData.set(this.stringToUint8Array(eventName, 32));
            eventData.set(new Uint8Array(new Uint32Array([eventId]).buffer), 32);
            eventData.set(payload, 36);
            this.connection.send(eventData);
            return true;
        }
        else {
            console.log("Error sending event");
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

    private logEvent(eventName: string, message: any, incoming: boolean = true) {
        if (this.loggingEnabled && this.logEventList.indexOf(eventName) >= 0) {
            if (incoming) {
                console.log(`<== ${eventName}`);
            }
            else {
                console.log(`${eventName} ==>`);
            }
            console.log(message);
            console.log("\n");
        }
    }
}