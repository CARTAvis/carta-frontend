import {action, computed, observable, makeObservable} from "mobx";
import { getFormattedWCSPoint } from "utilities";
import { AppStore } from "./AppStore";

export class DistanceMeasuringStore {
    @observable startX: string;
    @observable startY: string;
    @observable finishX: string;
    @observable finishY: string;

    constructor() {
        makeObservable(this);
        this.startX = null;
        this.startY = null;
        this.finishX = null;
        this.finishY = null;
    }

    @computed get isCreated(): boolean {
        return (this.startX != null && this.startY != null && this.finishX != null && this.finishY != null);
    }

    @computed get isCreating(): boolean {
        return (this.startX != null && this.startY != null && this.finishX == null && this.finishY == null);
    }

    @action setStartPos = (x: number, y: number) => {
        const pos = getFormattedWCSPoint(AppStore.Instance.activeFrame.wcsInfo, {x: x, y: y});
        this.startX = pos.x;
        this.startY = pos.y;
    };

    @action setFinishPos = (x: number, y: number) => {
        const pos = getFormattedWCSPoint(AppStore.Instance.activeFrame.wcsInfo, {x: x, y: y});
        this.finishX = pos.x;
        this.finishY = pos.y;
    };

    @action resetPos = () => {
        this.startX = null;
        this.startY = null;
        this.finishX = null;
        this.finishY = null;
    };
}