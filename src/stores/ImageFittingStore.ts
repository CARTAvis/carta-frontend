import {action, observable, makeObservable, computed} from "mobx";
import {AppStore, FrameStore} from "stores";
import {ACTIVE_FILE_ID} from "stores/widgets";
import {Point2D} from "models";

export class ImageFittingStore {
    private static staticInstance: ImageFittingStore;

    static get Instance() {
        if (!ImageFittingStore.staticInstance) {
            ImageFittingStore.staticInstance = new ImageFittingStore();
        }
        return ImageFittingStore.staticInstance;
    }

    @observable selectedFileId: number;
    @observable center: Point2D;
    @observable amplitude: number;
    @observable majorAxis: number;
    @observable minorAxis: number;
    @observable pa: number;

    @action setSelectedFileId = (id: number) => {
        this.selectedFileId = id;
    };

    @action setCenterX = (val: number) => {
        this.center.x = val;
    };

    @action setCenterY = (val: number) => {
        this.center.y = val;
    };

    @action setAmplitude = (val: number) => {
        this.amplitude = val;
    };

    @action setMajorAxis = (val: number) => {
        this.majorAxis = val;
    };

    @action setMinorAxis = (val: number) => {
        this.minorAxis = val;
    };

    @action setPa = (val: number) => {
        this.pa = val;
    };

    @action clearParams = () => {
        this.center = {x: null, y: null};
        this.amplitude = null;
        this.majorAxis = null;
        this.minorAxis = null;
        this.pa = null;
    };

    @computed get frameOptions() {
        return [{value: ACTIVE_FILE_ID, label: "Active"}, ...(AppStore.Instance.frameNames ?? [])];
    }

    @computed get effectiveFrame(): FrameStore {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame && appStore.frames?.length > 0) {
            return this.selectedFileId === ACTIVE_FILE_ID ? appStore.activeFrame : appStore.getFrame(this.selectedFileId) ?? appStore.activeFrame;
        }
        return null;
    }

    @computed get fitDisabled() {
        const validFileId = this.effectiveFrame?.frameInfo && this.effectiveFrame?.frameInfo?.fileId >= 0;
        const validParams = Number.isFinite(this.center.x) && Number.isFinite(this.center.y) && Number.isFinite(this.amplitude) && Number.isFinite(this.majorAxis) && Number.isFinite(this.minorAxis) && Number.isFinite(this.pa);
        return !(validFileId && validParams);
    }

    constructor() {
        makeObservable(this);
        this.selectedFileId = ACTIVE_FILE_ID;
        this.clearParams();
    }

    getParamString = () => {
        return `${this.amplitude}, ${this.center.x}, ${this.center.y}, ${this.majorAxis}arcsec, ${this.minorAxis}arcsec, ${this.pa}deg`;
    };
}
