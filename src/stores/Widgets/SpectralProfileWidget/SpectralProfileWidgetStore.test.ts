import {CARTA} from "carta-protobuf";
import * as GSL from "gsl_wrapper";
import {runInAction} from "mobx";

import {MomentSelectingMode, Polarizations, RestFrameShiftMode, SpectralType, SpectralUnit} from "enums";
import {AppStore} from "stores";

import {SpectralProfileWidgetStore} from "./SpectralProfileWidgetStore";

describe("SpectralProfileWidgetStore rest-frame coordinates", () => {
    let widgetStore: SpectralProfileWidgetStore | undefined;

    const createWidgetStore = (
        spectralType: SpectralType = SpectralType.FREQ,
        spectralUnit: SpectralUnit = SpectralUnit.GHZ,
        spectralTypeSecondary: SpectralType | null = spectralType,
        spectralUnitSecondary: SpectralUnit | null = spectralUnit,
        nativeIntensityUnit: string = "Jy/beam",
        displayIntensityUnit: string = nativeIntensityUnit,
        requiredPolarization: Polarizations = Polarizations.I
    ) => {
        const intensityConfig = {nativeIntensityUnit};
        const frame = {
            channelInfo: {},
            channelSecondaryValues: [10, 11],
            channelValues: [100, 110],
            channelValueBounds: undefined,
            filename: "test.fits",
            frameInfo: {fileId: 7},
            getRegion: jest.fn(),
            hasStokes: false,
            headerUnit: nativeIntensityUnit,
            intensityConfig,
            intensityUnit: displayIntensityUnit,
            isCoordChannel: spectralType === SpectralType.CHANNEL,
            isSpectralChannel: true,
            regionSet: {focusedRegion: undefined, regions: []},
            requiredPolarization,
            requiredUnit: nativeIntensityUnit,
            spectralType,
            spectralTypeSecondary,
            spectralUnit,
            spectralUnitSecondary,
            spectralUnitStr: spectralUnit,
            spectralLabel: `Frequency (${spectralUnit})`,
            spectralAxis: {type: {code: spectralType, unit: spectralUnit}},
            convertSettingWCSToFreqMHz: jest.fn((value: number): number | undefined => value),
            convertFreqMHzToSettingWCS: jest.fn((value: number): number | undefined => value),
            convertSettingWCSToFreqMHzArray: jest.fn((values: number[]): number[] | undefined => values),
            convertFreqMHzToSettingWCSArray: jest.fn((values: number[]): number[] | undefined => values)
        };
        const appStore = {
            activeFrame: frame,
            focusedRegion: undefined,
            frameNames: [],
            frames: [frame],
            getFrame: jest.fn(() => frame),
            getFrameName: jest.fn(() => "test.fits"),
            spatialAndSpectalMatchedFileIds: [],
            spectralProfiles: new Map([
                [
                    7,
                    new Map([
                        [
                            0,
                            {
                                getProfile: jest.fn(() => ({progress: 1, values: new Float32Array([4, 8])}))
                            }
                        ]
                    ])
                ]
            ])
        };
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue(appStore as any);
        widgetStore = new SpectralProfileWidgetStore();
        return {frame, widgetStore};
    };

    afterEach(() => {
        widgetStore?.dispose();
        jest.restoreAllMocks();
    });

    test("converts frequency coordinates in both directions without changing the redshift-zero identity", () => {
        const {widgetStore} = createWidgetStore(SpectralType.FREQ);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);

        expect(widgetStore.convertObservedXToDisplay(100)).toBe(200);
        expect(widgetStore.convertDisplayXToObserved(200)).toBe(100);

        widgetStore.setRestFrameRedshift(0);
        expect(widgetStore.convertObservedXToDisplay(100)).toBe(100);
        expect(widgetStore.convertDisplayXToObserved(100)).toBe(100);
    });

    test("converts wavelength coordinates with the inverse frequency factor", () => {
        const {widgetStore} = createWidgetStore(SpectralType.WAVE, SpectralUnit.NM);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);

        expect(widgetStore.convertObservedXToDisplay(1000)).toBe(500);
        expect(widgetStore.convertDisplayXToObserved(500)).toBe(1000);
    });

    test.each([SpectralUnit.M_SQUARE, SpectralUnit.MM_SQUARE, SpectralUnit.UM_SQUARE, SpectralUnit.NM_SQUARE, SpectralUnit.ANGSTROM_SQUARE])("converts squared wavelength coordinates in %s with the squared redshift factor", spectralUnit => {
        const {widgetStore} = createWidgetStore(SpectralType.WAVE, spectralUnit);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);

        expect(widgetStore.convertObservedXToDisplay(1000)).toBe(250);
        expect(widgetStore.convertDisplayXToObserved(250)).toBe(1000);
        expect(widgetStore.plotData?.data[0]).toEqual([
            {x: 25, y: 4},
            {x: 27.5, y: 8}
        ]);
    });

    test("converts air wavelength through the frame spectral conversion", () => {
        const {frame, widgetStore} = createWidgetStore(SpectralType.AWAV, SpectralUnit.NM);
        frame.convertSettingWCSToFreqMHz.mockImplementation((value: number) => 300 / value);
        frame.convertFreqMHzToSettingWCS.mockImplementation((value: number) => 300 / value);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);

        expect(widgetStore.convertObservedXToDisplay(10)).toBe(5);
        expect(widgetStore.convertDisplayXToObserved(5)).toBe(10);
        expect(frame.convertSettingWCSToFreqMHz).toHaveBeenCalled();
        expect(frame.convertFreqMHzToSettingWCS).toHaveBeenCalled();
    });

    test("converts squared air wavelength through the frame spectral conversion", () => {
        const {frame, widgetStore} = createWidgetStore(SpectralType.AWAV, SpectralUnit.NM_SQUARE);
        frame.convertSettingWCSToFreqMHz.mockImplementation((value: number) => 300 / Math.sqrt(value));
        frame.convertFreqMHzToSettingWCS.mockImplementation((value: number) => Math.pow(300 / value, 2));
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);
        frame.convertSettingWCSToFreqMHz.mockClear();
        frame.convertFreqMHzToSettingWCS.mockClear();

        expect(widgetStore.convertObservedXToDisplay(100)).toBe(25);
        expect(widgetStore.convertDisplayXToObserved(25)).toBe(100);
        expect(frame.convertSettingWCSToFreqMHz).toHaveBeenNthCalledWith(1, 100, SpectralType.AWAV, SpectralUnit.NM_SQUARE);
        expect(frame.convertSettingWCSToFreqMHz).toHaveBeenNthCalledWith(2, 25, SpectralType.AWAV, SpectralUnit.NM_SQUARE);
        expect(frame.convertFreqMHzToSettingWCS).toHaveBeenNthCalledWith(1, 60, SpectralType.AWAV, SpectralUnit.NM_SQUARE);
        expect(frame.convertFreqMHzToSettingWCS).toHaveBeenNthCalledWith(2, 30, SpectralType.AWAV, SpectralUnit.NM_SQUARE);
    });

    test("batches air-wavelength profile conversion without scalar AST calls", () => {
        const {frame, widgetStore} = createWidgetStore(SpectralType.AWAV, SpectralUnit.NM);
        frame.convertSettingWCSToFreqMHzArray.mockImplementation((values: number[]) => values.map(value => 300 / value));
        frame.convertFreqMHzToSettingWCSArray.mockImplementation((values: number[]) => values.map(value => 300 / value));
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);

        expect(widgetStore.plotData?.data[0][0]).toEqual({x: 50, y: 4});
        expect(widgetStore.plotData?.data[0][1].x).toBeCloseTo(55);
        expect(widgetStore.plotData?.data[0][1].y).toBe(8);
        expect(frame.convertSettingWCSToFreqMHzArray).toHaveBeenCalledWith([100, 110], SpectralType.AWAV, SpectralUnit.NM);
        expect(frame.convertFreqMHzToSettingWCSArray).toHaveBeenCalledWith([6, 60 / 11], SpectralType.AWAV, SpectralUnit.NM);
        expect(frame.convertSettingWCSToFreqMHz).not.toHaveBeenCalled();
        expect(frame.convertFreqMHzToSettingWCS).not.toHaveBeenCalled();
    });

    test("fails an air-wavelength profile conversion closed when a batched AST step fails", () => {
        const {frame, widgetStore} = createWidgetStore(SpectralType.AWAV, SpectralUnit.NM);
        frame.convertSettingWCSToFreqMHzArray.mockReturnValue(undefined);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);

        expect(widgetStore.plotData?.data[0].map(point => point.x)).toEqual([NaN, NaN]);
        expect(frame.convertFreqMHzToSettingWCSArray).not.toHaveBeenCalled();
    });

    test("does not approximate air wavelength when the AST conversion fails", () => {
        const {frame, widgetStore} = createWidgetStore(SpectralType.AWAV, SpectralUnit.NM);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);

        frame.convertSettingWCSToFreqMHz.mockReturnValue(undefined);
        expect(widgetStore.convertObservedXToDisplay(10)).toBeNaN();
        expect(widgetStore.convertDisplayXToObserved(5)).toBeNaN();

        frame.convertSettingWCSToFreqMHz.mockReturnValue(30);
        frame.convertFreqMHzToSettingWCS.mockReturnValue(undefined);
        expect(widgetStore.convertObservedXToDisplay(10)).toBeNaN();
        expect(widgetStore.convertDisplayXToObserved(5)).toBeNaN();
    });

    test("keeps moment ranges native while exposing rest-frame display values", () => {
        const {widgetStore} = createWidgetStore(SpectralType.FREQ);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);
        widgetStore.setSelectedChannelRange(100, 110);

        expect(widgetStore.displayChannelValueRange).toEqual([200, 220]);

        widgetStore.setSelectedDisplayChannelRange(240, 260);
        expect(widgetStore.channelValueRange).toEqual([120, 130]);
        expect(widgetStore.displayChannelValueRange).toEqual([240, 260]);
    });

    test("transforms plot and fitting x coordinates without rescaling intensity values", () => {
        const {widgetStore} = createWidgetStore(SpectralType.FREQ);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);

        expect(widgetStore.plotData?.data[0]).toEqual([
            {x: 200, y: 4},
            {x: 220, y: 8}
        ]);
        expect(widgetStore.plotData?.fittingData?.x).toEqual([200, 220]);
        expect(Array.from(widgetStore.plotData?.fittingData?.y ?? [])).toEqual([4, 8]);
    });

    test("applies the optional F_nu Jacobian consistently to plot data, statistics, fitting, labels, and export metadata", () => {
        const {widgetStore} = createWidgetStore(SpectralType.FREQ);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);
        widgetStore.setYAxisRestFrameEnabled(true);

        expect(widgetStore.plotData?.data[0]).toEqual([
            {x: 200, y: 2},
            {x: 220, y: 4}
        ]);
        expect(widgetStore.plotData?.yMean).toBe(3);
        expect(widgetStore.plotData?.yRms).toBe(1);
        expect(Array.from(widgetStore.plotData?.fittingData?.y ?? [])).toEqual([2, 4]);
        expect(widgetStore.xAxisLabel).toBe("Frequency (GHz) (rest frame)");
        expect(widgetStore.yUnitLabel).toBe("Jy/beam (rest frame)");
        expect(widgetStore.yAxisLabel).toBe("Value (Jy/beam) (rest frame)");
        expect(widgetStore.redshiftCorrectionExportComments).toEqual(["x-axis spectral coordinate: rest frame", "y-axis flux-density transformation: F_nu,rest = F_nu,observed / (1 + z)", "redshift (z): 1"]);
    });

    test("allows the Y-axis rest-frame density mode without enabling the X-axis mode", () => {
        const {widgetStore} = createWidgetStore(SpectralType.VRAD, SpectralUnit.KMS);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setYAxisRestFrameEnabled(true);

        expect(widgetStore.isXAxisRestFrameActive).toBe(false);
        expect(widgetStore.isYAxisRestFrameActive).toBe(true);
        expect(widgetStore.convertObservedXToDisplay(100)).toBe(100);
        expect(widgetStore.plotData?.data[0].map(point => point.y)).toEqual([2, 4]);
        expect(widgetStore.redshiftCorrectionExportComments).toEqual(["x-axis spectral coordinate: observed frame", "y-axis flux-density transformation: F_nu,rest = F_nu,observed / (1 + z)", "redshift (z): 1"]);
    });

    test("labels fitting results and logs with the rest-frame suffix when the Y-axis mode is active", () => {
        const {widgetStore} = createWidgetStore();
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);
        widgetStore.setYAxisRestFrameEnabled(true);
        (GSL.fitting as jest.Mock).mockReturnValueOnce({
            yIntercept: 0,
            yInterceptError: 0,
            slope: 0,
            slopeError: 0,
            center: new Float64Array([200, 0]),
            amp: new Float64Array([2, 0]),
            fwhm: new Float64Array([10, 0]),
            integral: new Float64Array([20, 0]),
            residual: new Float64Array([0, 0]),
            log: "Amplitude = @yUnit\nIntegral = @integralUnit"
        });

        widgetStore.fittingStore.fitData();

        expect(widgetStore.fittingStore.resultString).toContain("Amplitude = 2.000000 (Jy/beam (rest frame))");
        expect(widgetStore.fittingStore.resultString).toContain("Integral = 20.000000 (Jy/beam (rest frame) * GHz (rest frame))");
        expect(widgetStore.fittingStore.resultLog).toBe("Amplitude = (Jy/beam (rest frame))\nIntegral = (Jy/beam (rest frame) * GHz (rest frame))");
    });

    test("applies the F_nu Jacobian after converting the selected intensity unit", () => {
        const {widgetStore} = createWidgetStore(SpectralType.FREQ, SpectralUnit.GHZ, SpectralType.FREQ, SpectralUnit.GHZ, "mJy/beam", "Jy/beam");
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);
        widgetStore.setYAxisRestFrameEnabled(true);

        expect(widgetStore.plotData?.data[0][0].y).toBeCloseTo(0.002);
        expect(widgetStore.plotData?.data[0][1].y).toBeCloseTo(0.004);
    });

    test("uses the F_nu Jacobian even when the displayed spectral coordinate is wavelength", () => {
        const {widgetStore} = createWidgetStore(SpectralType.WAVE, SpectralUnit.NM);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);
        widgetStore.setYAxisRestFrameEnabled(true);

        expect(widgetStore.plotData?.data[0]).toEqual([
            {x: 50, y: 2},
            {x: 55, y: 4}
        ]);
    });

    test.each(["K", "mK"])("does not enable the F_nu Jacobian for %s intensity", intensityUnit => {
        const {widgetStore} = createWidgetStore(SpectralType.FREQ, SpectralUnit.GHZ, SpectralType.FREQ, SpectralUnit.GHZ, intensityUnit);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);
        widgetStore.setYAxisRestFrameEnabled(true);

        expect(widgetStore.isYAxisRestFrameSupported).toBe(false);
        expect(widgetStore.isYAxisRestFrameActive).toBe(false);
        expect(widgetStore.plotData?.data[0].map(point => point.y)).toEqual([4, 8]);
    });

    test.each(["Jy", "mJy", "uJy", "MJy"])("supports the F_nu Jacobian for bare %s flux-density units", intensityUnit => {
        const {widgetStore} = createWidgetStore(SpectralType.FREQ, SpectralUnit.GHZ, SpectralType.FREQ, SpectralUnit.GHZ, intensityUnit);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);
        widgetStore.setYAxisRestFrameEnabled(true);

        expect(widgetStore.isYAxisRestFrameActive).toBe(true);
        expect(widgetStore.plotData?.data[0].map(point => point.y)).toEqual([2, 4]);
    });

    test("does not enable the F_nu Jacobian for SumSq profiles", () => {
        const {widgetStore} = createWidgetStore();
        widgetStore.profileSelectionStore.selectStatSingleMode(CARTA.StatsType.SumSq);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);
        widgetStore.setYAxisRestFrameEnabled(true);

        expect(widgetStore.isYAxisRestFrameSupported).toBe(false);
        expect(widgetStore.isYAxisRestFrameActive).toBe(false);
        expect(widgetStore.plotData?.data[0].map(point => point.y)).toEqual([4, 8]);
    });

    test("does not enable the F_nu Jacobian for fractional-polarization profiles", () => {
        const {widgetStore} = createWidgetStore(SpectralType.FREQ, SpectralUnit.GHZ, SpectralType.FREQ, SpectralUnit.GHZ, "Jy/beam", "Jy/beam", Polarizations.PFtotal);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);
        widgetStore.setYAxisRestFrameEnabled(true);

        expect(widgetStore.isYAxisRestFrameSupported).toBe(false);
        expect(widgetStore.isYAxisRestFrameActive).toBe(false);
        expect(widgetStore.plotData?.data[0].map(point => point.y)).toEqual([4, 8]);
    });

    test("converts display mask values back to observed values and resets only affected display state", () => {
        const {widgetStore} = createWidgetStore();
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);
        widgetStore.setXBounds(90, 120);
        widgetStore.setYBounds(1, 9);
        widgetStore.fittingStore.setHasResult(true);

        widgetStore.setYAxisRestFrameEnabled(true);
        widgetStore.setSelectedDisplayMaskRange(2, 4);

        expect(widgetStore.maskRange).toEqual([4, 8]);
        expect(widgetStore.minX).toBe(90);
        expect(widgetStore.maxX).toBe(120);
        expect(widgetStore.minY).toBeUndefined();
        expect(widgetStore.maxY).toBeUndefined();
        expect(widgetStore.fittingStore.hasResult).toBe(false);

        widgetStore.setXYBounds(90, 120, 1, 9);
        widgetStore.fittingStore.setHasResult(true);
        widgetStore.setRestFrameRedshift(3);

        expect(widgetStore.minX).toBeUndefined();
        expect(widgetStore.maxX).toBeUndefined();
        expect(widgetStore.minY).toBeUndefined();
        expect(widgetStore.maxY).toBeUndefined();
        expect(widgetStore.fittingStore.hasResult).toBe(false);
    });

    test("renders native mask ranges in Jacobian-scaled display coordinates", () => {
        const {widgetStore} = createWidgetStore();
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);
        widgetStore.setYAxisRestFrameEnabled(true);
        widgetStore.setSelectedDisplayMaskRange(2, 4);
        widgetStore.setMomentRangeSelectingMode(MomentSelectingMode.MASK);

        expect(widgetStore.maskRange).toEqual([4, 8]);
        expect(widgetStore.displayMaskRange).toEqual([2, 4]);
        expect(widgetStore.selectedRange).toEqual({isHorizontal: true, center: 3, width: 2});
    });

    test("falls back to the native spectral coordinate for secondary rest-frame values", () => {
        const {widgetStore} = createWidgetStore(SpectralType.FREQ, SpectralUnit.GHZ, null, null);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);

        expect(widgetStore.effectiveSecondarySpectralType).toBe(SpectralType.FREQ);
        expect(widgetStore.effectiveSecondarySpectralUnit).toBe(SpectralUnit.GHZ);
        expect(widgetStore.plotData?.secondaryXData[0]).toEqual([20, 22]);
        expect(widgetStore.secondarySpectralUnitLabel).toBe("GHz (rest frame)");
    });

    test("keeps unsupported secondary coordinates observed and labels them explicitly", () => {
        const {widgetStore} = createWidgetStore(SpectralType.FREQ, SpectralUnit.GHZ, SpectralType.VRAD, SpectralUnit.KMS);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);

        expect(widgetStore.plotData?.secondaryXData[0]).toEqual([10, 11]);
        expect(widgetStore.secondarySpectralUnitLabel).toBe("km/s (observed)");
    });

    test("does not enable rest-frame conversion for velocity coordinates", () => {
        const {widgetStore} = createWidgetStore(SpectralType.VRAD, SpectralUnit.KMS);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);

        expect(widgetStore.isXAxisRestFrameSupported).toBe(false);
        expect(widgetStore.isXAxisRestFrameEnabled).toBe(false);
        expect(widgetStore.convertObservedXToDisplay(100)).toBe(100);
    });

    test("rejects invalid redshifts and persists the new X/Y rest-frame settings", () => {
        const {widgetStore} = createWidgetStore();
        runInAction(() => widgetStore.init({xAxisRestFrameEnabled: true, restFrameRedshift: 0.25, yAxisRestFrameEnabled: true}));

        expect(widgetStore.isXAxisRestFrameEnabled).toBe(true);
        expect(widgetStore.restFrameRedshift).toBe(0.25);
        expect(widgetStore.isYAxisRestFrameActive).toBe(true);
        expect(widgetStore.toConfig()).toEqual(expect.objectContaining({xAxisRestFrameEnabled: true, restFrameRedshift: 0.25, yAxisRestFrameEnabled: true}));

        widgetStore.setRestFrameRedshift(-1);
        expect(widgetStore.restFrameRedshift).toBe(0.25);
    });

    test("uses relativistic radial velocity as an alternate input while persisting only redshift", () => {
        const {widgetStore} = createWidgetStore();
        widgetStore.setRestFrameShiftMode(RestFrameShiftMode.RADIAL_VELOCITY);
        widgetStore.setRestFrameRadialVelocity(-300);

        expect(widgetStore.restFrameRedshift).toBeCloseTo(-0.0010001921, 10);
        expect(widgetStore.restFrameRadialVelocity).toBeCloseTo(-300, 10);
        expect(widgetStore.toConfig()).toEqual(expect.objectContaining({restFrameShiftMode: RestFrameShiftMode.RADIAL_VELOCITY, restFrameRedshift: widgetStore.restFrameRedshift}));
        expect(widgetStore.toConfig()).not.toHaveProperty("restFrameRadialVelocity");
    });

    test("restores the shift mode while keeping legacy redshift configs valid", () => {
        const {widgetStore} = createWidgetStore();
        runInAction(() => widgetStore.init({restFrameRedshift: -0.001, restFrameShiftMode: RestFrameShiftMode.RADIAL_VELOCITY}));

        expect(widgetStore.restFrameShiftMode).toBe(RestFrameShiftMode.RADIAL_VELOCITY);
        expect(widgetStore.restFrameRadialVelocity).toBeCloseTo(-299.942, 1);

        runInAction(() => widgetStore.init({restFrameRedshift: 0.25}));
        expect(widgetStore.restFrameShiftMode).toBe(RestFrameShiftMode.RADIAL_VELOCITY);
        expect(widgetStore.restFrameRedshift).toBe(0.25);
    });
});
