import {describe, expect, test} from "@jest/globals";

import {type Workspace} from "models";

import {describeRestoredSettings} from "./WorkspaceSummary";

describe("describeRestoredSettings", () => {
    test("names only the settings that the workspace holds", () => {
        const workspace: Workspace = {
            workspaceVersion: 2,
            frontendVersion: 0,
            files: [{id: 1, contourConfig: {levels: [1, 2]} as never}],
            layout: {} as never,
            cursor: {frozen: false},
            openDialogs: [],
            imageFitting: {} as never,
            plotWidgets: {"spectral-profiler-0": {} as never}
        };

        expect(describeRestoredSettings(workspace)).toEqual(["Contours", "Layout", "Profile and analysis widgets", "Image fitting"]);
    });

    test("names nothing for a workspace with only images", () => {
        expect(describeRestoredSettings({workspaceVersion: 2, frontendVersion: 0, files: [{id: 1}]})).toEqual([]);
    });
});
