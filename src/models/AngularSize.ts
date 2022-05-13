export enum AngularSizeUnit {
    MILLIARCSEC = "marcsec",
    ARCSEC = "arcsec",
    ARCMIN = "arcmin",
    DEG = "deg"
}

export class AngularSize {
    value: number;
    unit: AngularSizeUnit;

    public static convertValueFromArcsec = (arcsec: number, dstUnit: AngularSizeUnit): number => {
        if (!isFinite(arcsec)) {
            return undefined;
        }

        switch (dstUnit) {
            case AngularSizeUnit.MILLIARCSEC:
                return arcsec * 1e3;
            case AngularSizeUnit.ARCMIN:
                return arcsec / 60.0;
            case AngularSizeUnit.DEG:
                return arcsec / 3600.0;
            case AngularSizeUnit.ARCSEC:
            default:
                return arcsec;
        }
    }

    public static convertFromArcsec = (arcsec: number, supportMilliarcsec: boolean = false): AngularSize => {
        if (!isFinite(arcsec)) {
            return {value: undefined, unit: AngularSizeUnit.ARCSEC};
        }

        let unit;
        if (supportMilliarcsec && arcsec < 0.002) {
            unit = AngularSizeUnit.MILLIARCSEC;
        } else if (arcsec < 120) {
            unit = AngularSizeUnit.ARCSEC;
        } else if (arcsec >= 120 && arcsec < 7200) {
            unit = AngularSizeUnit.ARCMIN;
        } else {
            unit = AngularSizeUnit.DEG;
        }
        return {value: AngularSize.convertValueFromArcsec(arcsec, unit), unit: unit};
    }
}
