import {CARTA} from "carta-protobuf";
import * as Utility from "./testUtilityFunction";

let WebSocket = require("ws");
let testServerUrl = "wss://acdc0.asiaa.sinica.edu.tw/socket2";
let expectRootPath = "";
let testSubdirectoryName = "set_QA";
let connectionTimeout = 1000;

describe("FILEINFO tests", () => {   
    let Connection: WebSocket;

    beforeEach( done => {
        // Establish a websocket connection in the binary form: arraybuffer 
        Connection = new WebSocket(testServerUrl);
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
                // While receive a message
                Connection.onmessage = (event: MessageEvent) => {
                    const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                    if (eventName === "REGISTER_VIEWER_ACK") {
                        // Assertion
                        expect(event.data.byteLength).toBeGreaterThan(0);
                        eventData = new Uint8Array(event.data, 36);
                        expect(CARTA.RegisterViewerAck.decode(eventData).success).toBe(true);
                        
                        done();
                    }
                };
            } else {
                console.log(`Can not open a connection.`);
            }
            done();
        };
    }, connectionTimeout);
    
    describe(`access directory`, () => {
        [[expectRootPath], [testSubdirectoryName]
        ].map(
            ([dir]) => {
                test(`assert the directory "${dir}" opens.`, 
                done => {
                    // Preapare the message on a eventData
                    let message = CARTA.FileListRequest.create({directory: testSubdirectoryName});
                    let payload = CARTA.FileListRequest.encode(message).finish();
                    let eventDataTx = new Uint8Array(32 + 4 + payload.byteLength);
            
                    eventDataTx.set(Utility.stringToUint8Array("FILE_LIST_REQUEST", 32));
                    eventDataTx.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
                    eventDataTx.set(payload, 36);
            
                    Connection.send(eventDataTx);
            
                    // While receive a message
                    Connection.onmessage = (event: MessageEvent) => {
                        let eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                        if (eventName === "FILE_LIST_RESPONSE") {
                            expect(event.data.byteLength).toBeGreaterThan(0);
                            let eventData = new Uint8Array(event.data, 36);
                            expect(CARTA.FileListResponse.decode(eventData).success).toBe(true);
            
                            done();
                        }
                    };
                }, connectionTimeout);
            }
        );
    });

    describe(`access the folder ${testSubdirectoryName} and ...`, 
    () => {
        beforeEach( 
            done => {
                // Preapare the message on a eventData
                const message = CARTA.FileListRequest.create({directory: testSubdirectoryName});
                let payload = CARTA.FileListRequest.encode(message).finish();
                const eventDataTx = new Uint8Array(32 + 4 + payload.byteLength);

                eventDataTx.set(Utility.stringToUint8Array("FILE_LIST_REQUEST", 32));
                eventDataTx.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
                eventDataTx.set(payload, 36);

                Connection.send(eventDataTx);

                done();
            }, connectionTimeout);           
        
        describe(`look for a existent file`, () => {
            [
             ["S255_IR_sci.spw25.cube.I.pbcor.fits",    [1920, 1920, 478, 1],   4],
             ["SDC335.579-0.292.spw0.line.image",       [336, 350, 3840, 1],    4],
             ["G34mm1.miriad",                          [129, 129, 111, 1],     4],
            ].map(
                function([fileName, shape, NAXIS]: [string, number[], number]) {
                    test(`assert the file "${fileName}" exists, “Shape = [${shape}]” in file_info,
                          & “NAXIS = ${NAXIS}” in file_info_extended.`, 
                    done => {
                        Connection.onmessage = (eventList: MessageEvent) => {
                            let eventName = Utility.getEventName(new Uint8Array(eventList.data, 0, 32));
                            if (eventName === "FILE_LIST_RESPONSE") {
                                // Assertion
                                let eventData = new Uint8Array(eventList.data, 36);
                                expect(CARTA.FileListResponse.decode(eventData).success).toBe(true);
    
                                // Preapare the message on a eventData
                                const message = CARTA.FileInfoRequest.create({
                                                directory: testSubdirectoryName, file: fileName, hdu: "0"});
                                let payload = CARTA.FileInfoRequest.encode(message).finish();
                                const eventDataTx = new Uint8Array(32 + 4 + payload.byteLength);
    
                                eventDataTx.set(Utility.stringToUint8Array("FILE_INFO_REQUEST", 32));
                                eventDataTx.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
                                eventDataTx.set(payload, 36);
    
                                Connection.send(eventDataTx);

                                Connection.onmessage = (eventInfo: MessageEvent) => {
                                    eventName = Utility.getEventName(new Uint8Array(eventInfo.data, 0, 32));
                                    if (eventName === "FILE_INFO_RESPONSE") {
                                        eventData = new Uint8Array(eventInfo.data, 36);
                                        let fileInfoMessage = CARTA.FileInfoResponse.decode(eventData);
                                        // console.log(fileInfoMessage.fileInfoExtended);
                                        
                                        expect(fileInfoMessage.success).toBe(true);
                                        
                                        const fileInfoExtComputedShape = 
                                            fileInfoMessage.fileInfoExtended.computedEntries.find( f => f.name === "Shape").value;
                                        expect(
                                            fileInfoExtComputedShape.replace("[", "").replace("]", "").split(",").map(Number)
                                            ).toEqual(shape);

                                        const fileInfoExtHeaderNAXIS = 
                                            fileInfoMessage.fileInfoExtended.headerEntries.find( f => f.name === "NAXIS").value;
                                        expect(parseInt(fileInfoExtHeaderNAXIS)).toEqual(NAXIS);

                                        done();
                                    } // if
                                }; // onmessage
                            } // if
                        }; // onmessage                        
                    } // done
                    , connectionTimeout); // test
                } // function([ ])
            ); // map
        }); // describe

    });

    afterEach( done => {
        Connection.close();
        done();
    });
});

