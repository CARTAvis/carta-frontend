import * as AST from "ast_wrapper";
import {action, autorun, computed, observable, makeObservable} from "mobx";
import {AppStore, FrameStore, PreferenceStore, WCS_PRECISION} from "stores";
import {WCSType} from "models";
import {toFixed, clamp, getColorForTheme} from "utilities";

const AST_DEFAULT_COLOR = "auto-blue";

export enum AstColorsIndex {
    GLOBAL = 0,
    TITLE = 1,
    GRID = 2,
    BORDER = 3,
    TICK = 4,
    AXIS = 5,
    NUMBER = 6,
    LABEL = 7
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
    ICRS = "ICRS",
}

export enum NumberFormatType {
    HMS = "hms",
    DMS = "dms",
    Degrees = "d"
}

export const NUMBER_FORMAT_LABEL = new Map<NumberFormatType, string>([
    [NumberFormatType.HMS, "H:M:S"],
    [NumberFormatType.DMS, "D:M:S"],
    [NumberFormatType.Degrees, "Degrees"],
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
            let storedValue = (typeof value === "boolean" ? (value ? 1 : 0) : value);
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
        astString.add("Tol", toFixed(this.tolerance / 100, 2), (this.tolerance >= 0.001)); // convert to fraction
        astString.add("System", this.explicitSystem);
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
    @observable customTitleString: string;

    @computed get styleString() {
        let astString = new ASTSettingsString();
        astString.add("DrawTitle", this.show);
        astString.add("Font(Title)", this.font);
        astString.add("Size(Title)", this.fontSize);
        astString.add("Color(Title)", AstColorsIndex.TITLE, this.customColor);
        astString.add("Title", this.customTitleString, this.customText);
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
        this.customTitleString = "";
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

    @action setCustomTitleString = (customTitleString: string) => {
        this.customTitleString = customTitleString;
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
        astString.add("Width(Grid)", this.width, (this.width > 0));
        astString.add("Gap(1)", this.gapX, this.customGap);
        astString.add("Gap(2)", this.gapY, this.customGap);
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
        astString.add("Width(Border)", this.width, (this.width > 0));
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
        astString.add("Width(Ticks)", this.width, (this.width > 0));
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
        astString.add("Width(Axes)", this.width, (this.width > 0));

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

        const precision = (this.customPrecision ? this.precision : "*");
        return `${this.formatTypeX}.${precision}`;
    }

    @computed get formatStringY() {
        if (!this.validWcs) {
            return undefined;
        }

        const precision = (this.customPrecision ? this.precision : "*");
        return `${this.formatTypeY}.${precision}`;
    }

    cursorFormatStringX(precision: number) {
        if (!this.validWcs) {
            return undefined;
        }

        let format = (this.customFormat ? this.formatX : this.defaultFormatX);
        return `${format}.${precision}`;
    }

    cursorFormatStringY(precision: number) {
        if (!this.validWcs) {
            return undefined;
        }

        let format = (this.customFormat ? this.formatY : this.defaultFormatY);
        return `${format}.${precision}`;
    }

    @computed get styleString() {
        let astString = new ASTSettingsString();

        astString.add("NumLab", this.show);
        astString.add("Font(NumLab)", this.font);
        astString.add("Size(NumLab)", this.fontSize);
        astString.add("Color(NumLab)", AstColorsIndex.NUMBER, this.customColor);

        // Add settings for individual axes
        astString.add("Format(1)", this.formatStringX);
        astString.add("Format(2)", this.formatStringY);

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
        astString.add("Size(TextLab)", this.fontSize);
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
    @observable showHoverInfo: boolean;
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
    private textRatio = [0.5, 0.45, 0.5, 0.45, 0.6];

    constructor() {
        makeObservable(this);
        this.visible = true;
        this.showHoverInfo = true;
        this.width = 15;
        this.offset = 5;
        this.position = "right";
        this.customColor = false;
        this.color = AST_DEFAULT_COLOR;
        this.borderVisible = true;
        this.borderWidth = 1;
        this.borderCustomColor = false;
        this.borderColor = AST_DEFAULT_COLOR;
        this.tickVisible = true;
        this.tickDensity = 1;
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
        this.labelVisible = false;
        this.labelRotation = -90;
        this.labelFont = 0;
        this.labelFontSize = 15;
        this.labelCustomText = false;
        this.labelCustomColor = false;
        this.labelColor = AST_DEFAULT_COLOR;
    }

    @action setVisible = (visible: boolean) => {
        this.visible = visible;
    };

    @action setShowHoverInfo = (show: boolean) => {
        this.showHoverInfo = show;
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

    @computed get yOffset(): number {
        const padding = AppStore.Instance?.overlayStore?.padding;
        return this.position === "right" ? padding?.top : padding?.left;
    }

    @computed get height(): number {
        const overlayStore = AppStore.Instance?.overlayStore;
        return this.position === "right" ? overlayStore?.renderHeight : overlayStore?.renderWidth;
    }

    @computed get tickNum(): number {
        const tickNum = Math.round(this.height / 100.0 * this.tickDensity);
        return this.height && tickNum > 1 ? tickNum : 1;
    }

    private getOrder = (x: number): number => {
        return x === 0 ? 0 : Math.log10(Math.abs(x));
    };

    private getPrecision = (x: number): number => {
        return Math.floor(this.getOrder(x));
    };

    @computed get roundedNumbers(): {numbers: number[], precision: number} {
        const frame =  AppStore.Instance?.activeFrame;
        const scaleMinVal = frame?.renderConfig?.scaleMinVal;
        const scaleMaxVal = frame?.renderConfig?.scaleMaxVal;
        const tickNum = this.tickNum;
        if (!isFinite(scaleMinVal) || !isFinite(scaleMaxVal) || (scaleMinVal >= scaleMaxVal) || !tickNum) {
            return null;
        } else {
            let dy = (scaleMaxVal - scaleMinVal) / tickNum; // estimate the step
            let precision = -this.getPrecision(dy); // estimate precision
            const roundBase = Math.pow(10, precision);
            const min =  Math.round(scaleMinVal * roundBase) / roundBase;
            dy = Math.ceil(dy * roundBase) / roundBase; // the exact step
            precision = -this.getPrecision(dy); // the exact precision of the step

            const indexArray = Array.from(Array(tickNum).keys());
            let numbers = indexArray.map(x => min + dy * (x + (min <= scaleMinVal ? 1 : 0)));

            const isOutofBound = (element: number) => element >= scaleMaxVal;
            const outofBoundIndex = numbers.findIndex(isOutofBound);
            if (outofBoundIndex !== -1) {
                numbers = numbers.slice(0, outofBoundIndex);
            }
            return {numbers: numbers, precision: precision};
        }
    }

    @computed get texts(): string[] {
        if (!this.roundedNumbers) {
            return [];
        }
        const orders = this.roundedNumbers.numbers.map(x => this.getOrder(x));
        const maxOrder = Math.max(...orders);
        const minOrder = Math.min(...orders);
        if (maxOrder >= 5.0 || minOrder <= -5.0) {
            return this.roundedNumbers.numbers.map(x => x.toExponential(this.numberCustomPrecision ? this.numberPrecision : (x === 0 ? 0 : clamp(this.roundedNumbers.precision + this.getPrecision(x), 0, 50))));
        } else {
            return this.roundedNumbers.numbers.map(x => x.toFixed(this.numberCustomPrecision ? this.numberPrecision : clamp(this.roundedNumbers.precision, 0, 50)));
        }
    }

    @computed get positions(): number[] {
        const frame =  AppStore.Instance?.activeFrame;
        const scaleMinVal = frame?.renderConfig?.scaleMinVal;
        const scaleMaxVal = frame?.renderConfig?.scaleMaxVal;
        if (!this.roundedNumbers || !frame || !isFinite(this.yOffset)) {
            return [];
        }
        if (this.position === "right") {
            return this.roundedNumbers.numbers.map(x => this.yOffset + this.height * (scaleMaxVal - x) / (scaleMaxVal - scaleMinVal));
        } else {
            return this.roundedNumbers.numbers.map(x => this.yOffset + this.height * (x - scaleMinVal) / (scaleMaxVal - scaleMinVal));
        }
    }

    @computed get rightBorderPos(): number {
        return this.position === "top" ? this.stageWidth - this.offset - this.width : this.offset + this.width;
    }

    @computed get textGap(): number {
        return 5;
    }

    @computed get numberWidth(): number {
        const textWidth = Math.max(...(this.texts.map(x => x.length))) * this.textRatio[clamp(Math.floor(this.numberFont / 4), 0, this.textRatio.length)];
        return this.numberVisible ? this.numberFontSize * (this.numberRotation || this.position !== "right" ? 1 : textWidth) + this.textGap : 0;
    }

    @computed get labelWidth(): number {
        return this.labelVisible ? this.labelFontSize + this.textGap : 0;
    }

    @computed get totalWidth(): number {
        return this.offset + this.width + this.numberWidth + this.labelWidth;
    }

    @computed get stageWidth(): number { // total width + base
        return this.totalWidth + 5;
    }
}

export class OverlayBeamStore {
    @observable visible: boolean;
    @observable color: string;
    @observable type: BeamType;
    @observable width: number;
    @observable shiftX: number;
    @observable shiftY: number;

    constructor() {
        makeObservable(this);
        const preference = PreferenceStore.Instance;
        this.visible = preference.beamVisible;
        this.color = preference.beamColor;
        this.type = preference.beamType;
        this.width = preference.beamWidth;
        this.shiftX = this.shiftY = 0;
    }

    @action setVisible = (visible: boolean) => {
        this.visible = visible;
    };

    @action setColor = (color: string) => {
        this.color = color;
    };

    @action setType = (type: BeamType) => {
        this.type = type;
    };

    @action setWidth = (width: number) => {
        this.width = width;
    };

    @action setShiftX = (shift: number) => {
        this.shiftX = shift;
    };

    @action setShiftY = (shift: number) => {
        this.shiftY = shift;
    };
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
    @observable viewWidth: number;
    @observable viewHeight: number;

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
        this.viewHeight = 1;
        this.viewWidth = 1;

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
                AST.set(frame.wcsInfoForTransformation, `Format(1)=${this.numbers.formatTypeX}.${WCS_PRECISION}`);
            }
        });

        autorun(() => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const _ = this.numbers.formatTypeY;
            const frame = AppStore.Instance.activeFrame;
            if (frame?.validWcs && frame?.wcsInfoForTransformation && this.numbers.formatTypeY) {
                AST.set(frame.wcsInfoForTransformation, `Format(2)=${this.numbers.formatTypeY}.${WCS_PRECISION}`);
            }
        });
    }

    @action setViewDimension = (width: number, height: number) => {
        this.viewWidth = width;
        this.viewHeight = height;
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
        return (this.labels.hidden && this.numbers.hidden && this.title.hidden);
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

        astString.add("LabelUp", 0);
        astString.add("TitleGap", this.titleGap / this.minSize);
        astString.add("NumLabGap", this.defaultGap / this.minSize);
        astString.add("TextLabGap", this.cumulativeLabelGap / this.minSize);
        astString.add("TextGapType", "plot");

        return astString.toString();
    }

    @computed get minSize() {
        return Math.min(this.renderWidth, this.renderHeight);
    }

    @computed get showNumbers() {
        return (this.numbers.show && this.global.labelType === LabelType.Exterior);
    }

    @computed get defaultGap() {
        return 5;
    }

    @computed get titleGap() {
        return this.defaultGap * 2 + (this.colorbar.visible && this.colorbar.position === "top" ? this.colorbar.totalWidth : 0);
    }

    @computed get cumulativeLabelGap() {
        const numGap = (this.showNumbers ? this.defaultGap : 0);
        const numHeight = (this.showNumbers ? this.numbers.fontSize : 0);
        return (numGap + numHeight + this.defaultGap);
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
        return (!(this.colorbar.visible) || (this.colorbar.visible && this.colorbar.position !== "bottom" && this.labels.show) || (this.colorbar.visible && this.colorbar.position === "bottom" && this.colorbar.labelVisible) ? 0 : 10);
    }

    @computed get paddingLeft(): number { 
        return this.base + this.numberWidth + this.labelWidth;
    }

    @computed get paddingRight(): number {
        return this.base + (this.colorbar.visible && this.colorbar.position === "right" ? this.colorbar.totalWidth : 0);
    }

    @computed get paddingTop(): number {
        return this.base + (this.title.show ? this.titleGap + this.title.fontSize : (this.colorbar.visible && this.colorbar.position === "top" ? this.colorbar.totalWidth : 0));
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

    @computed get renderWidth() {
        const renderWidth = this.viewWidth - this.paddingLeft - this.paddingRight;
        return renderWidth > 1 ? renderWidth : 1; // return value > 1 to prevent crashing
    }

    @computed get renderHeight() {
        const renderHeight =  this.viewHeight - this.paddingTop - this.paddingBottom;
        return renderHeight > 1 ? renderHeight : 1; // return value > 1 to prevent crashing
    }
}
