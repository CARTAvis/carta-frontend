jest.mock("stores", () => ({
    AppStore: {
        Instance: {}
    }
}));

import type {CARTA} from "carta-protobuf";

import {markAsScriptingMap} from "scripting/returnPath";
import {AppStore} from "stores";

import {ScriptingService} from "./ScriptingService";

const MakeRequest = (action: string, returnPath?: string): CARTA.ScriptingRequest.$Properties => ({
    action,
    async: false,
    parameters: "",
    returnPath,
    scriptingRequestId: 1
});

describe("[unit] ScriptingService return_path", () => {
    const appStore = AppStore.Instance as any;
    const scriptingService = new ScriptingService();

    beforeEach(() => {
        Object.keys(appStore).forEach(key => delete appStore[key]);
    });

    test("applies return_path to every element in an array", async () => {
        appStore.getResponse = jest.fn(() => [{id: 1}, {id: 2}]);

        const response = await scriptingService.handleScriptingRequest(MakeRequest("getResponse", "id"));

        expect(response.success).toBe(true);
        expect(JSON.parse(response.response ?? "null")).toEqual([1, 2]);
    });

    test("returns an object of selected values for every array element", async () => {
        appStore.getResponse = jest.fn(() => [
            {id: 1, type: "frame"},
            {id: 2, type: "colorBlending"}
        ]);

        const response = await scriptingService.handleScriptingRequest(MakeRequest("getResponse", JSON.stringify(["id", "type"])));

        expect(response.success).toBe(true);
        expect(JSON.parse(response.response ?? "null")).toEqual([
            {id: 1, type: "frame"},
            {id: 2, type: "colorBlending"}
        ]);
    });

    test("uses aliases when selecting multiple paths", async () => {
        appStore.getResponse = jest.fn(() => [{frameInfo: {fileId: 7}, name: "image.fits"}]);

        const response = await scriptingService.handleScriptingRequest(MakeRequest("getResponse", JSON.stringify({id: "frameInfo.fileId", label: "name"})));

        expect(response.success).toBe(true);
        expect(JSON.parse(response.response ?? "null")).toEqual([{id: 7, label: "image.fits"}]);
    });

    test("applies return_path to every value in a native Map", async () => {
        appStore.getResponse = jest.fn(
            () =>
                new Map([
                    ["first", {id: 1}],
                    ["second", {id: 2}]
                ])
        );

        const response = await scriptingService.handleScriptingRequest(MakeRequest("getResponse", "id"));

        expect(response.success).toBe(true);
        expect(JSON.parse(response.response ?? "null")).toEqual({first: 1, second: 2});
    });

    test("applies return_path to values converted from a frontend Map", async () => {
        appStore.getResponse = jest.fn(() =>
            markAsScriptingMap({
                first: {id: 1},
                second: {id: 2}
            })
        );

        const response = await scriptingService.handleScriptingRequest(MakeRequest("getResponse", "id"));

        expect(response.success).toBe(true);
        expect(JSON.parse(response.response ?? "null")).toEqual({first: 1, second: 2});
    });

    test("returns selected objects for every value in a map", async () => {
        appStore.getResponse = jest.fn(() =>
            markAsScriptingMap({
                first: {id: 1, type: "frame"},
                second: {id: 2, type: "colorBlending"}
            })
        );

        const response = await scriptingService.handleScriptingRequest(MakeRequest("getResponse", JSON.stringify(["id", "type"])));

        expect(response.success).toBe(true);
        expect(JSON.parse(response.response ?? "null")).toEqual({
            first: {id: 1, type: "frame"},
            second: {id: 2, type: "colorBlending"}
        });
    });

    test("preserves scalar and ordinary object return_path behavior", async () => {
        appStore.getScalar = jest.fn(() => 5);
        const scalarResponse = await scriptingService.handleScriptingRequest(MakeRequest("getScalar", "id"));

        appStore.getObject = jest.fn(() => ({nested: {id: 7}}));
        const objectResponse = await scriptingService.handleScriptingRequest(MakeRequest("getObject", "nested.id"));

        expect(JSON.parse(scalarResponse.response ?? "null")).toBe(5);
        expect(JSON.parse(objectResponse.response ?? "null")).toBe(7);
    });
});
