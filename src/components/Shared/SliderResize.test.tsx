import {Classes} from "@blueprintjs/core";
import {act, fireEvent, render} from "@testing-library/react";

import {Slider} from "./Slider/Slider";

describe("Slider", () => {
    const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    const originalResizeObserver = window.ResizeObserver;

    afterEach(() => {
        if (originalClientWidth) {
            Object.defineProperty(HTMLElement.prototype, "clientWidth", originalClientWidth);
        }
        window.ResizeObserver = originalResizeObserver;
    });

    test("uses the resized track width when converting a click to a value", () => {
        let trackWidth = 100;
        let resizeCallback: ResizeObserverCallback | undefined;

        class MockResizeObserver {
            constructor(callback: ResizeObserverCallback) {
                resizeCallback = callback;
            }

            observe() {}
            unobserve() {}
            disconnect() {}
        }

        window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
        Object.defineProperty(HTMLElement.prototype, "clientWidth", {
            configurable: true,
            get() {
                return this.classList.contains(Classes.SLIDER_TRACK) ? trackWidth : 0;
            }
        });

        const onChange = jest.fn();
        const {container} = render(<Slider min={0} max={10} value={0} onChange={onChange} labelRenderer={false} />);

        trackWidth = 200;
        act(() => resizeCallback?.([], {} as ResizeObserver));
        fireEvent.mouseDown(container.querySelector(`.${Classes.SLIDER_TRACK}`)!, {clientX: 100});

        expect(onChange).toHaveBeenLastCalledWith(5);
    });
});
