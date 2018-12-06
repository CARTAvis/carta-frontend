import {CARTA} from "carta-protobuf";
import * as Utility from "./testUtilityFunction";

let WebSocket = require("ws");
let testServerUrl = "wss://acdc0.asiaa.sinica.edu.tw/socket2";
let expectRootPath = "";
let testSubdirectoryName = "set_QA";
let connectionTimeout = 3000;
let testFileName = "S255_IR_sci.spw25.cube.I.pbcor.fits";

describe("CURSOR_Z_PROFILE tests", () => {   
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

            // While receive a message
            Connection.onmessage = (eventOpen: MessageEvent) => {
                let eventName = Utility.getEventName(new Uint8Array(eventOpen.data, 0, 32));
                if (eventName === "OPEN_FILE_ACK") {
                    let eventData = new Uint8Array(eventOpen.data, 36);
                    let openFileMessage = CARTA.OpenFileAck.decode(eventData);
                    expect(openFileMessage.success).toBe(true);

                    // Preapare the message
                    let messageSetImageView = CARTA.SetImageView.create({
                        fileId: 0, imageBounds: {xMin: 0, xMax: openFileMessage.fileInfoExtended.width, yMin: 0, yMax: openFileMessage.fileInfoExtended.height}, 
                        mip: 6, compressionType: CARTA.CompressionType.ZFP, 
                        compressionQuality: 11, numSubsets: 4
                    });
                    payload = CARTA.SetImageView.encode(messageSetImageView).finish();
                    eventDataTx = new Uint8Array(32 + 4 + payload.byteLength);

                    eventDataTx.set(Utility.stringToUint8Array("SET_IMAGE_VIEW", 32));
                    eventDataTx.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
                    eventDataTx.set(payload, 36);

                    Connection.send(eventDataTx);

                    done();
                } // if
            }; // onmessage "OPEN_FILE_ACK"
                
        }, connectionTimeout);       
        
        describe(`get the z profiles at a cursor position`, () => {
            [[0, {x: 989, y: 1274}, 0, 0, 1, "z", 478, {idx: 300, value: -2.301968207024e-03}],
            ].map(
                function([fileID, point, regionID, stokes, progress, coordinate, profileLen, assertPoint]: 
                        [number, {x: number, y: number}, number, number, number, string, number, {idx: number, value: number}]) {
                    test(`assert the fileID "${fileID}" returns within ${connectionTimeout}ms, as point {${point.x}, ${point.y}}.`, 
                    done => {
                        Connection.onmessage = (eventRasterImageData: MessageEvent) => {
                            let eventName = Utility.getEventName(new Uint8Array(eventRasterImageData.data, 0, 32));
                            if (eventName === "RASTER_IMAGE_DATA") {
                                let eventData = new Uint8Array(eventRasterImageData.data, 36);
                                let rasterImageDataMessage = CARTA.RasterImageData.decode(eventData);
                                expect(rasterImageDataMessage.imageData.length).toBeGreaterThan(0);

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
                                    if (eventName === "SPECTRAL_PROFILE_DATA") {
                                        eventData = new Uint8Array(eventInfo.data, 36);
                                        let spectralProfileDataMessage = CARTA.SpectralProfileData.decode(eventData);
                                        // console.log(spectralProfileDataMessage);
                                        
                                        expect(spectralProfileDataMessage.fileId).toEqual(fileID);

                                        done();
                                    } // if
                                }; // onmessage
                            } // if
                        }; // onmessage                        
                    } // done
                    , connectionTimeout); // test

                    test(`assert the fileID "${fileID}" returns: fileId = ${fileID}, as point {${point.x}, ${point.y}}.`, 
                    done => {
                        Connection.onmessage = (eventRasterImageData: MessageEvent) => {
                            let eventName = Utility.getEventName(new Uint8Array(eventRasterImageData.data, 0, 32));
                            if (eventName === "RASTER_IMAGE_DATA") {
                                let eventData = new Uint8Array(eventRasterImageData.data, 36);
                                let rasterImageDataMessage = CARTA.RasterImageData.decode(eventData);
                                expect(rasterImageDataMessage.imageData.length).toBeGreaterThan(0);

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
                                    if (eventName === "SPECTRAL_PROFILE_DATA") {
                                        eventData = new Uint8Array(eventInfo.data, 36);
                                        let spectralProfileDataMessage = CARTA.SpectralProfileData.decode(eventData);
                                        // console.log(spectralProfileDataMessage);
                                        
                                        expect(spectralProfileDataMessage.fileId).toEqual(fileID);

                                        done();
                                    } // if
                                }; // onmessage
                            } // if
                        }; // onmessage                        
                    } // done
                    , connectionTimeout); // test

                    test(`assert the fileID "${fileID}" returns: regionId = ${regionID},  as point {${point.x}, ${point.y}}.`, 
                    done => {
                        Connection.onmessage = (eventRasterImageData: MessageEvent) => {
                            let eventName = Utility.getEventName(new Uint8Array(eventRasterImageData.data, 0, 32));
                            if (eventName === "RASTER_IMAGE_DATA") {
                                let eventData = new Uint8Array(eventRasterImageData.data, 36);
                                let rasterImageDataMessage = CARTA.RasterImageData.decode(eventData);
                                expect(rasterImageDataMessage.imageData.length).toBeGreaterThan(0);

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
                                    if (eventName === "SPECTRAL_PROFILE_DATA") {
                                        eventData = new Uint8Array(eventInfo.data, 36);
                                        let spectralProfileDataMessage = CARTA.SpectralProfileData.decode(eventData);
                                        // console.log(spectralProfileDataMessage);
                                       
                                        expect(spectralProfileDataMessage.regionId).toEqual(regionID);                                      

                                        done();
                                    } // if
                                }; // onmessage
                            } // if
                        }; // onmessage                        
                    } // done
                    , connectionTimeout); // test

                    test(`assert the fileID "${fileID}" returns: stokes = ${stokes}, as point {${point.x}, ${point.y}}.`, 
                    done => {
                        Connection.onmessage = (eventRasterImageData: MessageEvent) => {
                            let eventName = Utility.getEventName(new Uint8Array(eventRasterImageData.data, 0, 32));
                            if (eventName === "RASTER_IMAGE_DATA") {
                                let eventData = new Uint8Array(eventRasterImageData.data, 36);
                                let rasterImageDataMessage = CARTA.RasterImageData.decode(eventData);
                                expect(rasterImageDataMessage.imageData.length).toBeGreaterThan(0);

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
                                    if (eventName === "SPECTRAL_PROFILE_DATA") {
                                        eventData = new Uint8Array(eventInfo.data, 36);
                                        let spectralProfileDataMessage = CARTA.SpectralProfileData.decode(eventData);
                                        // console.log(spectralProfileDataMessage);

                                        expect(spectralProfileDataMessage.stokes).toEqual(stokes);

                                        done();
                                    } // if
                                }; // onmessage
                            } // if
                        }; // onmessage                        
                    } // done
                    , connectionTimeout); // test

                    test(`assert the fileID "${fileID}" returns: progress = ${progress},  as point {${point.x}, ${point.y}}.`, 
                    done => {
                        Connection.onmessage = (eventRasterImageData: MessageEvent) => {
                            let eventName = Utility.getEventName(new Uint8Array(eventRasterImageData.data, 0, 32));
                            if (eventName === "RASTER_IMAGE_DATA") {
                                let eventData = new Uint8Array(eventRasterImageData.data, 36);
                                let rasterImageDataMessage = CARTA.RasterImageData.decode(eventData);
                                expect(rasterImageDataMessage.imageData.length).toBeGreaterThan(0);

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
                                    if (eventName === "SPECTRAL_PROFILE_DATA") {
                                        eventData = new Uint8Array(eventInfo.data, 36);
                                        let spectralProfileDataMessage = CARTA.SpectralProfileData.decode(eventData);
                                        // console.log(spectralProfileDataMessage);

                                        expect(spectralProfileDataMessage.progress).toEqual(progress);                                        

                                        done();
                                    } // if
                                }; // onmessage
                            } // if
                        }; // onmessage                        
                    } // done
                    , connectionTimeout); // test

                    test(`assert the fileID "${fileID}" returns: 
                        coordinate = "${coordinate}", length = "${profileLen}", 
                        vals[${assertPoint.idx}] = "${assertPoint.value}" as point {${point.x}, ${point.y}}.`, 
                    done => {
                        Connection.onmessage = (eventRasterImageData: MessageEvent) => {
                            let eventName = Utility.getEventName(new Uint8Array(eventRasterImageData.data, 0, 32));
                            if (eventName === "RASTER_IMAGE_DATA") {
                                let eventData = new Uint8Array(eventRasterImageData.data, 36);
                                let rasterImageDataMessage = CARTA.RasterImageData.decode(eventData);
                                expect(rasterImageDataMessage.imageData.length).toBeGreaterThan(0);

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
                                    if (eventName === "SPECTRAL_PROFILE_DATA") {
                                        eventData = new Uint8Array(eventInfo.data, 36);
                                        let spectralProfileDataMessage = CARTA.SpectralProfileData.decode(eventData);
                                        // console.log(spectralProfileDataMessage);

                                        let spectralProfileDataMessageProfile = 
                                                spectralProfileDataMessage.profiles.find(f => f.coordinate === coordinate).vals;
                                        expect(spectralProfileDataMessageProfile.length).toEqual(profileLen);
                                        expect(spectralProfileDataMessageProfile[assertPoint.idx]).toBeCloseTo(assertPoint.value, 8);
                                        
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