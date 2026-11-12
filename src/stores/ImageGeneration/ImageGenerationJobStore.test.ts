import {afterEach, describe, expect, jest, test} from "@jest/globals";
import {CARTA} from "carta-protobuf";
import {observable, runInAction} from "mobx";
import {Subject} from "rxjs";

import {ConnectionStatus, RegionId, SpectralSystem, SpectralType, SpectralUnit} from "enums";
import {BackendService} from "services";
import {type AppStore} from "stores";
import {ImageGenerationJobStore} from "stores/ImageGeneration/ImageGenerationJobStore";
import {ImageRequestCancelledError} from "stores/ImageGeneration/ImageGenerationRequests";

/** A promise that the test settles by hand. */
function deferred<T>() {
    let resolve: (value: T) => void = () => {};
    let reject: (reason: unknown) => void = () => {};
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return {promise, resolve, reject};
}

/** Lets the pending promise callbacks run. */
function settle() {
    return new Promise(resolve => setTimeout(resolve));
}

const CLOSED_REGION = 5;
const LINE_REGION = 6;

function createSession() {
    const regions = observable.map<number, {regionType: CARTA.RegionType; isClosedRegion: boolean}>(
        [
            [CLOSED_REGION, {regionType: CARTA.RegionType.RECTANGLE, isClosedRegion: true}],
            [LINE_REGION, {regionType: CARTA.RegionType.LINE, isClosedRegion: false}]
        ],
        {deep: false}
    );
    const frame = observable(
        {
            frameInfo: {fileId: 1},
            numChannels: 10,
            isRequestingMoments: false,
            isRequestingPV: false,
            requestingMomentsProgress: 0,
            requestingPVProgress: 0,
            isSpectralAxisNonlinear: false,
            restFreqStore: undefined,
            spectralType: SpectralType.FREQ,
            spectralUnit: SpectralUnit.GHZ,
            spectralSystem: SpectralSystem.LSRK,
            spectralCoordsSupported: new Map([
                ["Frequency (GHz)", {type: SpectralType.FREQ, unit: SpectralUnit.GHZ}],
                ["Radio velocity (km/s)", {type: SpectralType.VRAD, unit: SpectralUnit.KMS}]
            ]),
            spectralSystemsSupported: [SpectralSystem.LSRK, SpectralSystem.BARY],
            getRegion: (regionId: number) => regions.get(regionId),
            findChannelIndexInCoordinate: jest.fn((value: number, _type?: unknown, _unit?: unknown, _system?: unknown, _shouldReject?: boolean): number | undefined => Math.round(value)),
            resetMomentRequestState: jest.fn(),
            setIsRequestingMoments: jest.fn(),
            resetPvRequestState: jest.fn(),
            setIsRequestingPV: jest.fn(),
            setIsRequestPVCancelling: jest.fn()
        },
        {
            getRegion: false,
            findChannelIndexInCoordinate: false,
            resetMomentRequestState: false,
            setIsRequestingMoments: false,
            resetPvRequestState: false,
            setIsRequestingPV: false,
            setIsRequestPVCancelling: false,
            spectralCoordsSupported: false,
            spectralSystemsSupported: false
        }
    );
    const state = observable({frames: [frame] as unknown[], isLoadingWorkspace: false, connectionStatus: ConnectionStatus.ACTIVE}, {frames: observable.shallow});
    const moments = deferred<unknown[]>();
    const pv = deferred<unknown>();
    const appStore = {
        get frames() {
            return state.frames;
        },
        get isLoadingWorkspace() {
            return state.isLoadingWorkspace;
        },
        backendService: {
            get connectionStatus() {
                return state.connectionStatus;
            }
        },
        requestMoment: jest.fn((_message: CARTA.MomentRequest.$Properties, _frame: unknown, _options: {isStillWanted?: () => boolean; shouldThrow?: boolean}) => moments.promise),
        requestPV: jest.fn((_message: CARTA.PvRequest.$Properties, _frame: unknown, _shouldKeep: boolean, _options: {isStillWanted?: () => boolean; shouldThrow?: boolean}) => pv.promise),
        cancelRequestingMoment: jest.fn(),
        cancelRequestingPV: jest.fn(),
        endFileLoading: jest.fn(),
        statsRequirementsOf: jest.fn((_fileId: number, _regionId: number): {statsConfigs: unknown[]} | undefined => undefined)
    };
    // The backend answers a statistics request for a region with the statistics of that region.
    const statsStream = new Subject<{fileId: number; regionId: number}>();
    const backend = {
        statsStream,
        setStatsRequirements: jest.fn((message: {fileId: number; regionId: number; statsConfigs: unknown[]}) => {
            if (message.statsConfigs.length) {
                setTimeout(() => statsStream.next({fileId: message.fileId, regionId: message.regionId}));
            }
            return true;
        })
    };
    jest.spyOn(BackendService, "Instance", "get").mockReturnValue(backend as never);
    const store = new ImageGenerationJobStore(appStore as unknown as AppStore);
    const madeImage = (fileId: number, moment?: CARTA.Moment) => ({frameInfo: {fileId}, generation: {moment}});
    return {store, appStore, state, frame, regions, moments, pv, backend, madeImage};
}

