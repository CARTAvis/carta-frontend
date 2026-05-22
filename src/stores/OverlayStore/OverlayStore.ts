import * as AST from "ast_wrapper";
import {action, autorun, computed, makeObservable, observable} from "mobx";

import {AstColorsIndex, LabelType, NumberFormatType, SystemType} from "enums";
import {WCSType} from "models";
import {AlertStore, AppStore, PreferenceStore, type PvGeneratorWidgetStore} from "stores";
import {type FrameStore, type OverlayBeamStore, WCS_PRECISION} from "stores/Frame";
import {ASTSettingsString, clamp, getColorForTheme, setAstStringSystem, setAstSystem, toFixed} from "utilities";

const AST_DEFAULT_COLOR = "auto-blue";

export class Padding {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export class OverlayGlobalSettings {
    @observable labelType: LabelType = LabelType.Exterior;
    @observable color: string;
    @observable tolerance: number = 2; // percentage
    @observable system: SystemType = SystemType.Auto;

    // We need this so that we know what to do if it's set to native
    @observable defaultSystem: SystemType = SystemType.Auto;
    @observable defaultEquinox: string;
    @observable defaultEpoch: string;
    @observable isValidWcs: boolean = false;

    public styleString(frame?: FrameStore) {
        const astString = new ASTSettingsString();
        astString.add("Labelling", this.labelType);
        astString.add("Color", AstColorsIndex.GLOBAL);
        astString.add("Tol", toFixed(this.tolerance / 100, 2), this.tolerance >= 0.001); // convert to fraction

        const isWcsFrameAndSystem = typeof this.explicitSystem !== "undefined" && this.explicitSystem !== SystemType.Image && frame?.isValidWcs;
        if (isWcsFrameAndSystem) {
            setAstStringSystem(astString, this.explicitSystem, this);
        }

        const labelFrameSet = frame?.isOffsetCoord ? (frame?.wcsInfoOffset ?? frame?.wcsInfo) : frame?.wcsInfo;
        if (!AppStore.Instance.overlaySettings.labels?.hasCustomText && labelFrameSet) {
            const symbolX = AST.getString(labelFrameSet, "Symbol(1)");
            const symbolY = AST.getString(labelFrameSet, "Symbol(2)");
            const labelX = AST.getString(labelFrameSet, "Label(1)");
            const labelY = AST.getString(labelFrameSet, "Label(2)");
            const hasUnitX = AST.getString(labelFrameSet, "Unit(1)") !== "";
            const hasUnitY = AST.getString(labelFrameSet, "Unit(2)") !== "";

            const isSysPixel = (this.explicitSystem === undefined && !(frame?.isPVImage || frame?.isSwappedZ)) || this.explicitSystem === SystemType.Image;
            const getSystemName = (symbolXY: string, isSysPixel: boolean, hasUnit: boolean, explicitSystem: SystemType) => {
                if (isSysPixel) {
                    return hasUnit ? "" : " (pixel)";
                } else if ((symbolXY === "RA" || symbolXY === "Dec") && AppStore.Instance.overlaySettings.labels?.hasRaDecReference) {
                    return ` (${explicitSystem})`;
                } else {
                    return "";
                }
            };
            const systemNameX = getSystemName(symbolX, isSysPixel, hasUnitX, this?.explicitSystem ?? SystemType.Image);
            const systemNameY = getSystemName(symbolY, isSysPixel, hasUnitY, this?.explicitSystem ?? SystemType.Image);
            astString.add("Label(1)", `"${labelX.replace(/%/g, "%%%%").replace(/"/g, "”")}${systemNameX}"`, labelX !== undefined);
            astString.add("Label(2)", `"${labelY.replace(/%/g, "%%%%").replace(/"/g, "”")}${systemNameY}"`, labelY !== undefined);
        }

        return astString.toString();
    }

    // Get the current manually overridden system or the default saved from file if system is set to native
    @computed get explicitSystem() {
        if (!this.isValidWcs) {
            return undefined;
        }

        if (this.system === SystemType.Auto) {
            return this.defaultSystem;
        }

        return this.system;
    }

    constructor() {
        this.setColor(PreferenceStore.Instance.astColor);
        makeObservable(this);
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

    @action async setSystem(system: SystemType) {
        const frames = AppStore.Instance.frames;
        if ((this.system === SystemType.Image) !== (system === SystemType.Image) && frames.map(f => f.spatialReference !== null).includes(true)) {
            const didConfirm = await AlertStore.Instance.showInteractiveAlert("Switching system between world and image coordinates will disable spatial matching.");
            if (didConfirm) {
                frames.forEach(f => f.clearSpatialReference());
                this.system = system;
            }
        } else {
            this.system = system;
        }
    }

    @action setDefaultSystem(system: SystemType) {
        this.defaultSystem = system;
    }

    @action setDefaultEquinox(equinox: string) {
        this.defaultEquinox = equinox;
    }

    @action setDefaultEpoch(epoch: string) {
        this.defaultEpoch = epoch;
    }

    @action setValidWcs(isValidWcs: boolean) {
        this.isValidWcs = isValidWcs;
    }
}

export class OverlayTitleSettings {
    @observable isVisible: boolean = false;
    @observable font: number = 2;
    @observable fontSize: number = 18;
    @observable hasCustomColor: boolean = false;
    @observable color: string = AST_DEFAULT_COLOR;
    @observable isHidden: boolean = false;
    @observable hasCustomText: boolean = false;

