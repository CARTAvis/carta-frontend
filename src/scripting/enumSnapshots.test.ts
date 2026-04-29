import {getEnumSnapshots, listEnumSnapshots} from "./enumSnapshots";

describe("enumSnapshots", () => {
    it("lists discovered enums in sorted order and covers the core verified set", () => {
        const names = listEnumSnapshots();
        const coreNames = [
            "BeamType",
            "ColorMap",
            "ContourDashMode",
            "protobuf:CoordinateType",
            "protobuf:FileType",
            "Font",
            "FontStyle",
            "FrameScaling",
            "ImagePanelMode",
            "LabelType",
            "NumberFormatType",
            "POLARIZATIONS",
            "protobuf:PointAnnotationShape",
            "protobuf:RegionType",
            "protobuf:SmoothingMode",
            "SpectralSystem",
            "SpectralType",
            "SpectralUnit",
            "SystemType",
            "protobuf:TextAnnotationPosition",
            "VectorOverlaySource"
        ];

        expect(names).toEqual(expect.arrayContaining(coreNames));
        expect(names).toEqual([...names].sort());
    });

    it("auto-discovers frontend enums beyond the historical curated set", () => {
        // CatalogType, BrowserMode, WidgetType were never in the old REGISTRY but
        // are public `export enum`s in src/enums/. carta-python should be able to
        // verify any of them without requiring a frontend code change.
        const snapshots = getEnumSnapshots(["CatalogType", "BrowserMode", "WidgetType"]);
        expect(snapshots).toHaveLength(3);
        expect(snapshots.every(entries => entries.length > 0)).toBe(true);
    });

    it("returns snapshots in the same order as the requested names", () => {
        const [fileType, catalogType] = getEnumSnapshots(["protobuf:FileType", "CatalogType"]);

        expect(fileType).toEqual(expect.arrayContaining([{name: "CASA", value: 0}]));
        expect(catalogType).toEqual(expect.arrayContaining([{name: "VIZIER", value: 0}]));
    });

    it("includes source values that are currently missing from carta-python constants", () => {
        const [frameScaling, regionType, spectralType] = getEnumSnapshots(["FrameScaling", "protobuf:RegionType", "SpectralType"]);

        expect(frameScaling).toEqual(
            expect.arrayContaining([
                {name: "EXP", value: 6},
                {name: "CUSTOM", value: 7}
            ])
        );
        expect(regionType).toEqual(expect.arrayContaining([{name: "ANNULUS", value: 5}]));
        expect(spectralType).toEqual(
            expect.arrayContaining([
                {name: "CHANNEL", value: "CHANNEL"},
                {name: "NATIVE", value: "NATIVE"}
            ])
        );
    });

    it("preserves the raw frontend enum keys without case normalization", () => {
        const [numberFormatType, contourDashMode] = getEnumSnapshots(["NumberFormatType", "ContourDashMode"]);

        expect(numberFormatType).toEqual(expect.arrayContaining([{name: "Degrees", value: "d"}]));
        expect(contourDashMode).toEqual(expect.arrayContaining([{name: "NegativeOnly", value: "Negative only"}]));
    });

    it("uses protobuf-prefixed names for CARTA protobuf enums", () => {
        const names = listEnumSnapshots();
        expect(names).toEqual(expect.arrayContaining(["ComparisonOperator", "protobuf:ComparisonOperator", "protobuf:RegionType"]));
        expect(names).not.toContain("RegionType");

        const [frontendComparisonOperator, protobufComparisonOperator] = getEnumSnapshots(["ComparisonOperator", "protobuf:ComparisonOperator"]);

        expect(frontendComparisonOperator).toEqual(expect.arrayContaining([{name: "Equal", value: "=="}]));
        expect(protobufComparisonOperator).toEqual(expect.arrayContaining([{name: "Equal", value: 0}]));
        expect(() => getEnumSnapshots(["RegionType"])).toThrow("Unknown enum 'RegionType'");
    });

    it("throws for unknown enums", () => {
        expect(() => getEnumSnapshots(["MissingEnum"])).toThrow("Unknown enum 'MissingEnum'");
    });

    it("returns defensive copies", () => {
        const first = getEnumSnapshots(["FrameScaling"]);
        const originalFirstEntry = {...first[0][0]};
        first[0].push({name: "MUTATED", value: 999});
        first[0][0].name = "MUTATED_ENTRY";

        const second = getEnumSnapshots(["FrameScaling"]);
        expect(second[0]).not.toContainEqual({name: "MUTATED", value: 999});
        expect(second[0]).toContainEqual(originalFirstEntry);
    });
});
