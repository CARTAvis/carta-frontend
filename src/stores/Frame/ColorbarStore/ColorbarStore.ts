import {computed, makeObservable} from "mobx";

import {OverlaySettings} from "stores";
import {FrameStore} from "stores/Frame";
import {clamp} from "utilities";

const COLORBAR_TICK_NUM_MIN = 3;

export class ColorbarStore {
    static readonly PRECISION_MAX = 15;
    private readonly frame: FrameStore;
    private readonly overlaySettings: OverlaySettings;

    constructor(frame: FrameStore) {
        makeObservable(this);
        this.frame = frame;
        this.overlaySettings = OverlaySettings.Instance;
    }

    @computed get yOffset(): number {
        return this.overlaySettings.colorbar.position === "right" ? this.frame.overlayStore.padding.top : this.frame.overlayStore.padding.left;
    }

    @computed get height() {
        return this.overlaySettings.colorbar.position === "right" ? this.frame.overlayStore.renderHeight : this.frame.overlayStore.renderWidth;
    }

    @computed get tickNum() {
        const tickNum = Math.round((this.height / 100.0) * this.overlaySettings.colorbar.tickDensity);
        return this.height && tickNum > COLORBAR_TICK_NUM_MIN ? tickNum : COLORBAR_TICK_NUM_MIN;
    }

    @computed get roundedNumbers(): {numbers: number[]; precision: number} {
        const scaleMinVal = this.frame?.renderConfig?.scaleMinVal;
        const scaleMaxVal = this.frame?.renderConfig?.scaleMaxVal;
        if (!isFinite(scaleMinVal) || !isFinite(scaleMaxVal) || scaleMinVal >= scaleMaxVal || !this.tickNum) {
            return null;
        } else {
            let dy = (scaleMaxVal - scaleMinVal) / this.tickNum; // estimate the step
            let precision = -ColorbarStore.GetPrecision(dy); // estimate precision
            let roundBase = Math.pow(10, precision);
            dy = Math.round(dy * roundBase) / roundBase; // the exact step
            precision = -ColorbarStore.GetPrecision(dy); // the exact precision of the step
            roundBase = Math.pow(10, precision);
            const min = Math.round(scaleMinVal * roundBase) / roundBase;

            let numbers = [];
            let val = min > scaleMinVal ? min : Math.round((min + dy) * roundBase) / roundBase;
            while (val < scaleMaxVal) {
                numbers.push(val);
                val = Math.round((val + dy) * roundBase) / roundBase;
            }
            return {numbers: numbers, precision: precision};
        }
    }

    @computed get texts(): string[] {
        if (!this.roundedNumbers) {
            return [];
        }
        const orders = this.roundedNumbers.numbers.map(x => ColorbarStore.GetOrder(x));
        const maxOrder = Math.max(...orders);
        const minOrder = Math.min(...orders);
        const colorbar = this.overlaySettings.colorbar;
        const precision = colorbar.numberCustomPrecision ? colorbar.numberPrecision : this.roundedNumbers.precision;
        if (maxOrder > 5.0 || minOrder < -5.0) {
            return this.roundedNumbers.numbers.map(x => x.toExponential(clamp(colorbar.numberCustomPrecision ? precision : x === 0 ? 0 : precision + ColorbarStore.GetPrecision(x), 0, ColorbarStore.PRECISION_MAX)));
        } else {
            return this.roundedNumbers.numbers.map(x => x.toFixed(clamp(precision, 0, ColorbarStore.PRECISION_MAX)));
        }
    }

    @computed get positions(): number[] {
        const colorbar = this.overlaySettings.colorbar;
        if (!this.roundedNumbers || !this.frame || !isFinite(this.yOffset)) {
            return [];
        }
        const scaleMinVal = this.frame?.renderConfig?.scaleMinVal;
        const scaleMaxVal = this.frame?.renderConfig?.scaleMaxVal;
        if (colorbar.position === "right") {
            return this.roundedNumbers.numbers.map(x => this.yOffset + (this.height * (scaleMaxVal - x)) / (scaleMaxVal - scaleMinVal));
        } else {
            return this.roundedNumbers.numbers.map(x => this.yOffset + (this.height * (x - scaleMinVal)) / (scaleMaxVal - scaleMinVal));
        }
    }

    private static GetOrder = (x: number): number => {
        return x === 0 ? 0 : Math.log10(Math.abs(x));
    };

    private static GetPrecision = (x: number): number => {
        return Math.floor(ColorbarStore.GetOrder(x));
    };
}
