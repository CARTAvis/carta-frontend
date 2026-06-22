import {parseSnippetArgValue, parseSnippetParameters, stripSnippetParameters} from "./parsing";

describe("parseSnippetArgValue", () => {
    test("coerces JSON-compatible values to their native types", () => {
        expect(parseSnippetArgValue("5")).toBe(5);
        expect(parseSnippetArgValue("5.5")).toBe(5.5);
        expect(parseSnippetArgValue("true")).toBe(true);
        expect(parseSnippetArgValue("false")).toBe(false);
        expect(parseSnippetArgValue("null")).toBeNull();
        expect(parseSnippetArgValue("[1,2,3]")).toEqual([1, 2, 3]);
        expect(parseSnippetArgValue('{"a":1}')).toEqual({a: 1});
    });

    test("falls back to the raw string for non-JSON values", () => {
        expect(parseSnippetArgValue("hello")).toBe("hello");
        expect(parseSnippetArgValue("/home/user/image.fits")).toBe("/home/user/image.fits");
        expect(parseSnippetArgValue("")).toBe("");
    });
});

describe("parseSnippetParameters", () => {
    test("returns undefined when no snippet parameter is present", () => {
        expect(parseSnippetParameters(new URLSearchParams(""))).toBeUndefined();
        expect(parseSnippetParameters(new URLSearchParams("file=test.fits"))).toBeUndefined();
    });

    test("returns the snippet name with empty parameters when no args are given", () => {
        expect(parseSnippetParameters(new URLSearchParams("snippet=My%20Snippet"))).toEqual({name: "My Snippet", parameters: {}});
    });

    test("parses parameters from snippet_<arg_name> query parameters with type coercion", () => {
        const result = parseSnippetParameters(new URLSearchParams("snippet=Foo&snippet_threshold=5&snippet_name=bar&snippet_enabled=true"));
        expect(result).toEqual({
            name: "Foo",
            parameters: {threshold: 5, name: "bar", enabled: true}
        });
    });

    test("parses parameters from a snippetArgs JSON object", () => {
        const result = parseSnippetParameters(new URLSearchParams(`snippet=Foo&snippetArgs=${encodeURIComponent('{"threshold":5,"name":"bar"}')}`));
        expect(result).toEqual({
            name: "Foo",
            parameters: {threshold: 5, name: "bar"}
        });
    });

    test("merges both sources, with snippet_<arg_name> overriding snippetArgs", () => {
        const result = parseSnippetParameters(new URLSearchParams(`snippet=Foo&snippetArgs=${encodeURIComponent('{"threshold":5,"shared":"json"}')}&snippet_shared=override&snippet_extra=1`));
        expect(result).toEqual({
            name: "Foo",
            parameters: {threshold: 5, shared: "override", extra: 1}
        });
    });

    test("parses base64-encoded snippetArgs JSON", () => {
        const b64 = btoa(JSON.stringify({threshold: 5, name: "bar"}));
        const result = parseSnippetParameters(new URLSearchParams(`snippet=Foo&snippetArgs=${b64}`));
        expect(result).toEqual({name: "Foo", parameters: {threshold: 5, name: "bar"}});
    });

    test("parses base64url-encoded snippetArgs JSON ('-_' alphabet, padding stripped)", () => {
        const b64url = btoa(JSON.stringify({path: "/data/jet.fits", n: 1}))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
        const result = parseSnippetParameters(new URLSearchParams(`snippet=Foo&snippetArgs=${b64url}`));
        expect(result).toEqual({name: "Foo", parameters: {path: "/data/jet.fits", n: 1}});
    });

    test("plain JSON snippetArgs still wins (not mis-decoded as base64)", () => {
        const result = parseSnippetParameters(new URLSearchParams(`snippet=Foo&snippetArgs=${encodeURIComponent('{"x":1}')}`));
        expect(result).toEqual({name: "Foo", parameters: {x: 1}});
    });

    test("merges base64-encoded snippetArgs with overriding snippet_ args", () => {
        const b64 = btoa(JSON.stringify({threshold: 5, shared: "json"}));
        const result = parseSnippetParameters(new URLSearchParams(`snippet=Foo&snippetArgs=${b64}&snippet_shared=override`));
        expect(result).toEqual({name: "Foo", parameters: {threshold: 5, shared: "override"}});
    });

    test("ignores invalid snippetArgs JSON and keeps individual parameters", () => {
        const result = parseSnippetParameters(new URLSearchParams("snippet=Foo&snippetArgs=not-json&snippet_x=1"));
        expect(result).toEqual({name: "Foo", parameters: {x: 1}});
    });

    test("ignores a snippetArgs value that is not a JSON object", () => {
        const result = parseSnippetParameters(new URLSearchParams(`snippet=Foo&snippetArgs=${encodeURIComponent("[1,2,3]")}`));
        expect(result).toEqual({name: "Foo", parameters: {}});
    });

    test("ignores a bare snippet_ key with no argument name", () => {
        const result = parseSnippetParameters(new URLSearchParams("snippet=Foo&snippet_=value"));
        expect(result).toEqual({name: "Foo", parameters: {}});
    });
});

describe("stripSnippetParameters", () => {
    test("removes snippet, snippetArgs and snippet_* keys, keeping others", () => {
        const params = new URLSearchParams("file=test.fits&snippet=Foo&snippetArgs=%7B%7D&snippet_x=1&folder=/data");
        expect(stripSnippetParameters(params)).toBe(true);
        expect(params.toString()).toBe(new URLSearchParams("file=test.fits&folder=/data").toString());
    });

    test("returns false and changes nothing when there are no snippet parameters", () => {
        const params = new URLSearchParams("file=test.fits&folder=/data");
        expect(stripSnippetParameters(params)).toBe(false);
        expect(params.toString()).toBe(new URLSearchParams("file=test.fits&folder=/data").toString());
    });
});
