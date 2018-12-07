import {CARTA} from "carta-protobuf";
import * as Utility from "./testUtilityFunction";

let WebSocket = require("ws");
let testServerUrl = "wss://acdc0.asiaa.sinica.edu.tw/socket2";
let expectRootPath = "";
let testSubdirectoryName = "set_QA";
let connectionTimeout = 1000;
let testFileName = "qa_xyProfiler.fits";

describe("CURSOR_XY_PROFILE tests", () => {   
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
                // While receive a message in the form of arraybuffer
                Connection.onmessage = (event: MessageEvent) => {
                    const eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                    if (eventName === "REGISTER_VIEWER_ACK") {
                        expect(event.data.byteLength).toBeGreaterThan(0);
                        eventData = new Uint8Array(event.data, 36);
                        expect(CARTA.RegisterViewerAck.decode(eventData).success).toBe(true);
                        
                        done();
                    }
                };
            } else {
                console.log(`Can not open a connection.`);
                done();
            }
            
        };
    }, connectionTimeout);

    describe(`open the file "${testFileName} and ...`, 
    () => {
        beforeEach( 
        done => {
            // Preapare the message
            let message = CARTA.OpenFile.create({
                directory: testSubdirectoryName, 
                file: testFileName, hdu: "0", fileId: 0, 
                renderMode: CARTA.RenderMode.RASTER
            });
            let payload = CARTA.OpenFile.encode(message).finish();
            let eventDataTx = new Uint8Array(32 + 4 + payload.byteLength);

            eventDataTx.set(Utility.stringToUint8Array("OPEN_FILE", 32));
            eventDataTx.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
            eventDataTx.set(payload, 36);

            Connection.send(eventDataTx);

            done();
        }, connectionTimeout);       
        
        describe(`get the xy profiles at different cursor positions`, () => {
            [[0, {x: 50.00, y: 50.00}, {x: 50.00, y: 50.00}, {x: 100, y: 100}, 1],
             [0, {x: 49.50, y: 49.50}, {x: 50.00, y: 50.00}, {x: 100, y: 100}, 1],
             [0, {x: 49.50, y: 50.49}, {x: 50.00, y: 50.00}, {x: 100, y: 100}, 1],
             [0, {x: 50.49, y: 49.50}, {x: 50.00, y: 50.00}, {x: 100, y: 100}, 1],
             [0, {x: 50.49, y: 50.49}, {x: 50.00, y: 50.00}, {x: 100, y: 100}, 1],
             [0, {x:  0.00, y:  0.00}, {x:  0.00, y:  0.00}, {x: 100, y: 100}, 1],
             [0, {x:  0.00, y: 99.00}, {x:  0.00, y: 99.00}, {x: 100, y: 100}, 0],
             [0, {x: 99.00, y:  0.00}, {x: 99.00, y:  0.00}, {x: 100, y: 100}, 0],
             [0, {x: 99.00, y: 99.00}, {x: 99.00, y: 99.00}, {x: 100, y: 100}, 1],
            ].map(
                function([fileID, point, assertPoint, profileLen, value]: 
                        [number, {x: number, y: number}, {x: number, y: number}, {x: number, y: number}, number]) {
                    test(`assert the fileID "${fileID}" returns: Value=${value}, Profile length={${profileLen.x}, ${profileLen.y}}, Point={${assertPoint.x}, ${assertPoint.y}} as {${point.x}, ${point.y}}.`, 
                    done => {
                        Connection.onmessage = (eventOpen: MessageEvent) => {
                            let eventName = Utility.getEventName(new Uint8Array(eventOpen.data, 0, 32));
                            if (eventName === "OPEN_FILE_ACK") {
                                let eventData = new Uint8Array(eventOpen.data, 36);
                                expect(CARTA.OpenFileAck.decode(eventData).success).toBe(true);
    
                                // Preapare the message
                                const message = CARTA.SetCursor.create({fileId: fileID, point: point});
                                let payload = CARTA.SetCursor.encode(message).finish();
                                const eventDataTx = new Uint8Array(32 + 4 + payload.byteLength);
    
                                eventDataTx.set(Utility.stringToUint8Array("SET_CURSOR", 32));
                                eventDataTx.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
                                eventDataTx.set(payload, 36);
    
                                Connection.send(eventDataTx);

                                // While receive a message
                                Connection.onmessage = (eventInfo: MessageEvent) => {
                                    eventName = Utility.getEventName(new Uint8Array(eventInfo.data, 0, 32));
                                    if (eventName === "SPATIAL_PROFILE_DATA") {
                                        eventData = new Uint8Array(eventInfo.data, 36);
                                        let spatialProfileDataMessage = CARTA.SpatialProfileData.decode(eventData);
                                        // console.log(spatialProfileDataMessage);
                                        
                                        expect(spatialProfileDataMessage.fileId).toEqual(fileID);
                                        expect(spatialProfileDataMessage.value).toEqual(value);
                                        expect(spatialProfileDataMessage.x).toEqual(assertPoint.x);
                                        expect(spatialProfileDataMessage.y).toEqual(assertPoint.y);

                                        let spatialProfileDataMessageProfileX = spatialProfileDataMessage.profiles.find(f => f.coordinate === "x").values;
                                        expect(spatialProfileDataMessageProfileX.length).toEqual(profileLen.x);
                                        let spatialProfileDataMessageProfileY = spatialProfileDataMessage.profiles.find(f => f.coordinate === "y").values;
                                        expect(spatialProfileDataMessageProfileY.length).toEqual(profileLen.y);

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

        describe(`get the xy profiles at different cursor positions`, () => {
            [[0, {x: 50.00, y: 50.00}, {idx: 50, value: 1, others: 0}, {idx: 50, value: 1, others: 0}],
             [0, {x:  0.00, y:  0.00}, {idx:  0, value: 1, others: 0}, {idx:  0, value: 1, others: 0}],
             [0, {x:  0.00, y: 99.00}, {idx: 99, value: 1, others: 0}, {idx:  0, value: 1, others: 0}],
             [0, {x: 99.00, y:  0.00}, {idx:  0, value: 1, others: 0}, {idx: 99, value: 1, others: 0}],
             [0, {x: 99.00, y: 99.00}, {idx: 99, value: 1, others: 0}, {idx: 99, value: 1, others: 0}],
            ].map(
                function([fileID, point, oddPointX, oddPointY]: 
                        [number, {x: number, y: number}, {idx: number, value: number, others: number}, {idx: number, value: number, others: number}]) {
                    test(`assert the profile in fileID "${fileID}" has: 
                    the #${oddPointX.idx + 1} value = ${oddPointX.value} with other values = ${oddPointX.others} on the profile_x & 
                    the #${oddPointY.idx + 1} value = ${oddPointY.value} with other values = ${oddPointY.others} on the profile_y as point {${point.x}, ${point.y}}.`, 
                    done => {
                        Connection.onmessage = (eventOpen: MessageEvent) => {
                            let eventName = Utility.getEventName(new Uint8Array(eventOpen.data, 0, 32));
                            if (eventName === "OPEN_FILE_ACK") {
                                let eventData = new Uint8Array(eventOpen.data, 36);
                                expect(CARTA.OpenFileAck.decode(eventData).success).toBe(true);
    
                                // Preapare the message
                                const message = CARTA.SetCursor.create({fileId: fileID, point: point});
                                let payload = CARTA.SetCursor.encode(message).finish();
                                const eventDataTx = new Uint8Array(32 + 4 + payload.byteLength);
    
                                eventDataTx.set(Utility.stringToUint8Array("SET_CURSOR", 32));
                                eventDataTx.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
                                eventDataTx.set(payload, 36);
    
                                Connection.send(eventDataTx);

                                // While receive a message
                                Connection.onmessage = (eventInfo: MessageEvent) => {
                                    eventName = Utility.getEventName(new Uint8Array(eventInfo.data, 0, 32));
                                    if (eventName === "SPATIAL_PROFILE_DATA") {
                                        eventData = new Uint8Array(eventInfo.data, 36);
                                        let spatialProfileDataMessage = CARTA.SpatialProfileData.decode(eventData);
                                        // console.log(spatialProfileDataMessage);

                                        // Assert profile x
                                        spatialProfileDataMessage.profiles.find(f => f.coordinate === "x").values.forEach( 
                                            (value, index) => {
                                                if (index === oddPointX.idx) {
                                                    expect(value).toEqual(oddPointX.value);
                                                } else {
                                                    expect(value).toEqual(oddPointX.others);
                                                }
                                            }
                                        );

                                        // Assert profile y
                                        spatialProfileDataMessage.profiles.find(f => f.coordinate === "y").values.forEach( 
                                            (value, index) => {
                                                if (index === oddPointY.idx) {
                                                    expect(value).toEqual(oddPointY.value);
                                                } else {
                                                    expect(value).toEqual(oddPointY.others);
                                                }
                                            }
                                        );

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