describe("FILEINFO_EXCEPTIONS tests", () => {   
    let Connection: WebSocket;

    beforeEach( done => {
        // Establish a websocket connection in the binary form: arraybuffer 
        Connection = new WebSocket(testServerUrl);
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
                // While receive a message
                Connection.onmessage = (event: MessageEvent) => {
                    const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                    if (eventName === "REGISTER_VIEWER_ACK") {
                        // Assertion
                        expect(event.data.byteLength).toBeGreaterThan(0);
                        eventData = new Uint8Array(event.data, 36);
                        expect(CARTA.RegisterViewerAck.decode(eventData).success).toBe(true);
                        
                        done();
                    }
                };
            } else {
                console.log(`Can not open a connection.`);
            }
            done();
        };
    }, connectionTimeout);

    describe(`access the folder ${testSubdirectoryName} and ...`, 
    () => {    
        beforeEach( 
            done => {
                // Preapare the message on a eventData
                const message = CARTA.FileListRequest.create({directory: testSubdirectoryName});
                let payload = CARTA.FileListRequest.encode(message).finish();
                const eventDataTx = new Uint8Array(32 + 4 + payload.byteLength);

                eventDataTx.set(Utility.stringToUint8Array("FILE_LIST_REQUEST", 32));
                eventDataTx.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
                eventDataTx.set(payload, 36);

                Connection.send(eventDataTx);

                done();
            }, connectionTimeout);           
        
        describe(`look for a non-existent file`, () => {
            [["no_such_file.image"],
             ["broken_header.miriad"],
            ].map(
                function([fileName]: [string]) {
                    test(`assert the file "${fileName}" does not exist.`, 
                    done => {
                        Connection.onmessage = (eventList: MessageEvent) => {
                            let eventName = Utility.getEventName(new Uint8Array(eventList.data, 0, 32));
                            if (eventName === "FILE_LIST_RESPONSE") {
                                // Assertion
                                let eventData = new Uint8Array(eventList.data, 36);
                                expect(CARTA.FileListResponse.decode(eventData).success).toBe(true);
    
                                // Preapare the message on a eventData
                                const message = CARTA.FileInfoRequest.create({
                                                directory: testSubdirectoryName, file: fileName, hdu: "0"});
                                let payload = CARTA.FileInfoRequest.encode(message).finish();
                                const eventDataTx = new Uint8Array(32 + 4 + payload.byteLength);
    
                                eventDataTx.set(Utility.stringToUint8Array("FILE_INFO_REQUEST", 32));
                                eventDataTx.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
                                eventDataTx.set(payload, 36);
    
                                Connection.send(eventDataTx);

                                Connection.onmessage = (eventInfo: MessageEvent) => {
                                    eventName = Utility.getEventName(new Uint8Array(eventInfo.data, 0, 32));
                                    if (eventName === "FILE_INFO_RESPONSE") {
                                        eventData = new Uint8Array(eventInfo.data, 36);
                                        let fileInfoMessage = CARTA.FileInfoResponse.decode(eventData);
                                        expect(fileInfoMessage.success).toBe(false);
                                        expect(fileInfoMessage.message).toBeDefined();

                                        //  console.log(CARTA.FileInfoResponse.decode(eventData));

                                        done();
                                    } // if
                                }; // onmessage
                            } // if
                        }; // onmessage                        
                    } // done
                    , connectionTimeout); // test
                } // function([ ])
            ); // map
        }); // describe

    });

    afterEach( done => {
        Connection.close();
        done();
    }, connectionTimeout);
});
