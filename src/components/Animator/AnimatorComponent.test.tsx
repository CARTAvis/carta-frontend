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

    test("ignores channel changes within 50ms of the first change", () => {
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
        component.onChannelChanged(20);
        expect(frame.setChannel).toHaveBeenCalledTimes(2);
        expect(frame.setChannel).toHaveBeenLastCalledWith(20);

        component.componentWillUnmount();
    });
});
