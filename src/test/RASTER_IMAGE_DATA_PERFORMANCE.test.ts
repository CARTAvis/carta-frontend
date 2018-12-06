import {CARTA} from "carta-protobuf";
import * as Utility from "./testUtilityFunction";

let WebSocket = require("ws");
let testServerUrl = "wss://acdc0.asiaa.sinica.edu.tw/socket2";
let expectRootPath = "";
let testSubdirectoryName = "set_QA"; // for NRAO backend
let connectionTimeout = 1000;
let disconnectionTimeout = 1000;
let openFileTimeout = 60000; // The larger file, the more required time.
let readFileTimeout = 60000;
let count: number[];

describe("RASTER_IMAGE_DATA_PERFORMANCE tests", () => {   
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
    
    describe(`prepare the files`, () => {
        [ 
         ["cluster_00128.fits", {xMin: 0, xMax:   128, yMin: 0, yMax:   128},  1, CARTA.CompressionType.ZFP, 18, 4],
         ["cluster_00256.fits", {xMin: 0, xMax:   256, yMin: 0, yMax:   256},  1, CARTA.CompressionType.ZFP, 12, 4],
         ["cluster_00512.fits", {xMin: 0, xMax:   512, yMin: 0, yMax:   512},  2, CARTA.CompressionType.ZFP, 11, 4], 
         ["cluster_01024.fits", {xMin: 0, xMax:  1024, yMin: 0, yMax:  1024},  3, CARTA.CompressionType.ZFP, 11, 4],
         ["cluster_02048.fits", {xMin: 0, xMax:  2048, yMin: 0, yMax:  2048},  6, CARTA.CompressionType.ZFP, 11, 4],
         ["cluster_04096.fits", {xMin: 0, xMax:  4096, yMin: 0, yMax:  4096}, 12, CARTA.CompressionType.ZFP, 11, 4],  
         ["cluster_08192.fits", {xMin: 0, xMax:  8192, yMin: 0, yMax:  8192}, 23, CARTA.CompressionType.ZFP, 11, 4],
         ["cluster_16384.fits", {xMin: 0, xMax: 16384, yMin: 0, yMax: 16384}, 46, CARTA.CompressionType.ZFP, 11, 4],
         ["cluster_32768.fits", {xMin: 0, xMax: 32768, yMin: 0, yMax: 32768}, 92, CARTA.CompressionType.ZFP, 11, 4],
         ["hugeGaussian10k.fits", {xMin: 0, xMax: 10000, yMin: 0, yMax: 10000},  28, CARTA.CompressionType.ZFP, 11, 4],
         ["hugeGaussian20k.fits", {xMin: 0, xMax: 20000, yMin: 0, yMax: 20000},  56, CARTA.CompressionType.ZFP, 11, 4],
         ["hugeGaussian40k.fits", {xMin: 0, xMax: 40000, yMin: 0, yMax: 40000}, 112, CARTA.CompressionType.ZFP, 11, 4],
         ["hugeGaussian80k.fits", {xMin: 0, xMax: 80000, yMin: 0, yMax: 80000}, 223, CARTA.CompressionType.ZFP, 11, 4],
        ].map(
            function ([testFileName, imageBounds, mip, compressionType, compressionQuality, numSubsets]: 
                    [string, {xMin: number, xMax: number, yMin: number, yMax: number}, number, CARTA.CompressionType, number, number]) {
                
                describe(`open the file "${testFileName}" and ...`,
                () => {
                    beforeEach( 
                    done => {
                        Connection.onmessage = (event: MessageEvent) => {
                            let eventName = Utility.getEventName(new Uint8Array(event.data, 0, 32));
                            if (eventName === "REGISTER_VIEWER_ACK") {
                                // Assertion
                                let eventData = new Uint8Array(event.data, 36);
                                expect(CARTA.RegisterViewerAck.decode(eventData).success).toBe(true);

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
                            }                
                        };    
                    }, openFileTimeout);       
                    
                });     
                
                let mean: number;
                let squareDiffs: number[];
                let SD: number;
                count = [0, 0, 0, 0, 0];
                for (let idx = 0; idx < 5; idx++) {
                    let timer: number = 0;
                    test(`assert the file "${testFileName}" reads image at round ${idx + 1}.`, 
                    done => {
                        // Preapare the message
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
                                let eventData = new Uint8Array(event.data, 36);
                                expect(CARTA.FileListResponse.decode(eventData).success).toBe(true);

                                // Preapare the message
                                let messageOpenFile = CARTA.OpenFile.create({
                                    directory: testSubdirectoryName, 
                                    file: testFileName, hdu: "0", fileId: 0, 
                                    renderMode: CARTA.RenderMode.RASTER
                                });
                                payload = CARTA.OpenFile.encode(messageOpenFile).finish();
                                eventDataTx = new Uint8Array(32 + 4 + payload.byteLength);

                                eventDataTx.set(Utility.stringToUint8Array("OPEN_FILE", 32));
                                eventDataTx.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
                                eventDataTx.set(payload, 36);

                                Connection.send(eventDataTx);

                                // While receive a message
                                Connection.onmessage = (eventOpen: MessageEvent) => {
                                    eventName = Utility.getEventName(new Uint8Array(eventOpen.data, 0, 32));
                                    if (eventName === "OPEN_FILE_ACK") {
                                        eventData = new Uint8Array(eventOpen.data, 36);
                                        let openFileMessage = CARTA.OpenFileAck.decode(eventData);
                                        expect(openFileMessage.success).toBe(true);

                                        // Preapare the message
                                        let messageSetImageView = CARTA.SetImageView.create({
                                            fileId: 0, imageBounds: {xMin: 0, xMax: openFileMessage.fileInfoExtended.width, yMin: 0, yMax: openFileMessage.fileInfoExtended.height}, 
                                            mip: 3, compressionType: CARTA.CompressionType.ZFP, 
                                            compressionQuality: 11, numSubsets: 4
                                        });
                                        payload = CARTA.SetImageView.encode(messageSetImageView).finish();
                                        eventDataTx = new Uint8Array(32 + 4 + payload.byteLength);

                                        eventDataTx.set(Utility.stringToUint8Array("SET_IMAGE_VIEW", 32));
                                        eventDataTx.set(new Uint8Array(new Uint32Array([1]).buffer), 32);
                                        eventDataTx.set(payload, 36);

                                        Connection.send(eventDataTx);

                                        timer = new Date().getTime();

                                        // While receive a message
                                        Connection.onmessage = (eventRasterImageData: MessageEvent) => {
                                            eventName = Utility.getEventName(new Uint8Array(eventRasterImageData.data, 0, 32));
                                            if (eventName === "RASTER_IMAGE_DATA") {
                                                eventData = new Uint8Array(eventRasterImageData.data, 36);
                                                let rasterImageDataMessage = CARTA.RasterImageData.decode(eventData);
                                                expect(rasterImageDataMessage.imageData.length).toBeGreaterThan(0);

                                                if (rasterImageDataMessage.imageData.length > 0) {
                                                    count[idx] = new Date().getTime() - timer;
                                                }

                                                if (idx + 1 === 5) {
                                                    mean = count.reduce((a, b) => a + b, 0) / count.length;
                                                    squareDiffs = count.map(function(value: number) {
                                                            let diff = value - mean;
                                                            return diff * diff;
                                                        });
                                                    SD = Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length);
                                                    console.log(`for "${testFileName}": returning time = ${count} ms. mean = ${mean} ms. deviation = ${SD} ms.`);
                            
                                                }

                                                done();
                                            } // if
                                        }; // onmessage "RASTER_IMAGE_DATA"
                                    } // if
                                }; // onmessage "OPEN_FILE_ACK"
                            } // if
                        }; // onmessage "FILE_LIST_RESPONSE"
                    }, readFileTimeout); // test
                    
                }           

            }
        );
    }); // describe

    afterEach( done => {
        Connection.close();
        done();
    }, disconnectionTimeout);

});