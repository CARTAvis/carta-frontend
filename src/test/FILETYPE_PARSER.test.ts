import {CARTA} from "carta-protobuf";
import * as Utility from "./testUtilityFunction";

let WebSocket = require('ws');
let testServerUrl = "ws://localhost:50505";
let expectRootPath = "/home/acdc/CARTA/Images";
let testSubdirectoryName = `${expectRootPath}/QA`;
let connectTimeoutLocal = 300;

describe("FILETYPE_PARSER tests", () => {   
    // Establish a websocket connection in the transfermation of binary: arraybuffer 
    let Connection = new WebSocket(testServerUrl);
    Connection.binaryType = "arraybuffer";

    beforeAll( done => {
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

    test(`send EventName: "FILE_LIST_REQUEST" to CARTA "${testServerUrl}" to access ${testSubdirectoryName}.`, 
    done => {
        // While receive a message in the form of arraybuffer
        Connection.onmessage = (event: MessageEvent) => {
            const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
            
            if(eventName == "FILE_LIST_RESPONSE"){
                expect(event.data.byteLength).toBeGreaterThan(0);
                const eventData = new Uint8Array(event.data, 36);
                expect(CARTA.FileListResponse.decode(eventData).success).toBe(true);

            //    console.log(CARTA.FileListResponse.decode(eventData));
                console.log(`The root folder on backend is "${CARTA.FileListResponse.decode(eventData).parent}"`);
                
                done();
            }
        }

    }, connectTimeoutLocal);

    describe(`send EventName: "FILE_LIST_REQUEST" to CARTA ${testServerUrl}`, 
    () => {
        beforeEach( done => {
            // Preapare the message on a eventData
            const message = CARTA.FileListRequest.create({directory: testSubdirectoryName});
            let payload = CARTA.FileListRequest.encode(message).finish();
            const eventDataTx = new Uint8Array(32 + 4 + payload.byteLength);

            eventDataTx.set(Utility.stringToUint8Array("FILE_LIST_REQUEST", 32));
            eventDataTx.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
            eventDataTx.set(payload, 36);

            Connection.send(eventDataTx);

            done();
                       
        }, connectTimeoutLocal);        
        
        test(`assert the received EventName is "FILE_LIST_RESPONSE" within ${connectTimeoutLocal * 1e-3} seconds.`, 
        done => {
            // While receive a message from Websocket server
            Connection.onmessage = (event: MessageEvent) => {
                const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                expect(event.data.byteLength).toBeGreaterThan(40);
                expect(eventName).toBe("FILE_LIST_RESPONSE");

                done();
            }
        }, connectTimeoutLocal);
    
        test(`assert the "FILE_LIST_RESPONSE.success" is true.`, 
        done => {
            // While receive a message from Websocket server
            Connection.onmessage = (event: MessageEvent) => {
                const eventData = new Uint8Array(event.data, 36);
                expect(CARTA.FileListResponse.decode(eventData).success).toBe(true);
                
                done();
            }
        }, connectTimeoutLocal);  

        test(`assert the "FILE_LIST_RESPONSE.parent" is "${expectRootPath}".`, 
        done => {
            // While receive a message from Websocket server
            Connection.onmessage = (event: MessageEvent) => {
                const eventData = new Uint8Array(event.data, 36);

                expect(CARTA.FileListResponse.decode(eventData).parent).toBe(expectRootPath);

                done();
            }
    
        }, connectTimeoutLocal);

        test(`assert the "FILE_LIST_RESPONSE.directory" is the path "${testSubdirectoryName}".`, 
        done => {
            // While receive a message from Websocket server
            Connection.onmessage = (event: MessageEvent) => {
                const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                if(eventName == "FILE_LIST_RESPONSE"){
                    const eventData = new Uint8Array(event.data, 36);

                    let parsedMessage;
                    parsedMessage = CARTA.FileListResponse.decode(eventData);

                    expect(parsedMessage.directory).toBe(testSubdirectoryName);
                }
                done();
            }
    
        }, connectTimeoutLocal);

        describe(`assert the file is not existed`, () => {
            [["empty2.miriad"], ["empty2.fits"], ["empty2.image"],
            ["empty.txt"], ["empty.miriad"], ["empty.fits"], ["empty.image"],
            ].map(
                ([file]) => {
                    test(`assert the file "${file}" is not existed.`, 
                    done => {
                        // While receive a message from Websocket server
                        Connection.onmessage = (event: MessageEvent) => {
                            const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                            if(eventName == "FILE_LIST_RESPONSE"){
                                const eventData = new Uint8Array(event.data, 36);
    
                                let parsedMessage;
                                parsedMessage = CARTA.FileListResponse.decode(eventData);
    
                                let fileInfo = parsedMessage.files.find(f => f.name === file);
                                expect(fileInfo).toBeUndefined();
                            }
                            done();
                        } 
                    }, connectTimeoutLocal)
                }
            )
        });        
        
        describe(`assert the folder is existed in "FILE_LIST_RESPONSE.subdirectory"`, () => {
            [["empty_folder"], ["empty2.miriad"], ["empty2.fits"], ["empty2.image"]
            ].map(
                ([folder]) => {
                    test(`assert the folder "${folder}" is existed.`, 
                    done => {
                        // While receive a message from Websocket server
                        Connection.onmessage = (event: MessageEvent) => {
                            const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                            if(eventName == "FILE_LIST_RESPONSE"){
                                const eventData = new Uint8Array(event.data, 36);
    
                                let parsedMessage;
                                parsedMessage = CARTA.FileListResponse.decode(eventData);
    
                                let folderInfo = parsedMessage.subdirectories.find(f => f === folder);
                                expect(folderInfo).toBeDefined();
                            }
                            done();
                        } 
                    }, connectTimeoutLocal)
                }
            )
        });

        describe(`assert the file is existed`, () => {
            [["S255_IR_sci.spw25.cube.I.pbcor.fits", CARTA.FileType.FITS, 7048405440],
             ["SDC335.579-0.292.spw0.line.image", CARTA.FileType.CASA, 1864975311],
             ["G34mm1.miriad", CARTA.FileType.MIRIAD, 7829305],
            ].map(
                ([file, type, size]) => {
    
                    test(`assert the file "${file}" is existed, image type is ${CARTA.FileType[type]}, size = ${size}.`, 
                    done => {
                        // While receive a message from Websocket server
                        Connection.onmessage = (event: MessageEvent) => {
                            const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                            if(eventName == "FILE_LIST_RESPONSE"){
                                const eventData = new Uint8Array(event.data, 36);
    
                                let parsedMessage;
                                parsedMessage = CARTA.FileListResponse.decode(eventData);
    
                                let fileInfo = parsedMessage.files.find(f => f.name === file);
                                expect(fileInfo).toBeDefined();
                                expect(fileInfo.type).toBe(type);
                                expect(fileInfo.size.toNumber()).toBe(size);
                            }
                            done();
                        } 
                    }, connectTimeoutLocal)
                }
            )
        });

    });

    afterAll( done => {
        Connection.close();
        done();
    });
});
