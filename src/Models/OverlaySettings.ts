export enum LabelType {
    Interior = "Interior",
    Exterior = "Exterior"
}

export enum SystemType {
    Native = "",
    Ecliptic = "ECLIPTIC",
    FK4 = "FK4",
    FK5 = "FK5",
    Galactic = "GALACTIC",
    ICRS = "ICRS",
    J2000 = "J2000"
}

export class OverlayTitleSettings {
    visible?: boolean;
    font?: number;
    gap?: number;
    color?: number;
    text: string;

    stringify() {
        let stringList = [];
        if (this.visible !== undefined) {
            stringList.push(`DrawTitle=${this.visible ? 1 : 0}`);
        }
        if (this.font !== undefined) {
            stringList.push(`Font(Title)=${this.font}`);
        }
        if (this.gap !== undefined) {
            stringList.push(`TitleGap=${this.gap}`);
        }
        if (this.color !== undefined) {
            stringList.push(`Color(Title)=${this.color}`);
        }
        if (this.text !== undefined) {
            stringList.push(`Title=${this.text}`);
        }
        return stringList.join(", ");
    }
}

export class OverlayGridSettings {
    visible?: boolean;
    color?: number;
    width?: number;

    stringify() {
        let stringList = [];
        if (this.visible !== undefined) {
            stringList.push(`Grid=${this.visible ? 1 : 0}`);
        }
        if (this.color !== undefined) {
            stringList.push(`Color(Grid)=${this.color}`);
        }
        if (this.width !== undefined) {
            stringList.push(`Width(Grid)=${this.width}`);
        }
        return stringList.join(", ");
    }
}

export class OverlayBorderSettings {
    visible?: boolean;
    color?: number;
    width?: number;

    stringify() {
        let stringList = [];
        if (this.visible !== undefined) {
            stringList.push(`Border=${this.visible ? 1 : 0}`);
        }
        if (this.color !== undefined) {
            stringList.push(`Color(Border)=${this.color}`);
        }
        if (this.width !== undefined) {
            stringList.push(`Width(Border)=${this.width}`);
        }

        return stringList.join(", ");
    }
}

export class OverlayTickSettings {
    density?: number;
    color?: number;
    width?: number;
    length?: number;
    majorLength?: number;

    stringify() {
        let stringList = [];
        if (this.density !== undefined) {
            stringList.push(`MinTick=${this.density}`);
        }
        if (this.color !== undefined) {
            stringList.push(`Color(Ticks)=${this.color}`);
        }
        if (this.width !== undefined) {
            stringList.push(`Width(Ticks)=${this.width}`);
        }
        if (this.length !== undefined) {
            stringList.push(`MinTickLen=${this.length}`);
        }
        if (this.majorLength !== undefined) {
            stringList.push(`MajTickLen=${this.majorLength}`);
        }

        return stringList.join(", ");
    }
}

export class OverlayAxesSettings {
    visible?: boolean;
    color?: number;
    width?: number;
    gap1?: number;
    gap2?: number;

    numberVisible?: boolean;
    numberFont?: number;
    numberColor?: number;
    labelFont?: number;

    labelVisible?: boolean;
    labelColor?: number;
    labelGap?: number;

    stringify() {
        let stringList = [];
        if (this.visible !== undefined) {
            stringList.push(`DrawAxes=${this.visible ? 1 : 0}`);
        }
        if (this.color !== undefined) {
            stringList.push(`Color(Axes)=${this.color}`);
        }
        if (this.width !== undefined) {
            stringList.push(`Width(Axes)=${this.width}`);
        }
        if (this.gap1 !== undefined) {
            stringList.push(`Gap(1)=${this.gap1}`);
        }
        if (this.gap2 !== undefined) {
            stringList.push(`Gap(2)=${this.gap2}`);
        }

        if (this.numberVisible !== undefined) {
            stringList.push(`NumLab=${this.numberVisible ? 1 : 0}`);
        }
        if (this.numberFont !== undefined) {
            stringList.push(`Font(NumLab)=${this.numberFont}`);
        }

        if (this.numberColor !== undefined) {
            stringList.push(`Color(NumLab)=${this.numberColor}`);
        }

        if (this.labelVisible !== undefined) {
            stringList.push(`TextLab=${this.labelVisible ? 1 : 0}`);
        }
        if (this.labelFont !== undefined) {
            stringList.push(`Font(TextLab)=${this.labelFont}`);
        }

        if (this.labelColor !== undefined) {
            stringList.push(`Color(TextLab)=${this.labelColor}`);
        }
        if (this.labelGap !== undefined) {
            stringList.push(`TextLabGap=${this.labelGap}`);
        }

        return stringList.join(", ");
    }
}

export class OverlaySettings {
    // Global options
    labelType?: LabelType;
    color?: number;
    width?: number;
    font?: number;
    tolerance?: number;
    system?: SystemType;

    // Individual settings
    grid = new OverlayGridSettings();
    title = new OverlayTitleSettings();
    border = new OverlayBorderSettings();
    axes = new OverlayAxesSettings();
    ticks = new OverlayTickSettings();
    // Title settings
    extra?: string;

    stringify() {
        let stringList = [];
        if (this.labelType !== undefined) {
            stringList.push(`Labelling=${this.labelType}`);
        }
        if (this.color !== undefined) {
            stringList.push(`Color=${this.color}`);
        }
        if (this.width !== undefined) {
            stringList.push(`Width=${this.width}`);
        }
        if (this.font !== undefined) {
            stringList.push(`Font=${this.font}`);
        }
        if (this.system !== undefined && this.system !== SystemType.Native) {
            stringList.push(`System=${this.system}`);
        }

        if (this.grid !== undefined) {
            stringList.push(this.grid.stringify());
        }
        if (this.title !== undefined) {
            stringList.push(this.title.stringify());
        }
        if (this.border !== undefined) {
            stringList.push(this.border.stringify());
        }
        if (this.axes !== undefined) {
            stringList.push(this.axes.stringify());
        }
        if (this.ticks !== undefined) {
            stringList.push(this.ticks.stringify());
        }

        if (this.extra !== undefined) {
            stringList.push(this.extra);
        }

        stringList = stringList.filter(str => str.length > 0);
        return stringList.join(", ");
    }
}