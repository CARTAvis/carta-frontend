import {describe, expect, test} from "@jest/globals";
import {CARTA} from "carta-protobuf";

import {type FrameStore} from "stores/Frame";

// Load the stores in dependency order before importing one of them directly
import "stores";

import {isLineInOnePixel, isLineOnImage, momentProblemOf, pvProblemOf} from "./ImageGenerationRequests";

const NONLINEAR_SPECTRAL_AXIS_MESSAGE = "Not available for nonlinear spectral axes";

const LINE_REGION = 1;
const POLYLINE_REGION = 2;
const RECTANGLE_REGION = 3;

interface TestRegion {
    regionType: CARTA.RegionType;
    controlPoints: {x: number; y: number}[];
}

/** Returns an image of 100 x 100 pixels with a line, a polyline and a rectangle region. */
function frameOf(options: {numChannels?: number; isSpectralAxisNonlinear?: boolean; line?: TestRegion["controlPoints"]} = {}): FrameStore {
    const regions = new Map<number, TestRegion>([
        [
            LINE_REGION,
            {
                regionType: CARTA.RegionType.LINE,
                controlPoints: options.line ?? [
                    {x: 10, y: 10},
                    {x: 90, y: 90}
                ]
            }
        ],
        [
            POLYLINE_REGION,
            {
                regionType: CARTA.RegionType.POLYLINE,
                controlPoints: [
                    {x: 10, y: 10},
                    {x: 50, y: 20},
                    {x: 90, y: 90}
                ]
            }
        ],
        [
            RECTANGLE_REGION,
            {
                regionType: CARTA.RegionType.RECTANGLE,
                controlPoints: [
                    {x: 50, y: 50},
                    {x: 10, y: 10}
                ]
            }
        ]
    ]);
    return {
        numChannels: options.numChannels ?? 10,
        isSpectralAxisNonlinear: options.isSpectralAxisNonlinear ?? false,
        frameInfo: {fileId: 0, fileInfoExtended: {width: 100, height: 100}},
        getRegion: (regionId: number) => regions.get(regionId)
    } as unknown as FrameStore;
}

describe("momentProblemOf", () => {
    test("allows moments of a cube", () => {
        expect(momentProblemOf(frameOf(), [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM])).toBeUndefined();
    });

    test("rejects an image with one channel", () => {
        expect(momentProblemOf(frameOf({numChannels: 1}), [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM])).toBe("The image has only one channel");
    });

    test("rejects only the moments that need a linear spectral axis when the axis is nonlinear", () => {
        const frame = frameOf({isSpectralAxisNonlinear: true});
        expect(momentProblemOf(frame, [CARTA.Moment.MAX_OF_THE_SPECTRUM])).toBeUndefined();
        expect(momentProblemOf(frame, [CARTA.Moment.MAX_OF_THE_SPECTRUM, CARTA.Moment.INTENSITY_WEIGHTED_COORD])).toBe(NONLINEAR_SPECTRAL_AXIS_MESSAGE);
    });
});

describe("pvProblemOf", () => {
    test("allows a line or a polyline that crosses a cube", () => {
        expect(pvProblemOf(frameOf(), LINE_REGION)).toBeUndefined();
        expect(pvProblemOf(frameOf(), POLYLINE_REGION, {min: 2, max: 3})).toBeUndefined();
    });

    test("rejects an image with one channel", () => {
        expect(pvProblemOf(frameOf({numChannels: 1}), LINE_REGION)).toBe("The image has only one channel");
    });

    test("rejects a nonlinear spectral axis", () => {
        expect(pvProblemOf(frameOf({isSpectralAxisNonlinear: true}), LINE_REGION)).toBe(NONLINEAR_SPECTRAL_AXIS_MESSAGE);
    });

    test("rejects a missing region and a region that is not a line", () => {
        expect(pvProblemOf(frameOf(), 9)).toBe("The image has no region 9");
        expect(pvProblemOf(frameOf(), RECTANGLE_REGION)).toBe("Region 3 is not a line or polyline");
    });

    test("rejects a line that does not cross the image", () => {
        expect(
            pvProblemOf(
                frameOf({
                    line: [
                        {x: 110, y: 10},
                        {x: 150, y: 90}
                    ]
                }),
                LINE_REGION
            )
        ).toBe("The line does not cross the image");
    });

    test("rejects a line that starts and ends in the same pixel", () => {
        expect(
            pvProblemOf(
                frameOf({
                    line: [
                        {x: 10.2, y: 10.1},
                        {x: 9.8, y: 10.3}
                    ]
                }),
                LINE_REGION
            )
        ).toBe("The line starts and ends in the same pixel");
    });

    test("rejects a channel range of one channel", () => {
        expect(pvProblemOf(frameOf(), LINE_REGION, {min: 4, max: 4})).toBe("The channel range has fewer than two channels");
        expect(pvProblemOf(frameOf(), LINE_REGION, {min: 5, max: 4})).toBe("The channel range has fewer than two channels");
    });
});

describe("line checks", () => {
    const frame = frameOf();
    const lineOf = (x1: number, y1: number, x2: number, y2: number) => ({
        controlPoints: [
            {x: x1, y: y1},
            {x: x2, y: y2}
        ]
    });

    test("find whether a line crosses the image", () => {
        expect(isLineOnImage(lineOf(10, 10, 90, 90), frame)).toBe(true);
        expect(isLineOnImage(lineOf(-20, 50, 120, 50), frame)).toBe(true);
        expect(isLineOnImage(lineOf(-20, -20, -10, 120), frame)).toBe(false);
        expect(isLineOnImage(lineOf(-20, 50, -10, 50), frame)).toBe(false);
    });

    test("find no crossing without a region or without the size of the image", () => {
        expect(isLineOnImage(undefined, frame)).toBe(false);
        expect(isLineOnImage(lineOf(10, 10, 90, 90), {frameInfo: {}} as unknown as FrameStore)).toBe(false);
    });

    test("find whether a line starts and ends in the same pixel", () => {
        expect(isLineInOnePixel(lineOf(10.4, 10.4, 9.6, 9.6))).toBe(true);
        expect(isLineInOnePixel(lineOf(10.4, 10.4, 10.6, 10.4))).toBe(false);
        expect(isLineInOnePixel(undefined)).toBe(false);
    });
});
