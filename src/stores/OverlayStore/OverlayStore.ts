import * as AST from "ast_wrapper";
import {action, autorun, computed, makeObservable, observable} from "mobx";

import {WCSType} from "models";
import {AppStore, PreferenceStore} from "stores";
import {FrameStore, OverlayBeamStore, WCS_PRECISION} from "stores/Frame";
import {clamp, getColorForTheme, toFixed} from "utilities";

const AST_DEFAULT_COLOR = "auto-blue";
const COLORBAR_TICK_NUM_MIN = 3;

export enum AstColorsIndex {
    GLOBAL = 0,
    TITLE = 1,
    GRID = 2,
    BORDER = 3,
    TICK = 4,
    AXIS = 5,
    NUMBER = 6,
    LABEL = 7,
    DISTANCE_MEASURE = 8
}

export enum LabelType {
    Interior = "Interior",
    Exterior = "Exterior"
}

export enum SystemType {
    Auto = "AUTO",
    Ecliptic = "ECLIPTIC",
    FK4 = "FK4",
    FK5 = "FK5",
    Galactic = "GALACTIC",
    ICRS = "ICRS"
}

export enum NumberFormatType {
    HMS = "hms",
    DMS = "dms",
    Degrees = "d"
}

export const NUMBER_FORMAT_LABEL = new Map<NumberFormatType, string>([
    [NumberFormatType.HMS, "H:M:S"],
    [NumberFormatType.DMS, "D:M:S"],
    [NumberFormatType.Degrees, "Degrees"]
]);

export enum BeamType {
    Open = "open",
    Solid = "solid"
}

export class Padding {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export class ASTSettingsString {
    stringList: Array<string>;

    constructor() {
        this.stringList = [];
    }

    add(name: string, value: any, storeIf: boolean = true) {
        if (value !== undefined && storeIf) {
            let storedValue = typeof value === "boolean" ? (value ? 1 : 0) : value;
            this.stringList.push(`${name}=${storedValue}`);
        }
    }

    addSection(section: string) {
        if (section !== undefined) {
            this.stringList.push(section);
        }
    }

    toString() {
        return this.stringList.filter(str => str.length > 0).join(", ");
    }
}

export class OverlayGlobalSettings {
    @observable labelType: LabelType;
    @observable color: string;
    @observable tolerance: number; // percentage
    @observable system: SystemType;

    // We need this so that we know what to do if it's set to native
    @observable defaultSystem: SystemType;
    @observable validWcs: boolean;

    @computed get styleString() {
        let astString = new ASTSettingsString();
        astString.add("Labelling", this.labelType);
        astString.add("Color", AstColorsIndex.GLOBAL);
        astString.add("Tol", toFixed(this.tolerance / 100, 2), this.tolerance >= 0.001); // convert to fraction
        astString.add("System", this.explicitSystem);

        const frame = AppStore.Instance.activeFrame;
        if (frame.isXY || frame.isYX) {
            if (this.system === SystemType.FK4) {
                astString.add("Equinox", "1950");
            } else {
                astString.add("Equinox", "2000");
            }
        }

        return astString.toString();
    }

    // Get the current manually overridden system or the default saved from file if system is set to native
    @computed get explicitSystem() {
        if (!this.validWcs) {
            return undefined;
        }

        if (this.system === SystemType.Auto) {
            return this.defaultSystem;
        }

        return this.system;
    }

    constructor() {
        makeObservable(this);
        this.system = SystemType.Auto;
        this.labelType = LabelType.Exterior;
        this.setColor(PreferenceStore.Instance.astColor);
        this.tolerance = 2; // percentage

        this.defaultSystem = SystemType.Auto;
        this.validWcs = false;
    }

    @action setColor = (color: string) => {
        this.color = color;
        AST.setColor(getColorForTheme(color), AstColorsIndex.GLOBAL);
    };

    @action setTolerance(tolerance: number) {
        this.tolerance = tolerance;
    }

    @action setLabelType(labelType: LabelType) {
        this.labelType = labelType;
    }

    @action setSystem(system: SystemType) {
        this.system = system;

        // update distance measuring position tranformation before plotting
        const wcsInfo = AppStore.Instance.activeFrame?.wcsInfo;
        if (wcsInfo && this.explicitSystem) {
            AST.set(wcsInfo, `System=${this.explicitSystem}`);
        }
    }

    @action setDefaultSystem(system: SystemType) {
        this.defaultSystem = system;
    }

