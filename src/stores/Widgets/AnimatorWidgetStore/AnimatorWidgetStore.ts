import {action, makeObservable, observable} from "mobx";

import {IsoTimePrecision, RelativeTimeReference, RelativeTimeUnit, TimeLabelFormat, TimeScale, TimeZoneMode} from "enums";

export interface AnimatorWidgetConfig {
    timeLabelFormat: TimeLabelFormat;
    timeZoneMode: TimeZoneMode;
    ianaTimeZone: string;
    timeScale: TimeScale;
    isoTimePrecision: IsoTimePrecision;
    numericTimePrecision: number | null;
    relativeTimeReference: RelativeTimeReference;
    relativeReferenceMjdUtc: number | null;
    relativeTimeUnit: RelativeTimeUnit;
}

export type PersistedAnimatorWidgetConfig = Partial<Record<keyof AnimatorWidgetConfig, unknown>>;

function isEnumValue<T extends string>(enumeration: Record<string, T>, value: unknown): value is T {
    return typeof value === "string" && Object.values(enumeration).includes(value as T);
}

export class AnimatorWidgetStore implements AnimatorWidgetConfig {
    @observable timeLabelFormat: TimeLabelFormat = TimeLabelFormat.AUTO;
    @observable timeZoneMode: TimeZoneMode = TimeZoneMode.UTC;
    @observable ianaTimeZone: string = "UTC";
    @observable timeScale: TimeScale = TimeScale.UTC;
    @observable isoTimePrecision: IsoTimePrecision = IsoTimePrecision.AUTO;
    @observable numericTimePrecision: number | null = null;
    @observable relativeTimeReference: RelativeTimeReference = RelativeTimeReference.FIRST;
    @observable relativeReferenceMjdUtc: number | null = null;
    @observable relativeTimeUnit: RelativeTimeUnit = RelativeTimeUnit.AUTO;

    @action setTimeLabelFormat = (format: TimeLabelFormat) => {
        this.timeLabelFormat = format;
    };

    @action setTimeZoneMode = (mode: TimeZoneMode) => {
        this.timeZoneMode = mode;
    };

    @action setIanaTimeZone = (timeZone: string) => {
        this.ianaTimeZone = timeZone;
    };

    @action setTimeScale = (scale: TimeScale) => {
        this.timeScale = scale;
    };

    @action setIsoTimePrecision = (precision: IsoTimePrecision) => {
        this.isoTimePrecision = precision;
    };

    @action setNumericTimePrecision = (precision: number | null) => {
        this.numericTimePrecision = precision;
    };

    @action setRelativeTimeReference = (reference: RelativeTimeReference) => {
        this.relativeTimeReference = reference;
    };

    @action setRelativeReferenceMjdUtc = (mjdUtc: number | null) => {
        this.relativeReferenceMjdUtc = mjdUtc;
    };

    @action setRelativeTimeUnit = (unit: RelativeTimeUnit) => {
        this.relativeTimeUnit = unit;
    };

    @action init = (config: PersistedAnimatorWidgetConfig) => {
        if (isEnumValue(TimeLabelFormat, config.timeLabelFormat)) {
            this.timeLabelFormat = config.timeLabelFormat;
        }
        if (isEnumValue(TimeZoneMode, config.timeZoneMode)) {
            this.timeZoneMode = config.timeZoneMode;
        }
        if (typeof config.ianaTimeZone === "string" && config.ianaTimeZone.trim()) {
            this.ianaTimeZone = config.ianaTimeZone;
        }
        if (isEnumValue(TimeScale, config.timeScale)) {
            this.timeScale = config.timeScale;
        }
        if (isEnumValue(IsoTimePrecision, config.isoTimePrecision)) {
            this.isoTimePrecision = config.isoTimePrecision;
        }
        const numericTimePrecision = config.numericTimePrecision;
        if (numericTimePrecision === null) {
            this.numericTimePrecision = null;
        } else if (typeof numericTimePrecision === "number" && Number.isInteger(numericTimePrecision) && numericTimePrecision >= 0 && numericTimePrecision <= 9) {
            this.numericTimePrecision = numericTimePrecision;
        }
        if (isEnumValue(RelativeTimeReference, config.relativeTimeReference)) {
            this.relativeTimeReference = config.relativeTimeReference;
        }
        const relativeReferenceMjdUtc = config.relativeReferenceMjdUtc;
        if (relativeReferenceMjdUtc === null) {
            this.relativeReferenceMjdUtc = null;
        } else if (typeof relativeReferenceMjdUtc === "number" && isFinite(relativeReferenceMjdUtc)) {
            this.relativeReferenceMjdUtc = relativeReferenceMjdUtc;
        }
        if (isEnumValue(RelativeTimeUnit, config.relativeTimeUnit)) {
            this.relativeTimeUnit = config.relativeTimeUnit;
        }
    };

    toConfig = (): AnimatorWidgetConfig => ({
        timeLabelFormat: this.timeLabelFormat,
        timeZoneMode: this.timeZoneMode,
        ianaTimeZone: this.ianaTimeZone,
        timeScale: this.timeScale,
        isoTimePrecision: this.isoTimePrecision,
        numericTimePrecision: this.numericTimePrecision,
        relativeTimeReference: this.relativeTimeReference,
        relativeReferenceMjdUtc: this.relativeReferenceMjdUtc,
        relativeTimeUnit: this.relativeTimeUnit
    });

    constructor() {
        makeObservable(this);
    }
}
