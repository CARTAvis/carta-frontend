import {CARTA} from "carta-protobuf";
import * as Utility from "./testUtilityFunction";

let WebSocket = require("ws");
let testServerUrl = "wss://acdc0.asiaa.sinica.edu.tw/socket2";
let testFileName = "aJ.fits";
let fileType = CARTA.FileType.FITS;
let testSubdirectoryName = "set_QA";
let expectRootPath = "";
let connectTimeout = 1000;
let testReturnName = "FILE_LIST_RESPONSE";

describe("GET_FILELIST_ROOTPATH tests", () => {    

    test(`send EventName: "REGISTER_VIEWER" to CARTA "${testServerUrl}" with no session_id & api_key "1234".`, 
    done => {
        // Construct a Websocket
        let Connection = new WebSocket(testServerUrl);
        Connection.binaryType = "arraybuffer";

        // While open a Websocket
        Connection.onopen = () => {
            
            // Checkout if Websocket server is ready
            if (Connection.readyState === WebSocket.OPEN) {
                // Preapare the message on a eventData
                const message = CARTA.RegisterViewer.create({sessionId: "", apiKey: "1234"});
                let payload = CARTA.RegisterViewer.encode(message).finish();
                let eventData = new Uint8Array(32 + 4 + payload.byteLength);

                eventData.set(Utility.stringToUint8Array("REGISTER_VIEWER", 32));
                eventData.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
                eventData.set(payload, 36);

                Connection.send(eventData);
            } else {
                console.log(`Can not open a connection.`);
            }

        };

        // While receive a message in the form of arraybuffer
        Connection.onmessage = (event: MessageEvent) => {
            expect(event.data.byteLength).toBeGreaterThan(0);

            Connection.close();
            done();
        };

    }, connectTimeout);

    test(`send EventName: "FILE_LIST_RESPONSE" to CARTA "${testServerUrl}".`, 
    done => {
        // Construct a Websocket
        let Connection = new WebSocket(testServerUrl);
        Connection.binaryType = "arraybuffer";

        // While open a Websocket
        Connection.onopen = () => {
            
            // Checkout if Websocket server is ready
            if (Connection.readyState === WebSocket.OPEN) {
                // Preapare the message on a eventData
                const message = CARTA.RegisterViewer.create({sessionId: "", apiKey: "1234"});
                let payload = CARTA.RegisterViewer.encode(message).finish();
                let eventData = new Uint8Array(32 + 4 + payload.byteLength);

                eventData.set(Utility.stringToUint8Array("REGISTER_VIEWER", 32));
                eventData.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
                eventData.set(payload, 36);

                Connection.send(eventData);
            } else {
                console.log(`Can not open a connection.`);
            }

        };

        // While receive a message in the form of arraybuffer
        Connection.onmessage = (event: MessageEvent) => {
            const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
            if (eventName === "REGISTER_VIEWER_ACK") {
                // Preapare the message on a eventData
                const message = CARTA.FileListRequest.create({directory: ""});
                let payload = CARTA.FileListRequest.encode(message).finish();
                const eventDataTx = new Uint8Array(32 + 4 + payload.byteLength);
    
                eventDataTx.set(Utility.stringToUint8Array("FILE_LIST_REQUEST", 32));
                eventDataTx.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
                eventDataTx.set(payload, 36);
    
                Connection.send(eventDataTx);
            } 
            if (eventName === testReturnName) {
                done();
            }
        };

    }, connectTimeout);

    describe(`receive EventName: "FILE_LIST_RESPONSE" tests on CARTA ${testServerUrl}`, 
    () => {

        let Connection: WebSocket;
    
        beforeEach( done => {
            // Construct a Websocket
            Connection = new WebSocket(testServerUrl);
            Connection.binaryType = "arraybuffer";
    
            // While open a Websocket
            Connection.onopen = () => {
                // Preapare the message on a eventData
                const message = CARTA.RegisterViewer.create({sessionId: "", apiKey: "1234"});
                let payload = CARTA.RegisterViewer.encode(message).finish();
                let eventData = new Uint8Array(32 + 4 + payload.byteLength);

                // Checkout if Websocket server is ready
                if (Connection.readyState === WebSocket.OPEN) {
                    // Send event: "REGISTER_VIEWER"
                    eventData.set(Utility.stringToUint8Array("REGISTER_VIEWER", 32));
                    eventData.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
                    eventData.set(payload, 36);
    
                    Connection.send(eventData);
                } else {
                    console.log(`Can not open a connection.`);
                    Connection.close();
                }
            };

            // While receive a message
            Connection.onmessage = (event: MessageEvent) => {
                const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                if (eventName === "REGISTER_VIEWER_ACK") {
                    // Preapare the message on a eventData
                    const message = CARTA.FileListRequest.create({directory: ""});
                    let payload = CARTA.FileListRequest.encode(message).finish();
                    const eventDataTx = new Uint8Array(32 + 4 + payload.byteLength);
        
                    eventDataTx.set(Utility.stringToUint8Array("FILE_LIST_REQUEST", 32));
                    eventDataTx.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
                    eventDataTx.set(payload, 36);
        
                    Connection.send(eventDataTx); 
                    done();
                }
            };
        }, connectTimeout);
    
        test(`assert the received EventName is "${testReturnName}" within ${connectTimeout * 1e-3} seconds.`, 
        done => {
            // While receive a message from Websocket server
            Connection.onmessage = (event: MessageEvent) => {
                const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                if (eventName === testReturnName) {
                    expect(event.data.byteLength).toBeGreaterThan(40);
                    
                    expect(eventName).toBe(testReturnName);
                }

                Connection.close();
                done();
            };
        }, connectTimeout);
    
        test(`assert the "FILE_LIST_RESPONSE.success" is true.`, 
        done => {
            // While receive a message from Websocket server
            Connection.onmessage = (event: MessageEvent) => {
                const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                if (eventName === "FILE_LIST_RESPONSE") {
                    const eventData = new Uint8Array(event.data, 36);
                    expect(CARTA.FileListResponse.decode(eventData).success).toBe(true);
                }

                Connection.close();
                done();
            };
        }, connectTimeout);  

        test(`assert the "FILE_LIST_RESPONSE.parent" is None.`, 
        done => {
            // While receive a message from Websocket server
            Connection.onmessage = (event: MessageEvent) => {
                const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                if (eventName === "FILE_LIST_RESPONSE") {
                    const eventId = new Uint32Array(event.data, 32, 1)[0];
                    const eventData = new Uint8Array(event.data, 36);

                    let parsedMessage;
                    parsedMessage = CARTA.FileListResponse.decode(eventData);
                    expect(parsedMessage.parent).toBe("");
                }

                Connection.close();
                done();
            };    
        }, connectTimeout);

        test(`assert the "FILE_LIST_RESPONSE.directory" is root path "${expectRootPath}".`, 
        done => {
            // While receive a message from Websocket server
            Connection.onmessage = (event: MessageEvent) => {
                const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                if (eventName === "FILE_LIST_RESPONSE") {
                    const eventId = new Uint32Array(event.data, 32, 1)[0];
                    const eventData = new Uint8Array(event.data, 36);

                    let parsedMessage;
                    parsedMessage = CARTA.FileListResponse.decode(eventData);
                    expect(parsedMessage.directory).toBe(expectRootPath);
                }

                Connection.close();
                done();
            };    
        }, connectTimeout);

        test(`assert the file "${testFileName}" exists.`, 
        done => {
            // While receive a message from Websocket server
            Connection.onmessage = (event: MessageEvent) => {
                const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                if (eventName === "FILE_LIST_RESPONSE") {
                    const eventId = new Uint32Array(event.data, 32, 1)[0];
                    const eventData = new Uint8Array(event.data, 36);

                    let parsedMessage;
                    parsedMessage = CARTA.FileListResponse.decode(eventData);

                    let fileInfo = parsedMessage.files.find(f => f.name === testFileName);
                    expect(fileInfo).toBeDefined();
                    expect(fileInfo.type).toBe(fileType);
                }

                done();                
                Connection.close();
            };
    
        }, connectTimeout);
    
        test(`assert the subdirectory "${testSubdirectoryName}" exists.`, 
        done => {
            // While receive a message from Websocket server
            Connection.onmessage = (event: MessageEvent) => {
                const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                if (eventName === "FILE_LIST_RESPONSE") {
                    const eventId = new Uint32Array(event.data, 32, 1)[0];
                    const eventData = new Uint8Array(event.data, 36);

                    let parsedMessage;
                    parsedMessage = CARTA.FileListResponse.decode(eventData);

                    let folderInfo = parsedMessage.subdirectories.find(f => f === testSubdirectoryName);
                    expect(folderInfo).toBeDefined();
                }

                Connection.close();
                done();
            };
        }, connectTimeout);
    
    });
});