    @action setValidWcs(validWcs: boolean) {
        this.validWcs = validWcs;
    }
}

export class OverlayTitleSettings {
    @observable visible: boolean;
    @observable font: number;
    @observable fontSize: number;
    @observable customColor: boolean;
    @observable color: string;
    @observable hidden: boolean;
    @observable customText: boolean;

    @computed get styleString() {
        let astString = new ASTSettingsString();
        astString.add("DrawTitle", this.show);
        astString.add("Font(Title)", this.font);
        astString.add("Size(Title)", this.fontSize * AppStore.Instance.imageRatio);
        astString.add("Color(Title)", AstColorsIndex.TITLE, this.customColor);
        return astString.toString();
    }

    constructor() {
        makeObservable(this);
        this.visible = false;
        this.hidden = false;
        this.customColor = false;
        this.color = AST_DEFAULT_COLOR;
        this.font = 2;
        this.fontSize = 18;
        this.customText = false;
    }

    @computed get show() {
        return this.visible && !this.hidden;
    }

    @action setVisible(visible: boolean = true) {
        this.visible = visible;
    }

    @action setHidden(hidden: boolean) {
        this.hidden = hidden;
    }

    @action setFont = (font: number) => {
        this.font = font;
    };

    @action setFontSize(fontSize: number) {
        this.fontSize = fontSize;
    }

    @action setCustomColor(customColor: boolean) {
        this.customColor = customColor;
    }

    @action setColor = (color: string) => {
        this.color = color;
        AST.setColor(getColorForTheme(color), AstColorsIndex.TITLE);
    };

    @action setCustomText = (customTitle: boolean) => {
        this.customText = customTitle;
    };
}

export class OverlayGridSettings {
    @observable visible: boolean;
    @observable customColor: boolean;
    @observable color: string;
    @observable width: number;
    @observable customGap: boolean;
    @observable gapX: number;
    @observable gapY: number;

    @computed get styleString() {
        let astString = new ASTSettingsString();
        astString.add("Grid", this.visible);
        astString.add("Color(Grid)", AstColorsIndex.GRID, this.customColor);
        astString.add("Width(Grid)", this.width * AppStore.Instance.imageRatio, this.width > 0);
        astString.add("Gap(1)", this.gapX * AppStore.Instance.imageRatio, this.customGap);
        astString.add("Gap(2)", this.gapY * AppStore.Instance.imageRatio, this.customGap);
        return astString.toString();
    }

    constructor() {
        makeObservable(this);
        this.visible = PreferenceStore.Instance.astGridVisible;
        this.customColor = false;
        this.color = AST_DEFAULT_COLOR;
        this.width = 1;
        this.customGap = false;
        this.gapX = 0.2;
        this.gapY = 0.2;
    }

    @action setVisible(visible: boolean = true) {
        this.visible = visible;
    }

    @action setCustomColor(customColor: boolean) {
        this.customColor = customColor;
    }

    @action setColor = (color: string) => {
        this.color = color;
        AST.setColor(getColorForTheme(color), AstColorsIndex.GRID);
    };

    @action setWidth(width: number) {
        this.width = width;
    }

    @action setCustomGap(customGap: boolean = true) {
        this.customGap = customGap;
    }

    @action setGapX(gap: number) {
        this.gapX = gap;
    }

    @action setGapY(gap: number) {
        this.gapY = gap;
    }
}

export class OverlayBorderSettings {
    @observable visible: boolean;
    @observable customColor: boolean;
    @observable color: string;
    @observable width: number;

    @computed get styleString() {
        let astString = new ASTSettingsString();
        astString.add("Border", this.visible);
        astString.add("Color(Border)", AstColorsIndex.BORDER, this.customColor);
        astString.add("Width(Border)", this.width * AppStore.Instance.imageRatio, this.width > 0);
        return astString.toString();
    }

    constructor() {
        makeObservable(this);
        this.visible = true;
        this.customColor = false;
        this.color = AST_DEFAULT_COLOR;
        this.width = 1;
    }

    @action setVisible(visible: boolean = true) {
        this.visible = visible;
    }

    @action setCustomColor(customColor: boolean) {
        this.customColor = customColor;
    }

    @action setColor = (color: string) => {
        this.color = color;
        AST.setColor(getColorForTheme(color), AstColorsIndex.BORDER);
    };

    @action setWidth(width: number) {
        this.width = width;
    }
}

export class OverlayTickSettings {
    @observable drawAll: boolean;
    @observable densityX: number;
    @observable densityY: number;
    @observable customDensity: boolean;
    @observable customColor: boolean;
    @observable color: string;
    @observable width: number;
    @observable length: number; // percentage
    @observable majorLength: number; // percentage

