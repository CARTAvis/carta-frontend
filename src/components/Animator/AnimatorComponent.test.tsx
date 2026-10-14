import * as React from "react";
import {HTMLSelect} from "@blueprintjs/core";

import {NumericInputType} from "enums/animation";
import {AppStore} from "stores";

import {AnimatorComponent} from "./AnimatorComponent";

jest.mock("components/Shared", () => ({
    ResizeDetector: () => null,
    SafeNumericInput: () => null,
    ScrollShadow: () => null
}));
jest.mock("stores", () => ({
    AnimatorStore: {Instance: {}},
    AppStore: Object.defineProperty({}, "Instance", {configurable: true, get: () => undefined})
}));

describe("AnimatorComponent", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    test("throttles channel changes and delivers the final value", () => {
        const frame = {
            frameInfo: {fileInfoExtended: {depth: 100_000}},
            setChannel: jest.fn()
        };
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({activeFrame: frame} as any);
        const component = new AnimatorComponent({} as any);

        component.onChannelChanged(10);
        component.onChannelChanged(20);
        expect(frame.setChannel).toHaveBeenCalledTimes(1);
        expect(frame.setChannel).toHaveBeenLastCalledWith(10);

        jest.advanceTimersByTime(50);
        expect(frame.setChannel).toHaveBeenCalledTimes(2);
        expect(frame.setChannel).toHaveBeenLastCalledWith(20);

        component.componentWillUnmount();
    });

    test("does not apply a pending channel change to a different active frame", () => {
        const frame = {frameInfo: {fileInfoExtended: {depth: 100}}, setChannel: jest.fn()};
        const otherFrame = {frameInfo: {fileInfoExtended: {depth: 100}}, setChannel: jest.fn()};
        const appStore = {activeFrame: frame};
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue(appStore as any);
        const component = new AnimatorComponent({} as any);
        component.onChannelChanged(10);
        component.onChannelChanged(20);
        appStore.activeFrame = otherFrame;
        jest.advanceTimersByTime(50);
        expect(frame.setChannel).toHaveBeenCalledTimes(1);
        expect(otherFrame.setChannel).not.toHaveBeenCalled();
        component.componentWillUnmount();
    });

    test("cancels the pending channel change on unmount", () => {
        const frame = {frameInfo: {fileInfoExtended: {depth: 100}}, setChannel: jest.fn()};
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({activeFrame: frame} as any);
        const component = new AnimatorComponent({} as any);
        component.onChannelChanged(10);
        component.onChannelChanged(20);
        component.componentWillUnmount();
        jest.advanceTimersByTime(50);
        expect(frame.setChannel).toHaveBeenCalledTimes(1);
    });

    test.each([
        [-1, 99],
        [100, 0]
    ])("wraps channel %i to %i", (input, expected) => {
        const frame = {frameInfo: {fileInfoExtended: {depth: 100}}, setChannel: jest.fn()};
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({activeFrame: frame} as any);
        const component = new AnimatorComponent({} as any);
        component.onChannelChanged(input);
        expect(frame.setChannel).toHaveBeenLastCalledWith(expected);
        component.componentWillUnmount();
    });

    test.each([false, true])("selects the appropriate control with step two and channel-map mode %s", isChannelMapEnabled => {
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({
            activeFrame: {frameInfo: {fileInfoExtended: {depth: 1, stokes: 1}}},
            activeImageIndex: 0,
            imageViewConfigStore: {imageNum: 2},
            widgetsStore: {animatorWidgets: new Map()},
            timeSeriesStore: {elements: []},
            animatorStore: {step: 2, isAnimationActive: false},
            channelMapStore: {isChannelMapEnabled}
        } as any);
        const component = new AnimatorComponent({} as any);
        component.onNumericInputTypeChange(NumericInputType.FrameRate);
        const findSelect = (node: React.ReactNode): React.ReactElement<{value: string; disabled: boolean}> | undefined => {
            if (!React.isValidElement<{children?: React.ReactNode}>(node)) {
                return undefined;
            }
            if (node.type === HTMLSelect) {
                return node as React.ReactElement<{value: string; disabled: boolean}>;
            }
            return React.Children.toArray(node.props.children).map(findSelect).find(Boolean);
        };
        const select = findSelect(component.render());
        expect(select?.props.disabled).toBe(isChannelMapEnabled);
        expect(select?.props.value).toBe(isChannelMapEnabled ? NumericInputType.Step : NumericInputType.FrameRate);
        component.componentWillUnmount();
    });
});