describe("GET_FILELIST_UNKNOWNPATH tests", () => {    

    test(`send EventName: "REGISTER_VIEWER" to CARTA "${testServerUrl}" with no session_id & api_key "1234".`, 
    done => {
        // Construct a Websocket
        let Connection = new WebSocket(testServerUrl);
        Connection.binaryType = "arraybuffer";

        // While open a Websocket
        Connection.onopen = () => {
            
            // Checkout if Websocket server is ready
            if (Connection.readyState === WebSocket.OPEN) {
                // Preapare the message on a eventData
                const message = CARTA.RegisterViewer.create({sessionId: "", apiKey: "1234"});
                let payload = CARTA.RegisterViewer.encode(message).finish();
                let eventData = new Uint8Array(32 + 4 + payload.byteLength);

                eventData.set(Utility.stringToUint8Array("REGISTER_VIEWER", 32));
                eventData.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
                eventData.set(payload, 36);

                Connection.send(eventData);
            } else {
                console.log(`Can not open a connection.`);
            }

        };

        // While receive a message in the form of arraybuffer
        Connection.onmessage = (event: MessageEvent) => {
            expect(event.data.byteLength).toBeGreaterThan(0);

            Connection.close();
            done();
        };

    }, connectTimeout);

    test(`send EventName: "FILE_LIST_REQUEST" to CARTA "${testServerUrl}".`, 
    done => {
        // Construct a Websocket
        let Connection = new WebSocket(testServerUrl);
        Connection.binaryType = "arraybuffer";

        // While open a Websocket
        Connection.onopen = () => {
            
            // Checkout if Websocket server is ready
            if (Connection.readyState === WebSocket.OPEN) {
                // Preapare the message on a eventData
                const message = CARTA.RegisterViewer.create({sessionId: "", apiKey: "1234"});
                let payload = CARTA.RegisterViewer.encode(message).finish();
                let eventData = new Uint8Array(32 + 4 + payload.byteLength);

                eventData.set(Utility.stringToUint8Array("REGISTER_VIEWER", 32));
                eventData.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
                eventData.set(payload, 36);

                Connection.send(eventData);
            } else {
                console.log(`Can not open a connection.`);
            }

        };

        // While receive a message in the form of arraybuffer
        Connection.onmessage = (event: MessageEvent) => {
            const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
            if (eventName === "REGISTER_VIEWER_ACK") {
                // Preapare the message on a eventData
                const message = CARTA.FileListRequest.create({directory: ""});
                let payload = CARTA.FileListRequest.encode(message).finish();
                const eventDataTx = new Uint8Array(32 + 4 + payload.byteLength);
    
                eventDataTx.set(Utility.stringToUint8Array("FILE_LIST_REQUEST", 32));
                eventDataTx.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
                eventDataTx.set(payload, 36);
    
                Connection.send(eventDataTx);
            } 
            if (eventName === testReturnName) {
                done();
            }
        };

    }, connectTimeout);

    describe(`access "/unknown/path" on CARTA ${testServerUrl}`, 
    () => {

        let Connection: WebSocket;
    
        beforeEach( done => {
            // Construct a Websocket
            Connection = new WebSocket(testServerUrl);
            Connection.binaryType = "arraybuffer";
    
            // While open a Websocket
            Connection.onopen = () => {
                // Preapare the message on a eventData
                const message = CARTA.RegisterViewer.create({sessionId: "", apiKey: "1234"});
                let payload = CARTA.RegisterViewer.encode(message).finish();
                let eventData = new Uint8Array(32 + 4 + payload.byteLength);

                // Checkout if Websocket server is ready
                if (Connection.readyState === WebSocket.OPEN) {
                    // Send event: "REGISTER_VIEWER"
                    eventData.set(Utility.stringToUint8Array("REGISTER_VIEWER", 32));
                    eventData.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
                    eventData.set(payload, 36);
    
                    Connection.send(eventData);
                } else {
                    console.log(`Can not open a connection.`);
                    Connection.close();
                }
            };

            // While receive a message
            Connection.onmessage = (event: MessageEvent) => {
                const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                if (eventName === "REGISTER_VIEWER_ACK") {
                    // Preapare the message on a eventData
                    const message = CARTA.FileListRequest.create({directory: ""});
                    let payload = CARTA.FileListRequest.encode(message).finish();
                    const eventDataTx = new Uint8Array(32 + 4 + payload.byteLength);
        
                    eventDataTx.set(Utility.stringToUint8Array("FILE_LIST_REQUEST", 32));
                    eventDataTx.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
                    eventDataTx.set(payload, 36);
        
                    Connection.send(eventDataTx);
                }
                if (eventName === "FILE_LIST_RESPONSE") {
                    // Preapare the message on a eventData
                    const message = CARTA.FileListRequest.create({directory: "/unknown/path"});
                    let payload = CARTA.FileListRequest.encode(message).finish();
                    const eventDataTx = new Uint8Array(32 + 4 + payload.byteLength);
        
                    eventDataTx.set(Utility.stringToUint8Array("FILE_LIST_REQUEST", 32));
                    eventDataTx.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
                    eventDataTx.set(payload, 36);
        
                    Connection.send(eventDataTx);
                    done();
                }
            };
        }, connectTimeout);
    
        test(`assert the received EventName is "FILE_LIST_RESPONSE" within ${connectTimeout * 1e-3} seconds.`, 
        done => {
            // While receive a message from Websocket server
            Connection.onmessage = (event: MessageEvent) => {
                const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                if (eventName === testReturnName) {
                    expect(event.data.byteLength).toBeGreaterThan(40);
                    expect(eventName).toBe(testReturnName);
                }

                Connection.close();
                done();
            };
        }, connectTimeout);
    
        test(`assert the "${testReturnName}.success" is false.`, 
        done => {
            // While receive a message from Websocket server
            Connection.onmessage = (event: MessageEvent) => {
                const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                if (eventName === testReturnName) {
                    const eventData = new Uint8Array(event.data, 36);
                    expect(CARTA.FileListResponse.decode(eventData).success).toBe(false);
                }

                Connection.close();
                done();
            };
        }, connectTimeout); 

        test(`assert the "FILE_LIST_RESPONSE.message" is not None.`, 
        done => {
            // While receive a message from Websocket server
            Connection.onmessage = (event: MessageEvent) => {
                const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                if (eventName === "FILE_LIST_RESPONSE") {
                    const eventData = new Uint8Array(event.data, 36);
                    expect(CARTA.FileListResponse.decode(eventData).message).toBeDefined();
                    console.log(`As given a unknown path, returned message: "` + CARTA.FileListResponse.decode(eventData).message + `"`);
                }

                Connection.close();
                done();
            };
        }, connectTimeout); 

    });
});
