jest.mock("stores", () => ({AppStore: {Instance: {imageRatio: 1}}}));
jest.mock("stores/Frame", () => ({}));
jest.mock("models", () => ({}));
jest.mock("utilities", () => ({
    ...jest.requireActual("utilities/math2d/math2d"),
    ...jest.requireActual("utilities/region/simpleShapePointEdit"),
    transformPoint: jest.fn((_mapping, point) => ({...point})),
    isAstBadPoint: jest.fn(() => false)
}));

import {CARTA} from "carta-protobuf";

import {SimpleShapeRegionComponent} from "./SimpleShapeRegionComponent";

const ANNULUS_ANCHORS: Array<[string, {x: number; y: number}]> = [
    ["top", {x: 0, y: 3}],
    ["bottom", {x: 0, y: -3}],
    ["left", {x: -6, y: 0}],
    ["right", {x: 6, y: 0}],
    ["top-left", {x: -6, y: 3}],
    ["top-right", {x: 6, y: 3}],
    ["bottom-left", {x: -6, y: -3}],
    ["bottom-right", {x: 6, y: -3}]
];

test.each(ANNULUS_ANCHORS)("keeps the annulus %s resize handle on its projected anchor", (anchor, offset) => {
    for (const regionType of [CARTA.RegionType.ANNULUS, CARTA.RegionType.ANNANNULUS]) {
        for (const aspectRatio of [0.5, 2]) {
            for (const rotation of [30, 90, 210]) {
                const center = {x: 20, y: 20};
                const region = {regionType, center, size: {x: 3, y: 6}, rotation};
                const view = {xMin: 0, xMax: 100, yMin: 0, yMax: 100};
                const frame = {aspectRatio, effectiveZoomLevel: {x: 1, y: 1}, unitFrameView: view};
                const component = new SimpleShapeRegionComponent({
                    region,
                    frame,
                    layerWidth: 100 * aspectRatio,
                    layerHeight: 100,
                    stageRef: {current: {getPosition: () => ({x: 0, y: 0}), scaleX: () => 1, scaleY: () => 1}}
                } as any);
                const radians = (rotation * Math.PI) / 180;
                const expectedX = aspectRatio * (center.x + offset.x * Math.cos(radians) - offset.y * Math.sin(radians));
                const expectedY = 100 - (center.y + offset.x * Math.sin(radians) + offset.y * Math.cos(radians));
                if (anchor.includes("-")) {
                    const position = (component as any).getDragBoundedDiagonalAnchorPos(region, anchor);
                    expect(position.x).toBeCloseTo(expectedX);
                    expect(position.y).toBeCloseTo(expectedY);
                } else {
                    for (const isCornerMode of [false, true]) {
                        const position = (component as any).getDragBoundedAnchorPos(region, anchor, isCornerMode);
                        expect(position.x).toBeCloseTo(expectedX);
                        expect(position.y).toBeCloseTo(expectedY);
                    }
                }
            }
        }
    }
});
