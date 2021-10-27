import {computed, makeObservable} from "mobx";
import {FrameStore, OverlayStore} from "stores";
import {clamp} from "utilities";

export class ColorbarStore {
    static readonly PRECISION_MAX = 15;
    private readonly frame: FrameStore;
    private readonly overlayStore: OverlayStore;
    constructor(frame: FrameStore) {
        makeObservable(this);
        this.frame = frame;
        this.overlayStore = OverlayStore.Instance;
    }

    @computed get roundedNumbers(): {numbers: number[]; precision: number} {
        const scaleMinVal = this.frame?.renderConfig?.scaleMinVal;
        const scaleMaxVal = this.frame?.renderConfig?.scaleMaxVal;
        const tickNum = this.overlayStore.colorbar.tickNum;
        if (!isFinite(scaleMinVal) || !isFinite(scaleMaxVal) || scaleMinVal >= scaleMaxVal || !tickNum) {
            return null;
        } else {
            let dy = (scaleMaxVal - scaleMinVal) / tickNum; // estimate the step
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
        const colorbar = this.overlayStore.colorbar;
        const precision = colorbar.numberCustomPrecision ? colorbar.numberPrecision : this.roundedNumbers.precision;
        if (maxOrder > 5.0 || minOrder < -5.0) {
            return this.roundedNumbers.numbers.map(x =>
                x.toExponential(clamp(colorbar.numberCustomPrecision ? precision : x === 0 ? 0 : precision + ColorbarStore.GetPrecision(x), 0, ColorbarStore.PRECISION_MAX))
            );
        } else {
            return this.roundedNumbers.numbers.map(x => x.toFixed(clamp(precision, 0, ColorbarStore.PRECISION_MAX)));
        }
    }

    @computed get positions(): number[] {
        const colorbar = this.overlayStore.colorbar;
        if (!this.roundedNumbers || !this.frame || !isFinite(colorbar.yOffset)) {
            return [];
        }
        const scaleMinVal = this.frame?.renderConfig?.scaleMinVal;
        const scaleMaxVal = this.frame?.renderConfig?.scaleMaxVal;
        if (colorbar.position === "right") {
            return this.roundedNumbers.numbers.map(x => colorbar.yOffset + (colorbar.height * (scaleMaxVal - x)) / (scaleMaxVal - scaleMinVal));
        } else {
            return this.roundedNumbers.numbers.map(x => colorbar.yOffset + (colorbar.height * (x - scaleMinVal)) / (scaleMaxVal - scaleMinVal));
        }
    }

    private static GetOrder = (x: number): number => {
        return x === 0 ? 0 : Math.log10(Math.abs(x));
    };

    private static GetPrecision = (x: number): number => {
        return Math.floor(ColorbarStore.GetOrder(x));
    };
}
