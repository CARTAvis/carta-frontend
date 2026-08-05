import {runInAction} from "mobx";

import {SpectralType, SpectralUnit} from "enums";
import {AppStore} from "stores";

import {SpectralProfileWidgetStore} from "./SpectralProfileWidgetStore";

describe("SpectralProfileWidgetStore rest-frame coordinates", () => {
    let widgetStore: SpectralProfileWidgetStore | undefined;

    const createWidgetStore = (
        spectralType: SpectralType = SpectralType.FREQ,
        spectralUnit: SpectralUnit = SpectralUnit.GHZ,
        spectralTypeSecondary: SpectralType | null = spectralType,
        spectralUnitSecondary: SpectralUnit | null = spectralUnit
    ) => {
        const frame = {
            channelInfo: {},
            channelSecondaryValues: [10, 11],
            channelValues: [100, 110],
            channelValueBounds: undefined,
            filename: "test.fits",
            frameInfo: {fileId: 7},
            getRegion: jest.fn(),
            hasStokes: false,
            headerUnit: "Jy/beam",
            intensityConfig: undefined,
            isCoordChannel: spectralType === SpectralType.CHANNEL,
            isSpectralChannel: true,
            regionSet: {focusedRegion: undefined, regions: []},
            requiredPolarization: 0,
            spectralType,
            spectralTypeSecondary,
            spectralUnit,
            spectralUnitSecondary,
            spectralUnitStr: spectralUnit,
            spectralLabel: `Frequency (${spectralUnit})`,
            spectralAxis: {type: {code: spectralType, unit: spectralUnit}},
            convertSettingWCSToFreqMHz: jest.fn((value: number): number | undefined => value),
            convertFreqMHzToSettingWCS: jest.fn((value: number): number | undefined => value)
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
        widgetStore.setRestFrameEnabled(true);

        expect(widgetStore.convertObservedXToDisplay(100)).toBe(200);
        expect(widgetStore.convertDisplayXToObserved(200)).toBe(100);

        widgetStore.setRestFrameRedshift(0);
        expect(widgetStore.convertObservedXToDisplay(100)).toBe(100);
        expect(widgetStore.convertDisplayXToObserved(100)).toBe(100);
    });

    test("converts wavelength coordinates with the inverse frequency factor", () => {
        const {widgetStore} = createWidgetStore(SpectralType.WAVE, SpectralUnit.NM);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setRestFrameEnabled(true);

        expect(widgetStore.convertObservedXToDisplay(1000)).toBe(500);
        expect(widgetStore.convertDisplayXToObserved(500)).toBe(1000);
    });

    test("converts air wavelength through the frame spectral conversion", () => {
        const {frame, widgetStore} = createWidgetStore(SpectralType.AWAV, SpectralUnit.NM);
        frame.convertSettingWCSToFreqMHz.mockImplementation((value: number) => 300 / value);
        frame.convertFreqMHzToSettingWCS.mockImplementation((value: number) => 300 / value);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setRestFrameEnabled(true);

        expect(widgetStore.convertObservedXToDisplay(10)).toBe(5);
        expect(widgetStore.convertDisplayXToObserved(5)).toBe(10);
        expect(frame.convertSettingWCSToFreqMHz).toHaveBeenCalled();
        expect(frame.convertFreqMHzToSettingWCS).toHaveBeenCalled();
    });

    test("does not approximate air wavelength when the AST conversion fails", () => {
        const {frame, widgetStore} = createWidgetStore(SpectralType.AWAV, SpectralUnit.NM);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setRestFrameEnabled(true);

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
        widgetStore.setRestFrameEnabled(true);
        widgetStore.setSelectedChannelRange(100, 110);

        expect(widgetStore.displayChannelValueRange).toEqual([200, 220]);

        widgetStore.setSelectedDisplayChannelRange(240, 260);
        expect(widgetStore.channelValueRange).toEqual([120, 130]);
        expect(widgetStore.displayChannelValueRange).toEqual([240, 260]);
    });

    test("transforms plot and fitting x coordinates without rescaling intensity values", () => {
        const {widgetStore} = createWidgetStore(SpectralType.FREQ);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setRestFrameEnabled(true);

        expect(widgetStore.plotData?.data[0]).toEqual([
            {x: 200, y: 4},
            {x: 220, y: 8}
        ]);
        expect(widgetStore.plotData?.fittingData?.x).toEqual([200, 220]);
        expect(Array.from(widgetStore.plotData?.fittingData?.y ?? [])).toEqual([4, 8]);
    });

    test("falls back to the native spectral coordinate for secondary rest-frame values", () => {
        const {widgetStore} = createWidgetStore(SpectralType.FREQ, SpectralUnit.GHZ, null, null);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setRestFrameEnabled(true);

        expect(widgetStore.effectiveSecondarySpectralType).toBe(SpectralType.FREQ);
        expect(widgetStore.effectiveSecondarySpectralUnit).toBe(SpectralUnit.GHZ);
        expect(widgetStore.plotData?.secondaryXData[0]).toEqual([20, 22]);
        expect(widgetStore.secondarySpectralUnitLabel).toBe("GHz (rest frame)");
    });

    test("keeps unsupported secondary coordinates observed and labels them explicitly", () => {
        const {widgetStore} = createWidgetStore(SpectralType.FREQ, SpectralUnit.GHZ, SpectralType.VRAD, SpectralUnit.KMS);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setRestFrameEnabled(true);

        expect(widgetStore.plotData?.secondaryXData[0]).toEqual([10, 11]);
        expect(widgetStore.secondarySpectralUnitLabel).toBe("km/s (observed)");
    });

    test("does not enable rest-frame conversion for velocity coordinates", () => {
        const {widgetStore} = createWidgetStore(SpectralType.VRAD, SpectralUnit.KMS);
        widgetStore.setRestFrameRedshift(1);
        widgetStore.setRestFrameEnabled(true);

        expect(widgetStore.isRestFrameSupported).toBe(false);
        expect(widgetStore.isRestFrameEnabled).toBe(false);
        expect(widgetStore.convertObservedXToDisplay(100)).toBe(100);
    });

    test("rejects invalid redshifts and persists valid rest-frame settings", () => {
        const {widgetStore} = createWidgetStore();
        runInAction(() => widgetStore.init({restFrameEnabled: true, restFrameRedshift: 0.25}));

        expect(widgetStore.isRestFrameEnabled).toBe(true);
        expect(widgetStore.restFrameRedshift).toBe(0.25);
        expect(widgetStore.toConfig()).toEqual(expect.objectContaining({restFrameEnabled: true, restFrameRedshift: 0.25}));

        widgetStore.setRestFrameRedshift(-1);
        expect(widgetStore.restFrameRedshift).toBe(0.25);
    });
});
