import {LogStore} from "./stores/LogStore";
import {BackendService} from "./services/BackendService";
import {CARTA} from "carta-protobuf";

let logStore: LogStore;
let backendService: BackendService;
let currentSessionId: string;
let testServerUrl = "ws://localhost:3002";
let testFileName = "N4_average.hdf5";
let testPath = "QA";
let numTestFiles = 10;
let connectTimeout = 100;
let fileListTimeout = 100;
let fileInfoTimeout = 100;
let fileLoadTimeout = 1000;
let currentFileListResponse: CARTA.FileListResponse;

describe("Bootstrapping tests", () => {
    it("Should establish a backend service correctly", () => {
        process.env.NODE_ENV = "test";
        logStore = new LogStore();
        backendService = new BackendService(logStore);
    });
});

describe("ICD tests", () => {
    beforeEach(() => {
        process.env.NODE_ENV = "test";
        logStore = new LogStore();
        backendService = new BackendService(logStore);
    });

    describe("connection testing", () => {
        it(`connects successfully with an API key within ${connectTimeout * 1e-3} seconds`, done => {
            backendService.connect(testServerUrl, "1234").subscribe(sessionId => {
                currentSessionId = sessionId;
                done();
            });
        }, connectTimeout);

        it(`connects successfully without an API key within ${connectTimeout * 1e-3} seconds`, done => {
            backendService.connect(testServerUrl, "").subscribe(sessionId => {
                currentSessionId = sessionId;
                done();
            });
        }, connectTimeout);
    });

    describe("file list", () => {
        beforeEach(done => {
            backendService.connect(testServerUrl, "").subscribe(sessionId => {
                currentSessionId = sessionId;
                done();
            });
        }, connectTimeout);

        it(`retrieves a file list correctly for the default path within ${fileListTimeout * 1e-3} seconds`, done => {
            backendService.getFileList("").subscribe(fileListResponse => {
                expect(fileListResponse.files.length).toBeGreaterThan(0);
                const fileInfo = fileListResponse.files.find(f => f.name === testFileName);
                expect(fileInfo).toBeDefined();
                expect(fileInfo.type).toBe(2);
                done();
            });
        }, fileListTimeout);

        it(`retrieves a file list correctly for the root path within ${fileListTimeout * 1e-3} seconds`, done => {
            backendService.getFileList("/").subscribe(fileListResponse => {
                expect(fileListResponse.files.length).toBeGreaterThan(0);
                const fileInfo = fileListResponse.files.find(f => f.name === testFileName);
                expect(fileInfo).toBeDefined();
                expect(fileInfo.type).toBe(2);
                done();
            });
        }, fileListTimeout);

        it(`retrieves a file list correctly for a test path within ${fileListTimeout * 1e-3} seconds`, done => {
            backendService.getFileList(testPath).subscribe(fileListResponse => {
                expect(fileListResponse.files.length).toBeGreaterThan(0);
                done();
            });
        }, fileListTimeout);
    });

    describe("file info", () => {
        beforeEach(done => {
            backendService.connect(testServerUrl, "").subscribe(sessionId => {
                currentSessionId = sessionId;
                backendService.getFileList(testPath).subscribe(fileListResponse => {
                    currentFileListResponse = fileListResponse;
                    done();
                });
            });
        }, fileListTimeout);

        it(`retrieves file info correctly within ${fileInfoTimeout * 1e-3} seconds`, done => {
            backendService.getFileInfo("", testFileName, "").subscribe(fileInfoResponse => {
                expect(fileInfoResponse.success).toBe(true);
                done();
            });
        }, fileInfoTimeout);

        it(`retrieves file info for all files in the QA directory within ${numTestFiles * fileInfoTimeout * 1e-3} seconds`, done => {
            let fileCounter = 0;
            for (let file of currentFileListResponse.files) {
                backendService.getFileInfo(testPath, file.name, "").subscribe(fileInfoResponse => {
                    expect(fileInfoResponse.success).toBe(true);
                    fileCounter++;
                    if (fileCounter === currentFileListResponse.files.length) {
                        done();
                    }
                });
            }
        }, numTestFiles * fileInfoTimeout);
    });

    describe("file loading", () => {
        beforeEach(done => {
            backendService.connect(testServerUrl, "").subscribe(sessionId => {
                currentSessionId = sessionId;
                backendService.getFileList(testPath).subscribe(fileListResponse => {
                    currentFileListResponse = fileListResponse;
                    done();
                });
            });
        }, fileListTimeout);

        it(`loads a test file correctly within ${fileLoadTimeout * 1e-3} seconds`, done => {
            backendService.loadFile("", testFileName, "", 0, CARTA.RenderMode.RASTER).subscribe(openFileAck => {
                expect(openFileAck.success).toBeTruthy();
                done();
            });
        }, fileLoadTimeout);

        it(`loads all files in the QA directory within ${numTestFiles * fileLoadTimeout * 1e-3} seconds`, done => {
            let fileCounter = 0;
            for (let file of currentFileListResponse.files) {
                backendService.loadFile(testPath, file.name, "", 0, CARTA.RenderMode.RASTER).subscribe(openFileAck => {
                    expect(openFileAck.success).toBe(true);
                    fileCounter++;
                    if (fileCounter === currentFileListResponse.files.length) {
                        done();
                    }
                });
            }
        }, numTestFiles * fileLoadTimeout);
    });
});