    @computed get styleString() {
        let astString = new ASTSettingsString();
        astString.add("TickAll", this.drawAll);
        astString.add("MinTick(1)", this.densityX, this.customDensity);
        astString.add("MinTick(2)", this.densityY, this.customDensity);
        astString.add("Color(Ticks)", AstColorsIndex.TICK, this.customColor);
        astString.add("Width(Ticks)", this.width * AppStore.Instance.imageRatio, this.width > 0);
        astString.add("MinTickLen", toFixed(this.length / 100, 2)); // convert to fraction
        astString.add("MajTickLen", toFixed(this.majorLength / 100, 2)); // convert to fraction
        return astString.toString();
    }

    constructor() {
        makeObservable(this);
        this.drawAll = true;
        this.customDensity = false;
        this.densityX = 4;
        this.densityY = 4;
        this.customColor = false;
        this.color = AST_DEFAULT_COLOR;
        this.width = 1;
        this.length = 1; // percentage
        this.majorLength = 2; // percentage
    }

    @action setDrawAll(drawAll: boolean = true) {
        this.drawAll = drawAll;
    }

    @action setCustomDensity(customDensity: boolean = true) {
        this.customDensity = customDensity;
    }

    @action setDensityX(density: number) {
        this.densityX = density;
    }

    @action setDensityY(density: number) {
        this.densityY = density;
    }

    @action setCustomColor(customColor: boolean) {
        this.customColor = customColor;
    }

    @action setColor = (color: string) => {
        this.color = color;
        AST.setColor(getColorForTheme(color), AstColorsIndex.TICK);
    };

    @action setWidth(width: number) {
        this.width = width;
    }

    @action setLength(length: number) {
        this.length = length;
    }

    @action setMajorLength(length: number) {
        this.majorLength = length;
    }
}

export class OverlayAxisSettings {
    @observable visible: boolean;
    @observable customColor: boolean;
    @observable color: string;
    @observable width: number;

    constructor() {
        makeObservable(this);
        this.visible = false;
        this.customColor = false;
        this.color = AST_DEFAULT_COLOR;
        this.width = 1;
    }

    @computed get styleString() {
        let astString = new ASTSettingsString();

        astString.add("DrawAxes", this.visible);
        astString.add("Color(Axes)", AstColorsIndex.AXIS, this.customColor);
        astString.add("Width(Axes)", this.width * AppStore.Instance.imageRatio, this.width > 0);

        return astString.toString();
    }

    @action setVisible(visible: boolean = true) {
        this.visible = visible;
    }

    @action setCustomColor(customColor: boolean) {
        this.customColor = customColor;
    }

    @action setColor = (color: string) => {
        this.color = color;
        AST.setColor(getColorForTheme(color), AstColorsIndex.AXIS);
    };

    @action setWidth(width: number) {
        this.width = width;
    }
}

export class OverlayNumberSettings {
    @observable visible: boolean;
    @observable hidden: boolean;
    @observable font: number;
    @observable fontSize: number;
    @observable customColor: boolean;
    @observable color: string;
    @observable customFormat: boolean;
    @observable formatX: NumberFormatType;
    @observable formatY: NumberFormatType;
    @observable customPrecision: boolean;
    @observable precision: number;

    // Unlike most default values, we calculate and set these explicitly, instead of
    // leaving them unset and letting AST pick a default. We have to save these so that
    // we can revert to default values after setting custom values.
    @observable defaultFormatX: NumberFormatType;
    @observable defaultFormatY: NumberFormatType;
    @observable validWcs: boolean;

    constructor() {
        makeObservable(this);
        this.visible = true;
        this.hidden = false;
        this.fontSize = 12;
        this.font = 0;
        this.customColor = false;
        this.color = AST_DEFAULT_COLOR;
        this.customFormat = false;
        this.defaultFormatX = NumberFormatType.Degrees;
        this.defaultFormatY = NumberFormatType.Degrees;
        this.formatX = NumberFormatType.Degrees;
        this.formatY = NumberFormatType.Degrees;
        this.customPrecision = false;
        this.precision = 3;
        this.validWcs = false;
    }

    @computed get formatTypeX(): NumberFormatType {
        if (!this.validWcs) {
            return undefined;
        }
        return this.customFormat ? this.formatX : this.defaultFormatX;
    }

    @computed get formatTypeY(): NumberFormatType {
        if (!this.validWcs) {
            return undefined;
        }
        return this.customFormat ? this.formatY : this.defaultFormatY;
    }

