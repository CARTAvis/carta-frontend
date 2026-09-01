const MOCK_UNDEFINED_TARGET = Object.create({value: undefined});

const MOCK_APP_STORE = {
    acceptUndefined: (value: unknown) => value === undefined,
    fetchParameter: (value: unknown) => value,
    getObject: () => ({nested: {id: 7}}),
    getResponse: (): any => [],
    getScalar: () => 5,
    noResponse: () => undefined,
    nullResponse: () => null,
    objectResponse: () => ({nested: {value: 42, undefinedValue: undefined}}),
    undefinedTargets: [MOCK_UNDEFINED_TARGET]
};

jest.mock("stores", () => ({
    AppStore: {Instance: MOCK_APP_STORE}
}));

import type {CARTA} from "carta-protobuf";

import {markAsScriptingMap} from "scripting/returnPath";

import {ScriptingService} from "./ScriptingService";

const MakeRequest = (action: string, parameters: unknown[] = [], returnPath = ""): CARTA.ScriptingRequest.$Properties => ({
    scriptingRequestId: 1,
    target: "",
    action,
    parameters: JSON.stringify(parameters),
    async: false,
    returnPath
});

describe("ScriptingService", () => {
    const scriptingService = new ScriptingService();

    beforeEach(() => {
        jest.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test.each([
        [{macroTarget: "", macroVariable: "missingAttribute"}, "missingAttribute"],
        [{macroTarget: "missingAttribute", macroVariable: "nested"}, "missingAttribute.nested"]
    ])("rejects a missing macro target", async (macro, target) => {
        const response = await ScriptingService.Instance.handleScriptingRequest(MakeRequest("fetchParameter", [macro]));

        expect(response).toMatchObject({
            scriptingRequestId: 1,
            success: false,
            message: `Missing macro target: ${target}`
        });
        expect(response.response).toBeUndefined();
    });

    test("preserves an explicit undefined macro", async () => {
        const response = await ScriptingService.Instance.handleScriptingRequest(MakeRequest("acceptUndefined", [{macroTarget: "", macroVariable: "undefined"}]));

        expect(response).toMatchObject({success: true, response: "true"});
    });

    test("serializes an existing undefined macro target as null", async () => {
        const response = await ScriptingService.Instance.handleScriptingRequest(MakeRequest("fetchParameter", [{macroTarget: "undefinedTargets[0]", macroVariable: "value"}]));

        expect(response).toMatchObject({success: true, response: "null"});
    });

    test("rejects a missing response path", async () => {
        const response = await ScriptingService.Instance.handleScriptingRequest(MakeRequest("objectResponse", [], "nested.missing"));

        expect(response).toMatchObject({
            success: false,
            message: "Missing response path: nested.missing"
        });
        expect(response.response).toBeUndefined();
    });

    test("returns an existing response path", async () => {
        const response = await ScriptingService.Instance.handleScriptingRequest(MakeRequest("objectResponse", [], "nested.value"));

        expect(response).toMatchObject({success: true, response: "42"});
    });

    test("serializes an existing undefined response path as null", async () => {
        const response = await ScriptingService.Instance.handleScriptingRequest(MakeRequest("objectResponse", [], "nested.undefinedValue"));

        expect(response).toMatchObject({success: true, response: "null"});
    });

    test("rejects a return path for a scalar response", async () => {
        const response = await scriptingService.handleScriptingRequest(MakeRequest("getScalar", [], "id"));

        expect(response).toMatchObject({
            success: false,
            message: "Cannot read response path from a non-object response: id"
        });
    });

    test("rejects a missing return path from an array response", async () => {
        MOCK_APP_STORE.getResponse = () => [{id: 1}, {id: 2}];

        const response = await scriptingService.handleScriptingRequest(MakeRequest("getResponse", [], "missing"));

        expect(response).toMatchObject({
            success: false,
            message: "Missing response path: missing"
        });
    });

    test("allows an action with no response", async () => {
        const response = await ScriptingService.Instance.handleScriptingRequest(MakeRequest("noResponse"));

        expect(response).toMatchObject({success: true});
        expect(response.response).toBeUndefined();
    });

    test("serializes a null response", async () => {
        const response = await ScriptingService.Instance.handleScriptingRequest(MakeRequest("nullResponse"));

        expect(response).toMatchObject({success: true, response: "null"});
    });

    test("reports when a response cannot be serialized", async () => {
        const circularResponse: any = {};
        circularResponse.self = circularResponse;
        MOCK_APP_STORE.getResponse = () => circularResponse;

        const response = await scriptingService.handleScriptingRequest(MakeRequest("getResponse"));

        expect(response).toMatchObject({
            success: false,
            message: "Response cannot be serialized to JSON because it contains a circular reference or unsupported value. Use return_path to select JSON-serializable fields."
        });
    });

    test("applies return_path to every element in an array", async () => {
        MOCK_APP_STORE.getResponse = () => [{id: 1}, {id: 2}];

        const response = await scriptingService.handleScriptingRequest(MakeRequest("getResponse", [], "id"));

        expect(response.success).toBe(true);
        expect(JSON.parse(response.response ?? "null")).toEqual([1, 2]);
    });

    test("returns an object of selected values for every array element", async () => {
        MOCK_APP_STORE.getResponse = () => [
            {id: 1, type: "frame"},
            {id: 2, type: "colorBlending"}
        ];

        const response = await scriptingService.handleScriptingRequest(MakeRequest("getResponse", [], JSON.stringify(["id", "type"])));

        expect(response.success).toBe(true);
        expect(JSON.parse(response.response ?? "null")).toEqual([
            {id: 1, type: "frame"},
            {id: 2, type: "colorBlending"}
        ]);
    });

    test("rejects a structured return path with a non-string array element", async () => {
        MOCK_APP_STORE.getResponse = () => [{id: 1}];

        const response = await scriptingService.handleScriptingRequest(MakeRequest("getResponse", [], JSON.stringify(["id", false])));

        expect(response).toMatchObject({
            success: false,
            message: "Invalid return path at index 1: expected a string, got false"
        });
    });

    test("rejects a structured return path with a missing path", async () => {
        MOCK_APP_STORE.getResponse = () => [{frameInfo: {fileId: 0}}, {frameInfo: {fileId: 1}}];

        const response = await scriptingService.handleScriptingRequest(MakeRequest("getResponse", [], JSON.stringify(["frameInfo.fileId", "not_existing"])));

        expect(response).toMatchObject({
            success: false,
            message: "Missing response path: not_existing"
        });
    });

    test("uses aliases when selecting multiple paths", async () => {
        MOCK_APP_STORE.getResponse = () => [{frameInfo: {fileId: 7}, name: "image.fits"}];

        const response = await scriptingService.handleScriptingRequest(MakeRequest("getResponse", [], JSON.stringify({id: "frameInfo.fileId", label: "name"})));

        expect(response.success).toBe(true);
        expect(JSON.parse(response.response ?? "null")).toEqual([{id: 7, label: "image.fits"}]);
    });

    test("applies return_path to every value in a native Map", async () => {
        MOCK_APP_STORE.getResponse = () =>
            new Map([
                ["first", {id: 1}],
                ["second", {id: 2}]
            ]);

        const response = await scriptingService.handleScriptingRequest(MakeRequest("getResponse", [], "id"));

        expect(response.success).toBe(true);
        expect(JSON.parse(response.response ?? "null")).toEqual({first: 1, second: 2});
    });

    test("applies return_path to values converted from a frontend Map", async () => {
        MOCK_APP_STORE.getResponse = () =>
            markAsScriptingMap({
                first: {id: 1},
                second: {id: 2}
            });

        const response = await scriptingService.handleScriptingRequest(MakeRequest("getResponse", [], "id"));

        expect(response.success).toBe(true);
        expect(JSON.parse(response.response ?? "null")).toEqual({first: 1, second: 2});
    });

    test("returns selected objects for every value in a map", async () => {
        MOCK_APP_STORE.getResponse = () =>
            markAsScriptingMap({
                first: {id: 1, type: "frame"},
                second: {id: 2, type: "colorBlending"}
            });

        const response = await scriptingService.handleScriptingRequest(MakeRequest("getResponse", [], JSON.stringify(["id", "type"])));

        expect(response.success).toBe(true);
        expect(JSON.parse(response.response ?? "null")).toEqual({
            first: {id: 1, type: "frame"},
            second: {id: 2, type: "colorBlending"}
        });
    });
});
