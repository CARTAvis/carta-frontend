import * as React from "react";
import {render} from "@testing-library/react";

import {SpectralType, SpectralUnit} from "enums";
import {type FrameStore} from "stores/Frame";

// load the stores first: importing the component alone reaches HelpDrawerComponent through a circular import before CARTA_INFO of "models" exists
import "stores";

import {SpectralSettingsComponent} from "./SpectralSettingsComponent";

const MakeFrame = (specsys: string, spectralSystemsSupported: string[]) =>
    ({
        spectralAxis: {valid: true, type: {name: "Vacuum wavelength", code: "WAVE", unit: "Angstrom"}, specsys, value: 3621.6},
        nativeSpectralCoordinate: "Vacuum wavelength (Angstrom)",
        spectralCoordinate: "Vacuum wavelength (Angstrom)",
        spectralCoordsSupported: new Map([
            ["Vacuum wavelength (Angstrom)", {type: SpectralType.WAVE, unit: SpectralUnit.ANGSTROM}],
            ["Channel", {type: SpectralType.CHANNEL, unit: null}]
        ]),
        spectralSystemsSupported,
        spectralSystem: spectralSystemsSupported.length ? spectralSystemsSupported[0] : null,
        isSpectralSystemConvertible: spectralSystemsSupported.length > 0
    }) as unknown as FrameStore;

const RenderSystemSelect = (frame: FrameStore): HTMLSelectElement => {
    const {container} = render(<SpectralSettingsComponent frame={frame} onSpectralCoordinateChange={jest.fn()} onSpectralSystemChange={jest.fn()} disable={false} />);
    const selects = container.querySelectorAll("select");
    expect(selects).toHaveLength(2);
    return selects[1] as HTMLSelectElement;
};

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
