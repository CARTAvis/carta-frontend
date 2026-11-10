import {afterEach, describe, expect, jest, test} from "@jest/globals";
import {CARTA} from "carta-protobuf";
import * as GSL from "gsl_wrapper";
import {observable, runInAction} from "mobx";

import {MomentSelectingMode, MultiProfileCategory, Polarizations, PreferenceKeys, RegionId, RestFrameShiftMode, SmoothingType, SpectralType, SpectralUnit, VelocityConvention} from "../../../enums";
import {NONLINEAR_SPECTRAL_AXIS_UNSUPPORTED_MOMENTS} from "../../../models/MomentDefinition/MomentDefinition";
import {TelemetryService} from "../../../services";
import {SPEED_OF_LIGHT, SPEED_OF_LIGHT_KMS} from "../../../utilities/cosmology/cosmology";
import {AppStore, PreferenceStore} from "../..";

import {SpectralProfileWidgetStore} from "./SpectralProfileWidgetStore";

describe("SpectralProfileWidgetStore moments on a nonlinear spectral axis", () => {
    let widgetStore: SpectralProfileWidgetStore | undefined;

    const createWidgetStore = (isSpectralAxisNonlinear: boolean) => {
        const intensityConfig = {nativeIntensityUnit: "Jy/beam"};
        const frame = observable({
            channelInfo: {},
            channelValues: [100, 110],
            channelValueBounds: undefined,
            filename: "test.fits",
            frameInfo: {fileId: 7},
            findChannelIndexByValue: jest.fn((value: number) => value),
            getIntensityConfig: jest.fn(() => intensityConfig),
            getRegion: jest.fn(),
            hasStokes: false,
            headerUnit: "Jy/beam",
            intensityConfig,
            intensityUnit: "Jy/beam",
            isCoordChannel: false,
            isSpectralAxisNonlinear,
            isSpectralChannel: true,
            regionSet: {focusedRegion: undefined, regions: [], regionMap: new Map()},
            requiredPolarization: Polarizations.I,
            requiredUnit: "Jy/beam",
            resetMomentRequestState: jest.fn(),
            restFreqStore: {restFreqInHz: undefined},
            setIsRequestingMoments: jest.fn(),
            spectralType: SpectralType.FREQ,
            spectralTypeSecondary: SpectralType.FREQ,
            spectralUnit: SpectralUnit.GHZ,
            spectralUnitSecondary: SpectralUnit.GHZ,
            spectralUnitStr: SpectralUnit.GHZ,
            spectralAxis: {type: {code: SpectralType.FREQ, unit: SpectralUnit.GHZ}}
        });
        const appStore = {
            activeFrame: frame,
            focusedRegion: undefined,
            frameNames: [],
            frames: [frame],
            getFrame: jest.fn(() => frame),
            getFrameName: jest.fn(() => "test.fits"),
            requestMoment: jest.fn(),
            spatialAndSpectalMatchedFileIds: [],
            spectralProfiles: new Map()
        };
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue(appStore as any);
        jest.spyOn(TelemetryService.Instance, "addTelemetryEntry").mockResolvedValue(undefined);
        widgetStore = new SpectralProfileWidgetStore();
        return {frame, appStore, widgetStore};
    };

    afterEach(() => {
        widgetStore?.dispose();
        jest.restoreAllMocks();
    });

    test("keeps every moment available and selected on a linear spectral axis", () => {
        const {widgetStore} = createWidgetStore(false);
        widgetStore.selectMoment(CARTA.Moment.MEDIAN_COORDINATE);
        expect(widgetStore.unsupportedMoments).toEqual([]);
        expect(Array.from(widgetStore.selectedMoments)).toEqual([CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM, CARTA.Moment.MEDIAN_COORDINATE]);
    });

    test("starts without the default integrated moment on a nonlinear spectral axis", () => {
        const {widgetStore} = createWidgetStore(true);
        expect(widgetStore.unsupportedMoments).toEqual(NONLINEAR_SPECTRAL_AXIS_UNSUPPORTED_MOMENTS);
        expect(Array.from(widgetStore.selectedMoments)).toEqual([]);
        expect(widgetStore.isMomentSupported(CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM)).toBe(false);
        expect(widgetStore.isMomentSupported(CARTA.Moment.MAX_OF_THE_SPECTRUM)).toBe(true);
    });

    test("drops the coordinate-dependent moments when the frame changes to a nonlinear spectral axis and refuses to reselect them", () => {
        const {frame, widgetStore} = createWidgetStore(false);
        widgetStore.selectMoment(CARTA.Moment.MEDIAN_COORDINATE);
        widgetStore.selectMoment(CARTA.Moment.MAX_OF_THE_SPECTRUM);

        runInAction(() => {
            frame.isSpectralAxisNonlinear = true;
        });
        expect(Array.from(widgetStore.selectedMoments)).toEqual([CARTA.Moment.MAX_OF_THE_SPECTRUM]);

        widgetStore.selectMoment(CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM);
        widgetStore.selectMoment(CARTA.Moment.MIN_OF_THE_SPECTRUM);
        expect(Array.from(widgetStore.selectedMoments)).toEqual([CARTA.Moment.MAX_OF_THE_SPECTRUM, CARTA.Moment.MIN_OF_THE_SPECTRUM]);
    });

    test("never submits an unsupported moment", () => {
        const {frame, appStore, widgetStore} = createWidgetStore(true);
        runInAction(() => {
            widgetStore.selectedMoments = [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM, CARTA.Moment.MAX_OF_THE_SPECTRUM];
        });
        expect(widgetStore.supportedSelectedMoments).toEqual([CARTA.Moment.MAX_OF_THE_SPECTRUM]);
        widgetStore.requestMoment();
        expect(appStore.requestMoment).toHaveBeenCalledTimes(1);
        expect(appStore.requestMoment).toHaveBeenLastCalledWith(expect.objectContaining({moments: [CARTA.Moment.MAX_OF_THE_SPECTRUM]}), frame);

        runInAction(() => {
            widgetStore.selectedMoments = [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM];
        });
        expect(widgetStore.supportedSelectedMoments).toEqual([]);
        widgetStore.requestMoment();
        expect(appStore.requestMoment).toHaveBeenCalledTimes(1);
    });
});