    @computed get formatStringX() {
        if (!this.validWcs) {
            return undefined;
        }

        const precision = this.customPrecision ? this.precision : "*";
        return `${this.formatTypeX}.${precision}`;
    }

    @computed get formatStringY() {
        if (!this.validWcs) {
            return undefined;
        }

        const precision = this.customPrecision ? this.precision : "*";
        return `${this.formatTypeY}.${precision}`;
    }

    cursorFormatStringX(precision: number) {
        if (!this.validWcs) {
            return undefined;
        }

        let format = this.customFormat ? this.formatX : this.defaultFormatX;
        return `${format}.${precision}`;
    }

    cursorFormatStringY(precision: number) {
        if (!this.validWcs) {
            return undefined;
        }

        let format = this.customFormat ? this.formatY : this.defaultFormatY;
        return `${format}.${precision}`;
    }

    @computed get styleString() {
        let astString = new ASTSettingsString();

        astString.add("NumLab", this.show);
        astString.add("Font(NumLab)", this.font);
        astString.add("Size(NumLab)", this.fontSize * AppStore.Instance.imageRatio);
        astString.add("Color(NumLab)", AstColorsIndex.NUMBER, this.customColor);

        return astString.toString();
    }

    @computed get show() {
        return this.visible && !this.hidden;
    }

    @action setVisible(visible: boolean = true) {
        this.visible = visible;
    }

    @action setHidden(hidden: boolean) {
        this.hidden = hidden;
    }

    @action setFont = (font: number) => {
        this.font = font;
    };

    @action setFontSize(fontSize: number) {
        this.fontSize = fontSize;
    }

    @action setCustomColor(customColor: boolean) {
        this.customColor = customColor;
    }

    @action setColor = (color: string) => {
        this.color = color;
        AST.setColor(getColorForTheme(color), AstColorsIndex.NUMBER);
    };

    @action setCustomFormat(customFormat: boolean) {
        this.customFormat = customFormat;
    }

    @action setFormatX(format: NumberFormatType) {
        this.formatX = format;
    }

    @action setFormatY(format: NumberFormatType) {
        this.formatY = format;
    }

    @action setDefaultFormatX(format: NumberFormatType) {
        this.defaultFormatX = format;
    }

    @action setDefaultFormatY(format: NumberFormatType) {
        this.defaultFormatY = format;
    }

    @action setCustomPrecision(customPrecision: boolean) {
        this.customPrecision = customPrecision;
    }

    @action setPrecision(precision: number) {
        this.precision = precision;
    }

    @action setValidWcs(validWcs: boolean) {
        this.validWcs = validWcs;
    }
}

export class OverlayLabelSettings {
    @observable visible: boolean;
    @observable hidden: boolean;
    @observable customColor: boolean;
    @observable color: string;
    @observable font: number;
    @observable fontSize: number;
    @observable customText: boolean;
    @observable customLabelX: string;
    @observable customLabelY: string;

    constructor() {
        makeObservable(this);
        this.visible = PreferenceStore.Instance.astLabelsVisible;
        this.hidden = false;
        this.fontSize = 15;
        this.font = 0;
        this.customColor = false;
        this.color = AST_DEFAULT_COLOR;
        this.customText = false;
        this.customLabelX = "";
        this.customLabelY = "";
    }

    @computed get styleString() {
        let astString = new ASTSettingsString();

        astString.add("TextLab", this.show);
        astString.add("Font(TextLab)", this.font);
        astString.add("Size(TextLab)", this.fontSize * AppStore.Instance.imageRatio);
        astString.add("Color(TextLab)", AstColorsIndex.LABEL, this.customColor);
        astString.add("Label(1)", this.customLabelX, this.customText);
        astString.add("Label(2)", this.customLabelY, this.customText);

        return astString.toString();
    }

    @computed get show() {
        return this.visible && !this.hidden;
    }

    @action setVisible(visible: boolean = true) {
        this.visible = visible;
    }

    @action setHidden(hidden: boolean) {
        this.hidden = hidden;
    }

    @action setCustomColor(customColor: boolean) {
        this.customColor = customColor;
    }

    @action setColor = (color: string) => {
        this.color = color;
        AST.setColor(getColorForTheme(color), AstColorsIndex.LABEL);
    };

    @action setFont = (font: number) => {
        this.font = font;
    };

    @action setFontSize(fontSize: number) {
        this.fontSize = fontSize;
    }

    @action setCustomText = (val: boolean) => {
        this.customText = val;
    };

    @action setCustomLabelX = (label: string) => {
        this.customLabelX = label;
    };

