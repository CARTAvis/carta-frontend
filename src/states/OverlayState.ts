import {action, computed, observable} from "mobx";

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

export class Padding {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export class OverlayTitleSettings {
    @observable visible?: boolean;
    @observable font?: number;
    @observable fontSize?: number;
    @observable gap?: number;
    @observable color?: number;
    @observable text: string;

    @computed get styleString() {
        let stringList = [];
        if (this.visible !== undefined) {
            stringList.push(`DrawTitle=${this.visible ? 1 : 0}`);
        }
        if (this.font !== undefined) {
            stringList.push(`Font(Title)=${this.font}`);
        }
        if (this.fontSize !== undefined) {
            stringList.push(`Size(Title)=${this.fontSize}`);
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

    @computed get styleString() {
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

    @computed get styleString() {
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

    @computed get styleString() {
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
    @observable numberFontSize?: number;
    @observable numberColor?: number;

    @observable labelVisible?: boolean;
    @observable labelColor?: number;
    @observable labelGap?: number;
    @observable labelFont?: number;
    @observable labelFontSize?: number;
    @observable labelText?: string;

    axisIndex: number;

    constructor(axisIndex: number) {
        this.axisIndex = axisIndex;
    }

    @computed get styleString() {
        const indexStringBrackets = (this.axisIndex > 0) ? `(${this.axisIndex})` : "";
        const indexString = (this.axisIndex > 0) ? `${this.axisIndex}` : "";
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
        if (this.numberFontSize !== undefined) {
            stringList.push(`Size(NumLab${indexString})=${this.numberFontSize}`);
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
        if (this.labelFontSize !== undefined) {
            stringList.push(`Size(TextLab${indexString})=${this.labelFontSize}`);
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

export class OverlayState {
    // View size options
    @observable viewWidth: number;
    @observable viewHeight: number;
    // Global options
    @observable labelType?: LabelType;
    @observable color?: number;
    @observable width?: number;
    @observable font?: number;
    @observable fontSize?: number;
    @observable tolerance?: number;
    @observable system?: SystemType;

    // Individual settings
    @observable grid: OverlayGridSettings;
    @observable title: OverlayTitleSettings;
    @observable border: OverlayBorderSettings;
    @observable axes: OverlayAxisSettings;
    @observable axis: Array<OverlayAxisSettings>;
    @observable ticks: OverlayTickSettings;
    // Title settings
    @observable extra?: string;

    @computed get styleString() {
        return this.stringify();
    }

    @computed get padding(): Padding {
        const displayTitle = this.title.visible;
        const displayLabelText = this.axis.map((axis) => {
            if (axis.labelVisible !== undefined) {
                return axis.labelVisible;
            }
            return this.axes.labelVisible !== false;
        });
        const displayNumText = this.axis.map((axis) => {
            if (this.labelType === LabelType.Interior) {
                return false;
            }
            if (axis.numberVisible !== undefined) {
                return axis.numberVisible;
            }
            return this.axes.numberVisible !== false;
        });

        let paddingSize = 65;
        const minSize = Math.min(this.viewWidth, this.viewHeight);
        const scalingStartSize = 600;
        if (minSize < scalingStartSize) {
            paddingSize = Math.max(15, minSize / scalingStartSize * paddingSize);
        }
        const paddingRatios = [
            Math.max(0.2, (displayLabelText[1] ? 0.5 : 0) + (displayNumText[1] ? 0.6 : 0)),
            0.2,
            (displayTitle ? 1.0 : 0.2),
            Math.max(0.2, (displayLabelText[0] ? 0.4 : 0) + (displayNumText[0] ? 0.6 : 0))
        ];

        const paddingValues = paddingRatios.map(r => r * paddingSize * devicePixelRatio);
        return {
            left: paddingValues[0],
            right: paddingValues[1],
            top: paddingValues[2],
            bottom: paddingValues[3]
        };
    }

    // Dialog
    @observable overlaySettingsDialogVisible = false;

    @action showOverlaySettings = () => {
        this.overlaySettingsDialogVisible = true;
    };
    @action hideOverlaySettings = () => {
        this.overlaySettingsDialogVisible = false;
    };

    private stringify() {
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
        if (this.fontSize !== undefined) {
            stringList.push(`Size=${this.fontSize}`);
        }
        if (this.system !== undefined && this.system !== SystemType.Native) {
            stringList.push(`System=${this.system}`);
        }

        stringList.push(this.grid.styleString);
        stringList.push(this.title.styleString);
        stringList.push(this.border.styleString);
        stringList.push(this.axes.styleString);
        stringList.push(this.axis[0].styleString);
        stringList.push(this.axis[1].styleString);
        stringList.push(this.ticks.styleString);

        if (this.extra !== undefined) {
            stringList.push(this.extra);
        }

        stringList = stringList.filter(str => str.length > 0);
        return stringList.join(", ");
    }

    constructor() {
        this.grid = new OverlayGridSettings();
        this.title = new OverlayTitleSettings();
        this.border = new OverlayBorderSettings();
        this.axes = new OverlayAxisSettings(0);
        this.axis = [new OverlayAxisSettings(1), new OverlayAxisSettings(2)];
        this.ticks = new OverlayTickSettings();

        // Default settings
        this.system = SystemType.Native;
        this.labelType = LabelType.Exterior;
        this.border.visible = true;
        this.color = 4;
        this.width = 1;
        this.tolerance = 0.02;
        this.title.visible = false;
        this.title.gap = 0.02;
        this.title.color = 4;
        this.title.text = "A custom AST plot";
        this.grid.visible = true;
        this.grid.color = 3;
        this.extra = "Format(1) = d.1, Format(2) = d.1";
        this.title.font = 2;
        this.axes.labelFontSize = 15;
        this.axes.labelFont = 1;
        this.axes.numberFontSize = 10;
    }
}