/** A workspace that saves no image. Each region keeps the ID that it was saved with. */
const WORKSPACE_IDS = {
    imageIdOf: (): number | undefined => undefined,
    fileIdOf: (): number | undefined => undefined,
    regionIdOf: (_imageId: number | undefined, regionId: number): number | undefined => regionId,
    wasActiveImageRestored: () => true
};

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
            getIntensityConfig: jest.fn(() => intensityConfig),
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
            convertSettingWCSToFreqMHz: jest.fn((value: number, _type?: SpectralType, _unit?: SpectralUnit): number | undefined => value),
            convertFreqMHzToSettingWCS: jest.fn((value: number, _type?: SpectralType, _unit?: SpectralUnit): number | undefined => value),
            convertSettingWCSToFreqMHzArray: jest.fn((values: number[], _type?: SpectralType, _unit?: SpectralUnit): number[] | undefined => values),
            convertFreqMHzToSettingWCSArray: jest.fn((values: number[], _type?: SpectralType, _unit?: SpectralUnit): number[] | undefined => values)
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

    test("initializes shift input from preferences", () => {
        const preferenceStore = PreferenceStore.Instance;
        preferenceStore.preferences.set(PreferenceKeys.SILENT_SPECTRAL_PROFILER_REST_FRAME_SHIFT_MODE, RestFrameShiftMode.REDSHIFT);
        preferenceStore.preferences.set(PreferenceKeys.SILENT_SPECTRAL_PROFILER_REST_FRAME_VELOCITY_CONVENTION, VelocityConvention.OPTICAL);
        preferenceStore.preferences.set(PreferenceKeys.SILENT_IMAGE_VIEW_REST_FRAME_SHIFT_MODE, RestFrameShiftMode.RADIAL_VELOCITY);
        preferenceStore.preferences.set(PreferenceKeys.SILENT_IMAGE_VIEW_REST_FRAME_VELOCITY_CONVENTION, VelocityConvention.RELATIVISTIC);

        const {widgetStore} = createWidgetStore();

        expect(widgetStore.restFrameShiftMode).toBe(RestFrameShiftMode.REDSHIFT);
        expect(widgetStore.restFrameVelocityConvention).toBe(VelocityConvention.OPTICAL);

        preferenceStore.preferences.delete(PreferenceKeys.SILENT_SPECTRAL_PROFILER_REST_FRAME_SHIFT_MODE);
        preferenceStore.preferences.delete(PreferenceKeys.SILENT_SPECTRAL_PROFILER_REST_FRAME_VELOCITY_CONVENTION);
        preferenceStore.preferences.delete(PreferenceKeys.SILENT_IMAGE_VIEW_REST_FRAME_SHIFT_MODE);
        preferenceStore.preferences.delete(PreferenceKeys.SILENT_IMAGE_VIEW_REST_FRAME_VELOCITY_CONVENTION);
    });

    test("keeps plotted spectral lines in rest-frame coordinates when X-axis correction is active", () => {
        const {widgetStore} = createWidgetStore(SpectralType.FREQ);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);
        widgetStore.addSpectralLines([{species: "CO", value: 100, qn: "1-0"}]);

        expect(widgetStore.transformedSpectralLines).toEqual([{species: "CO", value: 100, qn: "1-0"}]);
    });

    test("reprojects the plot cursor when the rest-frame display transform changes", () => {
        const {widgetStore} = createWidgetStore(SpectralType.FREQ);
        widgetStore.setMouseMoveIntoLinePlots(true);
        widgetStore.setCursor(100);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);

        expect(widgetStore.cursorX).toBe(200);

        widgetStore.setRestFrameRedshift(2);
        expect(widgetStore.cursorX).toBe(300);

        widgetStore.setXAxisRestFrameEnabled(false);
        expect(widgetStore.cursorX).toBe(100);
    });

    test.each([
        [SpectralType.VRAD, SpectralUnit.KMS, SPEED_OF_LIGHT_KMS],
        [SpectralType.VRAD, SpectralUnit.MS, SPEED_OF_LIGHT],
        [SpectralType.VOPT, SpectralUnit.KMS, SPEED_OF_LIGHT_KMS],
        [SpectralType.VOPT, SpectralUnit.MS, SPEED_OF_LIGHT]
    ])("moves the systemic %s coordinate in %s to zero", (spectralType, spectralUnit, speedOfLight) => {
        const {widgetStore} = createWidgetStore(spectralType, spectralUnit);
        const redshift = 0.1;
        const systemicVelocity = spectralType === SpectralType.VRAD ? (speedOfLight * redshift) / (1 + redshift) : speedOfLight * redshift;

        widgetStore.setRestFrameRedshift(redshift);
        widgetStore.setXAxisRestFrameEnabled(true);

        expect(widgetStore.isXAxisRestFrameSupported).toBe(true);
        expect(widgetStore.isXAxisRestFrameActive).toBe(true);
        expect(widgetStore.convertObservedXToDisplay(systemicVelocity)).toBeCloseTo(0, 6);
        expect(widgetStore.convertDisplayXToObserved(0)).toBeCloseTo(systemicVelocity, 6);
    });

    test.each([SpectralType.VRAD, SpectralType.VOPT])("converts %s profile arrays and moment ranges in both directions", spectralType => {
        const {widgetStore} = createWidgetStore(spectralType, SpectralUnit.KMS);
        const redshift = 0.1;
        widgetStore.setRestFrameRedshift(redshift);
        widgetStore.setXAxisRestFrameEnabled(true);

        const restFrequencyFactor = 1 + redshift;
        const expectedDisplayValues =
            spectralType === SpectralType.VRAD ? [100, 110].map(value => value * restFrequencyFactor - SPEED_OF_LIGHT_KMS * redshift) : [100, 110].map(value => (value - SPEED_OF_LIGHT_KMS * redshift) / restFrequencyFactor);
        widgetStore.plotData?.data[0].forEach((point, index) => expect(point.x).toBeCloseTo(expectedDisplayValues[index], 10));

        widgetStore.setSelectedDisplayChannelRange(expectedDisplayValues[0], expectedDisplayValues[1]);
        expect(widgetStore.channelValueRange[0]).toBeCloseTo(100, 10);
        expect(widgetStore.channelValueRange[1]).toBeCloseTo(110, 10);
    });

    test("reprojects a velocity cursor without changing its observed coordinate", () => {
        const {widgetStore} = createWidgetStore(SpectralType.VRAD, SpectralUnit.KMS);
        widgetStore.setMouseMoveIntoLinePlots(true);
        widgetStore.setCursor(1000);
        widgetStore.setRestFrameRedshift(0.1);
        widgetStore.setXAxisRestFrameEnabled(true);

        expect(widgetStore.cursorX).toBeCloseTo(widgetStore.convertObservedXToDisplay(1000), 10);

        widgetStore.setRestFrameRedshift(0.2);
        expect(widgetStore.convertDisplayXToObserved(widgetStore.cursorX)).toBeCloseTo(1000, 10);
    });

    test("transforms a secondary velocity coordinate using its own convention", () => {
        const {widgetStore} = createWidgetStore(SpectralType.VRAD, SpectralUnit.KMS, SpectralType.VOPT, SpectralUnit.KMS);
        widgetStore.setRestFrameRedshift(0.1);
        widgetStore.setXAxisRestFrameEnabled(true);

        const expectedSecondaryValues = [10, 11].map(value => (value - SPEED_OF_LIGHT_KMS * 0.1) / 1.1);
        widgetStore.plotData?.secondaryXData[0].forEach((value, index) => expect(value).toBeCloseTo(expectedSecondaryValues[index], 10));
        expect(widgetStore.secondarySpectralUnitLabel).toBe("km/s (rest frame)");
    });

    test("keeps a spectral line that transforms to zero velocity", () => {
        const {frame, widgetStore} = createWidgetStore(SpectralType.VRAD, SpectralUnit.KMS);
        frame.convertFreqMHzToSettingWCS.mockReturnValue(0);
        widgetStore.setRestFrameRedshift(0.1);
        widgetStore.setXAxisRestFrameEnabled(true);
        widgetStore.addSpectralLines([{species: "HI", value: 1420.405751, qn: "1-0"}]);

        expect(widgetStore.transformedSpectralLines).toEqual([{species: "HI", value: 0, qn: "1-0"}]);
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
        expect(widgetStore.restFrameCorrectionExportComments).toEqual(["x-axis spectral coordinate: rest frame", "y-axis flux-density transformation: F_nu,rest = F_nu,observed / (1 + z)", "radial velocity (radio, km/s): 149896.229"]);
    });

    test("allows the Y-axis rest-frame density mode without enabling the X-axis mode", () => {
        const {widgetStore} = createWidgetStore(SpectralType.VRAD, SpectralUnit.KMS);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setYAxisRestFrameEnabled(true);

        expect(widgetStore.isXAxisRestFrameActive).toBe(false);
        expect(widgetStore.isYAxisRestFrameActive).toBe(true);
        expect(widgetStore.convertObservedXToDisplay(100)).toBe(100);
        expect(widgetStore.plotData?.data[0].map(point => point.y)).toEqual([2, 4]);
        expect(widgetStore.restFrameCorrectionExportComments).toEqual(["x-axis spectral coordinate: observed frame", "y-axis flux-density transformation: F_nu,rest = F_nu,observed / (1 + z)", "radial velocity (radio, km/s): 149896.229"]);
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

    test("transforms secondary radio velocity coordinates and labels them as rest frame", () => {
        const {widgetStore} = createWidgetStore(SpectralType.FREQ, SpectralUnit.GHZ, SpectralType.VRAD, SpectralUnit.KMS);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);

        expect(widgetStore.plotData?.secondaryXData[0]).toEqual([20 - SPEED_OF_LIGHT_KMS, 22 - SPEED_OF_LIGHT_KMS]);
        expect(widgetStore.secondarySpectralUnitLabel).toBe("km/s (rest frame)");
    });

    test("defaults shift input to radio radial velocity", () => {
        const {widgetStore} = createWidgetStore();

        expect(widgetStore.restFrameShiftMode).toBe(RestFrameShiftMode.RADIAL_VELOCITY);
        expect(widgetStore.restFrameVelocityConvention).toBe(VelocityConvention.RADIO);
        expect(widgetStore.restFrameRadialVelocity).toBe(0);
    });

    test("enables rest-frame conversion for velocity coordinates", () => {
        const {widgetStore} = createWidgetStore(SpectralType.VRAD, SpectralUnit.KMS);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);

        expect(widgetStore.isXAxisRestFrameSupported).toBe(true);
        expect(widgetStore.isXAxisRestFrameEnabled).toBe(true);
        expect(widgetStore.convertObservedXToDisplay(100)).toBe(200 - SPEED_OF_LIGHT_KMS);
    });

    test("rejects invalid redshifts and persists the new X/Y rest-frame settings", () => {
        const {widgetStore} = createWidgetStore();
        runInAction(() => widgetStore.applyWorkspaceBinding({xAxisRestFrameEnabled: true, restFrameRedshift: 0.25, yAxisRestFrameEnabled: true}, WORKSPACE_IDS));

        expect(widgetStore.isXAxisRestFrameEnabled).toBe(true);
        expect(widgetStore.restFrameRedshift).toBe(0.25);
        expect(widgetStore.isYAxisRestFrameActive).toBe(true);
        expect(widgetStore.toWorkspaceConfig(WORKSPACE_IDS)).toEqual(expect.objectContaining({xAxisRestFrameEnabled: true, restFrameRedshift: 0.25, yAxisRestFrameEnabled: true}));
        expect(widgetStore.toConfig()).not.toHaveProperty("restFrameRedshift");

        widgetStore.setRestFrameRedshift(-1);
        expect(widgetStore.restFrameRedshift).toBe(0.25);
    });

    test("uses relativistic radial velocity as an alternate input while persisting only redshift", () => {
        const {widgetStore} = createWidgetStore();
        widgetStore.setRestFrameVelocityConvention(VelocityConvention.RELATIVISTIC);
        widgetStore.setRestFrameRadialVelocity(-300);

        expect(widgetStore.restFrameRedshift).toBeCloseTo(-0.0010001921, 10);
        expect(widgetStore.restFrameRadialVelocity).toBeCloseTo(-300, 10);
        expect(widgetStore.toConfig()).toEqual(expect.objectContaining({restFrameShiftMode: RestFrameShiftMode.RADIAL_VELOCITY}));
        expect(widgetStore.toWorkspaceConfig(WORKSPACE_IDS)).toEqual(expect.objectContaining({restFrameRedshift: widgetStore.restFrameRedshift}));
        expect(widgetStore.toConfig()).not.toHaveProperty("restFrameRadialVelocity");
    });

    test.each([
        [VelocityConvention.RADIO, 300, 300 / (299792.458 - 300)],
        [VelocityConvention.OPTICAL, 300, 300 / 299792.458]
    ])("uses %s velocity convention while persisting only redshift", (convention, velocityKms, expectedRedshift) => {
        const {widgetStore} = createWidgetStore();
        widgetStore.setRestFrameShiftMode(RestFrameShiftMode.RADIAL_VELOCITY);
        widgetStore.setRestFrameVelocityConvention(convention);
        widgetStore.setRestFrameRadialVelocity(velocityKms);

        expect(widgetStore.restFrameRedshift).toBeCloseTo(expectedRedshift, 10);
        expect(widgetStore.restFrameRadialVelocity).toBeCloseTo(velocityKms, 10);
        expect(widgetStore.toConfig()).toEqual(expect.objectContaining({restFrameShiftMode: RestFrameShiftMode.RADIAL_VELOCITY, restFrameVelocityConvention: convention}));
        expect(widgetStore.toWorkspaceConfig(WORKSPACE_IDS)).toEqual(expect.objectContaining({restFrameRedshift: widgetStore.restFrameRedshift}));
        expect(widgetStore.toConfig()).not.toHaveProperty("restFrameRadialVelocity");
    });

    test("takes the redshift from a workspace, not from a layout", () => {
        const {widgetStore} = createWidgetStore();

        runInAction(() => widgetStore.applyConfig({restFrameRedshift: 0.25, xAxisRestFrameEnabled: true} as never));

        expect(widgetStore.restFrameRedshift).toBe(0);
        expect(widgetStore.isXAxisRestFrameEnabled).toBe(false);
    });

    test("shows the regions' profiles it was saved showing together, in the colours they were shown in", () => {
        const {frame, widgetStore} = createWidgetStore();
        const region = (regionId: number) => ({regionId, isTemporary: false, isClosedRegion: true, nameString: `region ${regionId}`});
        frame.regionSet.regions = [region(15), region(16)] as never;
        const config = {
            profileCategory: MultiProfileCategory.REGION,
            regions: [{regionId: 5}],
            regionIds: [5, 6],
            statsTypes: [CARTA.StatsType.Mean],
            coordinates: ["z"],
            profileColors: [
                {key: 5, color: "#ff0000"},
                {key: 6, color: "#00ff00"}
            ]
        };
        const ids = {...WORKSPACE_IDS, regionIdOf: (_imageId: number | undefined, regionId: number): number | undefined => regionId + 10};

        runInAction(() => widgetStore.applyWorkspaceBinding(config, ids));
        runInAction(() => widgetStore.applyWorkspaceConfig(config, ids));

        expect(widgetStore.profileSelectionStore.activeProfileCategory).toBe(MultiProfileCategory.REGION);
        expect(widgetStore.profileSelectionStore.selectedRegionIds).toEqual([15, 16]);
        expect([widgetStore.getProfileColor(15), widgetStore.getProfileColor(16)]).toEqual(["#ff0000", "#00ff00"]);
    });

    test("keeps the Y range it was saved at in the rest frame, though showing the rest frame resets the Y range", () => {
        const {widgetStore} = createWidgetStore();
        const config = {restFrameRedshift: 1, yAxisRestFrameEnabled: true, minY: 1, maxY: 2};

        runInAction(() => widgetStore.applyWorkspaceBinding(config, WORKSPACE_IDS));
        runInAction(() => widgetStore.applyWorkspaceConfig(config, WORKSPACE_IDS));
        runInAction(() => widgetStore.applyWorkspaceView(config, WORKSPACE_IDS));

        expect(widgetStore.isYAxisRestFrameActive).toBe(true);
        expect([widgetStore.minY, widgetStore.maxY]).toEqual([1, 2]);
    });

    test("is not zoomed to the range of profiles it could not show again", () => {
        const {widgetStore} = createWidgetStore();
        const config = {regionIds: [5], minX: 100, maxX: 110};

        runInAction(() => widgetStore.applyWorkspaceBinding(config, WORKSPACE_IDS));
        const problems = runInAction(() => widgetStore.applyWorkspaceConfig(config, {...WORKSPACE_IDS, regionIdOf: () => undefined}));
        runInAction(() => widgetStore.applyWorkspaceView(config, WORKSPACE_IDS));

        expect(problems).toEqual(["some of the regions whose profiles it showed were not restored"]);
        expect(widgetStore.minX).toBeUndefined();
    });

    test("is zoomed back to the range it was saved at, though pointing it at its region again clears the range", () => {
        const {widgetStore} = createWidgetStore();
        const config = {regions: [{regionId: RegionId.ACTIVE}], minX: 100, maxX: 110, minY: 1, maxY: 2};

        runInAction(() => widgetStore.applyWorkspaceBinding(config, WORKSPACE_IDS));
        runInAction(() => widgetStore.applyWorkspaceConfig(config, WORKSPACE_IDS));
        runInAction(() => widgetStore.applyWorkspaceView(config, WORKSPACE_IDS));

        expect([widgetStore.minX, widgetStore.maxX, widgetStore.minY, widgetStore.maxY]).toEqual([100, 110, 1, 2]);
        expect(widgetStore.toWorkspaceConfig({imageIdOf: () => 1})).toEqual(expect.objectContaining({minX: 100, maxX: 110, minY: 1, maxY: 2}));
    });

    test("saves the spectral lines that a query plotted on it, and plots them again, leaving out a line that is not valid", () => {
        const {widgetStore} = createWidgetStore();
        runInAction(() => widgetStore.addSpectralLines([{species: "CO", value: 115271.2, qn: "1-0"}]));

        const config = widgetStore.toWorkspaceConfig(WORKSPACE_IDS);
        expect(config.spectralLines).toEqual([{species: "CO", value: 115271.2, qn: "1-0"}]);

        const restored = createWidgetStore().widgetStore;
        runInAction(() => restored.applyWorkspaceConfig({spectralLines: [...(config.spectralLines ?? []), {species: "HCN", value: "x", qn: "1-0"}]} as never, WORKSPACE_IDS));
        expect(restored.toWorkspaceConfig(WORKSPACE_IDS).spectralLines).toEqual(config.spectralLines);
    });

    test("names the images whose profiles it shows together, and their colours, by workspace image ID", () => {
        const {widgetStore} = createWidgetStore();
        runInAction(() => {
            widgetStore.profileSelectionStore.applyWorkspaceSelection({category: MultiProfileCategory.IMAGE, fileIds: [7, 8]});
            widgetStore.setProfileColor(7, "#ff0000");
            widgetStore.setProfileColor(8, "#00ff00");
        });

        const config = widgetStore.toWorkspaceConfig({imageIdOf: fileId => (fileId === 7 ? 2 : undefined)});

        expect(config).toEqual(expect.objectContaining({profileCategory: MultiProfileCategory.IMAGE, imageIds: [2], profileColors: [{key: 2, color: "#ff0000"}]}));
    });

    describe("when the fitting is cleared", () => {
        /** Creates a widget whose profile arrives in parts. The region of the profile can change its shape, and the image has Stokes I and Q. */
        const createStreamingWidgetStore = () => {
            const {frame} = createWidgetStore();
            const data = observable.box<{progress: number; values: Float32Array}>({progress: 0.5, values: new Float32Array([4])}, {deep: false});
            const region = observable({controlPoints: [{x: 1, y: 1}], rotation: 0});
            frame.getRegion.mockReturnValue(region as never);
            const stokes = observable.box(0);
            Object.defineProperty(frame, "requiredStokes", {get: () => stokes.get()});
            Object.assign(frame, {hasStokes: true, polarizationInfo: ["Stokes I", "Stokes Q"]});
            (AppStore.Instance.spectralProfiles.get(7)!.get(0)!.getProfile as jest.Mock).mockImplementation(() => data.get());
            const store = new SpectralProfileWidgetStore();
            runInAction(() => {
                store.fittingStore.setYIntercept(0.5);
                store.fittingStore.components[0].setCenter(105);
            });
            return {store, data, region, stokes};
        };

        test("keeps the guesses while more data of the same profile arrives, and waits for all of it before Auto detect and Fit", () => {
            const {store, data} = createStreamingWidgetStore();
            expect(store.isFittingProfileComplete).toBe(false);

            runInAction(() => data.set({progress: 1, values: new Float32Array([4, 8])}));

            expect(store.isFittingProfileComplete).toBe(true);
            expect([store.fittingStore.yIntercept, store.fittingStore.components[0].center]).toEqual([0.5, 105]);
            store.dispose();
        });

        test("clears the guesses when the region of the profile moves", () => {
            const {store, region} = createStreamingWidgetStore();

            runInAction(() => (region.controlPoints[0] = {x: 2, y: 1}));

            expect([store.fittingStore.yIntercept, store.fittingStore.components[0].center]).toEqual([0, 0]);
            store.dispose();
        });

        test("clears the guesses when the Stokes of the image changes, as the profile follows it", () => {
            const {store, stokes} = createStreamingWidgetStore();

            runInAction(() => stokes.set(1));

            expect(store.fittingStore.yIntercept).toBe(0);
            store.dispose();
        });

        test("keeps the guesses of a profile in a fixed Stokes when the Stokes of the image changes", () => {
            const {store, stokes} = createStreamingWidgetStore();
            runInAction(() => store.profileSelectionStore.applyWorkspaceSelection({coordinates: ["Iz"]}));
            runInAction(() => store.fittingStore.setYIntercept(0.5));

            runInAction(() => stokes.set(1));

            expect(store.fittingStore.yIntercept).toBe(0.5);
            store.dispose();
        });

        test("clears the guesses when the smoothing type changes", () => {
            const {store} = createStreamingWidgetStore();

            runInAction(() => store.smoothingStore.setType(SmoothingType.BOXCAR));

            expect(store.fittingStore.yIntercept).toBe(0);
            store.dispose();
        });
    });

    describe("fitting and moment settings in a workspace", () => {
        /** Creates a widget on a frame in Frequency (GHz), LSRK, from 100 to 110. Its profile is in Jy/beam. */
        const createFittingWidgetStore = () => {
            const created = createWidgetStore();
            Object.assign(created.frame, {spectralCoordinate: "Frequency (GHz)", spectralSystem: "LSRK", channelValueBounds: {min: 100, max: 110}});
            return created;
        };
        const savesTheImage = {imageIdOf: (): number | undefined => 1};

        const savedFitting = {
            function: 1,
            continuum: 1,
            yIntercept: 0.5,
            slope: 0.1,
            yInterceptLocked: true,
            slopeLocked: false,
            components: [
                {center: 100, amp: 2, fwhm: 3, centerLocked: true, ampLocked: false, fwhmLocked: false},
                {center: 105, amp: 1, fwhm: 2, centerLocked: false, ampLocked: true, fwhmLocked: true}
            ],
            autoDetectWithContinuum: true,
            autoDetectWithFitting: true,
            residualVisible: false,
            xUnit: "Frequency (GHz), LSRK",
            yUnit: "Jy/beam"
        };

        /** A config that points the widget at region 5. Region 5 comes back with the same ID. */
        const onRegion5 = {regions: [{regionId: 5}]};

        const savedMoments = {
            moments: [CARTA.Moment.MEAN_OF_THE_SPECTRUM, CARTA.Moment.MAX_OF_THE_SPECTRUM],
            regionId: 5,
            channelRange: [101, 108] as [number, number],
            channelUnit: "Frequency (GHz), LSRK",
            mask: CARTA.MomentMask.Include,
            maskRange: [0.2, 0.8] as [number, number],
            maskUnit: "Jy/beam"
        };

        const restore = (widgetStore: SpectralProfileWidgetStore, config: object, ids = WORKSPACE_IDS) => {
            runInAction(() => widgetStore.applyWorkspaceBinding(config, ids));
            runInAction(() => widgetStore.applyWorkspaceConfig(config, ids));
            return runInAction(() => widgetStore.applyWorkspaceView(config, ids));
        };

        test("saves the fitting guesses with the units of the axes, a guess that is not finite as 0, and leaves out a fit result that the profile does not have", () => {
            const {widgetStore} = createFittingWidgetStore();
            const fitting = widgetStore.fittingStore;
            runInAction(() => {
                fitting.setFunction(1);
                fitting.setContinuum(0);
                fitting.setYIntercept(0.5);
                fitting.setSlope(Number.NaN);
                fitting.setLockedYIntercept(true);
                fitting.components[0].setCenter(100);
                fitting.components[0].setLockedFwhm(true);
                fitting.setResultLog("fitted before the reset");
            });

            const saved = widgetStore.toWorkspaceConfig(savesTheImage).fitting;

            expect(saved).toEqual({
                function: 1,
                continuum: 0,
                yIntercept: 0.5,
                slope: 0,
                yInterceptLocked: true,
                slopeLocked: false,
                components: [{center: 100, amp: 0, fwhm: 0, centerLocked: false, ampLocked: false, fwhmLocked: true}],
                autoDetectWithContinuum: false,
                autoDetectWithFitting: false,
                residualVisible: true,
                xUnit: "Frequency (GHz), LSRK",
                yUnit: "Jy/beam"
            });
        });

        test("saves the fit result, with a value that is not finite as null", () => {
            const {widgetStore} = createFittingWidgetStore();
            const fitting = widgetStore.fittingStore;
            runInAction(() => {
                fitting.components[0].setCenter(100);
                fitting.setResultYIntercept(0.4);
                fitting.setResultYInterceptError(0.01);
                fitting.setResultSlope(0);
                fitting.setResultSlopeError(Number.NaN);
                const component = fitting.components[0];
                component.setResultCenter(101);
                component.setResultCenterError(0.1);
                component.setResultAmp(2);
                component.setResultAmpError(0.2);
                component.setResultFwhm(3);
                component.setResultFwhmError(Number.NaN);
                component.setResultIntegral(6.4);
                component.setResultIntegralError(0.6);
                fitting.setResultLog("fitted");
                fitting.setHasResult(true);
            });

            const saved = widgetStore.toWorkspaceConfig(savesTheImage).fitting;

            expect(saved?.result).toEqual({
                yIntercept: 0.4,
                yInterceptError: 0.01,
                slope: 0,
                slopeError: null,
                components: [{center: 101, centerError: 0.1, amp: 2, ampError: 0.2, fwhm: 3, fwhmError: null, integral: 6.4, integralError: 0.6}],
                log: "fitted"
            });
        });

        describe("a saved fit result", () => {
            const savedResult = {
                yIntercept: 0.5,
                yInterceptError: 0.01,
                slope: 0.1,
                slopeError: null,
                components: [
                    {center: 100, centerError: 0.1, amp: 2, ampError: 0.2, fwhm: 3, fwhmError: null, integral: 6.4, integralError: 0.6},
                    {center: 105, centerError: 0.2, amp: 1, ampError: 0.1, fwhm: 2, fwhmError: 0.3, integral: 2.1, integralError: 0.2}
                ],
                log: "fitted"
            };

            /** Gives region 5 a profile that arrives in parts, from 100 to 110 GHz. */
            const streamRegion5 = () => {
                const data = observable.box<{progress: number; values: Float32Array}>({progress: 0.5, values: new Float32Array([4])}, {deep: false});
                AppStore.Instance.spectralProfiles.get(7)!.set(5, {getProfile: jest.fn(() => data.get())} as never);
                return data;
            };

            test("is shown when the whole profile has arrived, with the residual computed from the profile", () => {
                const {widgetStore} = createFittingWidgetStore();
                const data = streamRegion5();

                const problems = restore(widgetStore, {...onRegion5, fitting: {...savedFitting, result: savedResult}});

                const fitting = widgetStore.fittingStore;
                expect(problems).toEqual([]);
                expect(fitting.hasResult).toBe(false);

                runInAction(() => data.set({progress: 1, values: new Float32Array([4, 8])}));

                expect(fitting.hasResult).toBe(true);
                expect([fitting.resultYIntercept, fitting.resultYInterceptError, fitting.resultSlope, fitting.resultSlopeError]).toEqual([0.5, 0.01, 0.1, Number.NaN]);
                expect(fitting.components.map(component => [component.resultCenter, component.resultAmp, component.resultFwhm, component.resultFwhmError, component.resultIntegral])).toEqual([
                    [100, 2, 3, Number.NaN, 6.4],
                    [105, 1, 2, 0.3, 2.1]
                ]);
                expect(fitting.resultLog).toBe("fitted");
                // The saved function is Lorentzian. At 100 GHz the first component is at its peak, 2,
                // and the second adds 1 * 1 / (25 + 1). The continuum adds 0.5 + 0.1 * 100.
                const model = 2 + 1 / 26 + 0.5 + 10;
                expect(fitting.residualPoint2DArray[0].x).toBe(100);
                expect(fitting.residualPoint2DArray[0].y).toBeCloseTo(4 - model, 10);
                expect(fitting.modelPoint2DArray[0].y).toBeCloseTo(model, 10);
            });

            test("is not shown when the guesses are 0, and the report says so", () => {
                const {widgetStore} = createFittingWidgetStore();
                streamRegion5();
                const config = {...onRegion5, fitting: {...savedFitting, xUnit: "Velocity (km/s), LSRK", result: savedResult}};

                const problems = restore(widgetStore, config);

                expect(problems).toEqual([
                    'the fitting guesses were made in "Velocity (km/s), LSRK" on the x axis and "Jy/beam" on the y axis, but the profile now shows "Frequency (GHz), LSRK" on the x axis and "Jy/beam" on the y axis. The guesses are 0, and the fit result is not shown'
                ]);
                expect([widgetStore.fittingStore.hasResult, widgetStore.fittingStore.isWaitingForWorkspaceResult]).toEqual([false, false]);
            });

            test("is not shown when it does not have one entry for each component", () => {
                const {widgetStore} = createFittingWidgetStore();
                const data = streamRegion5();

                restore(widgetStore, {...onRegion5, fitting: {...savedFitting, result: {...savedResult, components: savedResult.components.slice(1)}}});
                runInAction(() => data.set({progress: 1, values: new Float32Array([4, 8])}));

                expect(widgetStore.fittingStore.hasResult).toBe(false);
            });

            test("is dropped when the widget shows another profile before the profile has arrived", () => {
                const {widgetStore} = createFittingWidgetStore();
                const data = streamRegion5();
                restore(widgetStore, {...onRegion5, fitting: {...savedFitting, result: savedResult}});

                runInAction(() => widgetStore.smoothingStore.setType(SmoothingType.BOXCAR));
                runInAction(() => data.set({progress: 1, values: new Float32Array([4, 8])}));

                expect(widgetStore.fittingStore.hasResult).toBe(false);
            });
        });

        test("names the rest frame in the units of the fitting guesses, and not in the units of the moment ranges", () => {
            const {widgetStore} = createFittingWidgetStore();
            runInAction(() => {
                widgetStore.setRestFrameRedshift(1);
                widgetStore.setXAxisRestFrameEnabled(true);
                widgetStore.setYAxisRestFrameEnabled(true);
                widgetStore.setSelectedChannelRange(101, 108);
                widgetStore.setSelectedMaskRange(0.2, 0.8);
            });

            const config = widgetStore.toWorkspaceConfig(savesTheImage);

            expect([config.fitting?.xUnit, config.fitting?.yUnit]).toEqual(["Frequency (GHz), LSRK, rest frame", "Jy/beam, rest frame"]);
            expect([config.moments?.channelUnit, config.moments?.maskUnit]).toEqual(["Frequency (GHz), LSRK", "Jy/beam"]);
        });

        test("leaves out the fitting and moment settings when the workspace does not save the image", () => {
            const {widgetStore} = createFittingWidgetStore();

            const config = widgetStore.toWorkspaceConfig(WORKSPACE_IDS);

            expect(config).not.toHaveProperty("fitting");
            expect(config).not.toHaveProperty("moments");
        });

        test("restores the fitting guesses, though showing the rest frame resets them", () => {
            const {widgetStore} = createFittingWidgetStore();
            const config = {...onRegion5, restFrameRedshift: 1, yAxisRestFrameEnabled: true, fitting: {...savedFitting, yUnit: "Jy/beam, rest frame"}};

            const problems = restore(widgetStore, config);

            const fitting = widgetStore.fittingStore;
            expect(problems).toEqual([]);
            expect([fitting.function, fitting.continuum, fitting.yIntercept, fitting.slope, fitting.isLockedYIntercept, fitting.isLockedSlope]).toEqual([1, 1, 0.5, 0.1, true, false]);
            expect(fitting.components.map(component => [component.center, component.amp, component.fwhm, component.isLockedCenter, component.isLockedAmp, component.isLockedFwhm])).toEqual([
                [100, 2, 3, true, false, false],
                [105, 1, 2, false, true, true]
            ]);
            expect([fitting.isAutoDetectWithCont, fitting.isAutoDetectWithFitting, fitting.isResidualEnabled, fitting.hasResult]).toEqual([true, true, false, false]);
        });

        test("sets the guesses to 0 and says so when the profile shows other units, and applies the other fitting settings", () => {
            const {widgetStore} = createFittingWidgetStore();
            const config = {...onRegion5, fitting: {...savedFitting, xUnit: "Velocity (km/s), LSRK"}};

            const problems = restore(widgetStore, config);

            const fitting = widgetStore.fittingStore;
            expect(problems).toEqual([
                'the fitting guesses were made in "Velocity (km/s), LSRK" on the x axis and "Jy/beam" on the y axis, but the profile now shows "Frequency (GHz), LSRK" on the x axis and "Jy/beam" on the y axis. The guesses are 0'
            ]);
            expect([fitting.function, fitting.continuum, fitting.yIntercept, fitting.slope, fitting.isLockedYIntercept, fitting.isResidualEnabled]).toEqual([1, 1, 0, 0, true, false]);
            expect(fitting.components.map(component => [component.center, component.amp, component.fwhm, component.isLockedCenter, component.isLockedFwhm])).toEqual([
                [0, 0, 0, true, false],
                [0, 0, 0, false, true]
            ]);
        });

        test("does not report fitting guesses in other units when every guess is 0", () => {
            const {widgetStore} = createFittingWidgetStore();
            const guessesOfZero = {yIntercept: 0, slope: 0, components: [{center: 0, amp: 0, fwhm: 0, centerLocked: false, ampLocked: false, fwhmLocked: false}]};
            const config = {fitting: {...savedFitting, ...guessesOfZero, xUnit: "Channel"}};

            expect(restore(widgetStore, config)).toEqual([]);
            expect(widgetStore.fittingStore.function).toBe(1);
        });

        test("keeps the default of each saved fitting value that is not valid", () => {
            const {widgetStore} = createFittingWidgetStore();
            const config = {...onRegion5, fitting: {...savedFitting, function: "LORENTZIAN", continuum: "FIRST_ORDER", yIntercept: Number.NaN, components: [{center: "100", amp: 2}], residualVisible: "no"}};

            restore(widgetStore, config);

            const fitting = widgetStore.fittingStore;
            expect([fitting.function, fitting.continuum, fitting.yIntercept, fitting.isResidualEnabled]).toEqual([0, -1, 0, true]);
            expect(fitting.components.map(component => [component.center, component.amp, component.fwhm])).toEqual([[0, 2, 0]]);
        });

        test("uses the default function when the saved function is not valid, though the widget used another function", () => {
            const {widgetStore} = createFittingWidgetStore();
            runInAction(() => widgetStore.fittingStore.setFunction(1));

            restore(widgetStore, {...onRegion5, fitting: {...savedFitting, function: 7}});

            expect(widgetStore.fittingStore.function).toBe(0);
        });

        test("sets the guesses to 0 and says so when the region of the fitted profile was not restored", () => {
            const {widgetStore} = createFittingWidgetStore();
            const config = {regions: [{regionId: 5}], fitting: savedFitting};

            const problems = restore(widgetStore, config, {...WORKSPACE_IDS, regionIdOf: () => undefined});

            expect(problems).toEqual(["the profile that its fitting guesses were made for was not restored, so the guesses are 0"]);
            expect([widgetStore.fittingStore.function, widgetStore.fittingStore.yIntercept, widgetStore.fittingStore.components[0].center]).toEqual([1, 0, 0]);
        });

        test("sets the guesses of a profile at the cursor to 0, as the cursor position is not saved", () => {
            const {widgetStore} = createFittingWidgetStore();

            const problems = restore(widgetStore, {fitting: savedFitting});

            expect(problems).toEqual(["its fitting guesses were made for the profile at the cursor, whose position is not saved, so the guesses are 0"]);
            expect([widgetStore.fittingStore.function, widgetStore.fittingStore.yIntercept]).toEqual([1, 0]);
        });

        test("does not apply the settings of an image that was not restored", () => {
            const {widgetStore} = createFittingWidgetStore();
            const config = {imageId: 4, fitting: savedFitting, moments: savedMoments};

            const problems = restore(widgetStore, config);

            expect(problems).toEqual([]);
            expect(widgetStore.fittingStore.function).toBe(0);
            expect(widgetStore.selectedMoments).toEqual([CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM]);
        });

        test("saves the moment generator settings, with the region by its ID", () => {
            const {widgetStore} = createFittingWidgetStore();
            runInAction(() => {
                widgetStore.selectMoment(CARTA.Moment.MAX_OF_THE_SPECTRUM);
                widgetStore.selectMomentRegion(5);
                widgetStore.setMomentMask(CARTA.MomentMask.Exclude);
                widgetStore.setSelectedChannelRange(101, 108);
                widgetStore.setSelectedMaskRange(0.2, 0.8);
            });

            expect(widgetStore.toWorkspaceConfig(savesTheImage).moments).toEqual({
                moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM, CARTA.Moment.MAX_OF_THE_SPECTRUM],
                regionId: 5,
                channelRange: [101, 108],
                channelUnit: "Frequency (GHz), LSRK",
                mask: CARTA.MomentMask.Exclude,
                maskRange: [0.2, 0.8],
                maskUnit: "Jy/beam"
            });
        });

        test("leaves out a moment range that is the default, so a restore in other units does not report it", () => {
            const {widgetStore} = createFittingWidgetStore();
            runInAction(() => {
                widgetStore.setSelectedChannelRange(100, 110);
                widgetStore.setSelectedMaskRange(0, 1);
            });

            const moments = widgetStore.toWorkspaceConfig(savesTheImage).moments;

            expect(moments).toEqual({moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM], regionId: RegionId.IMAGE, mask: CARTA.MomentMask.None});
            expect(restore(createFittingWidgetStore().widgetStore, {moments})).toEqual([]);
        });

        test("restores the moments, the region they are made from, the mask and the ranges", () => {
            const {widgetStore} = createFittingWidgetStore();
            const regionIdOf = jest.fn((_imageId: number | undefined, regionId: number): number | undefined => regionId + 10);
            const ids = {...WORKSPACE_IDS, regionIdOf};

            const problems = restore(widgetStore, {moments: savedMoments}, ids);

            expect(problems).toEqual([]);
            // The widget follows the active image. So the region is looked up on the image that was in front.
            expect(regionIdOf).toHaveBeenCalledWith(undefined, 5);
            expect(widgetStore.selectedMoments).toEqual([CARTA.Moment.MEAN_OF_THE_SPECTRUM, CARTA.Moment.MAX_OF_THE_SPECTRUM]);
            expect(widgetStore.momentRegionId).toBe(15);
            expect(widgetStore.momentMask).toBe(CARTA.MomentMask.Include);
            expect([[...widgetStore.channelValueRange], [...widgetStore.maskRange]]).toEqual([
                [101, 108],
                [0.2, 0.8]
            ]);
        });

        test("says what it could not restore of the moment settings, and keeps the rest", () => {
            const {widgetStore} = createFittingWidgetStore();
            const ids = {...WORKSPACE_IDS, regionIdOf: (): number | undefined => undefined};
            const moments = {...savedMoments, channelUnit: "Channel", maskUnit: "K"};
            runInAction(() => widgetStore.selectMomentRegion(RegionId.ACTIVE));

            const problems = restore(widgetStore, {moments}, ids);

            expect(problems).toEqual([
                "the region that its moments were made from was not restored, so the moments are made from the whole image",
                'the spectral range of its moments was in "Channel", but the profile now shows "Frequency (GHz), LSRK". The range covers the whole spectral axis',
                'the mask range of its moments was in "K", but the profile now shows "Jy/beam". The mask range keeps its default'
            ]);
            expect(widgetStore.selectedMoments).toEqual(savedMoments.moments);
            expect(widgetStore.momentMask).toBe(CARTA.MomentMask.Include);
            expect(widgetStore.momentRegionId).toBe(RegionId.IMAGE);
            expect([...widgetStore.maskRange]).toEqual([0, 1]);
        });
    });

    test("keeps the previous canonical redshift when either input is invalid", () => {
        const {widgetStore} = createWidgetStore();
        widgetStore.setRestFrameRedshift(0.25);

        widgetStore.setRestFrameRadialVelocity(299792.458);
        expect(widgetStore.restFrameRedshift).toBe(0.25);

        widgetStore.setRestFrameRedshift(-1);
        expect(widgetStore.restFrameRedshift).toBe(0.25);
    });

    test("temporarily uses zero redshift without clearing the selected correction toggles", () => {
        const {widgetStore} = createWidgetStore();
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setXAxisRestFrameEnabled(true);

        expect(widgetStore.isXAxisRestFrameEnabled).toBe(true);
        expect(widgetStore.isXAxisRestFrameActive).toBe(true);
        expect(widgetStore.redshiftFactor).toBe(2);

        widgetStore.setRestFrameShiftInputValid(false);

        expect(widgetStore.isXAxisRestFrameEnabled).toBe(true);
        expect(widgetStore.isXAxisRestFrameActive).toBe(false);
        expect(widgetStore.effectiveRestFrameRedshift).toBe(0);
        expect(widgetStore.redshiftFactor).toBe(1);
        expect(widgetStore.convertObservedXToDisplay(100)).toBe(100);

        widgetStore.setRestFrameShiftInputValid(true);
        expect(widgetStore.isXAxisRestFrameActive).toBe(true);
        expect(widgetStore.redshiftFactor).toBe(2);
    });

    test("restores the shift mode while keeping legacy redshift configs valid", () => {
        const {widgetStore} = createWidgetStore();
        runInAction(() => {
            widgetStore.applyConfig({restFrameShiftMode: RestFrameShiftMode.RADIAL_VELOCITY});
            widgetStore.applyWorkspaceBinding({restFrameRedshift: -0.001}, WORKSPACE_IDS);
        });

        expect(widgetStore.restFrameShiftMode).toBe(RestFrameShiftMode.RADIAL_VELOCITY);
        expect(widgetStore.restFrameRadialVelocity).toBeCloseTo(-300.093, 1);

        runInAction(() => widgetStore.applyWorkspaceBinding({restFrameRedshift: 0.25}, WORKSPACE_IDS));
        expect(widgetStore.restFrameShiftMode).toBe(RestFrameShiftMode.RADIAL_VELOCITY);
        expect(widgetStore.restFrameRedshift).toBe(0.25);
    });

    test("restores the velocity convention while defaulting legacy configs to radio", () => {
        const {widgetStore} = createWidgetStore();
        runInAction(() => widgetStore.applyConfig({restFrameShiftMode: RestFrameShiftMode.RADIAL_VELOCITY, restFrameVelocityConvention: VelocityConvention.OPTICAL}));

        expect(widgetStore.restFrameVelocityConvention).toBe(VelocityConvention.OPTICAL);
        expect(widgetStore.restFrameRadialVelocity).toBe(0);

        const {widgetStore: legacyWidgetStore} = createWidgetStore();
        runInAction(() => legacyWidgetStore.applyWorkspaceBinding({restFrameRedshift: 0.25}, WORKSPACE_IDS));
        expect(legacyWidgetStore.restFrameVelocityConvention).toBe(VelocityConvention.RADIO);
        expect(legacyWidgetStore.restFrameRadialVelocity).toBeCloseTo(59958.4916, 3);
    });
});