    @action setCustomLabelY = (label: string) => {
        this.customLabelY = label;
    };
}

export class OverlayColorbarSettings {
    @observable visible: boolean;
    @observable interactive: boolean;
    @observable width: number;
    @observable offset: number;
    @observable position: string;
    @observable customColor: boolean;
    @observable color: string;
    @observable borderVisible: boolean;
    @observable borderWidth: number;
    @observable borderCustomColor: boolean;
    @observable borderColor: string;
    @observable tickVisible: boolean;
    @observable tickDensity: number;
    @observable tickLen: number;
    @observable tickWidth: number;
    @observable tickCustomColor: boolean;
    @observable tickColor: string;
    @observable numberVisible: boolean;
    @observable numberRotation: number;
    @observable numberFont: number;
    @observable numberFontSize: number;
    @observable numberCustomPrecision: boolean;
    @observable numberPrecision: number;
    @observable numberCustomColor: boolean;
    @observable numberColor: string;
    @observable labelVisible: boolean;
    @observable labelRotation: number;
    @observable labelFont: number;
    @observable labelFontSize: number;
    @observable labelCustomText: boolean;
    @observable labelCustomColor: boolean;
    @observable labelColor: string;
    @observable gradientVisible: boolean;
    private textRatio = [0.56, 0.51, 0.56, 0.51, 0.6];

    constructor() {
        makeObservable(this);
        const preference = PreferenceStore.Instance;
        this.visible = preference.colorbarVisible;
        this.interactive = preference.colorbarInteractive;
        this.width = preference.colorbarWidth;
        this.offset = 5;
        this.position = preference.colorbarPosition;
        this.customColor = false;
        this.color = AST_DEFAULT_COLOR;
        this.borderVisible = true;
        this.borderWidth = 1;
        this.borderCustomColor = false;
        this.borderColor = AST_DEFAULT_COLOR;
        this.tickVisible = true;
        this.tickDensity = preference.colorbarTicksDensity;
        this.tickLen = 6;
        this.tickWidth = 1;
        this.tickCustomColor = false;
        this.tickColor = AST_DEFAULT_COLOR;
        this.numberVisible = true;
        this.numberRotation = -90;
        this.numberFont = 0;
        this.numberFontSize = 12;
        this.numberCustomPrecision = false;
        this.numberPrecision = 3;
        this.numberCustomColor = false;
        this.numberColor = AST_DEFAULT_COLOR;
        this.labelVisible = preference.colorbarLabelVisible;
        this.labelRotation = -90;
        this.labelFont = 0;
        this.labelFontSize = 15;
        this.labelCustomText = false;
        this.labelCustomColor = false;
        this.labelColor = AST_DEFAULT_COLOR;
        this.gradientVisible = true;
    }

    @action setVisible = (visible: boolean) => {
        this.visible = visible;
    };

    @action setInteractive = (interactive: boolean) => {
        this.interactive = interactive;
    };

    @action setWidth = (width: number) => {
        this.width = width;
    };

    @action setOffset = (offset: number) => {
        this.offset = offset;
    };

    @action setPosition = (position: string) => {
        this.position = position;
    };

    @action setCustomColor = (customColor: boolean) => {
        this.customColor = customColor;
    };

    @action setColor = (color: string) => {
        this.color = color;
    };

    @action setBorderVisible = (visible: boolean) => {
        this.borderVisible = visible;
    };

    @action setBorderWidth = (width: number) => {
        this.borderWidth = width;
    };

    @action setBorderCustomColor = (customColor: boolean) => {
        this.borderCustomColor = customColor;
    };

    @action setBorderColor = (color: string) => {
        this.borderColor = color;
    };

    @action setTickVisible = (visible: boolean) => {
        this.tickVisible = visible;
    };

    @action setTickDensity = (density: number) => {
        this.tickDensity = density;
    };

    @action setTickLen = (len: number) => {
        this.tickLen = len;
    };

    @action setTickWidth = (width: number) => {
        this.tickWidth = width;
    };

    @action setTickCustomColor = (customColor: boolean) => {
        this.tickCustomColor = customColor;
    };

    @action setTickColor = (color: string) => {
        this.tickColor = color;
    };

    @action setNumberVisible = (visible: boolean) => {
        this.numberVisible = visible;
    };

    @action setNumberRotation = (rotation: number) => {
        this.numberRotation = rotation;
    };

    @action setNumberFont = (font: number) => {
        this.numberFont = font;
    };

    @action setNumberFontSize = (fontSize: number) => {
        this.numberFontSize = fontSize;
    };

    @action setNumberCustomPrecision = (customPrecision: boolean) => {
        this.numberCustomPrecision = customPrecision;
    };

