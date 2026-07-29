const MOCK_APP_STORE = {
    activeImage: null as any,
    setActiveImageById: jest.fn()
};

jest.mock("stores", () => ({
    AppStore: {Instance: MOCK_APP_STORE}
}));

import {ImageType} from "enums";

import {TimeSeriesStore} from "./TimeSeriesStore";

interface MockFrameOptions {
    isPreview?: boolean;
}

const MakeMockFrame = (id: number, obsTimeMjdUtc: number | undefined, options: MockFrameOptions = {}) => {
    return {
        id,
        isPreview: options.isPreview ?? false,
        obsTimeMjdUtc,
        setChannel: jest.fn()
    };
};

describe("TimeSeriesStore", () => {
    const store = TimeSeriesStore.Instance;

    const mockMembers = (frames: any[], activeFrame: any = null) => {
        store.clearMembers();
        frames.forEach(frame => store.setMember(frame, true));
        MOCK_APP_STORE.activeImage = activeFrame ? {type: ImageType.FRAME, store: activeFrame} : null;
    };

    beforeEach(() => {
        store.clearMembers();
        MOCK_APP_STORE.activeImage = null;
        MOCK_APP_STORE.setActiveImageById.mockClear();
    });

    describe("elements", () => {
        test("returns an empty list without members", () => {
            expect(store.elements).toEqual([]);
        });

        test("sorts member images by ascending observation time", () => {
            const late = MakeMockFrame(0, 59200);
            const early = MakeMockFrame(1, 58800);
            const middle = MakeMockFrame(2, 59000);
            mockMembers([late, early, middle]);

            expect(store.elements.map(element => element.frame.id)).toEqual([1, 2, 0]);
            expect(store.elements.map(element => element.mjdUtc)).toEqual([58800, 59000, 59200]);
        });

        test("breaks ties deterministically by image id", () => {
            const laterId = MakeMockFrame(5, 59000);
            const other = MakeMockFrame(3, 59000);
            mockMembers([laterId, other]);

            expect(store.elements.map(element => element.frame.id)).toEqual([3, 5]);
        });

        test("rejects images without a valid time and preview images", () => {
            const valid = MakeMockFrame(0, 59000);
            const noTime = MakeMockFrame(1, undefined);
            const preview = MakeMockFrame(2, 59100, {isPreview: true});

            expect(store.setMember(valid as any, true)).toBe(true);
            expect(store.setMember(noTime as any, true)).toBe(false);
            expect(store.setMember(preview as any, true)).toBe(false);
            expect(store.elements.map(element => element.frame.id)).toEqual([0]);
        });
    });

    describe("membership", () => {
        test("adds, toggles, and removes members independently of spatial matching", () => {
            const frame = MakeMockFrame(0, 59000);

            expect(store.setMember(frame as any, true)).toBe(true);
            expect(store.isMember(frame as any)).toBe(true);
            expect(store.toggleMember(frame as any)).toBe(true);
            expect(store.isMember(frame as any)).toBe(false);
        });
    });

    describe("currentIndex", () => {
        test("returns the index of the active image", () => {
            const reference = MakeMockFrame(0, 59200);
            const other = MakeMockFrame(1, 58800);
            mockMembers([reference, other], reference);

            expect(store.currentIndex).toBe(1);
        });

        test("returns -1 when the active image is not in the series", () => {
            const reference = MakeMockFrame(0, 59000);
            const unmatched = MakeMockFrame(9, 59100);
            mockMembers([reference], unmatched);

            expect(store.currentIndex).toBe(-1);
        });

        test.each([ImageType.PV_PREVIEW, ImageType.COLOR_BLENDING])("returns -1 when the active image type is %s", type => {
            const reference = MakeMockFrame(0, 59000);
            mockMembers([reference]);
            MOCK_APP_STORE.activeImage = {type, store: type === ImageType.COLOR_BLENDING ? {baseFrame: reference} : reference};

            expect(store.currentIndex).toBe(-1);
        });
    });

    describe("setIndex", () => {
        test("switches the active image without changing its channel", () => {
            const reference = MakeMockFrame(0, 58800);
            const other = MakeMockFrame(1, 59000);
            mockMembers([reference, other], reference);

            store.setIndex(1);
            expect(MOCK_APP_STORE.setActiveImageById).toHaveBeenCalledWith(expect.anything(), 1);
            expect(other.setChannel).not.toHaveBeenCalled();
        });

        test("ignores out-of-range indexes", () => {
            mockMembers([MakeMockFrame(0, 59000)]);
            store.setIndex(5);
            expect(MOCK_APP_STORE.setActiveImageById).not.toHaveBeenCalled();
        });

        test("switches from color blending even when its base frame is the selected element", () => {
            const reference = MakeMockFrame(0, 59000);
            mockMembers([reference]);
            MOCK_APP_STORE.activeImage = {type: ImageType.COLOR_BLENDING, store: {baseFrame: reference}};

            store.setIndex(0);

            expect(MOCK_APP_STORE.setActiveImageById).toHaveBeenCalledWith(ImageType.FRAME, reference.id);
        });
    });

    describe("next and prev", () => {
        test("wraps around the series", () => {
            const reference = MakeMockFrame(0, 59200);
            const other = MakeMockFrame(1, 58800);

            // Active image is the last element; next wraps to the first
            mockMembers([reference, other], reference);
            store.next();
            expect(MOCK_APP_STORE.setActiveImageById).toHaveBeenLastCalledWith(expect.anything(), 1);

            // Active image is the first element; prev wraps to the last
            mockMembers([reference, other], other);
            store.prev();
            expect(MOCK_APP_STORE.setActiveImageById).toHaveBeenLastCalledWith(expect.anything(), 0);
        });
    });

    describe("ensureActiveElement", () => {
        test("selects the first time-series image when the active image is outside the series", () => {
            const reference = MakeMockFrame(0, 59200);
            const first = MakeMockFrame(1, 58800);
            const unmatched = MakeMockFrame(9, 59100);
            mockMembers([reference, first], unmatched);

            store.ensureActiveElement();
            expect(MOCK_APP_STORE.setActiveImageById).toHaveBeenCalledWith(expect.anything(), 1);
        });

        test("keeps the current image when it is already in the time series", () => {
            const reference = MakeMockFrame(0, 59200);
            const first = MakeMockFrame(1, 58800);
            mockMembers([reference, first], reference);

            store.ensureActiveElement();
            expect(MOCK_APP_STORE.setActiveImageById).not.toHaveBeenCalled();
        });
    });
});
