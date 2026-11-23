import * as React from "react";
import {Intent} from "@blueprintjs/core";
import {act, fireEvent, render, screen} from "@testing-library/react";
import axios from "axios";
import {observable, runInAction} from "mobx";

import {BeamOverlayMode} from "enums/overlay";
import {AppStore} from "stores";
import {OverlayBeamStore} from "stores/Frame";

import {ImageViewSettingsPanelComponent} from "./ImageViewSettingsPanelComponent";

interface TestFrame {
    id: number;
    isPVImage: boolean;
}

interface TestableImageViewSettingsPanelComponent {
    restFrameShiftInputIntent: Intent;
    componentWillUnmount: () => void;
}

describe("ImageViewSettingsPanelComponent beam placement", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test.each([false, true])("uses the selected image's per-plane beam status (%s) instead of the displayed image's", async hasSelectedPerPlaneBeams => {
        jest.spyOn(axios, "get").mockResolvedValue({data: []});
        const realApp = AppStore.Instance;
        const beamSettings = new OverlayBeamStore();
        const getFrame = jest.fn().mockReturnValue({shouldShowBeamForAllChannels: hasSelectedPerPlaneBeams});
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({
            activeFrame: undefined,
            overlaySettings: {...realApp.overlaySettings, beam: {selectedFileId: 23, isSelectedFrameValid: true, settingsForDisplay: beamSettings}},
            preferenceStore: realApp.preferenceStore,
            channelMapStore: {isChannelMapEnabled: true, displayedFrame: {shouldShowBeamForAllChannels: !hasSelectedPerPlaneBeams}},
            getFrame,
            frameNames: [],
            frameNum: 2,
            widgetsStore: {},
            isDarkTheme: false
        } as unknown as AppStore);

        await act(async () => {
            render(React.createElement(ImageViewSettingsPanelComponent, {} as any));
        });
        await act(async () => {
            fireEvent.click(screen.getByRole("tab", {name: "Beam"}));
        });

        expect(getFrame).toHaveBeenCalledWith(23);
        expect(screen.getByRole("option", {name: "Bottom-left panel only"})).toHaveProperty("disabled", hasSelectedPerPlaneBeams);
        const placement = screen.getByDisplayValue(hasSelectedPerPlaneBeams ? "All panels" : "Bottom-left panel only");
        expect(placement).toHaveValue(hasSelectedPerPlaneBeams ? BeamOverlayMode.AllPanels : BeamOverlayMode.BottomLeft);
        expect(beamSettings.channelMapMode).toBe(BeamOverlayMode.BottomLeft);
    });
});

describe("ImageViewSettingsPanelComponent rest-frame validation", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("clears validation intent when the active frame changes", () => {
        const activeFrame = observable.box<TestFrame | null>({id: 1, isPVImage: true});
        const appStore = {
            get activeFrame() {
                return activeFrame.get();
            }
        };
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue(appStore as unknown as AppStore);

        const component = new ImageViewSettingsPanelComponent({} as any) as unknown as TestableImageViewSettingsPanelComponent;
        component.restFrameShiftInputIntent = Intent.DANGER;

        runInAction(() => {
            activeFrame.set({id: 2, isPVImage: true});
        });

        expect(component.restFrameShiftInputIntent).toBe(Intent.NONE);
        component.componentWillUnmount();
    });
});
