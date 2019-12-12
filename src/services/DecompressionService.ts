import {observable} from "mobx";
import {CARTA} from "carta-protobuf";

export class DecompressionService {
    @observable zfpReady: boolean;
    private readonly workers: Worker[];
    private readonly workerBuffers: ArrayBuffer[];
    private readonly workLengths: number[];
    private readonly workerReady: boolean[];
    // Queue of resolves for worker availability promises
    private workQueue: Array<() => void>;
    private decompressedData: (val?: Float32Array) => void;
    private isQueueFree: boolean;

    constructor(numWorkers: number) {
        const ZFPWorker = require("worker-loader!zfp_wrapper");
        this.decompressedData = null;
        this.workQueue = [];
        this.workers = new Array<Worker>(numWorkers);
        this.workerBuffers = new Array<ArrayBuffer>(numWorkers);
        this.workLengths = new Array<number>(numWorkers);
        this.workerReady = new Array<boolean>(numWorkers);

        for (let i = 0; i < numWorkers; i++) {
            this.workers[i] = new ZFPWorker();
            this.workerBuffers[i] = new ArrayBuffer(1e6);
            this.workLengths[i] = 0;
            this.workerReady[i] = false;
            this.workers[i].onmessage = (event: MessageEvent) => {
                if (event.data[0] === "ready") {
                    // signals worker is ready to receive data
                    this.workerReady[i] = true;
                    // Check if all workers are ready
                    if (this.workerReady.every(v => v)) {
                        this.zfpReady = true;
                        if (this.workQueue.length) {
                            const nextReadyResolve = this.workQueue.shift();
                            nextReadyResolve();
                        }
                        else {
                            this.isQueueFree = true;
                        }
                    }
                }
                else if (event.data[0] === "decompress") {
                    this.workerBuffers[i] = event.data[1];
                    const eventArgs = event.data[2];
                    this.workLengths[i] = eventArgs.width * eventArgs.subsetHeight;
                    this.workerReady[i] = true;

                    // Check if all workers are ready to receive data
                    if (this.workerReady.every(v => v)) {
                        if (this.decompressedData) {
                            const totalLength = this.workLengths.reduce((val, sum) => sum + val);
                            const newData = new Float32Array(totalLength);
                            let offset = 0;
                            for (let j = 0; j < numWorkers; j++) {
                                const currentArray = new Float32Array(this.workerBuffers[j], 0, this.workLengths[j]);
                                newData.set(currentArray, offset);
                                offset += this.workLengths[j];
                                this.workLengths[j] = 0;
                            }
                            this.decompressedData(newData);
                            this.decompressedData = null;
                        }
                        if (this.workQueue.length) {
                            const nextReadyResolve = this.workQueue.shift();
                            nextReadyResolve();
                        }
                        else {
                            this.isQueueFree = true;
                        }
                    }

                }
            };
        }
    }

    decompressRasterData(message: CARTA.RasterImageData) {
        return new Promise<CARTA.RasterImageData>((resolve, reject) => {
            if (message.imageData.length > this.workers.length || message.imageData.length !== message.nanEncodings.length) {
                reject("Mismatched subset counts");
            }

            if (message.compressionType !== CARTA.CompressionType.ZFP || message.compressionQuality <= 0 || message.compressionQuality > 32) {
                reject("Unsupported compression type");
            }

            const w = Math.ceil((message.imageBounds.xMax - message.imageBounds.xMin) / message.mip);
            const h = Math.ceil((message.imageBounds.yMax - message.imageBounds.yMin) / message.mip);
            this.submitWork(message.imageData, message.nanEncodings, message.compressionQuality, w, h).then(() => {
                const promise = new Promise<Float32Array>(resolveWork => {
                    this.decompressedData = resolveWork;
                });

                promise.then(val => {
                    message.imageData = [new Uint8Array(val.buffer)];
                    resolve(message);
                });
            });
        });
    }

    private submitWork(subsets: Uint8Array[], nanEncodings: Uint8Array[], precision: number, w: number, h: number): Promise<void> {
        return new Promise<void>(resolve => {
            if (this.isQueueFree) {
                this.sendWork(subsets, nanEncodings, precision, w, h);
                resolve();
            }
            else {
                const readyPromise = new Promise(resolveReady => {
                    this.workQueue.push(resolveReady);
                });
                readyPromise.then(() => {
                    this.sendWork(subsets, nanEncodings, precision, w, h);
                });
            }
        });
    }

    private sendWork(subsets: Uint8Array[], nanEncodings: Uint8Array[], precision: number, w: number, h: number) {
        this.isQueueFree = false;
        const N = subsets.length;
        for (let i = 0; i < N; i++) {
            this.workerReady[i] = false;
            const subsetRowStart = i * Math.floor(h / N);
            let subsetRowEnd = (i + 1) * Math.floor(h / N);
            if (i === N - 1) {
                subsetRowEnd = h;
            }
            const subsetHeight = subsetRowEnd - subsetRowStart;
            const bufferSizeRequirement = Math.max(w * subsetHeight * 4, subsets[i].byteLength);
            if (!this.workerBuffers[i] || this.workerBuffers[i].byteLength < bufferSizeRequirement) {
                const prevLength = this.workerBuffers[i] ? this.workerBuffers[i].byteLength : 0;
                this.workerBuffers[i] = new ArrayBuffer(Math.max(prevLength * 2, bufferSizeRequirement));
                console.log(`Allocating new buffer for Worker[${i}]: ${prevLength / 1e6} -> ${this.workerBuffers[i].byteLength / 1e6} MB`);
            }
            let compressedView = new Uint8Array(this.workerBuffers[i]);
            compressedView.set(subsets[i]);
            const nanEncodings32 = new Int32Array(nanEncodings[i].slice(0).buffer);
            this.workers[i].postMessage(["decompress", this.workerBuffers[i], {
                    width: w,
                    subsetHeight: subsetHeight,
                    subsetLength: subsets[i].byteLength,
                    compression: precision,
                    nanEncodings: nanEncodings32
                }],
                [this.workerBuffers[i], nanEncodings32.buffer]);
        }
    }
}