    @computed get styleString() {
        const astString = new ASTSettingsString();
        astString.add("DrawTitle", this.isShown);
        astString.add("Font(Title)", this.font);
        astString.add("Size(Title)", this.fontSize * AppStore.Instance.imageRatio);
        astString.add("Color(Title)", AstColorsIndex.TITLE, this.hasCustomColor);
        return astString.toString();
    }

    constructor() {
        makeObservable(this);
    }

    @computed get isShown() {
        return this.isVisible && !this.isHidden;
    }

    @action setVisible(isVisible: boolean = true) {
        this.isVisible = isVisible;
    }

    @action setHidden(isHidden: boolean) {
        this.isHidden = isHidden;
    }

    @action setFont = (font: number) => {
        this.font = font;
    };

    @action setFontSize(fontSize: number) {
        this.fontSize = fontSize;
    }

    @action setCustomColor(hasCustomColor: boolean) {
        this.hasCustomColor = hasCustomColor;
    }

    @action setColor = (color: string) => {
        this.color = color;
        AST.setColor(getColorForTheme(color), AstColorsIndex.TITLE);
    };

    @action setCustomText = (hasCustomTitle: boolean) => {
        this.hasCustomText = hasCustomTitle;
    };
}

export class OverlayGridSettings {
    @observable isVisible: boolean = PreferenceStore.Instance.isAstGridVisible;
    @observable hasCustomColor: boolean = false;
    @observable color: string = AST_DEFAULT_COLOR;
    @observable width: number = 1;
    @observable hasCustomGap: boolean = false;
    @observable gapX: number = 0.2;
    @observable gapY: number = 0.2;

    @computed get styleString() {
        const astString = new ASTSettingsString();
        astString.add("Grid", this.isVisible);
        astString.add("Color(Grid)", AstColorsIndex.GRID, this.hasCustomColor);
        astString.add("Width(Grid)", this.width * AppStore.Instance.imageRatio, this.width > 0);
        astString.add("Gap(1)", this.gapX * AppStore.Instance.imageRatio, this.hasCustomGap);
        astString.add("Gap(2)", this.gapY * AppStore.Instance.imageRatio, this.hasCustomGap);
        return astString.toString();
    }

    constructor() {
        makeObservable(this);
    }

    @action setVisible(isVisible: boolean = true) {
        this.isVisible = isVisible;
    }

    @action setCustomColor(hasCustomColor: boolean) {
        this.hasCustomColor = hasCustomColor;
    }

    @action setColor = (color: string) => {
        this.color = color;
        AST.setColor(getColorForTheme(color), AstColorsIndex.GRID);
    };

    @action setWidth(width: number) {
        this.width = width;
    }

    @action setCustomGap(hasCustomGap: boolean = true) {
        this.hasCustomGap = hasCustomGap;
    }

    @action setGapX(gap: number) {
        this.gapX = gap;
    }

    @action setGapY(gap: number) {
        this.gapY = gap;
    }
}

export class OverlayBorderSettings {
    @observable isVisible: boolean = true;
    @observable hasCustomColor: boolean = false;
    @observable color: string = AST_DEFAULT_COLOR;
    @observable width: number = 1;

    @computed get styleString() {
        const astString = new ASTSettingsString();
        astString.add("Border", this.isVisible);
        astString.add("Color(Border)", AstColorsIndex.BORDER, this.hasCustomColor);
        astString.add("Width(Border)", this.width * AppStore.Instance.imageRatio, this.width > 0);
        return astString.toString();
    }

    constructor() {
        makeObservable(this);
    }

    @action setVisible(isVisible: boolean = true) {
        this.isVisible = isVisible;
    }

