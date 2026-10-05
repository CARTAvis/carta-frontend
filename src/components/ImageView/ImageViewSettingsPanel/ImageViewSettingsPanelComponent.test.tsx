import {Intent} from "@blueprintjs/core";
import {observable, runInAction} from "mobx";

import {AppStore} from "stores";

import {ImageViewSettingsPanelComponent} from "./ImageViewSettingsPanelComponent";

interface TestFrame {
    id: number;
    isPVImage: boolean;
}

interface TestableImageViewSettingsPanelComponent {
    restFrameShiftInputIntent: Intent;
    componentWillUnmount: () => void;
}

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
