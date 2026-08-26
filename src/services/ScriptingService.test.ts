const MOCK_UNDEFINED_TARGET = Object.create({value: undefined});

const MOCK_APP_STORE = {
    acceptUndefined: (value: unknown) => value === undefined,
    fetchParameter: (value: unknown) => value,
    noResponse: () => undefined,
    nullResponse: () => null,
    objectResponse: () => ({nested: {value: 42, undefinedValue: undefined}}),
    undefinedTargets: [MOCK_UNDEFINED_TARGET]
};

jest.mock("stores", () => ({
    AppStore: {Instance: MOCK_APP_STORE}
}));

import {ScriptingService} from "./ScriptingService";

const MakeRequest = (action: string, parameters: unknown[] = [], returnPath = "") => ({
    scriptingRequestId: 1,
    target: "",
    action,
    parameters: JSON.stringify(parameters),
    async: false,
    returnPath
});

describe("ScriptingService", () => {
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

    test("allows an action with no response", async () => {
        const response = await ScriptingService.Instance.handleScriptingRequest(MakeRequest("noResponse"));

        expect(response).toMatchObject({success: true});
        expect(response.response).toBeUndefined();
    });

    test("serializes a null response", async () => {
        const response = await ScriptingService.Instance.handleScriptingRequest(MakeRequest("nullResponse"));

        expect(response).toMatchObject({success: true, response: "null"});
    });
});
