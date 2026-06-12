jest.mock("carta_computation", () => {
    const fs = require("fs");
    const path = require("path");
    const wasmDir = path.resolve(__dirname, "../../../wasm_src/carta_computation/build");
    const code = fs.readFileSync(path.resolve(wasmDir, "index.js"), "utf8");
    const mockModule = {exports: {} as any};

    const customFs = {
        ...fs,
        readFileSync: (filename: any, options: any) => {
            if (typeof filename === "string" && filename.endsWith("carta_computation.wasm")) {
                return fs.readFileSync(path.resolve(wasmDir, "carta_computation.wasm"));
            }
            return fs.readFileSync(filename, options);
        }
    };

    const customRequire = (name: string) => {
        if (name === "fs") {
            return customFs;
        }
        return require(name);
    };

    const fn = new Function("module", "exports", "require", "__dirname", "__filename", code);
    fn(mockModule, mockModule.exports, customRequire, wasmDir, path.resolve(wasmDir, "index.js"));

    mockModule.exports.__esModule = true;
    mockModule.exports.default = mockModule.exports;

    return mockModule.exports;
});

import * as CARTACompute from "carta_computation";
import {type CARTA} from "carta-protobuf";

import {ProtobufProcessing} from "./Processed";

describe("ProtobufProcessing.processContourSet", () => {
    beforeAll(async () => {
        await CARTACompute.onReady;
    });

    test("should correctly decode Case 1 rawCoordinates using WebAssembly", () => {
        const rawCoordinates = new Uint8Array([
            40, 181, 47, 253, 32, 104, 245, 1, 0, 196, 2, 39, 38, 255, 1, 0, 0, 255, 0, 255, 3, 1, 3, 0, 0, 1, 1, 3, 1, 0, 3, 255, 1, 255, 0, 1, 253, 255, 253, 0, 255, 255, 255, 255, 255, 253, 255, 253, 255, 255, 255, 1, 0, 0, 0, 6, 32, 16,
            218, 225, 112, 50, 225, 25, 13, 141, 137, 77, 38, 38, 23
        ]);

        const expectedVertices = [9.75, 9.5, 9.5, 9.75, 9.25, 10.5, 9.5, 11.25, 9.75, 11.5, 10.5, 11.75, 11.25, 11.5, 11.5, 11.25, 11.75, 10.5, 11.5, 9.75, 11.25, 9.5, 10.5, 9.25, 9.75, 9.5];

        const mockContourSet: CARTA.IContourSet = {
            level: 0.6,
            decimationFactor: 4,
            uncompressedCoordinatesSize: 104,
            rawCoordinates: rawCoordinates
        };

        const result = ProtobufProcessing.processContourSet(mockContourSet);
        expect(result).toBeDefined();
        expect(result.level).toBe(0.6);
        expect(result.coordinates).toBeDefined();

        const decodedCoords = Array.from(result.coordinates!);
        expect(decodedCoords).toHaveLength(expectedVertices.length);
        for (let i = 0; i < expectedVertices.length; i++) {
            expect(decodedCoords[i]).toBeCloseTo(expectedVertices[i]);
        }
    });

    test("should correctly decode Case 2 rawCoordinates using WebAssembly", () => {
        const rawCoordinates = new Uint8Array([40, 181, 47, 253, 32, 40, 237, 0, 0, 168, 36, 40, 4, 5, 0, 5, 251, 251, 252, 0, 255, 255, 255, 252, 255, 255, 255, 4, 0, 0, 0, 2, 0, 59, 194, 13, 160, 5]);

        const expectedVertices = [9.0, 10.0, 10.0, 11.25, 11.25, 10.0, 10.0, 9.0, 9.0, 10.0];

        const mockContourSet: CARTA.IContourSet = {
            level: 0.6,
            decimationFactor: 4,
            uncompressedCoordinatesSize: 40,
            rawCoordinates: rawCoordinates
        };

        const result = ProtobufProcessing.processContourSet(mockContourSet);
        expect(result).toBeDefined();
        expect(result.level).toBe(0.6);
        expect(result.coordinates).toBeDefined();

        const decodedCoords = Array.from(result.coordinates!);
        expect(decodedCoords).toHaveLength(expectedVertices.length);
        for (let i = 0; i < expectedVertices.length; i++) {
            expect(decodedCoords[i]).toBeCloseTo(expectedVertices[i]);
        }
    });

    test("should correctly decode Case 3 rawCoordinates using WebAssembly", () => {
        const rawCoordinates = new Uint8Array([
            40, 181, 47, 253, 32, 104, 253, 1, 0, 212, 2, 40, 38, 254, 2, 0, 0, 255, 0, 255, 2, 1, 2, 0, 0, 2, 2, 2, 1, 0, 2, 255, 2, 254, 0, 255, 1, 254, 255, 254, 0, 255, 255, 255, 254, 254, 254, 255, 254, 255, 255, 255, 1, 0, 0, 0, 6,
            32, 16, 218, 225, 112, 50, 225, 237, 2, 141, 137, 77, 38, 38, 23
        ]);

        const expectedVertices = [10.0, 9.5, 9.5, 10.0, 9.25, 10.5, 9.5, 11.0, 10.0, 11.5, 10.5, 11.75, 11.0, 11.5, 11.5, 11.0, 11.75, 10.5, 11.5, 10.0, 11.0, 9.5, 10.5, 9.25, 10.0, 9.5];

        const mockContourSet: CARTA.IContourSet = {
            level: 0.85,
            decimationFactor: 4,
            uncompressedCoordinatesSize: 104,
            rawCoordinates: rawCoordinates
        };

        const result = ProtobufProcessing.processContourSet(mockContourSet);
        expect(result).toBeDefined();
        expect(result.level).toBe(0.85);
        expect(result.coordinates).toBeDefined();

        const decodedCoords = Array.from(result.coordinates!);
        expect(decodedCoords).toHaveLength(expectedVertices.length);
        for (let i = 0; i < expectedVertices.length; i++) {
            expect(decodedCoords[i]).toBeCloseTo(expectedVertices[i]);
        }
    });
});
