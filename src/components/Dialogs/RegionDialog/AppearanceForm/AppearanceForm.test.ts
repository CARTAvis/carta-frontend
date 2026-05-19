import {CARTA} from "carta-protobuf";

import {AppearanceControl} from "enums";

import {AppearanceForm} from "./AppearanceForm";

const makeRegion = (regionType: CARTA.RegionType) => ({regionType}) as any;

describe("AppearanceForm control selection", () => {
    test("returns point controls for annotation points", () => {
        expect(AppearanceForm.getControlsForRegion(makeRegion(CARTA.RegionType.ANNPOINT))).toEqual(new Set([AppearanceControl.Color, AppearanceControl.Point]));
    });

    test("returns text controls for text annotations", () => {
        expect(AppearanceForm.getControlsForRegion(makeRegion(CARTA.RegionType.ANNTEXT))).toEqual(new Set([AppearanceControl.Color, AppearanceControl.Font, AppearanceControl.TextAlignment]));
    });

    test("returns vector-specific controls for vector annotations", () => {
        expect(AppearanceForm.getControlsForRegion(makeRegion(CARTA.RegionType.ANNVECTOR))).toEqual(new Set([AppearanceControl.Color, AppearanceControl.LineWidth, AppearanceControl.DashLength, AppearanceControl.VectorPointer]));
    });

    test("returns compass and ruler specific controls", () => {
        expect(AppearanceForm.getControlsForRegion(makeRegion(CARTA.RegionType.ANNCOMPASS))).toEqual(
            new Set([AppearanceControl.Color, AppearanceControl.LineWidth, AppearanceControl.DashLength, AppearanceControl.Font, AppearanceControl.Compass])
        );
        expect(AppearanceForm.getControlsForRegion(makeRegion(CARTA.RegionType.ANNRULER))).toEqual(
            new Set([AppearanceControl.Color, AppearanceControl.LineWidth, AppearanceControl.DashLength, AppearanceControl.Font, AppearanceControl.Ruler])
        );
    });

    test("returns only controls common to all selected regions", () => {
        expect(AppearanceForm.getCommonControls([makeRegion(CARTA.RegionType.ANNVECTOR), makeRegion(CARTA.RegionType.ANNCOMPASS)])).toEqual(new Set([AppearanceControl.Color, AppearanceControl.LineWidth, AppearanceControl.DashLength]));
        expect(AppearanceForm.getCommonControls([])).toEqual(new Set());
    });
});