    @action setNumberPrecision = (precision: number) => {
        this.numberPrecision = precision;
    };

    @action setNumberCustomColor = (customColor: boolean) => {
        this.numberCustomColor = customColor;
    };

    @action setNumberColor = (color: string) => {
        this.numberColor = color;
    };

    @action setLabelVisible = (visible: boolean) => {
        this.labelVisible = visible;
    };

    @action setLabelRotation = (rotation: number) => {
        this.labelRotation = rotation;
    };

    @action setLabelFont = (font: number) => {
        this.labelFont = font;
    };

    @action setLabelFontSize = (fontSize: number) => {
        this.labelFontSize = fontSize;
    };

    @action setLabelCustomText = (customText: boolean) => {
        this.labelCustomText = customText;
    };

    @action setLabelCustomColor = (customColor: boolean) => {
        this.labelCustomColor = customColor;
    };

    @action setLabelColor = (color: string) => {
        this.labelColor = color;
    };

    @action setGradientVisible = (visible: boolean) => {
        this.gradientVisible = visible;
    };

    @computed get yOffset(): number {
        const padding = AppStore.Instance?.overlayStore?.padding;
        return this.position === "right" ? padding?.top : padding?.left;
    }

    @action height(frame?: FrameStore): number {
        const overlayStore = AppStore.Instance?.overlayStore;
        return this.position === "right" ? frame?.renderHeight || overlayStore?.renderHeight : frame?.renderWidth || overlayStore?.renderWidth;
    }

    @computed get tickNum(): number {
        const tickNum = Math.round((this.height() / 100.0) * this.tickDensity);
        return this.height && tickNum > COLORBAR_TICK_NUM_MIN ? tickNum : COLORBAR_TICK_NUM_MIN;
    }

    @computed get rightBorderPos(): number {
        return this.position === "top" ? this.stageWidth - this.offset - this.width : this.offset + this.width;
    }

    @computed get textGap(): number {
        return 5;
    }

    @computed get numberWidth(): number {
        let textWidth = 1;

        if (!this.numberRotation && this.position === "right") {
            textWidth = 0;
            const textFontIndex = clamp(Math.floor(this.numberFont / 4), 0, this.textRatio.length);
            for (const frame of AppStore.Instance.visibleFrames) {
                const frameTextWidth = Math.max(...frame.colorbarStore.texts.map(x => x.length - (textFontIndex === 4 ? 0 : x.match(/[.-]/g)?.length * 0.5 || 0))) * this.textRatio[textFontIndex];
                textWidth = Math.max(textWidth, frameTextWidth);
            }
        }

        return this.numberVisible ? this.numberFontSize * textWidth + this.textGap : 0;
    }

    @computed get labelWidth(): number {
        return this.labelVisible ? this.labelFontSize + this.textGap : 0;
    }

    @computed get totalWidth(): number {
        return this.offset + this.width + this.numberWidth + this.labelWidth;
    }

    @computed get stageWidth(): number {
        // total width + base
        return this.totalWidth + 5;
    }
}

export class OverlayBeamSettings {
    @observable selectedFileId: number;
    @observable settingsForDisplay: OverlayBeamStore;

    constructor() {
        makeObservable(this);
        this.selectedFileId = -1;
        this.settingsForDisplay = null;

        autorun(() => {
            const appStore = AppStore.Instance;
            if (appStore.activeFrame && appStore.activeFrame.frameInfo && appStore.activeFrame.frameInfo.fileInfo) {
                this.setSelectedFrame(appStore.activeFrame.frameInfo.fileId);
            }
        });
    }

    @computed get isSelectedFrameValid(): boolean {
        return this.selectedFileId >= 0 && this.settingsForDisplay !== null;
    }

    @action setSelectedFrame = (selectedFileId: number) => {
        this.selectedFileId = selectedFileId;
        const frame = AppStore.Instance.getFrame(selectedFileId);
        if (frame && frame.overlayBeamSettings) {
            this.settingsForDisplay = frame.overlayBeamSettings;
        }
    };
}

export class OverlayStore {
    private static staticInstance: OverlayStore;

    static get Instance() {
        if (!OverlayStore.staticInstance) {
            OverlayStore.staticInstance = new OverlayStore();
        }
        return OverlayStore.staticInstance;
    }

    // View size options
    @observable fullViewWidth: number;
    @observable fullViewHeight: number;

