import {action, observable, reaction} from "mobx";
import {CARTA} from "carta-protobuf";
import {Observable, Observer, of} from "rxjs";

export enum ConnectionStatus {
    CLOSED = 0,
    PENDING = 1,
    ACTIVE = 2,
    DROPPED = 3
}

export class BackendService {

    @observable connectionStatus: ConnectionStatus;
    @observable loggingEnabled: boolean;
    @observable log: string;
    @observable sessionId: string;
    @observable apiKey: string;
    messageHandler = (event: MessageEvent) => {
        if (event.data.byteLength < 40) {
            console.log("Unknown event format");
            return;
        }

        const eventName = this.getEventName(new Uint8Array(event.data, 0, 32));
        const eventId = new Uint32Array(event.data, 32, 2)[0];
        const eventData = new Uint8Array(event.data, 40);

        const eventCallbackConfig = this.callbackConfig.get(eventName);
        if (eventCallbackConfig) {
            try {
                const parsedMessage = eventCallbackConfig.messageType.decode(eventData);
                this.logEvent(eventName, parsedMessage);
                const observer = this.observerMap.get(eventName);
                if (observer) {
                    observer.next(parsedMessage);
                    if (!eventCallbackConfig.streamed) {
                        observer.complete();
                        this.observerMap.delete(eventName);
                    }
                }
            } catch (e) {
                console.log(e);
            }
        }
    };
    private latencyEmulationMs = 50;
    private connection: WebSocket;
    private observerMap: Map<string, Observer<any>>;
    private callbackConfig: Map<string, { messageType: any, streamed: boolean }>;

    constructor() {
        this.observerMap = new Map<string, Observer<any>>();
        this.callbackConfig = new Map<string, { messageType: any, streamed: boolean }>();
        this.callbackConfig.set("REGISTER_VIEWER_ACK", {messageType: CARTA.RegisterViewerAck, streamed: true});
        this.callbackConfig.set("FILE_LIST_RESPONSE", {messageType: CARTA.FileListResponse, streamed: false});
        this.callbackConfig.set("FILE_INFO_RESPONSE", {messageType: CARTA.FileInfoResponse, streamed: false});
        this.connectionStatus = ConnectionStatus.CLOSED;
    }

    @action("connect")
    connect(url: string, apiKey: string): Observable<CARTA.RegisterViewerAck> {
        // const response = CARTA.RegisterViewerAck.create({success: true, sessionId: "1234", sessionType: CARTA.SessionType.NEW});
        // this.connectionStatus = ConnectionStatus.ACTIVE;
        // this.sessionId =  response.sessionId;
        return new Observable<CARTA.RegisterViewerAck>(observer => {
            if (this.connection) {
                this.connection.close();
            }

            this.connection = new WebSocket(url);
            this.connectionStatus = ConnectionStatus.PENDING;
            this.connection.binaryType = "arraybuffer";

            this.apiKey = apiKey;
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
            this.connection.onmessage = this.messageHandler;
            this.connection.onclose = (ev: CloseEvent) => {
                // Reconnect to the same URL if Websocket is closed
                if (!ev.wasClean) {
                    setTimeout(() => {
                        const newConnection = new WebSocket(url);
                        newConnection.binaryType = "arraybuffer";
                        newConnection.onopen = this.connection.onopen;
                        newConnection.onerror = this.connection.onerror;
                        newConnection.onclose = this.connection.onclose;
                        newConnection.onmessage = this.messageHandler;
                        this.connection = newConnection;
                    }, 1000);
                }
            };

        });
    }

    @action("file list")
    getFileList(directory: string): Observable<CARTA.FileListResponse> {
        return new Observable<CARTA.FileListResponse>(observer => {
            if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
                observer.error("Not connected");
            }
            else {
                const message = CARTA.FileListRequest.create({directory});
                this.logEvent("FILE_LIST_REQUEST", message, false);
                if (this.sendEvent("FILE_LIST_REQUEST", 0, CARTA.FileListRequest.encode(message).finish())) {
                    this.observerMap.set("FILE_LIST_RESPONSE", observer);
                }
                else {
                    observer.error("Could not connect");
                }
            }
        });
    }

    @action("file info")
    getFileInfo(directory: string, file: string, hdu: string): Observable<CARTA.FileInfoResponse> {
        return new Observable<CARTA.FileInfoResponse>(observer => {
            if (this.connectionStatus !== ConnectionStatus.ACTIVE) {
                observer.error("Not connected");
            }
            else {
                const message = CARTA.FileInfoRequest.create({directory, file, hdu});
                this.logEvent("FILE_INFO_REQUEST", message, false);
                if (this.sendEvent("FILE_INFO_REQUEST", 0, CARTA.FileInfoRequest.encode(message).finish())) {
                    this.observerMap.set("FILE_INFO_RESPONSE", observer);
                }
                else {
                    observer.error("Could not connect");
                }
            }
        });
    }

    private sendEvent(eventName: string, eventId: number, payload: Uint8Array): boolean {
        if (this.connection.readyState === WebSocket.OPEN) {
            let eventData = new Uint8Array(32 + 8 + payload.byteLength);
            eventData.set(this.stringToUint8Array(eventName, 32));
            eventData.set(new Uint8Array(new Uint32Array([eventId]).buffer), 32);
            eventData.set(payload, 40);
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
        if (this.loggingEnabled) {
            if (incoming) {
                console.log(`<== ${eventName}`);
                this.log += `<== ${eventName}\n`;
            }
            else {
                console.log(`${eventName} ==>`);
                this.log += `${eventName} ==>\n`;
            }
            console.log(message);
            console.log("\n");
            this.log += `${JSON.stringify(message)}\n`;
        }
    }
}