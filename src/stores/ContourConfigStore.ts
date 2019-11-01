import {action, computed, observable} from "mobx";
import {RGBColor} from "react-color";
import {PreferenceStore} from "./PreferenceStore";
import {hexStringToRgba} from "../utilities";

export class ContourConfigStore {
    @observable enabled: boolean;
    @observable numComputedLevels: number;
    @observable lowerBound: number;
    @observable upperBound: number;
    @observable color: RGBColor;
    @observable colormapEnabled: boolean;
    @observable colormap: string;
    @observable dashLength: number;
    @observable manualLevelsEnabled: boolean;
    @observable manualLevels: number[];

    private readonly preferenceStore: PreferenceStore;

    // Returns computed or manual contour levels
    @computed get levels(): number[] {
        // Default to manual levels if they are enabled
        if (this.manualLevelsEnabled) {
            return this.manualLevels;
        } else if (isFinite(this.lowerBound) && isFinite(this.upperBound) && this.lowerBound < this.upperBound && this.numComputedLevels >= 1) {
            // For single contour levels, just use the midpoint
            if (this.numComputedLevels < 2) {
                return [(this.upperBound + this.lowerBound) / 2.0];
            } else {
                // Fill in the steps linearly
                const stepSize = (this.upperBound - this.lowerBound) / (this.numComputedLevels - 1);
                const levelArray = new Array<number>(this.numComputedLevels);
                for (let i = 0; i < levelArray.length; i++) {
                    levelArray[i] = this.upperBound - i * stepSize;
                }
                return levelArray;
            }
        }

        return [];
    }

    constructor(preferenceStore: PreferenceStore) {
        this.preferenceStore = preferenceStore;
        this.enabled = false;
        this.manualLevelsEnabled = false;
        this.numComputedLevels = this.preferenceStore.getContourNumLevels();
        this.color = hexStringToRgba(this.preferenceStore.getContourColor());
        this.colormapEnabled = this.preferenceStore.getContourColormapEnabled();
        this.colormap = this.preferenceStore.getContourColormap();
        this.manualLevels = [];
    }

    @action setEnabled(val: boolean) {
        this.enabled = val;
    }

    // Manual levels
    @action setManualLevelsEnabled(val: boolean) {
        this.manualLevelsEnabled = val;
    }

    @action setManualLevels(levelValues: number[]) {
        this.manualLevels = levelValues;
    }

    // Computed levels
    @action setBounds(lower: number, upper: number) {
        this.lowerBound = lower;
        this.upperBound = upper;
    }

    @action setNumComputedLevels(N: number) {
        this.numComputedLevels = N;
    }

    // Styling
    @action setColor = (color: RGBColor) => {
        this.color = color;
    };

    @action setDashLength(length: number) {
        this.dashLength = length;
    }

    @action setColormap = (colormap: string) => {
        this.colormap = colormap;
    };

    @action setColormapEnabled = (val: boolean) => {
        this.colormapEnabled = val;
    };
}