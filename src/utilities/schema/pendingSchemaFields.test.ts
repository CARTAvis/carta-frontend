import {PENDING_SCHEMA_FIELDS, undeclaredFields} from "./pendingSchemaFields";

const SCHEMAS: Record<string, {definitions: Record<string, {properties?: {widgetSettings?: {properties?: object}}}>}> = {
    workspace: require("carta-schemas/workspace_schema_2.json"),
    layout: require("carta-schemas/layout_schema_2.json")
};

describe("fields the schemas do not declare yet", () => {
    test.each(Object.entries(PENDING_SCHEMA_FIELDS))("%s lists only fields its schema still leaves undeclared", (definitionId, fields) => {
        const [schema, definition] = definitionId.split("/");
        const properties = SCHEMAS[schema].definitions[definition]?.properties;
        // A layout saves the settings of a widget in `widgetSettings`, next to the type and ID of the widget.
        const declared = (schema === "layout" ? properties?.widgetSettings?.properties : properties) ?? {};

        expect(fields.filter(field => field in declared)).toEqual([]);
    });

    test("leaves out the fields a definition declares and the ones listed as pending", () => {
        expect(undeclaredFields("layout/histogram", {lineWidth: {}}, {lineWidth: 1, meanRmsVisible: true, extra: 1})).toEqual(["extra"]);
    });

    test("counts every written field as undeclared when the schema has no such definition yet", () => {
        expect(undeclaredFields("layout/unknown", undefined, {a: 1})).toEqual(["a"]);
    });
});