    // Individual settings
    @observable global: OverlayGlobalSettings;
    @observable title: OverlayTitleSettings;
    @observable grid: OverlayGridSettings;
    @observable border: OverlayBorderSettings;
    @observable axes: OverlayAxisSettings;
    @observable numbers: OverlayNumberSettings;
    @observable labels: OverlayLabelSettings;
    @observable ticks: OverlayTickSettings;
    @observable colorbar: OverlayColorbarSettings;
    @observable beam: OverlayBeamSettings;

    private constructor() {
        makeObservable(this);
        this.global = new OverlayGlobalSettings();
        this.title = new OverlayTitleSettings();
        this.grid = new OverlayGridSettings();
        this.border = new OverlayBorderSettings();
        this.axes = new OverlayAxisSettings();
        this.numbers = new OverlayNumberSettings();
        this.labels = new OverlayLabelSettings();
        this.ticks = new OverlayTickSettings();
        this.colorbar = new OverlayColorbarSettings();
        this.beam = new OverlayBeamSettings();
        this.fullViewWidth = 1;
        this.fullViewHeight = 1;

        // if the system is manually selected, set new default formats & update active frame's wcs settings
        autorun(() => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const _ = this.global.system;
            this.setFormatsFromSystem();
            const frame = AppStore.Instance.activeFrame;
            if (frame?.validWcs && frame?.wcsInfoForTransformation && this.global.explicitSystem) {
                AST.set(frame.wcsInfoForTransformation, `System=${this.global.explicitSystem}`);
            }
        });

        autorun(() => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const _ = this.numbers.formatTypeX;
            const frame = AppStore.Instance.activeFrame;
            if (frame?.validWcs && frame?.wcsInfoForTransformation && this.numbers.formatTypeX) {
                AST.set(frame.wcsInfoForTransformation, `Format(${frame.dirX})=${this.numbers.formatTypeX}.${WCS_PRECISION}`);
            }
        });

