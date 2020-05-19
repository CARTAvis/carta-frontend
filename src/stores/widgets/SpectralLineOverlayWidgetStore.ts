import {action, computed, observable} from "mobx";
import {CARTA} from "carta-protobuf";
import {AppStore} from "stores";
import {RegionWidgetStore, RegionsType} from "./RegionWidgetStore";

export enum RedshiftGroup {
    V = "V",
    Z = "Z"
}

export class SpectralLineOverlayWidgetStore extends RegionWidgetStore {
    @observable redshiftSpeed: number;
    @observable redshiftGroup: RedshiftGroup;

    @action setRedshiftSpeed = (speed: number) => {
        if (isFinite(speed)) {
            this.redshiftSpeed = speed;
        }
    };

    @action setRedshiftGroup = (redshiftGroup: RedshiftGroup) => {
       this.redshiftGroup = redshiftGroup;
    };

    constructor() {
        super(RegionsType.CLOSED);
        this.redshiftSpeed = 0;
        this.redshiftGroup = RedshiftGroup.V;
    }
}