import * as React from "react";

import {BeamType} from "enums/overlay";

import {BeamProfileOverlayComponent} from "./BeamProfileOverlayComponent";

jest.mock("react-konva", () => ({Ellipse: "ellipse", Group: "group", Layer: "layer", Line: "line", Stage: "stage"}));
jest.mock("stores", () => ({
    AppStore: Object.defineProperty({}, "Instance", {
        configurable: true,
        get: () => ({contourFrames: new Map(), imageRatio: 1, updateLayerPixelRatio: jest.fn()})
    })
}));
jest.mock("utilities", () => ({getColorForTheme: (color: string) => color}));

const GetElements = (node: React.ReactNode, type: string): React.ReactElement[] => {
    if (!React.isValidElement(node)) {
        return [];
    }
    const element = node as React.ReactElement<{children?: React.ReactNode}>;
    return [...(element.type === type ? [element] : []), ...React.Children.toArray(element.props.children).flatMap(child => GetElements(child, type))];
};

describe("BeamProfileOverlayComponent", () => {
    test("renders the beam from each channel's beam metadata", () => {
        const frame = {
            frameInfo: {fileId: 1},
            effectiveZoomLevel: {x: 1, y: 1},
            spatialReference: null,
            spatialTransform: null,
            overlayBeamSettings: {color: "#ffffff", type: BeamType.Open, width: 1, shiftX: 0, shiftY: 0},
            renderWidth: 100,
            renderHeight: 100,
            getBeamProperties: jest.fn((_stokes: number | undefined, channel: number | undefined) => ({
                x: channel === 3 ? 4 : 10,
                y: 2,
                angle: 0,
                overlayBeamSettings: {isVisible: true}
            }))
        };
        const renderBeam = (channel: number) => new BeamProfileOverlayComponent({frame, channel, top: 0, left: 0, docked: false} as any).render();

        const firstBeam = GetElements(renderBeam(3), "ellipse");
        const secondBeam = GetElements(renderBeam(7), "ellipse");

        expect(frame.getBeamProperties.mock.calls.map(([, channel]) => channel)).toEqual([3, 7]);
        expect((firstBeam[0] as React.ReactElement<{radiusX: number}>).props.radiusX).toBe(2);
        expect((secondBeam[0] as React.ReactElement<{radiusX: number}>).props.radiusX).toBe(5);
    });

    test("does not render a beam when its overlay is hidden", () => {
        const frame = {
            frameInfo: {fileId: 1},
            effectiveZoomLevel: {x: 1, y: 1},
            spatialReference: null,
            spatialTransform: null,
            overlayBeamSettings: {color: "#ffffff", type: BeamType.Open, width: 1, shiftX: 0, shiftY: 0},
            renderWidth: 100,
            renderHeight: 100,
            getBeamProperties: jest.fn(() => ({x: 4, y: 2, angle: 0, overlayBeamSettings: {isVisible: false}}))
        };

        const rendered = new BeamProfileOverlayComponent({frame, channel: 3, top: 0, left: 0, docked: false} as any).render();

        expect(rendered).toBeNull();
    });
});
