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

describe("ProtobufProcessing", () => {
    describe("processSpectralProfile", () => {
        test("should convert the rawValuesFp64 Uint8Array to actual float64 coordinates", () => {
            const rawValuesFp64 = new Uint8Array([254, 200, 105, 252, 224, 108, 150, 63, 116, 209, 69, 71, 156, 152, 146, 63, 250, 90, 61, 131, 156, 74, 162, 63, 80, 42, 76, 112, 43, 3, 147, 63, 195, 196, 251, 25, 238, 78, 149, 63]);

            const profile: CARTA.SpectralProfile.$Properties = {
                coordinate: "z",
                statsType: 4,
                rawValuesFp64
            };

            const result = ProtobufProcessing.processSpectralProfile(profile, 1);

            expect(result.coordinate).toBe("z");
            expect(result.statsType).toBe(4);
            expect(result.progress).toBe(1);
            expect(result.values).toBeInstanceOf(Float64Array);
            expect(result.values!.length).toBe(5);

            const expectedValues = [0.021899714857178225, 0.01816028771413998, 0.035725489635913335, 0.018566778878304213, 0.02080890687551996];

            for (let i = 0; i < expectedValues.length; i++) {
                expect(result.values![i]).toBeCloseTo(expectedValues[i], 15);
            }
        });

        test("should convert the rawValuesFp32 Uint8Array to float32 values", () => {
            const float32Values = new Float32Array([1.5, 2.5, 3.5, 4.5]);
            const rawValuesFp32 = new Uint8Array(float32Values.buffer);

            const profile: CARTA.SpectralProfile.$Properties = {
                coordinate: "x",
                statsType: 2,
                rawValuesFp32
            };

            const result = ProtobufProcessing.processSpectralProfile(profile, 0.5);

            expect(result.coordinate).toBe("x");
            expect(result.statsType).toBe(2);
            expect(result.progress).toBe(0.5);
            expect(result.values).toBeInstanceOf(Float32Array);
            expect(result.values!.length).toBe(4);
            expect(result.values![0]).toBe(1.5);
            expect(result.values![1]).toBe(2.5);
            expect(result.values![2]).toBe(3.5);
            expect(result.values![3]).toBe(4.5);
        });

        test("should return values as null and progress as 0 for invalid inputs", () => {
            // Missing rawValues
            const profileEmpty: CARTA.SpectralProfile.$Properties = {
                coordinate: "z",
                statsType: 4
            };
            const resultEmpty = ProtobufProcessing.processSpectralProfile(profileEmpty, 1);
            expect(resultEmpty.values).toBeNull();
            expect(resultEmpty.progress).toBe(0);

            // Invalid rawValuesFp64 length
            const profileInvalidFp64: CARTA.SpectralProfile.$Properties = {
                coordinate: "z",
                statsType: 4,
                rawValuesFp64: new Uint8Array([1, 2, 3])
            };
            const resultInvalidFp64 = ProtobufProcessing.processSpectralProfile(profileInvalidFp64, 1);
            expect(resultInvalidFp64.values).toBeNull();
            expect(resultInvalidFp64.progress).toBe(0);

            // Invalid rawValuesFp32 length
            const profileInvalidFp32: CARTA.SpectralProfile.$Properties = {
                coordinate: "z",
                statsType: 4,
                rawValuesFp32: new Uint8Array([1, 2, 3])
            };
            const resultInvalidFp32 = ProtobufProcessing.processSpectralProfile(profileInvalidFp32, 1);
            expect(resultInvalidFp32.values).toBeNull();
            expect(resultInvalidFp32.progress).toBe(0);
        });
    });

    describe("processSpatialProfile", () => {
        test("should convert rawValuesFp32 to Float32Array", () => {
            const float32Values = new Float32Array([10.0, 20.0, 30.0]);
            const rawValuesFp32 = new Uint8Array(float32Values.buffer);
            const lineAxisMock: CARTA.LineProfileAxis.$Properties = {
                axisType: 1
            };

            const profile: CARTA.SpatialProfile.$Properties = {
                coordinate: "x",
                start: 0,
                end: 2,
                mip: 1,
                lineAxis: lineAxisMock,
                rawValuesFp32
            };

            const result = ProtobufProcessing.processSpatialProfile(profile);

            expect(result.coordinate).toBe("x");
            expect(result.start).toBe(0);
            expect(result.end).toBe(2);
            expect(result.mip).toBe(1);
            expect(result.lineAxis).toEqual(lineAxisMock);
            expect(result.values).toBeInstanceOf(Float32Array);
            expect(result.values!.length).toBe(3);
            expect(result.values![0]).toBe(10.0);
            expect(result.values![1]).toBe(20.0);
            expect(result.values![2]).toBe(30.0);
        });

        test("should return values as null when rawValuesFp32 is invalid or missing", () => {
            const profileEmpty: CARTA.SpatialProfile.$Properties = {
                coordinate: "x",
                start: 0,
                end: 2,
                mip: 1,
                lineAxis: null
            };

            const resultEmpty = ProtobufProcessing.processSpatialProfile(profileEmpty);
            expect(resultEmpty.values).toBeNull();

            const profileInvalid: CARTA.SpatialProfile.$Properties = {
                coordinate: "x",
                start: 0,
                end: 2,
                mip: 1,
                lineAxis: null,
                rawValuesFp32: new Uint8Array([1, 2, 3])
            };

            const resultInvalid = ProtobufProcessing.processSpatialProfile(profileInvalid);
            expect(resultInvalid.values).toBeNull();
        });
    });

    describe("processContourSet", () => {
        beforeAll(async () => {
            await CARTACompute.onReady;
        });

        test("should correctly decode Case 1 rawCoordinates using WebAssembly", () => {
            const rawCoordinates = new Uint8Array([
                40, 181, 47, 253, 32, 104, 245, 1, 0, 196, 2, 39, 38, 255, 1, 0, 0, 255, 0, 255, 3, 1, 3, 0, 0, 1, 1, 3, 1, 0, 3, 255, 1, 255, 0, 1, 253, 255, 253, 0, 255, 255, 255, 255, 255, 253, 255, 253, 255, 255, 255, 1, 0, 0, 0, 6, 32,
                16, 218, 225, 112, 50, 225, 25, 13, 141, 137, 77, 38, 38, 23
            ]);

            const expectedVertices = [9.75, 9.5, 9.5, 9.75, 9.25, 10.5, 9.5, 11.25, 9.75, 11.5, 10.5, 11.75, 11.25, 11.5, 11.5, 11.25, 11.75, 10.5, 11.5, 9.75, 11.25, 9.5, 10.5, 9.25, 9.75, 9.5];

            const mockContourSet: CARTA.ContourSet.$Properties = {
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
            const rawCoordinates = new Uint8Array([
                40, 181, 47, 253, 32, 104, 253, 1, 0, 212, 2, 40, 38, 254, 2, 0, 0, 255, 0, 255, 2, 1, 2, 0, 0, 2, 2, 2, 1, 0, 2, 255, 2, 254, 0, 255, 1, 254, 255, 254, 0, 255, 255, 255, 254, 254, 254, 255, 254, 255, 255, 255, 1, 0, 0, 0,
                6, 32, 16, 218, 225, 112, 50, 225, 237, 2, 141, 137, 77, 38, 38, 23
            ]);

            const expectedVertices = [10.0, 9.5, 9.5, 10.0, 9.25, 10.5, 9.5, 11.0, 10.0, 11.5, 10.5, 11.75, 11.0, 11.5, 11.5, 11.0, 11.75, 10.5, 11.5, 10.0, 11.0, 9.5, 10.5, 9.25, 10.0, 9.5];

            const mockContourSet: CARTA.ContourSet.$Properties = {
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
});
