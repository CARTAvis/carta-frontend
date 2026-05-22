import {action, makeObservable, observable} from "mobx";

import {type BeamType} from "enums";
import {PreferenceStore} from "stores";

export class OverlayBeamStore {
    @observable visible: boolean;
    @observable color: string;
    @observable type: BeamType;
    @observable width: number;
    @observable shiftX: number = 0;
    @observable shiftY: number = 0;

    constructor() {
        const preference = PreferenceStore.Instance;
        this.visible = preference.isBeamVisible;
        this.color = preference.beamColor;
        this.type = preference.beamType;
        this.width = preference.beamWidth;
        makeObservable(this);
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
