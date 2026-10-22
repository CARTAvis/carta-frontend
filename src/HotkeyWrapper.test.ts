import React from "react";
import {HotkeysProvider} from "@blueprintjs/core";
import {cleanup, render} from "@testing-library/react";

import {AppStore} from "stores";

import {HotkeyService, HotkeysRegistrar} from "./HotkeyWrapper";

const MockSelection = (text: string) => ({isCollapsed: text.length === 0, toString: () => text}) as unknown as Selection;

const MakeKeyboardEvent = () => {
    const event = new KeyboardEvent("keydown", {key: "c", metaKey: true, cancelable: true});
    jest.spyOn(event, "preventDefault");
    jest.spyOn(event, "stopPropagation");
    return event;
};

describe("HotkeyService.copyRegion", () => {
    const copySelectedRegion = jest.fn();

    beforeEach(() => {
        copySelectedRegion.mockReset();
        copySelectedRegion.mockReturnValue(true);
        // copySelectedRegion is a non-writable MobX action field, so stub the store instance rather than the method
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({copySelectedRegion} as unknown as AppStore);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("copies the focused region when no text is highlighted", () => {
        jest.spyOn(window, "getSelection").mockReturnValue(MockSelection(""));
        const event = MakeKeyboardEvent();

        HotkeyService.copyRegion(event);

        expect(copySelectedRegion).toHaveBeenCalledTimes(1);
        expect(event.preventDefault).toHaveBeenCalled();
        expect(event.stopPropagation).toHaveBeenCalled();
    });

    test("copies the focused region when getSelection is unavailable", () => {
        jest.spyOn(window, "getSelection").mockReturnValue(null);

        HotkeyService.copyRegion(MakeKeyboardEvent());

        expect(copySelectedRegion).toHaveBeenCalledTimes(1);
    });

    test("leaves the event to the browser when text is highlighted (issue #2892)", () => {
        jest.spyOn(window, "getSelection").mockReturnValue(MockSelection("NAXIS2 = 800"));
        const event = MakeKeyboardEvent();

        HotkeyService.copyRegion(event);

        expect(copySelectedRegion).not.toHaveBeenCalled();
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(event.stopPropagation).not.toHaveBeenCalled();
    });

    test("does not prevent the default copy when there is no region to copy", () => {
        copySelectedRegion.mockReturnValue(false);
        jest.spyOn(window, "getSelection").mockReturnValue(MockSelection(""));
        const event = MakeKeyboardEvent();

        HotkeyService.copyRegion(event);

        expect(copySelectedRegion).toHaveBeenCalledTimes(1);
        expect(event.preventDefault).not.toHaveBeenCalled();
    });
});

describe("HotkeysRegistrar", () => {
    const originalTarget = process.env.PUBLIC_REACT_APP_TARGET;
    beforeEach(() => {
        delete process.env.PUBLIC_REACT_APP_TARGET;
    });
    afterEach(() => {
        cleanup();
        jest.restoreAllMocks();
        if (originalTarget === undefined) delete process.env.PUBLIC_REACT_APP_TARGET;
        else process.env.PUBLIC_REACT_APP_TARGET = originalTarget;
    });

    test("handles macOS dead-key events for Alt+E", () => {
        const exportImage = jest.spyOn(AppStore.Instance, "exportImage").mockImplementation(() => undefined);
        render(React.createElement(HotkeysProvider, null, React.createElement(HotkeysRegistrar)));

        document.dispatchEvent(new KeyboardEvent("keydown", {altKey: true, bubbles: true, cancelable: true, code: "KeyE", key: "Dead"}));

        expect(exportImage).toHaveBeenCalledWith(1);
    });

    test.each(["linux", "darwin"])("does not register the Alt+E fallback for the %s target", target => {
        process.env.PUBLIC_REACT_APP_TARGET = target;
        const exportImage = jest.spyOn(AppStore.Instance, "exportImage").mockImplementation(() => undefined);
        render(React.createElement(HotkeysProvider, null, React.createElement(HotkeysRegistrar)));
        document.dispatchEvent(new KeyboardEvent("keydown", {altKey: true, bubbles: true, code: "KeyE", key: "Dead"}));
        expect(exportImage).not.toHaveBeenCalled();
    });

    test.each(["", "true", "plaintext-only"])("preserves Alt+E when typing inside contenteditable=%s", value => {
        const exportImage = jest.spyOn(AppStore.Instance, "exportImage").mockImplementation(() => undefined);
        const {container} = render(React.createElement(HotkeysProvider, null, React.createElement(HotkeysRegistrar)));
        const editable = document.createElement("div");
        editable.setAttribute("contenteditable", value);
        const child = document.createElement("span");
        editable.appendChild(child);
        container.appendChild(editable);
        child.dispatchEvent(new KeyboardEvent("keydown", {altKey: true, bubbles: true, code: "KeyE", key: "Dead"}));
        expect(exportImage).not.toHaveBeenCalled();
    });
});
