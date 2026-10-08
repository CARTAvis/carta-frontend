import {CARTA} from "carta-protobuf";

import {TelemetryAction} from "enums";

jest.mock("models", () => ({CARTA_INFO: {version: "test"}}));
jest.mock("stores", () => ({PreferenceStore: {Instance: {}}}));
jest.mock("utilities", () => ({getUnixTimestamp: jest.fn()}));

import {TelemetryService} from "./TelemetryService";

test.each([CARTA.RegionType.ELLIPSE, CARTA.RegionType.ANNULUS])("records spectral profile telemetry for region type %s", regionType => {
    const addTelemetryEntry = jest.fn();
    const instance = jest.spyOn(TelemetryService, "Instance", "get").mockReturnValue({addTelemetryEntry} as unknown as TelemetryService);
    try {
        const service = Object.create(TelemetryService.prototype) as TelemetryService;
        service.addSpectralProfileEntry(100, regionType, 7, 6, 3, 100);
        expect(addTelemetryEntry).toHaveBeenCalledWith(TelemetryAction.SpectralProfileGeneration, {profileLength: 100, regionId: 7, regionType, semi_major: 6, semi_minor: 3, depth: 100});
    } finally {
        instance.mockRestore();
    }
});
