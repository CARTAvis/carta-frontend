import {action, observable, makeObservable, computed} from "mobx";
import {CARTA} from "carta-protobuf";
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
    @observable components: ImageFittingIndividualStore[];
    @observable selectedComponentIndex: number;
    @observable isFitting: boolean;

    @action setSelectedFileId = (id: number) => {
        this.selectedFileId = id;
    };

    @action setComponents = (num: number) => {
        if (num > this.components.length) {
            for (let i = this.components.length; i < num; i++) {
                this.components.push(new ImageFittingIndividualStore());
                this.selectedComponentIndex = this.components.length - 1;
            }
        } else if (num < this.components.length) {
            this.components = this.components.slice(0, num);
            if (this.selectedComponentIndex >= this.components.length) {
                this.selectedComponentIndex = this.components.length - 1;
            }
        }
    };

    @action clearComponents = () => {
        this.components = [new ImageFittingIndividualStore()];
        this.selectedComponentIndex = 0;
    };

    @action deleteSelectedComponent = () => {
        if (this.components.length > 1) {
            this.components.splice(this.selectedComponentIndex, 1);
            this.selectedComponentIndex = this.selectedComponentIndex === 0 ? 0 : this.selectedComponentIndex - 1;
        }
    };

    @action setSelectedComponentIndex = (index: number) => {
        this.selectedComponentIndex = index;
    };

    @action setIsFitting = (isFitting: boolean) => {
        this.isFitting = isFitting;
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
        const validParams = this.components.every(c => c.validParams === true);
        return !(validFileId && validParams) || this.isFitting;
    }

    constructor() {
        makeObservable(this);
        this.selectedFileId = ACTIVE_FILE_ID;
        this.clearComponents();
        this.selectedComponentIndex = 0;
    }

    fitImage = () => {
        if (this.fitDisabled) {
            return;
        }
        this.setIsFitting(true);
        const initialValues = [];
        for (const c of this.components) {
            initialValues.push({
                center: c.center,
                amp: c.amplitude,
                fwhm: c.fwhm,
                pa: c.pa,
                fixedCenterX: false,
                fixedCenterY: false,
                fixedAmp: false,
                fixedFwhmX: false,
                fixedFwhmY: false,
                fixedPa: false
            });
        }

        const message: CARTA.IFittingRequest = {
            fileId: this.effectiveFrame.frameInfo.fileId,
            initialValues: initialValues
        };
        AppStore.Instance.requestFitting(message);
    };
}

export class ImageFittingIndividualStore {
    @observable center: Point2D;
    @observable amplitude: number;
    @observable fwhm: Point2D;
    @observable pa: number;

    @action setCenterX = (val: number) => {
        this.center.x = val;
    };

    @action setCenterY = (val: number) => {
        this.center.y = val;
    };

    @action setAmplitude = (val: number) => {
        this.amplitude = val;
    };

    @action setFwhmX = (val: number) => {
        this.fwhm.x = val;
    };

    @action setFwhmY = (val: number) => {
        this.fwhm.y = val;
    };

    @action setPa = (val: number) => {
        this.pa = val;
    };

    constructor() {
        makeObservable(this);
        this.center = {x: NaN, y: NaN};
        this.amplitude = NaN;
        this.fwhm = {x: NaN, y: NaN};
        this.pa = NaN;
    }

    @computed get validParams() {
        return isFinite(this.center?.x) && isFinite(this.center?.y) && isFinite(this.amplitude) && isFinite(this.fwhm?.x) && isFinite(this.fwhm?.y) && isFinite(this.pa);
    }
}
