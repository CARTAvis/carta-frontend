import Ajv from "ajv";

import {FrameScaling} from "enums";
import {getScalingParameterConfig} from "utilities/scaling/scaling";

const PREFERENCE_SCHEMA = require("carta-schemas/preferences_schema_2.json");
const WORKSPACE_SCHEMA = require("carta-schemas/workspace_schema_1.json");

const AJV = new Ajv({strictTypes: false});

describe("scaling parameter schemas", () => {
    const scalingProperties = [
        {scaling: FrameScaling.LOG, workspaceKey: "alphaLog"},
        {scaling: FrameScaling.POWER, workspaceKey: "alphaPower"},
        {scaling: FrameScaling.SINH, workspaceKey: "alphaSinh"},
        {scaling: FrameScaling.ASINH, workspaceKey: "alphaAsinh"},
        {scaling: FrameScaling.GAMMA, workspaceKey: "gamma"}
    ];

    test.each(scalingProperties)("matches runtime bounds for scaling $scaling", ({scaling, workspaceKey}) => {
        const config = getScalingParameterConfig(scaling)!;
        const preferenceProperty = PREFERENCE_SCHEMA.properties[config.preferenceKey];
        const workspaceProperty = WORKSPACE_SCHEMA.definitions["render-config"].properties[workspaceKey];

        expect(preferenceProperty).toMatchObject({minimum: config.min, maximum: config.max});
        expect(workspaceProperty).toMatchObject({minimum: config.min, maximum: config.max});

        for (const property of [preferenceProperty, workspaceProperty]) {
            const validate = AJV.compile(property);
            expect(validate(config.min)).toBe(true);
            expect(validate(config.max)).toBe(true);
            expect(validate(config.min / 2)).toBe(false);
            expect(validate(config.max * 2)).toBe(false);
            expect(validate(1e-300)).toBe(false);
            expect(validate(1e300)).toBe(false);
        }
    });

    test("excludes the legacy workspace alpha field", () => {
        expect(WORKSPACE_SCHEMA.definitions["render-config"].properties).not.toHaveProperty("alpha");
    });

    test("leaves supported scaling validation to the frontend", () => {
        const scalingProperties = [PREFERENCE_SCHEMA.properties.scaling, WORKSPACE_SCHEMA.definitions["render-config"].properties.scaling];
        for (const property of scalingProperties) {
            expect(property).toMatchObject({type: "integer", minimum: 0});
            expect(property).not.toHaveProperty("maximum");
        }
    });
});
