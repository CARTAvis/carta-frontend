import {BeamOverlayMode, BeamType} from "enums";

import {OverlayBeamStore} from "./OverlayBeamStore";

jest.mock("stores", () => ({
    PreferenceStore: {
        Instance: {
            isBeamVisible: true,
            beamColor: "auto-gray",
            beamType: BeamType.Open,
            beamWidth: 1
        }
    }
}));

describe("OverlayBeamStore", () => {
    test("defaults to the bottom-left panel and accepts all-panels placement", () => {
        const store = new OverlayBeamStore();

        expect(store.channelMapMode).toBe(BeamOverlayMode.BottomLeft);
        store.setChannelMapMode(BeamOverlayMode.AllPanels);
        expect(store.channelMapMode).toBe(BeamOverlayMode.AllPanels);
    });
});