describe("ImageGenerationJobStore", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("moment jobs", () => {
        test("make moment images over the whole image, and report the images by moment", async () => {
            const {store, appStore, frame, moments, madeImage} = createSession();
            const jobId = store.startMoments(1, {moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM, CARTA.Moment.MAX_OF_THE_SPECTRUM]});
            await settle();

            expect(store.getJob(jobId)).toEqual(expect.objectContaining({id: jobId, kind: "moment", fileId: 1, status: "running", images: []}));
            expect(frame.setIsRequestingMoments).toHaveBeenCalledWith(true);
            const [message, source, options] = appStore.requestMoment.mock.calls[0];
            expect(message).toEqual(
                expect.objectContaining({fileId: 1, regionId: RegionId.IMAGE, spectralRange: {min: 0, max: 9}, mask: CARTA.MomentMask.None, keep: true, moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM, CARTA.Moment.MAX_OF_THE_SPECTRUM]})
            );
            expect(source).toBe(frame);
            expect(options.shouldThrow).toBe(true);

            runInAction(() => (frame.requestingMomentsProgress = 0.4));
            expect(store.getJob(jobId).progress).toBe(0.4);

            moments.resolve([madeImage(11, CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM), madeImage(12, CARTA.Moment.MAX_OF_THE_SPECTRUM)]);
            await settle();
            expect(store.getJob(jobId)).toEqual(
                expect.objectContaining({
                    status: "done",
                    progress: 1,
                    images: [
                        {fileId: 11, moment: CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM},
                        {fileId: 12, moment: CARTA.Moment.MAX_OF_THE_SPECTRUM}
                    ]
                })
            );
        });

        test("wait for the backend to keep the region data before the moments are asked for", async () => {
            const {store, appStore, backend} = createSession();
            store.startMoments(1, {moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM], regionId: CLOSED_REGION, keep: false});
            expect(appStore.requestMoment).not.toHaveBeenCalled();
            await settle();
            await settle();

            expect(appStore.requestMoment).toHaveBeenCalledWith(expect.objectContaining({regionId: CLOSED_REGION, keep: false}), expect.anything(), expect.anything());
            expect(backend.setStatsRequirements.mock.calls.map(([message]) => message.statsConfigs.length)).toEqual([1, 0]);
            expect(backend.setStatsRequirements.mock.invocationCallOrder[1]).toBeLessThan(appStore.requestMoment.mock.invocationCallOrder[0]);
        });

        test("report the error of the backend", async () => {
            const {store, moments} = createSession();
            const jobId = store.startMoments(1, {moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM]});
            moments.reject("Moment generation failed.");
            await settle();
            expect(store.getJob(jobId)).toEqual(expect.objectContaining({status: "failed", error: "Moment generation failed", images: []}));
        });

        test("are cancelled by the script, and do not keep images that still come", async () => {
            const {store, appStore, moments} = createSession();
            const jobId = store.startMoments(1, {moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM]});
            await settle();

            store.cancelJob(jobId);
            expect(store.getJob(jobId).status).toBe("cancelled");
            expect(appStore.cancelRequestingMoment).toHaveBeenCalledWith(1);
            expect(appStore.requestMoment.mock.calls[0][2].isStillWanted?.()).toBe(false);

            moments.reject(new ImageRequestCancelledError());
            await settle();
            expect(store.getJob(jobId).status).toBe("cancelled");
        });

        test("are cancelled when the user cancels the request in the GUI", async () => {
            const {store, moments} = createSession();
            const jobId = store.startMoments(1, {moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM]});
            moments.reject(new ImageRequestCancelledError());
            await settle();
            expect(store.getJob(jobId)).toEqual(expect.objectContaining({status: "cancelled", error: undefined}));
        });

        test("fail when the image is closed, the region is deleted or a workspace loads", async () => {
            const session = createSession();
            const closedJob = session.store.startMoments(1, {moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM]});
            await settle();
            runInAction(() => session.state.frames.splice(0, 1));
            expect(session.store.getJob(closedJob)).toEqual(expect.objectContaining({status: "failed", error: "the image was closed"}));

            const regionSession = createSession();
            const regionJob = regionSession.store.startMoments(1, {moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM], regionId: CLOSED_REGION});
            runInAction(() => regionSession.regions.delete(CLOSED_REGION));
            await settle();
            expect(regionSession.store.getJob(regionJob)).toEqual(expect.objectContaining({status: "failed", error: "the region was deleted"}));
            expect(regionSession.appStore.requestMoment).not.toHaveBeenCalled();

            const workspaceSession = createSession();
            const workspaceJob = workspaceSession.store.startMoments(1, {moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM]});
            await settle();
            runInAction(() => (workspaceSession.state.isLoadingWorkspace = true));
            expect(workspaceSession.store.getJob(workspaceJob)).toEqual(expect.objectContaining({status: "failed", error: "a workspace was loaded"}));
            expect(workspaceSession.appStore.cancelRequestingMoment).toHaveBeenCalledWith(1);
            expect(() => workspaceSession.store.startMoments(1, {moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM]})).toThrow("A workspace is loading");
        });

        test("stop the wait for the region data when they are cancelled", async () => {
            const {store, appStore, frame, backend} = createSession();
            backend.setStatsRequirements.mockImplementation(() => true);
            const jobId = store.startMoments(1, {moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM], regionId: CLOSED_REGION});
            expect(frame.setIsRequestingMoments).toHaveBeenCalledWith(true);

            store.cancelJob(jobId);
            await settle();
            expect(store.getJob(jobId).status).toBe("cancelled");
            expect(backend.setStatsRequirements.mock.calls.map(([message]) => message.statsConfigs.length)).toEqual([1, 0]);
            expect(appStore.requestMoment).not.toHaveBeenCalled();
            expect(appStore.cancelRequestingMoment).not.toHaveBeenCalled();
            // The progress dialog of the GUI closes.
            expect(frame.resetMomentRequestState).toHaveBeenCalledTimes(2);
        });

        test("fail at once when the connection to the backend is lost, although the backend never answers", async () => {
            const {store, appStore, state, frame} = createSession();
            const jobId = store.startMoments(1, {moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM]});
            await settle();
            runInAction(() => (state.connectionStatus = ConnectionStatus.CLOSED));
            await settle();
            expect(store.getJob(jobId)).toEqual(expect.objectContaining({status: "failed", error: "the connection to the backend was lost"}));
            expect(frame.resetMomentRequestState).toHaveBeenCalledTimes(2);
            // The file operations of the GUI work again.
            expect(appStore.endFileLoading).toHaveBeenCalledTimes(1);
        });

        test("clear the request state of the image when the connection is lost after a cancel that the backend never answers", async () => {
            const {store, appStore, state, frame} = createSession();
            const jobId = store.startMoments(1, {moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM]});
            await settle();
            store.cancelJob(jobId);
            expect(frame.resetMomentRequestState).toHaveBeenCalledTimes(1);

            runInAction(() => (state.connectionStatus = ConnectionStatus.CLOSED));
            expect(store.getJob(jobId).status).toBe("cancelled");
            expect(frame.resetMomentRequestState).toHaveBeenCalledTimes(2);
            expect(appStore.endFileLoading).toHaveBeenCalledTimes(1);
        });

        test("stop watching the connection when the backend answers the request", async () => {
            const {store, appStore, state, frame, moments} = createSession();
            store.startMoments(1, {moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM]});
            moments.resolve([]);
            await settle();
            runInAction(() => (state.connectionStatus = ConnectionStatus.CLOSED));
            expect(frame.resetMomentRequestState).toHaveBeenCalledTimes(1);
            expect(appStore.endFileLoading).not.toHaveBeenCalled();
        });

        test("are cancelled from the progress dialog of the GUI while they wait for the region data", async () => {
            const {store, appStore, frame, backend} = createSession();
            backend.setStatsRequirements.mockImplementation(() => true);
            const jobId = store.startMoments(1, {moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM], regionId: CLOSED_REGION});

            store.cancelWaitingMomentJob(frame as never);
            await settle();
            expect(store.getJob(jobId).status).toBe("cancelled");
            expect(appStore.requestMoment).not.toHaveBeenCalled();
            expect(frame.resetMomentRequestState).toHaveBeenCalledTimes(2);
        });

        test("are left running by the progress dialog of the GUI once the request is sent", async () => {
            const {store, frame} = createSession();
            const jobId = store.startMoments(1, {moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM]});
            await settle();
            store.cancelWaitingMomentJob(frame as never);
            expect(store.getJob(jobId).status).toBe("running");
        });

        test("wait for the answer to the statistics that a widget asks for, and leave them as they are", async () => {
            const {store, appStore, backend} = createSession();
            const widgetConfigs = [{coordinate: "z", statsTypes: [CARTA.StatsType.Mean]}];
            appStore.statsRequirementsOf.mockReturnValue({statsConfigs: widgetConfigs});
            store.startMoments(1, {moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM], regionId: CLOSED_REGION});
            expect(appStore.statsRequirementsOf).toHaveBeenCalledWith(1, CLOSED_REGION);
            expect(backend.setStatsRequirements.mock.calls.map(([message]) => message.statsConfigs)).toEqual([widgetConfigs]);
            expect(appStore.requestMoment).not.toHaveBeenCalled();
            await settle();
            await settle();
            expect(backend.setStatsRequirements).toHaveBeenCalledTimes(1);
            expect(appStore.requestMoment).toHaveBeenCalled();
        });

        test("send again the statistics that a widget starts to ask for during the wait", async () => {
            const {store, appStore, backend} = createSession();
            const widgetConfigs = [{coordinate: "z", statsTypes: [CARTA.StatsType.Mean]}];
            store.startMoments(1, {moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM], regionId: CLOSED_REGION});
            appStore.statsRequirementsOf.mockReturnValue({statsConfigs: widgetConfigs});
            await settle();
            await settle();
            expect(backend.setStatsRequirements.mock.calls.map(([message]) => message.statsConfigs)).toEqual([[expect.anything()], widgetConfigs]);
            expect(appStore.requestMoment).toHaveBeenCalled();
        });

        test("are reported as running until they end, also while they wait for the region data", async () => {
            const {store, backend} = createSession();
            backend.setStatsRequirements.mockImplementation(() => true);
            expect(store.hasRunningJobs()).toBe(false);
            const jobId = store.startMoments(1, {moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM], regionId: CLOSED_REGION});
            expect(store.hasRunningJobs()).toBe(true);
            store.cancelJob(jobId);
            expect(store.hasRunningJobs()).toBe(false);
        });

        test("run one at a time for each image", () => {
            const {store} = createSession();
            store.startMoments(1, {moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM]});
            expect(() => store.startMoments(1, {moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM]})).toThrow("Image 1 already makes moment images");
            // A PV job of the same image can run at the same time.
            expect(() => store.startPv(1, {regionId: LINE_REGION})).not.toThrow();
        });

        test("refuse settings that are not valid", () => {
            const {store} = createSession();
            expect(() => store.startMoments(2, {moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM]})).toThrow("No image with the file ID 2 is open");
            expect(() => store.startMoments(1, {moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM], regionId: LINE_REGION})).toThrow("Image 1 has no closed region with the ID 6");
            expect(() => store.startMoments(1, {moments: []})).toThrow("The moment settings are not valid");
            expect(() => store.startMoments(1, {moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM], channels: {min: 0, max: 10}})).toThrow("The channels must be from 0 to 9");
            expect(() => store.startMoments(1, {moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM], channels: {min: 0, max: 2}, spectralRange: {min: 0, max: 2}})).toThrow("Give either channels or a spectral range, not both");
            expect(() => store.getJob(9)).toThrow("There is no image generation job with the ID 9");
        });
    });

    describe("the channel range", () => {
        test("is given as channel indices, with the smaller index first", () => {
            const {frame} = createSession();
            expect(ImageGenerationJobStore.channelRangeOf(frame as never, {channels: {min: 7, max: 2}})).toEqual({min: 2, max: 7});
            expect(ImageGenerationJobStore.channelRangeOf(frame as never, {})).toBeUndefined();
        });

        test("is converted from spectral values in the given coordinate, or in the coordinate the image shows", () => {
            const {frame} = createSession();
            expect(ImageGenerationJobStore.channelRangeOf(frame as never, {spectralRange: {min: 8.2, max: 3.4, type: SpectralType.VRAD, system: SpectralSystem.BARY}})).toEqual({min: 3, max: 8});
            expect(frame.findChannelIndexInCoordinate).toHaveBeenCalledWith(8.2, SpectralType.VRAD, SpectralUnit.KMS, SpectralSystem.BARY, true);

            ImageGenerationJobStore.channelRangeOf(frame as never, {spectralRange: {min: 1, max: 2}});
            expect(frame.findChannelIndexInCoordinate).toHaveBeenLastCalledWith(2, SpectralType.FREQ, SpectralUnit.GHZ, SpectralSystem.LSRK, true);
        });

        test("refuses spectral values that cannot be converted to channels", () => {
            const {frame} = createSession();
            frame.findChannelIndexInCoordinate.mockReturnValue(undefined);
            expect(() => ImageGenerationJobStore.channelRangeOf(frame as never, {spectralRange: {min: 1, max: 2}})).toThrow("The spectral range cannot be converted to channels");
        });

        test("refuses a coordinate that the image does not support", () => {
            const {frame} = createSession();
            expect(() => ImageGenerationJobStore.channelRangeOf(frame as never, {spectralRange: {min: 1, max: 2, type: SpectralType.WAVE}})).toThrow("The image does not support the spectral type WAVE");
            expect(() => ImageGenerationJobStore.channelRangeOf(frame as never, {spectralRange: {min: 1, max: 2, unit: SpectralUnit.KMS}})).toThrow("The image does not support the spectral type FREQ with the unit km/s");
            expect(() => ImageGenerationJobStore.channelRangeOf(frame as never, {spectralRange: {min: 1, max: 2, system: SpectralSystem.TOPO}})).toThrow("The image does not support the spectral system TOPOCENT");
        });
    });

    describe("PV jobs", () => {
        test("make a PV image along a line region", async () => {
            const {store, appStore, frame, pv, madeImage} = createSession();
            const jobId = store.startPv(1, {regionId: LINE_REGION, width: 3, channels: {min: 2, max: 6}, reverse: true});
            await settle();

            expect(frame.setIsRequestingPV).toHaveBeenCalledWith(true);
            const [message, , shouldKeep, options] = appStore.requestPV.mock.calls[0];
            expect(message).toEqual(expect.objectContaining({fileId: 1, regionId: LINE_REGION, width: 3, spectralRange: {min: 2, max: 6}, reverse: true, keep: true}));
            expect(shouldKeep).toBe(true);
            expect(options.shouldThrow).toBe(true);

            pv.resolve(madeImage(21));
            await settle();
            expect(store.getJob(jobId)).toEqual(expect.objectContaining({kind: "pv", status: "done", images: [{fileId: 21}]}));
        });

        test("fail when the cut is deleted", async () => {
            const {store, appStore, regions} = createSession();
            const jobId = store.startPv(1, {regionId: LINE_REGION});
            await settle();
            runInAction(() => regions.delete(LINE_REGION));
            expect(store.getJob(jobId)).toEqual(expect.objectContaining({status: "failed", error: "the region was deleted"}));
            expect(appStore.cancelRequestingPV).toHaveBeenCalledWith(1);
        });

        test("need a line or polyline region", () => {
            const {store} = createSession();
            expect(() => store.startPv(1, {regionId: CLOSED_REGION})).toThrow("Image 1 has no line or polyline region with the ID 5");
            expect(() => store.startPv(1, {regionId: LINE_REGION, width: 0})).toThrow("The PV settings are not valid");
        });
    });
});