    @action setCustomColor(hasCustomColor: boolean) {
        this.hasCustomColor = hasCustomColor;
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
    @observable isVisible: boolean = true;
    @observable shouldDrawAll: boolean = true;
    @observable densityX: number = 4;
    @observable densityY: number = 4;
    @observable hasCustomDensity: boolean = false;
    @observable hasCustomColor: boolean = false;
    @observable color: string = AST_DEFAULT_COLOR;
    @observable width: number = 1;
    @observable length: number = 1; // percentage
    @observable majorLength: number = 2; // percentage

    @computed get styleString() {
        const astString = new ASTSettingsString();
        astString.add("TickAll", this.shouldDrawAll);
        astString.add("MinTick(1)", this.densityX, this.hasCustomDensity);
        astString.add("MinTick(2)", this.densityY, this.hasCustomDensity);
        astString.add("Color(Ticks)", AstColorsIndex.TICK, this.hasCustomColor);
        astString.add("Width(Ticks)", this.width * AppStore.Instance.imageRatio, this.width > 0);
        astString.add("MinTickLen", toFixed(this.length / 100, 2)); // convert to fraction
        astString.add("MajTickLen", toFixed(this.majorLength / 100, 2)); // convert to fraction
        return astString.toString();
    }

    constructor() {
        makeObservable(this);
    }

    @action setVisible(isVisible: boolean) {
        this.isVisible = isVisible;
    }

    @action setDrawAll(shouldDrawAll: boolean = true) {
        this.shouldDrawAll = shouldDrawAll;
    }

    @action setCustomDensity(hasCustomDensity: boolean = true) {
        this.hasCustomDensity = hasCustomDensity;
    }

    @action setDensityX(density: number) {
        this.densityX = density;
    }

    @action setDensityY(density: number) {
        this.densityY = density;
    }

    @action setCustomColor(hasCustomColor: boolean) {
        this.hasCustomColor = hasCustomColor;
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
    @observable isVisible: boolean = false;
    @observable hasCustomColor: boolean = false;
    @observable color: string = AST_DEFAULT_COLOR;
    @observable width: number = 1;

    constructor() {
        makeObservable(this);
    }

    @computed get styleString() {
        const astString = new ASTSettingsString();

        astString.add("DrawAxes", this.isVisible);
        astString.add("Color(Axes)", AstColorsIndex.AXIS, this.hasCustomColor);
        astString.add("Width(Axes)", this.width * AppStore.Instance.imageRatio, this.width > 0);

        return astString.toString();
    }

    @action setVisible(isVisible: boolean = true) {
        this.isVisible = isVisible;
    }

    @action setCustomColor(hasCustomColor: boolean) {
        this.hasCustomColor = hasCustomColor;
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
    @observable isVisible: boolean = true;
    @observable isHidden: boolean = false;
    @observable font: number = 0;
    @observable fontSize: number = 12;
    @observable hasCustomColor: boolean = false;
    @observable color: string = AST_DEFAULT_COLOR;
    @observable hasCustomFormat: boolean = false;
    @observable formatX: NumberFormatType = NumberFormatType.Degrees;
    @observable formatY: NumberFormatType = NumberFormatType.Degrees;
    @observable hasCustomPrecision: boolean = false;
    @observable precision: number = 3;

    // Unlike most default values, we calculate and set these explicitly, instead of
    // leaving them unset and letting AST pick a default. We have to save these so that
    // we can revert to default values after setting custom values.
    @observable defaultFormatX: NumberFormatType | undefined = NumberFormatType.Degrees;
    @observable defaultFormatY: NumberFormatType | undefined = NumberFormatType.Degrees;
    @observable isValidWcs: boolean = false;

    constructor() {
        makeObservable(this);
    }

    @computed get formatTypeX(): NumberFormatType | undefined {
        if (!this.isValidWcs) {
            return undefined;
        }
        return this.hasCustomFormat ? this.formatX : this.defaultFormatX;
    }

    @computed get formatTypeY(): NumberFormatType | undefined {
        if (!this.isValidWcs) {
            return undefined;
        }
        return this.hasCustomFormat ? this.formatY : this.defaultFormatY;
    }

    @computed get formatStringX() {
        if (!this.isValidWcs) {
            return undefined;
        }

        const precision = this.hasCustomPrecision ? this.precision : "*";
        return `${this.formatTypeX}.${precision}`;
    }

    @computed get formatStringY() {
        if (!this.isValidWcs) {
            return undefined;
        }

        const precision = this.hasCustomPrecision ? this.precision : "*";
        return `${this.formatTypeY}.${precision}`;
    }

    cursorFormatStringX(precision: number) {
        if (!this.isValidWcs) {
            return undefined;
        }

        const format = this.hasCustomFormat ? this.formatX : this.defaultFormatX;
        return `${format}.${precision}`;
    }

    cursorFormatStringY(precision: number) {
        if (!this.isValidWcs) {
            return undefined;
        }

        const format = this.hasCustomFormat ? this.formatY : this.defaultFormatY;
        return `${format}.${precision}`;
    }

    @computed get styleString() {
        const astString = new ASTSettingsString();

        astString.add("NumLab", this.isShown);
        astString.add("Font(NumLab)", this.font);
        astString.add("Size(NumLab)", this.fontSize * AppStore.Instance.imageRatio);
        astString.add("Color(NumLab)", AstColorsIndex.NUMBER, this.hasCustomColor);

        return astString.toString();
    }

    @computed get isShown() {
        return this.isVisible && !this.isHidden;
    }

    @action setVisible(isVisible: boolean = true) {
        this.isVisible = isVisible;
    }

    @action setHidden(isHidden: boolean) {
        this.isHidden = isHidden;
    }

    @action setFont = (font: number) => {
        this.font = font;
    };

    @action setFontSize(fontSize: number) {
        this.fontSize = fontSize;
    }

    @action setCustomColor(hasCustomColor: boolean) {
        this.hasCustomColor = hasCustomColor;
    }

    @action setColor = (color: string) => {
        this.color = color;
        AST.setColor(getColorForTheme(color), AstColorsIndex.NUMBER);
    };

    @action setCustomFormat(hasCustomFormat: boolean) {
        this.hasCustomFormat = hasCustomFormat;
    }

    @action setFormatX(format: NumberFormatType) {
        this.formatX = format;
    }

    @action setFormatY(format: NumberFormatType) {
        this.formatY = format;
    }

    @action setDefaultFormatX(format: NumberFormatType | undefined) {
        this.defaultFormatX = format;
    }

    @action setDefaultFormatY(format: NumberFormatType | undefined) {
        this.defaultFormatY = format;
    }

    @action setCustomPrecision(hasCustomPrecision: boolean) {
        this.hasCustomPrecision = hasCustomPrecision;
    }

    @action setPrecision(precision: number) {
        this.precision = precision;
    }

    @action setValidWcs(isValidWcs: boolean) {
        this.isValidWcs = isValidWcs;
    }
}

export class OverlayLabelSettings {
    @observable isVisible: boolean = PreferenceStore.Instance.isAstLabelsVisible;
    @observable isHidden: boolean = false;
    @observable hasCustomColor: boolean = false;
    @observable color: string = AST_DEFAULT_COLOR;
    @observable font: number = 0;
    @observable fontSize: number = 15;
    @observable hasRaDecReference: boolean = true;
    @observable hasCustomText: boolean = false;
    @observable customLabelX: string = "";
    @observable customLabelY: string = "";

    constructor() {
        makeObservable(this);
    }

    @computed get styleString() {
        const astString = new ASTSettingsString();

        const appStore = AppStore.Instance;

        astString.add("TextLab", this.isShown);
        astString.add("Font(TextLab)", this.font);
        astString.add("Size(TextLab)", this.fontSize * appStore.imageRatio);
        astString.add("Color(TextLab)", AstColorsIndex.LABEL, this.hasCustomColor);

        astString.add("Label(1)", `"${this.customLabelX.replace(/%/g, "%%%%").replace(/"/g, "”")}"`, this.hasCustomText);
        astString.add("Label(2)", `"${this.customLabelY.replace(/%/g, "%%%%").replace(/"/g, "”")}"`, this.hasCustomText);

        return astString.toString();
    }

    @computed get isShown() {
        return this.isVisible && !this.isHidden;
    }

    @action setVisible(isVisible: boolean = true) {
        this.isVisible = isVisible;
    }

    @action setHidden(isHidden: boolean) {
        this.isHidden = isHidden;
    }

    @action setCustomColor(hasCustomColor: boolean) {
        this.hasCustomColor = hasCustomColor;
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

    @action setRaDecReference(hasRaDecReference: boolean) {
        this.hasRaDecReference = hasRaDecReference;
    }

    @action setCustomText = (hasCustomText: boolean) => {
        this.hasCustomText = hasCustomText;
    };

    @action setCustomLabelX = (label: string) => {
        this.customLabelX = label;
    };

    @action setCustomLabelY = (label: string) => {
        this.customLabelY = label;
    };
}

export class OverlayColorbarSettings {
    @observable isVisible: boolean = PreferenceStore.Instance.isColorbarVisible;
    @observable isInteractive: boolean = PreferenceStore.Instance.isColorbarInteractive;
    @observable width: number = PreferenceStore.Instance.colorbarWidth;
    @observable offset: number = 5;
    @observable position: "right" | "top" | "bottom" = PreferenceStore.Instance.colorbarPosition;
    @observable hasCustomColor: boolean = false;
    @observable color: string = AST_DEFAULT_COLOR;
    @observable isBorderVisible: boolean = true;
    @observable borderWidth: number = 1;
    @observable hasBorderCustomColor: boolean = false;
    @observable borderColor: string = AST_DEFAULT_COLOR;
    @observable isTickVisible: boolean = true;
    @observable tickDensity: number = PreferenceStore.Instance.colorbarTicksDensity;
    @observable tickLen: number = 6;
    @observable tickWidth: number = 1;
    @observable hasTickCustomColor: boolean = false;
    @observable tickColor: string = AST_DEFAULT_COLOR;
    @observable isNumberVisible: boolean = true;
    @observable numberRotation: number = -90;
    @observable numberFont: number = 0;
    @observable numberFontSize: number = 12;
    @observable hasNumberCustomPrecision: boolean = false;
    @observable numberPrecision: number = 3;
    @observable hasNumberCustomColor: boolean = false;
    @observable numberColor: string = AST_DEFAULT_COLOR;
    @observable isLabelVisible: boolean = PreferenceStore.Instance.isColorbarLabelVisible;
    @observable labelRotation: number = -90;
    @observable labelFont: number = 0;
    @observable labelFontSize: number = 15;
    @observable hasLabelCustomText: boolean = false;
    @observable hasLabelCustomColor: boolean = false;
    @observable labelColor: string = AST_DEFAULT_COLOR;
    @observable isGradientVisible: boolean = true;
    private textRatio = [0.56, 0.51, 0.56, 0.51, 0.6];

    constructor() {
        makeObservable(this);
    }

    @action setVisible = (isVisible: boolean) => {
        this.isVisible = isVisible;
    };

    @action setInteractive = (isInteractive: boolean) => {
        this.isInteractive = isInteractive;
    };

    @action setWidth = (width: number) => {
        this.width = width;
    };

    @action setOffset = (offset: number) => {
        this.offset = offset;
    };

    @action setPosition = (position: "right" | "top" | "bottom") => {
        this.position = position;
    };

    @action setCustomColor = (hasCustomColor: boolean) => {
        this.hasCustomColor = hasCustomColor;
    };

    @action setColor = (color: string) => {
        this.color = color;
    };

    @action setBorderVisible = (isBorderVisible: boolean) => {
        this.isBorderVisible = isBorderVisible;
    };

    @action setBorderWidth = (width: number) => {
        this.borderWidth = width;
    };

    @action setBorderCustomColor = (hasBorderCustomColor: boolean) => {
        this.hasBorderCustomColor = hasBorderCustomColor;
    };

    @action setBorderColor = (color: string) => {
        this.borderColor = color;
    };

    @action setTickVisible = (isTickVisible: boolean) => {
        this.isTickVisible = isTickVisible;
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

    @action setTickCustomColor = (hasTickCustomColor: boolean) => {
        this.hasTickCustomColor = hasTickCustomColor;
    };

    @action setTickColor = (color: string) => {
        this.tickColor = color;
    };

    @action setNumberVisible = (isNumberVisible: boolean) => {
        this.isNumberVisible = isNumberVisible;
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

    @action setNumberCustomPrecision = (hasNumberCustomPrecision: boolean) => {
        this.hasNumberCustomPrecision = hasNumberCustomPrecision;
    };

    @action setNumberPrecision = (precision: number) => {
        this.numberPrecision = precision;
    };

    @action setNumberCustomColor = (hasNumberCustomColor: boolean) => {
        this.hasNumberCustomColor = hasNumberCustomColor;
    };

    @action setNumberColor = (color: string) => {
        this.numberColor = color;
    };

    @action setLabelVisible = (isLabelVisible: boolean) => {
        this.isLabelVisible = isLabelVisible;
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

    @action setLabelCustomText = (hasLabelCustomText: boolean) => {
        this.hasLabelCustomText = hasLabelCustomText;
    };

    @action setLabelCustomColor = (hasLabelCustomColor: boolean) => {
        this.hasLabelCustomColor = hasLabelCustomColor;
    };

    @action setLabelColor = (color: string) => {
        this.labelColor = color;
    };

    @action setGradientVisible = (isGradientVisible: boolean) => {
        this.isGradientVisible = isGradientVisible;
    };

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
            for (const frame of AppStore.Instance.imageViewConfigStore.visibleFrames) {
                const frameTextWidth = Math.max(...frame.colorbarStore.texts.map(x => x.length - (textFontIndex === 4 ? 0 : (x.match(/[.-]/g)?.length ?? 0) * 0.5))) * this.textRatio[textFontIndex];
                textWidth = Math.max(textWidth, frameTextWidth);
            }
        }

        return this.isNumberVisible ? this.numberFontSize * textWidth + this.textGap : 0;
    }

    @computed get labelWidth(): number {
        return this.isLabelVisible ? this.labelFontSize + this.textGap : 0;
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
    @observable selectedFileId: number = -1;
    @observable settingsForDisplay: OverlayBeamStore | null = null;

    constructor() {
        makeObservable(this);

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

export class OverlaySettings {
    private static staticInstance: OverlaySettings;

    public static get Instance() {
        if (!OverlaySettings.staticInstance) {
            OverlaySettings.staticInstance = new OverlaySettings();
        }
        return OverlaySettings.staticInstance;
    }

    /** Visibility of the overlay. */
    @observable isVisible: boolean = true;

    // Individual settings
    @observable global: OverlayGlobalSettings = new OverlayGlobalSettings();
    @observable title: OverlayTitleSettings = new OverlayTitleSettings();
    @observable grid: OverlayGridSettings = new OverlayGridSettings();
    @observable border: OverlayBorderSettings = new OverlayBorderSettings();
    @observable axes: OverlayAxisSettings = new OverlayAxisSettings();
    @observable numbers: OverlayNumberSettings = new OverlayNumberSettings();
    @observable labels: OverlayLabelSettings = new OverlayLabelSettings();
    @observable ticks: OverlayTickSettings = new OverlayTickSettings();
    @observable colorbar: OverlayColorbarSettings = new OverlayColorbarSettings();
    @observable beam: OverlayBeamSettings = new OverlayBeamSettings();

    private base = 5;
    defaultGap = 5;

    private constructor() {
        makeObservable(this);

        // if the system is manually selected, set new default formats & update active frame's wcs settings
        autorun(() => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const _ = this.global.system;
            this.setFormatsFromSystem();
            AppStore.Instance.frames.forEach(frame => {
                if (frame?.isValidWcs && frame?.wcsInfoForTransformation && this.global.explicitSystem && this.global.explicitSystem !== SystemType.Image) {
                    setAstSystem(frame.wcsInfoForTransformation, this.global.explicitSystem, this.global);
                }
            });
        });

        autorun(() => {
            AppStore.Instance.frames.forEach(frame => {
                if (frame?.isValidWcs && frame?.wcsInfoForTransformation && this.numbers.formatTypeX) {
                    AST.set(frame.wcsInfoForTransformation, `Format(${frame.dirX})=${this.numbers.formatTypeX}.${WCS_PRECISION}`);
                }
            });
        });

        autorun(() => {
            AppStore.Instance.frames.forEach(frame => {
                if (frame?.isValidWcs && frame?.wcsInfoForTransformation && this.numbers.formatTypeY) {
                    AST.set(frame.wcsInfoForTransformation, `Format(${frame.dirY})=${this.numbers.formatTypeY}.${WCS_PRECISION}`);
                }
            });
        });
    }

    /**
     * Hide or show the overlay.
     * @param visible - Visibility of the overlay.
     */
    @action setVisible(isVisible: boolean) {
        this.isVisible = isVisible;
    }

    @action setFormatsFromSystem() {
        if (!this.global.isValidWcs) {
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
                    if (this.global.explicitSystem && [SystemType.FK4, SystemType.FK5, SystemType.ICRS].indexOf(this.global.explicitSystem) > -1) {
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
        if (!this.numbers.hasCustomFormat) {
            if (this.numbers.defaultFormatX) {
                this.numbers.setFormatX(this.numbers.defaultFormatX);
            }
            if (this.numbers.defaultFormatY) {
                this.numbers.setFormatY(this.numbers.defaultFormatY);
            }
        }
    }

    @action setDefaultsFromFrame(frame: FrameStore) {
        this.global.setValidWcs(frame.isValidWcs);
        this.numbers.setValidWcs(frame.isValidWcs);

        this.global.setDefaultSystem(frame.defaultWcsSystem);
        this.global.setDefaultEquinox(frame.defaultWcsEquinox);
        this.global.setDefaultEpoch(frame.defaultWcsEpoch);

        this.setFormatsFromSystem();

        if (this.global.system === SystemType.Auto) {
            const formatStringX = this.numbers.formatStringX;
            const formatStyingY = this.numbers.formatStringY;
            const explicitSystem = this.global.explicitSystem;
            AppStore.Instance.frames.forEach(frame => {
                if (frame) {
                    frame.updateWcsSystem(formatStringX, formatStyingY, explicitSystem);
                }
            });
        }
    }

    @action toggleLabels = () => {
        const willBeHidden = !this.isLabelsHidden;

        this.labels.setHidden(willBeHidden);
        this.numbers.setHidden(willBeHidden);
        this.title.setHidden(willBeHidden);
    };

    @computed get isLabelsHidden() {
        return this.labels.isHidden && this.numbers.isHidden && this.title.isHidden;
    }

    @computed get shouldShowNumbers() {
        return this.numbers.isShown && this.global.labelType === LabelType.Exterior;
    }

    @computed get titleGap() {
        return this.defaultGap * 2 + (this.colorbar.isVisible && this.colorbar.position === "top" ? this.colorbar.totalWidth : 0);
    }

    @computed get cumulativeLabelGap() {
        const numGap = this.shouldShowNumbers ? this.defaultGap : 0;
        const numHeight = this.shouldShowNumbers ? this.numbers.fontSize : 0;
        return numGap + numHeight + this.defaultGap;
    }

    @computed get numberWidth(): number {
        return this.shouldShowNumbers ? this.defaultGap + this.numbers.fontSize : 0;
    }

    @computed get labelWidth(): number {
        return this.labels.isShown ? this.defaultGap + this.labels.fontSize : 0;
    }

    @computed get colorbarHoverInfoHeight(): number {
        return !this.colorbar.isVisible || (this.colorbar.isVisible && this.colorbar.position !== "bottom" && this.labels.isShown) || (this.colorbar.isVisible && this.colorbar.position === "bottom" && this.colorbar.isLabelVisible) ? 0 : 10;
    }

    /** The usual left padding in single/multi-panel mode. */
    @computed get paddingLeft(): number {
        return this.base + this.numberWidth + this.labelWidth;
    }

    /** The usual right padding in single/multi-panel mode. */
    @computed get paddingRight(): number {
        return this.base + (this.colorbar.isVisible && this.colorbar.position === "right" ? this.colorbar.totalWidth : 0);
    }

    /** The usual top padding in single/multi-panel mode. */
    @computed get paddingTop(): number {
        return this.base + (this.title.isShown ? this.titleGap + this.title.fontSize : this.colorbar.isVisible && this.colorbar.position === "top" ? this.colorbar.totalWidth : 0);
    }

    /** The usual bottom padding in single/multi-panel mode. */
    @computed get paddingBottom(): number {
        return this.base + this.numberWidth + this.labelWidth + (this.colorbar.isVisible && this.colorbar.position === "bottom" ? this.colorbar.totalWidth : 0) + this.colorbarHoverInfoHeight;
    }

    @computed get isWcsCoordinates() {
        return this.global.explicitSystem !== SystemType.Image;
    }

    @computed get isImgCoordinates() {
        return this.global.explicitSystem === SystemType.Image;
    }
}

export type OverlayStore = ImageViewOverlayStore | PvPreviewOverlayStore;

/** The overlay configuration for a frame in the image view widget. */
export class ImageViewOverlayStore {
    constructor() {
        makeObservable(this);
    }

    /** The width of the entire widget on which the overlay is displayed. */
    @computed get fullViewWidth() {
        return AppStore.Instance.fullViewWidth;
    }

    /** The height of the entire widget on which the overlay is displayed. */
    @computed get fullViewHeight() {
        return AppStore.Instance.fullViewHeight;
    }

    /** The width of the overlay canvas. */
    @computed get viewWidth() {
        return Math.floor(this.fullViewWidth / AppStore.Instance.imageViewConfigStore.numImageColumns);
    }

    /** The height of the overlay canvas. */
    @computed get viewHeight() {
        return Math.floor(this.fullViewHeight / AppStore.Instance.imageViewConfigStore.numImageRows);
    }

    /** The width of the raster tile canvas (the area inside the border). */
    @computed get renderWidth() {
        // return value > 1 to prevent crashing
        return Math.max(this.viewWidth - OverlaySettings.Instance.paddingLeft - OverlaySettings.Instance.paddingRight, 1);
    }

    /** The height of the raster tile canvas (the area inside the border). */
    @computed get renderHeight() {
        // return value > 1 to prevent crashing
        return Math.max(this.viewHeight - OverlaySettings.Instance.paddingTop - OverlaySettings.Instance.paddingBottom, 1);
    }

    /** The minimum size between the raster tile canvas width and height (render width and height). */
    @computed get minSize() {
        return Math.min(this.renderWidth, this.renderHeight);
    }

    /** The space between the edges of the overlay canvas and the raster tile canvas (the area outside the border). */
    @computed get padding(): Padding {
        return {
            left: OverlaySettings.Instance.paddingLeft,
            right: OverlaySettings.Instance.paddingRight,
            top: OverlaySettings.Instance.paddingTop,
            bottom: OverlaySettings.Instance.paddingBottom
        };
    }

    defaultStyleString(frame?: FrameStore): ASTSettingsString {
        const astString = new ASTSettingsString();
        astString.addSection(OverlaySettings.Instance.global.styleString(frame));
        astString.addSection(OverlaySettings.Instance.title.styleString);
        astString.addSection(OverlaySettings.Instance.grid.styleString);
        astString.addSection(OverlaySettings.Instance.border.styleString);
        astString.addSection(OverlaySettings.Instance.ticks.styleString);
        astString.addSection(OverlaySettings.Instance.axes.styleString);
        astString.addSection(OverlaySettings.Instance.numbers.styleString);
        astString.addSection(OverlaySettings.Instance.labels.styleString);

        astString.add("LabelUp", 0);
        astString.add("TitleGap", OverlaySettings.Instance.titleGap / this.minSize);
        astString.add("NumLabGap", OverlaySettings.Instance.defaultGap / this.minSize);
        astString.add("TextLabGap", OverlaySettings.Instance.cumulativeLabelGap / this.minSize);
        astString.add("TextGapType", "plot");

        return astString;
    }

    styleString(frame?: FrameStore) {
        return this.defaultStyleString(frame).toString();
    }
}

/** The overlay configuration for a PV preview widget. */
export class PvPreviewOverlayStore extends ImageViewOverlayStore {
    private readonly previewWidgetStore: PvGeneratorWidgetStore | null = null;

    constructor(previewWidgetStore: PvGeneratorWidgetStore) {
        super();
        this.previewWidgetStore = previewWidgetStore;
    }

    /** The width of the entire widget on which the overlay is displayed. */
    get fullViewWidth() {
        return this.previewWidgetStore?.previewFullViewWidth ?? 0;
    }

    /** The height of the entire widget on which the overlay is displayed. */
    get fullViewHeight() {
        return this.previewWidgetStore?.previewFullViewHeight ?? 0;
    }

    /** The width of the overlay canvas. */
    get viewWidth() {
        return this.fullViewWidth;
    }

    /** The height of the overlay canvas. */
    get viewHeight() {
        return this.fullViewHeight;
    }
}

/** The overlay configuration for the outer part of a frame in channel map mode in the image view widget. */
export class ChannelMapOuterOverlayStore extends ImageViewOverlayStore {
    styleString(frame?: FrameStore) {
        const astString = this.defaultStyleString(frame);
        astString.add("Grid", false);
        astString.add("Border", false);
        astString.add("MajTickLen(1)", 0);
        astString.add("MinTickLen(1)", 0);
        astString.add("MajTickLen(2)", 0);
        astString.add("MinTickLen(2)", 0);
        astString.add("DrawAxes", false);
        astString.add("NumLab", false);
        return astString.toString();
    }
}

/** The overlay configuration for the bottom-left channel of a frame in channel map mode in the image view widget. */
export class ChannelMapInnerOverlayStore extends ImageViewOverlayStore {
    /** Maximum allowed gap between the overlay canvas in pixels. Cannot be set to a negative value. */
    @observable private maxGap = 5;

    constructor() {
        super();
        makeObservable(this);
    }

    /**
     * Sets the maximum allowed gap. Ensures the value is not negative.
     * @param maxGap - The maximum allowed gap.
     */
    @action setMaxGap = (maxGap: number) => {
        this.maxGap = Math.max(maxGap, 0);
    };

    /** The width of the overlay canvas. */
    get viewWidth() {
        return this.renderWidth + this.padding.left + this.padding.right;
    }

    /** The height of the overlay canvas. */
    get viewHeight() {
        return this.renderHeight + this.padding.top + this.padding.bottom;
    }

    /** The width of the raster tile canvas (the area inside the border). */
    get renderWidth() {
        const overlaySettings = AppStore.Instance.overlaySettings;
        const outerRenderWidth = this.fullViewWidth - overlaySettings.paddingLeft - overlaySettings.paddingRight;
        const numColumns = AppStore.Instance.channelMapStore.numColumns;
        const renderWidth = Math.ceil((outerRenderWidth - this.maxGap * (numColumns - 1)) / numColumns);
        return Math.max(renderWidth, 1); // return value > 1 to prevent crashing
    }

    /** The height of the raster tile canvas (the area inside the border). */
    get renderHeight() {
        const overlaySettings = AppStore.Instance.overlaySettings;
        const outerRenderHeight = this.fullViewHeight - overlaySettings.paddingTop - overlaySettings.paddingBottom;
        const numRows = AppStore.Instance.channelMapStore.numRows;
        const renderHeight = Math.ceil((outerRenderHeight - this.maxGap * (numRows - 1)) / numRows);
        return Math.max(renderHeight, 1); // return value > 1 to prevent crashing
    }

    /** The space between the edges of the overlay canvas and the raster tile canvas (the area outside the border). */
    get padding(): Padding {
        return {
            left: OverlaySettings.Instance.paddingLeft,
            right: this.maxGap,
            top: this.maxGap,
            bottom: OverlaySettings.Instance.paddingBottom
        };
    }

    /** The horizontal gap between columns. Returns 0 if there's only one column. */
    @computed get gapX() {
        const overlaySettings = AppStore.Instance.overlaySettings;
        const channelMapStore = AppStore.Instance.channelMapStore;
        const outerRenderWidth = this.fullViewWidth - overlaySettings.paddingLeft - overlaySettings.paddingRight;
        return channelMapStore.numColumns > 1 ? (outerRenderWidth - this.renderWidth * channelMapStore.numColumns) / (channelMapStore.numColumns - 1) : 0;
    }

    /** The vertical gap between rows. Returns 0 if there's only one row. */
    @computed get gapY() {
        const overlaySettings = AppStore.Instance.overlaySettings;
        const channelMapStore = AppStore.Instance.channelMapStore;
        const outerRenderHeight = this.fullViewHeight - overlaySettings.paddingTop - overlaySettings.paddingBottom;
        return channelMapStore.numRows > 1 ? (outerRenderHeight - this.renderHeight * channelMapStore.numRows) / (channelMapStore.numRows - 1) : 0;
    }

    styleString(frame?: FrameStore) {
        const astString = this.defaultStyleString(frame);
        astString.add("DrawTitle", false);
        astString.add("TextLab", false);
        return astString.toString();
    }
}