        autorun(() => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const _ = this.numbers.formatTypeY;
            const frame = AppStore.Instance.activeFrame;
            if (frame?.validWcs && frame?.wcsInfoForTransformation && this.numbers.formatTypeY) {
                AST.set(frame.wcsInfoForTransformation, `Format(${frame.dirY})=${this.numbers.formatTypeY}.${WCS_PRECISION}`);
            }
        });
    }

    @action setViewDimension = (width: number, height: number) => {
        this.fullViewWidth = width;
        this.fullViewHeight = height;
    };

    @action setFormatsFromSystem() {
        if (!this.global.validWcs) {
            // TODO: check if degrees would work
            this.numbers.setDefaultFormatX(undefined);
            this.numbers.setDefaultFormatY(undefined);
        } else {
            switch (PreferenceStore.Instance.wcsType) {
                case WCSType.DEGREES:
                    this.numbers.setDefaultFormatX(NumberFormatType.Degrees);
                    this.numbers.setDefaultFormatY(NumberFormatType.Degrees);
                    break;
                case WCSType.SEXAGESIMAL:
                    this.numbers.setDefaultFormatX(NumberFormatType.HMS);
                    this.numbers.setDefaultFormatY(NumberFormatType.DMS);
                    break;
                case WCSType.AUTOMATIC:
                default:
                    if ([SystemType.FK4, SystemType.FK5, SystemType.ICRS].indexOf(this.global.explicitSystem) > -1) {
                        this.numbers.setDefaultFormatX(NumberFormatType.HMS);
                        this.numbers.setDefaultFormatY(NumberFormatType.DMS);
                    } else {
                        // Fall back to degrees by default
                        this.numbers.setDefaultFormatX(NumberFormatType.Degrees);
                        this.numbers.setDefaultFormatY(NumberFormatType.Degrees);
                    }
                    break;
            }
        }

        // Set starting values for custom format only if format is not already custom
        if (!this.numbers.customFormat) {
            this.numbers.setFormatX(this.numbers.defaultFormatX);
            this.numbers.setFormatY(this.numbers.defaultFormatY);
        }
    }

    @action setDefaultsFromAST(frame: FrameStore) {
        this.global.setValidWcs(frame.validWcs);
        this.numbers.setValidWcs(frame.validWcs);

        this.global.setDefaultSystem(AST.getString(frame.wcsInfo, "System") as SystemType);
        this.setFormatsFromSystem();
    }

    @action toggleLabels = () => {
        const newState = !this.labelsHidden;

        this.labels.setHidden(newState);
        this.numbers.setHidden(newState);
        this.title.setHidden(newState);
    };

    @computed get labelsHidden() {
        return this.labels.hidden && this.numbers.hidden && this.title.hidden;
    }

    @computed get styleString() {
        let astString = new ASTSettingsString();

        astString.addSection(this.global.styleString);
        astString.addSection(this.title.styleString);
        astString.addSection(this.grid.styleString);
        astString.addSection(this.border.styleString);
        astString.addSection(this.ticks.styleString);
        astString.addSection(this.axes.styleString);
        astString.addSection(this.numbers.styleString);
        astString.addSection(this.labels.styleString);

        return (frame?: FrameStore) => {
            astString.add("LabelUp", 0);
            astString.add("TitleGap", this.titleGap / this.minSize(frame));
            astString.add("NumLabGap", this.defaultGap / this.minSize(frame));
            astString.add("TextLabGap", this.cumulativeLabelGap / this.minSize(frame));
            astString.add("TextGapType", "plot");
            frame ? astString.addSection(frame.distanceMeasuring?.styleString) : astString.addSection(AppStore.Instance.activeFrame?.distanceMeasuring?.styleString);

            return astString.toString();
        };
    }

    @action minSize(frame?: FrameStore) {
        return Math.min(frame.renderWidth || this.renderWidth, frame.renderHeight || this.renderHeight);
    }

    @computed get showNumbers() {
        return this.numbers.show && this.global.labelType === LabelType.Exterior;
    }

    @computed get defaultGap() {
        return 5;
    }

    @computed get titleGap() {
        return this.defaultGap * 2 + (this.colorbar.visible && this.colorbar.position === "top" ? this.colorbar.totalWidth : 0);
    }

    @computed get cumulativeLabelGap() {
        const numGap = this.showNumbers ? this.defaultGap : 0;
        const numHeight = this.showNumbers ? this.numbers.fontSize : 0;
        return numGap + numHeight + this.defaultGap;
    }

    @computed get base() {
        return 5;
    }

    @computed get numberWidth(): number {
        return this.showNumbers ? this.defaultGap + this.numbers.fontSize : 0;
    }

    @computed get labelWidth(): number {
        return this.labels.show ? this.defaultGap + this.labels.fontSize : 0;
    }

    @computed get colorbarHoverInfoHeight(): number {
        return !this.colorbar.visible || (this.colorbar.visible && this.colorbar.position !== "bottom" && this.labels.show) || (this.colorbar.visible && this.colorbar.position === "bottom" && this.colorbar.labelVisible) ? 0 : 10;
    }

    @computed get paddingLeft(): number {
        return this.base + this.numberWidth + this.labelWidth;
    }

    @computed get paddingRight(): number {
        return this.base + (this.colorbar.visible && this.colorbar.position === "right" ? this.colorbar.totalWidth : 0);
    }

    @computed get paddingTop(): number {
        return this.base + (this.title.show ? this.titleGap + this.title.fontSize : this.colorbar.visible && this.colorbar.position === "top" ? this.colorbar.totalWidth : 0);
    }

    @computed get paddingBottom(): number {
        return this.base + this.numberWidth + this.labelWidth + (this.colorbar.visible && this.colorbar.position === "bottom" ? this.colorbar.totalWidth : 0) + this.colorbarHoverInfoHeight;
    }

    @computed get padding(): Padding {
        return {
            left: this.paddingLeft,
            right: this.paddingRight,
            top: this.paddingTop,
            bottom: this.paddingBottom
        };
    }

    @computed get viewWidth() {
        return Math.floor(this.fullViewWidth / AppStore.Instance.numImageColumns);
    }

    @computed get viewHeight() {
        return Math.floor(this.fullViewHeight / AppStore.Instance.numImageRows);
    }

    @computed get renderWidth() {
        const renderWidth = this.viewWidth - this.paddingLeft - this.paddingRight;
        return renderWidth > 1 ? renderWidth : 1; // return value > 1 to prevent crashing
    }

    @computed get renderHeight() {
        const renderHeight = this.viewHeight - this.paddingTop - this.paddingBottom;
        return renderHeight > 1 ? renderHeight : 1; // return value > 1 to prevent crashing
    }

    @action previewRenderWidth(viewWidth: number) {
        if (!viewWidth) {
            return undefined;
        }
        const renderWidth = viewWidth - this.paddingLeft - this.paddingRight;
        return renderWidth > 1 ? renderWidth : 1; // return value > 1 to prevent crashing
    }

    @action previewRenderHeight(viewHeight: number) {
        if (!viewHeight) {
            return undefined;
        }
        const renderHeight = viewHeight - this.paddingTop - this.paddingBottom;
        return renderHeight > 1 ? renderHeight : 1; // return value > 1 to prevent crashing
    }
}
