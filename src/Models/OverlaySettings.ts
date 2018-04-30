import {observable} from "mobx";

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
    @observable visible?: boolean;
    @observable font?: number;
    @observable gap?: number;
    @observable color?: number;
    @observable text: string;

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
            stringList.push(`Title(1)=${this.text}`);
        }
        return stringList.join(", ");
    }
}

export class OverlayGridSettings {
    @observable visible?: boolean;
    @observable color?: number;
    @observable width?: number;

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
    @observable visible?: boolean;
    @observable color?: number;
    @observable width?: number;

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
    @observable density?: number;
    @observable color?: number;
    @observable width?: number;
    @observable length?: number;
    @observable majorLength?: number;

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

export class OverlayAxisSettings {
    @observable visible?: boolean;
    @observable color?: number;
    @observable width?: number;
    @observable gap?: number;

    @observable numberVisible?: boolean;
    @observable numberFont?: number;
    @observable numberColor?: number;

    @observable labelVisible?: boolean;
    @observable labelColor?: number;
    @observable labelGap?: number;
    @observable labelFont?: number;
    @observable labelText?: string;

    stringify(index: number) {
        const indexStringBrackets = (index > 0) ? `(${index})` : "";
        const indexString = (index > 0) ? `${index}` : "";
        let stringList = [];
        if (this.visible !== undefined) {
            stringList.push(`DrawAxes${indexStringBrackets}=${this.visible ? 1 : 0}`);
        }
        if (this.color !== undefined) {
            stringList.push(`Color(Axes${indexString})=${this.color}`);
        }
        if (this.width !== undefined) {
            stringList.push(`Width(Axes${indexString})=${this.width}`);
        }
        if (this.gap !== undefined) {
            stringList.push(`Gap${indexStringBrackets}=${this.gap}`);
        }

        if (this.numberVisible !== undefined) {
            stringList.push(`NumLab${indexStringBrackets}=${this.numberVisible ? 1 : 0}`);
        }
        if (this.numberFont !== undefined) {
            stringList.push(`Font(NumLab${indexString})=${this.numberFont}`);
        }

        if (this.numberColor !== undefined) {
            stringList.push(`Color(NumLab${indexString})=${this.numberColor}`);
        }

        if (this.labelVisible !== undefined) {
            stringList.push(`TextLab${indexStringBrackets}=${this.labelVisible ? 1 : 0}`);
        }
        if (this.labelFont !== undefined) {
            stringList.push(`Font(TextLab${indexString})=${this.labelFont}`);
        }

        if (this.labelColor !== undefined) {
            stringList.push(`Color(TextLab${indexString})=${this.labelColor}`);
        }
        if (this.labelGap !== undefined) {
            stringList.push(`TextLabGap${indexStringBrackets}=${this.labelGap}`);
        }
        if (this.labelText !== undefined) {
            stringList.push(`Label${indexStringBrackets}=${this.labelText}`);
        }

        return stringList.join(", ");
    }
}

export class OverlaySettings {
    // Global options
    @observable labelType?: LabelType;
    @observable color?: number;
    @observable width?: number;
    @observable font?: number;
    @observable tolerance?: number;
    @observable system?: SystemType;

    // Individual settings
    @observable grid = new OverlayGridSettings();
    @observable title = new OverlayTitleSettings();
    @observable border = new OverlayBorderSettings();
    @observable axes = new OverlayAxisSettings();
    @observable axis = [ new OverlayAxisSettings(), new OverlayAxisSettings()];
    @observable ticks = new OverlayTickSettings();
    // Title settings
    @observable extra?: string;

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

        stringList.push(this.grid.stringify());
        stringList.push(this.title.stringify());
        stringList.push(this.border.stringify());
        stringList.push(this.axes.stringify(0));
        stringList.push(this.axis[0].stringify(1));
        stringList.push(this.axis[1].stringify(2));
        stringList.push(this.ticks.stringify());

        if (this.extra !== undefined) {
            stringList.push(this.extra);
        }

        stringList = stringList.filter(str => str.length > 0);
        return stringList.join(", ");
    }
}