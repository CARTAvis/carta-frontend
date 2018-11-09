import {CARTA} from "carta-protobuf";
import * as Utility from "./testUtilityFunction";

let WebSocket = require('ws');
let testServerUrl = "ws://localhost:50505";
let expectRootPath = "/home/zarda/CARTA/Images";
// let testSubdirectoryName = "QA"; // for NRAO backend
let testSubdirectoryName = `${expectRootPath}/QA`; // ASIAA backend
let connectTimeoutLocal = 1000;

describe("FILEINFO tests", () => {   
    let Connection;

    beforeEach( done => {
        // Establish a websocket connection in the transfermation of binary: arraybuffer 
        Connection = new WebSocket(testServerUrl);
        Connection.binaryType = "arraybuffer";
        // While open a Websocket
        Connection.onopen = () => {
            // Checkout if Websocket server is ready
            if (Connection.readyState == WebSocket.OPEN) {
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
            done();
        };
    }, connectTimeoutLocal);

    test(`connect to CARTA "${testServerUrl}" & ...`, 
    done => {
        // While receive a message in the form of arraybuffer
        Connection.onmessage = (event: MessageEvent) => {
            const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
            if(eventName == "REGISTER_VIEWER_ACK"){
                // Assertion
                expect(event.data.byteLength).toBeGreaterThan(0);
                const eventData = new Uint8Array(event.data, 36);
                expect(CARTA.RegisterViewerAck.decode(eventData).success).toBe(true);
                
                done();
            }
        };
    }, connectTimeoutLocal);

    describe(`access directory`, () => {
        [[expectRootPath], [testSubdirectoryName]
        ].map(
            ([dir]) => {
                test(`assert the directory "${dir}" can be opened.`, 
                done => {
                    // Preapare the message on a eventData
                    let message = CARTA.FileListRequest.create({directory: testSubdirectoryName});
                    let payload = CARTA.FileListRequest.encode(message).finish();
                    let eventDataTx = new Uint8Array(32 + 4 + payload.byteLength);
            
                    eventDataTx.set(Utility.stringToUint8Array("FILE_LIST_REQUEST", 32));
                    eventDataTx.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
                    eventDataTx.set(payload, 36);
            
                    Connection.send(eventDataTx);
            
                    // While receive a message in the form of arraybuffer
                    Connection.onmessage = (event: MessageEvent) => {
                        let eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                        if(eventName == "FILE_LIST_RESPONSE"){
                            expect(event.data.byteLength).toBeGreaterThan(0);
                            let eventData = new Uint8Array(event.data, 36);
                            expect(CARTA.FileListResponse.decode(eventData).success).toBe(true);
            
                            done();
                        }
                    }
                }, connectTimeoutLocal)
            }
        )
    });

    describe(`access the folder ${testSubdirectoryName} and ...`, 
    () => {
        beforeEach( 
        done => {
            Connection.onmessage = (event: MessageEvent) => {
                const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                if(eventName == "REGISTER_VIEWER_ACK"){
                    // Assertion
                    const eventData = new Uint8Array(event.data, 36);
                    expect(CARTA.RegisterViewerAck.decode(eventData).success).toBe(true);

                    // Preapare the message on a eventData
                    const message = CARTA.FileListRequest.create({directory: testSubdirectoryName});
                    let payload = CARTA.FileListRequest.encode(message).finish();
                    const eventDataTx = new Uint8Array(32 + 4 + payload.byteLength);

                    eventDataTx.set(Utility.stringToUint8Array("FILE_LIST_REQUEST", 32));
                    eventDataTx.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
                    eventDataTx.set(payload, 36);

                    Connection.send(eventDataTx);

                    done();
                }                
            };    
        }, connectTimeoutLocal);       
        
        describe(`look for a file`, () => {
            [["S255_IR_sci.spw25.cube.I.pbcor.fits", [1920, 1920, 478, 1], 4],
             ["SDC335.579-0.292.spw0.line.image", [336, 350, 3840, 1], 4],
             ["G34mm1.miriad", [129, 129, 111, 1], 4],
            ].map(
                ([fileName, shape, NAXIS]) => {
                    test(`assert the file "${fileName}" is existed, “Shape = [${shape}]” in file_info, “NAXIS = ${NAXIS}” in file_info_extended.`, 
                    done => {
                        Connection.onmessage = (event: MessageEvent) => {
                            const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                            if(eventName == "FILE_LIST_RESPONSE"){
                                // Assertion
                                const eventData = new Uint8Array(event.data, 36);
                                expect(CARTA.FileListResponse.decode(eventData).success).toBe(true);
    
                                // Preapare the message on a eventData
                                const message = CARTA.FileInfoRequest.create({
                                                directory: testSubdirectoryName, file: fileName, hdu: ""});
                                let payload = CARTA.FileInfoRequest.encode(message).finish();
                                const eventDataTx = new Uint8Array(32 + 4 + payload.byteLength);
    
                                eventDataTx.set(Utility.stringToUint8Array("FILE_INFO_REQUEST", 32));
                                eventDataTx.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
                                eventDataTx.set(payload, 36);
    
                                Connection.send(eventDataTx);

                                Connection.onmessage = (event: MessageEvent) => {
                                    const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                                    if(eventName == "FILE_INFO_RESPONSE"){
                                        const eventData = new Uint8Array(event.data, 36);
                                        let fileInfoMessage = CARTA.FileInfoResponse.decode(eventData);
                                        expect(fileInfoMessage.success).toBe(true);
                                        expect(fileInfoMessage.fileInfoExtended.width).toBe(shape[0]);
                                        expect(fileInfoMessage.fileInfoExtended.height).toBe(shape[1]);
                                        expect(fileInfoMessage.fileInfoExtended.depth).toBe(shape[2]);
                                        expect(fileInfoMessage.fileInfoExtended.stokes).toBe(shape[3]);
                                        expect(fileInfoMessage.fileInfoExtended.dimensions).toBe(NAXIS);

                                    //    console.log(CARTA.FileInfoResponse.decode(eventData));

                                        done();
                                    } // if
                                } // onmessage
                            } // if
                        } // onmessage                        
                    } // done
                    , connectTimeoutLocal); // test
                } // ([ ])
            ) // map
        }); // describe

    });

    afterEach( done => {
        Connection.close();
        done();
    });
});

describe("FILEINFO_EXCEPTIONS tests", () => {   
    let Connection;

    beforeEach( done => {
        // Establish a websocket connection in the transfermation of binary: arraybuffer 
        Connection = new WebSocket(testServerUrl);
        Connection.binaryType = "arraybuffer";
        // While open a Websocket
        Connection.onopen = () => {
            // Checkout if Websocket server is ready
            if (Connection.readyState == WebSocket.OPEN) {
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
            done();
        };
    }, connectTimeoutLocal);

    test(`connect to CARTA "${testServerUrl}" & ...`, 
    done => {
        // While receive a message in the form of arraybuffer
        Connection.onmessage = (event: MessageEvent) => {
            const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
            if(eventName == "REGISTER_VIEWER_ACK"){
                // Assertion
                expect(event.data.byteLength).toBeGreaterThan(0);
                const eventData = new Uint8Array(event.data, 36);
                expect(CARTA.RegisterViewerAck.decode(eventData).success).toBe(true);
                
                done();
            }
        };
    }, connectTimeoutLocal);

    describe(`access directory`, () => {
        [[expectRootPath], [testSubdirectoryName]
        ].map(
            ([dir]) => {
                test(`assert the directory "${dir}" can be opened.`, 
                done => {
                    // Preapare the message on a eventData
                    let message = CARTA.FileListRequest.create({directory: testSubdirectoryName});
                    let payload = CARTA.FileListRequest.encode(message).finish();
                    let eventDataTx = new Uint8Array(32 + 4 + payload.byteLength);
            
                    eventDataTx.set(Utility.stringToUint8Array("FILE_LIST_REQUEST", 32));
                    eventDataTx.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
                    eventDataTx.set(payload, 36);
            
                    Connection.send(eventDataTx);
            
                    // While receive a message in the form of arraybuffer
                    Connection.onmessage = (event: MessageEvent) => {
                        let eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                        if(eventName == "FILE_LIST_RESPONSE"){
                            expect(event.data.byteLength).toBeGreaterThan(0);
                            let eventData = new Uint8Array(event.data, 36);
                            expect(CARTA.FileListResponse.decode(eventData).success).toBe(true);
            
                            done();
                        }
                    }
                }, connectTimeoutLocal)
            }
        )
    });

    describe(`access the folder ${testSubdirectoryName} and ...`, 
    () => {
        beforeEach( 
        done => {
            Connection.onmessage = (event: MessageEvent) => {
                const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                if(eventName == "REGISTER_VIEWER_ACK"){
                    // Assertion
                    const eventData = new Uint8Array(event.data, 36);
                    expect(CARTA.RegisterViewerAck.decode(eventData).success).toBe(true);

                    // Preapare the message on a eventData
                    const message = CARTA.FileListRequest.create({directory: testSubdirectoryName});
                    let payload = CARTA.FileListRequest.encode(message).finish();
                    const eventDataTx = new Uint8Array(32 + 4 + payload.byteLength);

                    eventDataTx.set(Utility.stringToUint8Array("FILE_LIST_REQUEST", 32));
                    eventDataTx.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
                    eventDataTx.set(payload, 36);

                    Connection.send(eventDataTx);

                    done();
                }                
            };    
        }, connectTimeoutLocal);       
        
        describe(`look for a non-existed file`, () => {
            [["no_such_file.image"],
             ["broken_header.miriad"],
            ].map(
                ([fileName]) => {
                    test(`assert the file "${fileName}" is not existed.`, 
                    done => {
                        Connection.onmessage = (event: MessageEvent) => {
                            const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                            if(eventName == "FILE_LIST_RESPONSE"){
                                // Assertion
                                const eventData = new Uint8Array(event.data, 36);
                                expect(CARTA.FileListResponse.decode(eventData).success).toBe(true);
    
                                // Preapare the message on a eventData
                                const message = CARTA.FileInfoRequest.create({
                                                directory: testSubdirectoryName, file: fileName, hdu: ""});
                                let payload = CARTA.FileInfoRequest.encode(message).finish();
                                const eventDataTx = new Uint8Array(32 + 4 + payload.byteLength);
    
                                eventDataTx.set(Utility.stringToUint8Array("FILE_INFO_REQUEST", 32));
                                eventDataTx.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
                                eventDataTx.set(payload, 36);
    
                                Connection.send(eventDataTx);

                                Connection.onmessage = (event: MessageEvent) => {
                                    const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                                    if(eventName == "FILE_INFO_RESPONSE"){
                                        const eventData = new Uint8Array(event.data, 36);
                                        let fileInfoMessage = CARTA.FileInfoResponse.decode(eventData);
                                        expect(fileInfoMessage.success).toBe(false);
                                        expect(fileInfoMessage.message).toBeDefined;

                                    //    console.log(CARTA.FileInfoResponse.decode(eventData));

                                        done();
                                    } // if
                                } // onmessage
                            } // if
                        } // onmessage                        
                    } // done
                    , connectTimeoutLocal); // test
                } // ([ ])
            ) // map
        }); // describe

    });

    afterEach( done => {
        Connection.close();
        done();
    });
});
