type SpectralTransformMock = jest.Mock<number, [number | null, string | null, string | null, string | null, number, number, boolean, number]>;

type TestModule = {
    HEAPF32: Float32Array;
    HEAPF64: Float64Array;
    _free: jest.Mock<void, [number]>;
    _malloc: jest.Mock<number, [number]>;
    calledRun: boolean;
    cwrap: jest.Mock;
    spectralTransform?: SpectralTransformMock;
    transformSpectralPoint?: (spectralFrameFrom: number | null, specType: string | null, specUnit: string | null, specSys: string | null, zIn: number, forward?: boolean) => number;
    transformSpectralPointArray?: (spectralFrameFrom: number | null, specType: string | null, specUnit: string | null, specSys: string | null, zIn: number[], forward?: boolean) => Float64Array;
    zIn?: number;
    zOut?: number;
};

const loadPostModule = (spectralTransformStatus: number, invalidOutputIndex?: number) => {
    jest.resetModules();

    const buffer = new ArrayBuffer(4096);
    let nextPointer = 8;
    const module: TestModule = {
        HEAPF32: new Float32Array(buffer),
        HEAPF64: new Float64Array(buffer),
        _free: jest.fn(),
        _malloc: jest.fn((size: number) => {
            const pointer = nextPointer;
            nextPointer += size;
            return pointer;
        }),
        calledRun: false,
        cwrap: jest.fn()
    };
    const spectralTransform: SpectralTransformMock = jest.fn((_spectralFrameFrom, _specType, _specUnit, _specSys, npoint, zInPointer, _forward, zOutPointer) => {
        if (spectralTransformStatus === 0) {
            const input = new Float64Array(buffer, zInPointer, npoint);
            const output = new Float64Array(buffer, zOutPointer, npoint);
            input.forEach((value, index) => (output[index] = index === invalidOutputIndex ? NaN : value * 2));
        }
        return spectralTransformStatus;
    });
    module.cwrap.mockImplementation((name: string) => (name === "spectralTransform" ? spectralTransform : jest.fn()));

    const globals = globalThis as typeof globalThis & {Module?: TestModule; addOnPostRun?: (callback: () => void) => void};
    globals.Module = module;
    globals.addOnPostRun = callback => callback();

    const consoleSpy = jest.spyOn(console, "log").mockImplementation();
    jest.isolateModules(() => require("./post"));
    consoleSpy.mockRestore();

    return {module, spectralTransform};
};

describe("AST spectral transform helpers", () => {
    afterEach(() => {
        const globals = globalThis as typeof globalThis & {Module?: TestModule; addOnPostRun?: (callback: () => void) => void};
        delete globals.Module;
        delete globals.addOnPostRun;
    });

    test("returns NaN instead of a stale scalar output when the native transform fails", () => {
        const {module, spectralTransform} = loadPostModule(1);
        module.HEAPF64[(module.zOut ?? 0) / 8] = 123;

        const result = module.transformSpectralPoint?.(1, "AWAV", "nm", "LSRK", 10, false);

        expect(result).toBeNaN();
        expect(spectralTransform).toHaveBeenCalledWith(1, "AWAV", "nm", "LSRK", 1, module.zIn, false, module.zOut);
    });

    test("returns NaNs and releases temporary buffers when an array transform fails", () => {
        const {module} = loadPostModule(1);
        module._free.mockClear();

        const result = module.transformSpectralPointArray?.(1, "AWAV", "nm", "LSRK", [10, 20], false);

        expect(Array.from(result ?? [])).toEqual([NaN, NaN]);
        expect(module._free).toHaveBeenCalledTimes(2);
        expect(module._free.mock.calls[0][0]).not.toBe(module._free.mock.calls[1][0]);
    });

    test("preserves successful scalar and array transform results", () => {
        const {module} = loadPostModule(0);

        expect(module.transformSpectralPoint?.(1, "AWAV", "nm", "LSRK", 10, false)).toBe(20);
        expect(Array.from(module.transformSpectralPointArray?.(1, "AWAV", "nm", "LSRK", [10, 20], false) ?? [])).toEqual([20, 40]);
    });

    test("preserves valid array results alongside a point-level invalid result", () => {
        const {module} = loadPostModule(0, 1);

        expect(Array.from(module.transformSpectralPointArray?.(1, "AWAV", "nm", "LSRK", [10, 20], false) ?? [])).toEqual([20, NaN]);
    });
});
