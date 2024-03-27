import {action, makeObservable, observable} from "mobx";

import {BeamType, PreferenceStore} from "stores";

export class OverlayBeamStore {
    @observable visible: boolean;
    @observable color: string;
    @observable type: BeamType;
    @observable width: number;
    @observable shiftX: number;
    @observable shiftY: number;

    constructor() {
        makeObservable(this);
        const preference = PreferenceStore.Instance;
        this.visible = preference.wcsOverlay.beamVisible;
        this.color = preference.wcsOverlay.beamColor;
        this.type = preference.wcsOverlay.beamType;
        this.width = preference.wcsOverlay.beamWidth;
        this.shiftX = this.shiftY = 0;
    }

    @action setVisible = (visible: boolean) => {
        this.visible = visible;
    };

    @action setColor = (color: string) => {
        this.color = color;
    };

    @action setType = (type: BeamType) => {
        this.type = type;
    };

    @action setWidth = (width: number) => {
        this.width = width;
    };

    @action setShiftX = (shift: number) => {
        this.shiftX = shift;
    };

    @action setShiftY = (shift: number) => {
        this.shiftY = shift;
    };
}
