import {Colors} from "@blueprintjs/core";
import {action, computed, observable} from "mobx";
import * as AST from "ast_wrapper";
import {FrameStore} from "./FrameStore";

export const dayPalette = [
    Colors.BLACK,        // 0
    Colors.WHITE,        // 1
    Colors.RED2,         // 2
    Colors.FOREST3,      // 3
    Colors.BLUE2,        // 4
    Colors.TURQUOISE2,   // 5
    Colors.VIOLET2,      // 6
    Colors.GOLD2,        // 7
    Colors.GRAY2         // 8
];

export const nightPalette = [
    Colors.BLACK,        // 0
    Colors.WHITE,        // 1
    Colors.RED4,         // 2
    Colors.FOREST4,      // 3
    Colors.BLUE4,        // 4
    Colors.TURQUOISE4,   // 5
    Colors.VIOLET4,      // 6
    Colors.GOLD4,        // 7
    Colors.GRAY4         // 8
];

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
//     J2000 = "J2000"
}

export class Padding {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export class ASTSettingsString {
    stringList: Array<string>;
    
    constructor () {
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
    @observable color: number;
    @observable tolerance: number; // percentage
    @observable system: SystemType;

    @computed get styleString() {
        let astString = new ASTSettingsString();
        astString.add("Labelling", this.labelType);
        astString.add("Color", this.color);
        astString.add("Tol", (this.tolerance / 100).toFixed(2), (this.tolerance >= 0.001)); // convert to fraction
        astString.add("System", this.system, (this.system !== SystemType.Native));
        return astString.toString();
    }
    
    constructor() {
        this.system = SystemType.Native;
        this.labelType = LabelType.Exterior;
        this.color = 4;
        this.tolerance = 1; // percentage
    }
    
    @action setColor = (color: number) => {
        this.color = color;
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
}

export class OverlayGridSettings {
    @observable visible: boolean;
    @observable customColor: boolean;
    @observable color: number;
    @observable width: number;
    @observable customGap: boolean;
    @observable gapX: number;
    @observable gapY: number;

    @computed get styleString() {
        let astString = new ASTSettingsString();
        astString.add("Grid", this.visible);
        astString.add("Color(Grid)", this.color, this.customColor);
        astString.add("Width(Grid)", this.width, (this.width > 0));
        astString.add("Gap(1)", this.gapX, this.customGap);
        astString.add("Gap(2)", this.gapY, this.customGap);
        return astString.toString();
    }
    
    constructor() {
        this.visible = true;
        this.customColor = false;
        this.color = 4;
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

    @action setColor = (color: number) => {
        this.color = color;
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
    @observable color: number;
    @observable width: number;

    @computed get styleString() {
        let astString = new ASTSettingsString();
        astString.add("Border", this.visible);
        astString.add("Color(Border)", this.color, this.customColor);
        astString.add("Width(Border)", this.width, (this.width > 0));
        return astString.toString();
    }
    
    constructor() {
        this.visible = true;
        this.customColor = false;
        this.color = 4;
        this.width = 1;
    }

    @action setVisible(visible: boolean = true) {
        this.visible = visible;
    }

    @action setCustomColor(customColor: boolean) {
        this.customColor = customColor;
    }

    @action setColor = (color: number) => {
        this.color = color;
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
    @observable color: number;
    @observable width: number;
    @observable length: number; // percentage
    @observable majorLength: number; // percentage

    @computed get styleString() {
        let astString = new ASTSettingsString();
        astString.add("TickAll", this.drawAll);
        astString.add("MinTick(1)", this.densityX, this.customDensity);
        astString.add("MinTick(2)", this.densityY, this.customDensity);
        astString.add("Color(Ticks)", this.color, this.customColor);
        astString.add("Width(Ticks)", this.width, (this.width > 0));
        astString.add("MinTickLen", (this.length / 100).toFixed(2)); // convert to fraction
        astString.add("MajTickLen", (this.majorLength / 100).toFixed(2)); // convert to fraction
        return astString.toString();
    }
    
    constructor() {
        this.drawAll = true;
        this.customDensity = false;
        this.densityX = 4;
        this.densityY = 4;
        this.customColor = false;
        this.color = 4;
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

    @action setColor = (color: number) => {
        this.color = color;
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
    @observable color: number;
    @observable width: number;
    
    constructor() {
        this.visible = false;
        this.customColor = false;
        this.color = 4;
        this.width = 1;
    }

    @computed get styleString() {        
        let astString = new ASTSettingsString();

        astString.add("DrawAxes", this.visible);
        astString.add("Color(Axes)", this.color, this.customColor);
        astString.add("Width(Axes)", this.width, (this.width > 0));

        return astString.toString();
    }

    @action setVisible(visible: boolean = true) {
        this.visible = visible;
    }

    @action setCustomColor(customColor: boolean) {
        this.customColor = customColor;
    }

    @action setColor = (color: number) => {
        this.color = color;
    };

    @action setWidth(width: number) {
        this.width = width;
    }
}

export class OverlayNumberSettings {
    @observable visible: boolean;
    @observable font: number;
    @observable fontSize: number;
    @observable customColor: boolean;
    @observable color: number;
    @observable customFormat: boolean;
    @observable formatX: string;
    @observable formatY: string;
    @observable customPrecision: boolean;
    @observable precision: number;
    @observable cursorPrecision: number;
    
    // Unlike most default values, we calculate and set these explicitly, instead of
    // leaving them unset and letting AST pick a default. We have to save these so that
    // we can revert to default values after setting custom values.
    defaultFormatX: string;
    defaultFormatY: string;

    constructor() {
        this.visible = true;
        this.fontSize = 10;
        this.font = 0;
        this.customColor = false;
        this.color = 4;
        this.customFormat = false;
        this.defaultFormatX = "d";
        this.defaultFormatY = "d";
        this.formatX = "d";
        this.formatY = "d";
        this.customPrecision = false;
        this.precision = 3;
        this.cursorPrecision = 4;
    }
    
    @computed get formatStringX() {
        let format = (this.customFormat ? this.formatX : this.defaultFormatX);
        let precision = (this.customPrecision ? this.precision : "*");
        return `${format}.${precision}`;
    }
    
    @computed get formatStringY() {
        let format = (this.customFormat ? this.formatY : this.defaultFormatY);
        let precision = (this.customPrecision ? this.precision : "*");
        return `${format}.${precision}`;
    }
    
    @computed get cursorFormatStringX() {
        let format = (this.customFormat ? this.formatX : this.defaultFormatX);
        return `${format}.${this.cursorPrecision}`;
    }
    
    @computed get cursorFormatStringY() {
        let format = (this.customFormat ? this.formatY : this.defaultFormatY);
        return `${format}.${this.cursorPrecision}`;
    }

    @computed get styleString() {
        let astString = new ASTSettingsString();
        
        astString.add("NumLab", this.visible);
        astString.add("Font(NumLab)", this.font);
        astString.add("Size(NumLab)", this.fontSize);
        astString.add("Color(NumLab)", this.color, this.customColor);
                
        // Add settings for individual axes
        astString.add("Format(1)", this.formatStringX);
        astString.add("Format(2)", this.formatStringY);
        
        return astString.toString();
    }

    @action setVisible(visible: boolean = true) {
        this.visible = visible;
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

    @action setColor = (color: number) => {
        this.color = color;
    };

    @action setCustomFormat(customFormat: boolean) {
        this.customFormat = customFormat;
    }

    @action setFormatX(format: string) {
        this.formatX = format;
    }

    @action setFormatY(format: string) {
        this.formatY = format;
    }

    @action setCustomPrecision(customPrecision: boolean) {
        this.customPrecision = customPrecision;
    }

    @action setPrecision(precision: number) {
        this.precision = precision;
    }

    @action setCursorPrecision(precision: number) {
        this.cursorPrecision = precision;
    }
}

export class OverlayLabelSettings {
    @observable visible: boolean;
    @observable customColor: boolean;
    @observable color: number;
    @observable gap: number;
    @observable font: number;
    @observable fontSize: number;
    @observable customText: boolean;
    @observable textX: string;
    @observable textY: string;

    constructor() {
        this.visible = true;
        this.fontSize = 15;
        this.font = 0;
        this.customColor = false;
        this.color = 4;
        this.customText = false;
    }

    @computed get styleString() {
        let astString = new ASTSettingsString();

        astString.add("TextLab", this.visible);
        astString.add("Font(TextLab)", this.font);
        astString.add("Size(TextLab)", this.fontSize);
        astString.add("Color(TextLab)", this.color, this.customColor);
        astString.add("TextLabGap", this.gap);
        
        // Add settings for individual axes
        astString.add(`Label(1)`, this.textX, this.customText);
        astString.add(`Label(2)`, this.textY, this.customText);
        
        return astString.toString();
    }

    @action setVisible(visible: boolean = true) {
        this.visible = visible;
    }

    @action setCustomColor(customColor: boolean) {
        this.customColor = customColor;
    }

    @action setColor = (color: number) => {
        this.color = color;
    };

    @action setGap(gap: number) {
        this.gap = gap;
    }

    @action setFont = (font: number) => {
        this.font = font;
    };

    @action setFontSize(fontSize: number) {
        this.fontSize = fontSize;
    }

    @action setCustomText(customText: boolean) {
        this.customText = customText;
    }

    @action setTextX(text: string) {
        this.textX = text;
    }

    @action setTextY(text: string) {
        this.textY = text;
    }
}

export class OverlayStore {
    // View size options
    @observable viewWidth: number;
    @observable viewHeight: number;

    // Individual settings
    @observable global: OverlayGlobalSettings;
    @observable grid: OverlayGridSettings;
    @observable border: OverlayBorderSettings;
    @observable axes: OverlayAxisSettings;
    @observable numbers: OverlayNumberSettings;
    @observable labels: OverlayLabelSettings;
    @observable ticks: OverlayTickSettings;
    
    // Dialog
    
    @observable overlaySettingsDialogVisible = false;
    
    @action showOverlaySettings = () => {
        this.overlaySettingsDialogVisible = true;
    };
    
    @action hideOverlaySettings = () => {
        this.overlaySettingsDialogVisible = false;
    };
    
    @observable overlaySettingsActiveTab = "global";
    
    @action setOverlaySettingsActiveTab(tabId: string) {
        this.overlaySettingsActiveTab = tabId;
    }

    constructor() {
        this.global = new OverlayGlobalSettings();
        this.grid = new OverlayGridSettings();
        this.border = new OverlayBorderSettings();
        this.axes = new OverlayAxisSettings();
        this.numbers = new OverlayNumberSettings();
        this.labels = new OverlayLabelSettings();
        this.ticks = new OverlayTickSettings();
    }
    
    private formatFromUnit(unit: string) {
        if (/^d+:m+:s+/.test(unit)) {
            return "dms";
        } else if (/^h+:m+:s+/.test(unit)) {
            return "hms";
        }
        return "d";
    }
    
    @action setDefaultsFromAST(frame: FrameStore) {
        this.labels.setTextX(AST.getString(frame.wcsInfo, "Label(1)"));
        this.labels.setTextY(AST.getString(frame.wcsInfo, "Label(2)"));
                
        let formatFromUnit = (unit: string) => {
            if (/^d+:m+:s+/.test(unit)) {
                return "dms";
            } else if (/^h+:m+:s+/.test(unit)) {
                return "hms";
            }
            return "d";
        };
        
        this.numbers.defaultFormatX = formatFromUnit(AST.getString(frame.wcsInfo, "Unit(1)"));
        this.numbers.defaultFormatY = formatFromUnit(AST.getString(frame.wcsInfo, "Unit(2)"));
        
        this.numbers.setFormatX(formatFromUnit(AST.getString(frame.wcsInfo, "Unit(1)")));
        this.numbers.setFormatY(formatFromUnit(AST.getString(frame.wcsInfo, "Unit(2)")));
    }

    @computed get styleString() {
        let astString = new ASTSettingsString();

        astString.addSection(this.global.styleString);
        astString.addSection(this.grid.styleString);
        astString.addSection(this.border.styleString);
        astString.addSection(this.ticks.styleString);
        astString.addSection(this.axes.styleString);
        astString.addSection(this.numbers.styleString);
        astString.addSection(this.labels.styleString);
        
        astString.add("LabelUp(2)", "0")
        
        return astString.toString();
    }

    @computed get padding(): Padding {
        const displayLabelText = this.labels.visible;        
        const displayNumText = this.numbers.visible;

        let paddingSize = 65;
        const minSize = Math.min(this.viewWidth, this.viewHeight);
        const scalingStartSize = 600;
        if (minSize < scalingStartSize) {
            paddingSize = Math.max(15, minSize / scalingStartSize * paddingSize);
        }
        const minimumPaddingRatio = 0.05;
        const paddingRatios = [
            Math.max(minimumPaddingRatio, (displayLabelText ? 0.5 : 0) + (displayNumText ? 0.5 : 0)),
            minimumPaddingRatio,
            minimumPaddingRatio,
            Math.max(minimumPaddingRatio, (displayLabelText ? 0.5 : 0) + (displayNumText ? 0.5 : 0))
        ];

        const paddingValues = paddingRatios.map(r => r * paddingSize);
        return {
            left: paddingValues[0],
            right: paddingValues[1],
            top: paddingValues[2],
            bottom: paddingValues[3]
        };
    }
}
