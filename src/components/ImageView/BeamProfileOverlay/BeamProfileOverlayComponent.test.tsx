import * as React from "react";
import {render} from "@testing-library/react";

import {BeamType} from "enums/overlay";

import {BeamProfileOverlayComponent} from "./BeamProfileOverlayComponent";

jest.mock("react-konva", () => {
    const reactApi = jest.requireActual("react") as typeof React;
    return {
        Ellipse: (props: {radiusX: number; radiusY: number}) => reactApi.createElement("beam-ellipse", {"data-radius-x": props.radiusX, "data-radius-y": props.radiusY}),
        Group: ({children}: {children?: React.ReactNode}) => reactApi.createElement("beam-group", null, children),
        Layer: reactApi.forwardRef(({children}: {children?: React.ReactNode}, ref: React.Ref<HTMLDivElement>) => reactApi.createElement("div", {ref}, children)),
        Line: () => null,
        Stage: ({children}: {children?: React.ReactNode}) => reactApi.createElement("beam-stage", null, children)
    };
});
jest.mock("stores", () => ({
    AppStore: Object.defineProperty({}, "Instance", {
        configurable: true,
        get: () => ({contourFrames: new Map(), imageRatio: 1, updateLayerPixelRatio: jest.fn()})
    })
}));
jest.mock("utilities", () => ({getColorForTheme: (color: string) => color}));

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
            getBeamProperties: jest.fn(({channel}: {stokes?: number; channel?: number}) => ({
                x: channel === 3 ? 4 : 10,
                y: 2,
                angle: 0,
                overlayBeamSettings: {isVisible: true}
            }))
        };
        const renderBeam = (channel: number) => render(<BeamProfileOverlayComponent frame={frame as any} channel={channel} top={0} left={0} docked={false} />);
        const firstPanel = renderBeam(3);
        const secondPanel = renderBeam(7);
        expect(frame.getBeamProperties.mock.calls.map(([options]) => options.channel)).toEqual([3, 7]);
        expect(firstPanel.container.querySelector("beam-ellipse")?.getAttribute("data-radius-x")).toBe("2");
        expect(secondPanel.container.querySelector("beam-ellipse")?.getAttribute("data-radius-x")).toBe("5");
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

        const rendered = render(<BeamProfileOverlayComponent frame={frame as any} channel={3} top={0} left={0} docked={false} />);

        expect(rendered.container).toBeEmptyDOMElement();
    });
});
