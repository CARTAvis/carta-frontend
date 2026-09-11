import * as React from "react";
import {render} from "@testing-library/react";

import {SpectralType, SpectralUnit} from "enums";
import {type FrameStore} from "stores/Frame";

// load the stores first: importing the component alone reaches HelpDrawerComponent through a circular import before CARTA_INFO of "models" exists
import "stores";

import {SpectralSettingsComponent} from "./SpectralSettingsComponent";

const MakeFrame = (specsys: string, spectralSystemsSupported: string[], nativeSpectralCoordinateLabel: string = "Vacuum wavelength (Angstrom)") =>
    ({
        spectralAxis: {valid: true, type: {name: "Vacuum wavelength", code: "WAVE", unit: "Angstrom"}, ctype: "WAVE-LOG", specsys, value: 3621.6},
        nativeSpectralCoordinate: "Vacuum wavelength (Angstrom)",
        nativeSpectralCoordinateLabel,
        spectralCoordinate: "Vacuum wavelength (Angstrom)",
        spectralCoordsSupported: new Map([
            ["Vacuum wavelength (Angstrom)", {type: SpectralType.WAVE, unit: SpectralUnit.ANGSTROM}],
            ["Frequency (GHz)", {type: SpectralType.FREQ, unit: SpectralUnit.GHZ}],
            ["Channel", {type: SpectralType.CHANNEL, unit: null}]
        ]),
        spectralSystemsSupported,
        spectralSystem: spectralSystemsSupported.length ? spectralSystemsSupported[0] : null,
        isSpectralSystemConvertible: spectralSystemsSupported.length > 0
    }) as unknown as FrameStore;

const RenderSelects = (frame: FrameStore): {coordinateSelect: HTMLSelectElement; systemSelect: HTMLSelectElement} => {
    const {container} = render(<SpectralSettingsComponent frame={frame} onSpectralCoordinateChange={jest.fn()} onSpectralSystemChange={jest.fn()} disable={false} />);
    const selects = container.querySelectorAll("select");
    expect(selects).toHaveLength(2);
    return {coordinateSelect: selects[0] as HTMLSelectElement, systemSelect: selects[1] as HTMLSelectElement};
};

const RenderSystemSelect = (frame: FrameStore): HTMLSelectElement => RenderSelects(frame).systemSelect;

describe("SpectralSettingsComponent coordinate dropdown", () => {
    test("labels the native entry with the CTYPE value as it is", () => {
        const {coordinateSelect} = RenderSelects(MakeFrame("", [], "WAVE-LOG (Angstrom)"));
        expect(Array.from(coordinateSelect.options).map(option => [option.value, option.text])).toEqual([
            ["Vacuum wavelength (Angstrom)", "WAVE-LOG (Angstrom) (Native WCS)"],
            ["Frequency (GHz)", "Frequency (GHz)"],
            ["Channel", "Channel"]
        ]);
        expect(coordinateSelect.value).toBe("Vacuum wavelength (Angstrom)");
    });
});

describe("SpectralSettingsComponent system dropdown", () => {
    test("labels a missing SPECSYS as Unknown in a disabled dropdown", () => {
        const systemSelect = RenderSystemSelect(MakeFrame("", []));
        expect(systemSelect.disabled).toBe(true);
        expect(Array.from(systemSelect.options).map(option => option.text)).toEqual(["Unknown"]);
    });

    test("shows the native SPECSYS when no system conversion is available", () => {
        const systemSelect = RenderSystemSelect(MakeFrame("LSRK", []));
        expect(systemSelect.disabled).toBe(true);
        expect(Array.from(systemSelect.options).map(option => option.text)).toEqual(["LSRK"]);
    });

    test("lists the convertible systems when available", () => {
        const systemSelect = RenderSystemSelect(MakeFrame("LSRK", ["LSRK", "BARYCENT"]));
        expect(systemSelect.disabled).toBe(false);
        expect(Array.from(systemSelect.options).map(option => option.text)).toEqual(["LSRK", "BARYCENT"]);
    });
});
