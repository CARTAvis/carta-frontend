import {describe, expect, test} from "@jest/globals";

import {formatSize, getFieldOfViewScale, isSameSize, isValidImageViewSize, waitForStableSize, workspaceWindowUrl} from "./WorkspaceFieldOfView";

describe("WorkspaceFieldOfView", () => {
    test("uses the smaller scale of the width and the height, so that the saved area fits", () => {
        expect(getFieldOfViewScale({width: 1600, height: 900, devicePixelRatio: 1}, {width: 1280, height: 800}, 1)).toBeCloseTo(0.8);
        expect(getFieldOfViewScale({width: 1000, height: 500, devicePixelRatio: 2}, {width: 1000, height: 500}, 1)).toBeCloseTo(0.5);
        expect(getFieldOfViewScale({width: 1000, height: 500, devicePixelRatio: NaN}, {width: 1000, height: 500}, 2)).toBeCloseTo(2);
    });

    test("compares sizes in whole pixels", () => {
        expect(isSameSize({width: 1600.4, height: 900}, {width: 1600, height: 900})).toBe(true);
        expect(isSameSize({width: 1600, height: 900}, {width: 1599, height: 900})).toBe(false);
        expect(formatSize({width: 757.6, height: 461})).toBe("758×461");
    });

    test("accepts only a size with a positive width and height", () => {
        expect(isValidImageViewSize({width: 10, height: 20, devicePixelRatio: 1})).toBe(true);
        expect(isValidImageViewSize({width: 0, height: 20})).toBe(false);
        expect(isValidImageViewSize("640x400")).toBe(false);
        expect(isValidImageViewSize(undefined)).toBe(false);
    });

    test("opens the workspace in a new window, and keeps only the parameters that connect to the server", () => {
        expect(workspaceWindowUrl("https://carta.example/?socketUrl=wss%3A%2F%2Fhost&file=a.fits&folder=data&workspace=old", "my view")).toBe("https://carta.example/?socketUrl=wss%3A%2F%2Fhost&workspace=my+view&checkWindowSize=true");
        expect(workspaceWindowUrl("http://localhost:3002/?key=abc", "ws")).toBe("http://localhost:3002/?workspace=ws&checkWindowSize=true");
    });

    test("waits for the size of a layout that takes longer to show than two checks", async () => {
        let size = {width: 1600, height: 900};
        let lastRead = size;
        setTimeout(() => (size = {width: 800, height: 450}), 120);

        await waitForStableSize(() => (lastRead = size), 50, 1000);

        expect(lastRead).toEqual({width: 800, height: 450});
    });

    test("gives up after the longest wait when the size keeps changing", async () => {
        let width = 100;
        const start = Date.now();

        await waitForStableSize(() => ({width: width++, height: 100}), 20, 200);

        expect(Date.now() - start).toBeGreaterThanOrEqual(200);
    });
});
