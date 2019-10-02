import {action, computed, observable} from "mobx";
import {RGBColor} from "react-color";
import {PreferenceStore} from "./PreferenceStore";
import {hexStringToRgba} from "../utilities";

export enum ContourColorMode {
    Constant = 0,
    Colormapped = 1,
    Custom = 2
}

export class ContourConfigStore {
    @observable enabled: boolean;
    @observable numComputedLevels: number;
    @observable lowerBound: number;
    @observable upperBound: number;
    @observable color: RGBColor;
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
            // For single contour levels, just use the lower bound
            if (this.numComputedLevels < 2) {
                return [this.lowerBound];
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
        this.numComputedLevels = this.preferenceStore.contourNumLevels;
        this.color = hexStringToRgba(this.preferenceStore.contourColor);
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
}