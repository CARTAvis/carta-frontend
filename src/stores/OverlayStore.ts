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
    @observable labelType?: LabelType;
    @observable color?: number;
    @observable width?: number;
    @observable font?: number;
    @observable fontSize?: number;
    @observable tolerance?: number; // percentage
    @observable system?: SystemType;

    @computed get styleString() {
        let astString = new ASTSettingsString();
        astString.add("Labelling", this.labelType);
        astString.add("Color", this.color);
        astString.add("Width", this.width, (this.width > 0));
        astString.add("Font", this.font);
        astString.add("Size", this.fontSize);
        astString.add("Tol", (this.tolerance / 100).toFixed(2), (this.tolerance >= 0.001)); // convert to fraction
        astString.add("System", this.system, (this.system !== SystemType.Native));
        return astString.toString();
    }
    
    constructor() {
        this.system = SystemType.Native;
        this.labelType = LabelType.Exterior;
        this.color = 4;
        this.width = 1;
        this.tolerance = 1; // percentage
    }
    
    @action setColor = (color: number) => {
        this.color = color;
    };

    @action setWidth(width: number) {
        this.width = width;
    }

    @action setFont = (font: number) => {
        this.font = font;
    };

    @action setFontSize(fontSize: number) {
        this.fontSize = fontSize;
    }

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

export class OverlayTitleSettings {
    @observable visible?: boolean;
    @observable font?: number;
    @observable fontSize?: number;
    @observable gap?: number;
    @observable customColor?: boolean;
    @observable color?: number;
    @observable text: string;

    @computed get styleString() {
        let astString = new ASTSettingsString();
        astString.add("DrawTitle", this.visible);
        astString.add("Font(Title)", this.font);
        astString.add("Size(Title)", this.fontSize);
        astString.add("TitleGap", this.gap);
        astString.add("Color(Title)", this.color, this.customColor);
        astString.add("Title(1)", this.text);
        return astString.toString();
    }
    
    constructor() {
        this.visible = false;
        this.gap = 0.02;
        this.customColor = false;
        this.color = 4;
        this.font = 2;
        this.fontSize = 24;
        this.text = "A custom AST plot";
    }

    @action setVisible(visible: boolean = true) {
        this.visible = visible;
    }

    @action setText(text: string) {
        this.text = text;
    }

    @action setFont = (font: number) => {
        this.font = font;
    };

    @action setFontSize(fontSize: number) {
        this.fontSize = fontSize;
    }

    @action setGap(gap: number) {
        this.gap = gap;
    }

    @action setCustomColor(customColor: boolean) {
        this.customColor = customColor;
    }

    @action setColor = (color: number) => {
        this.color = color;
    };
}

export class OverlayGridSettings {
    @observable visible?: boolean;
    @observable customColor?: boolean;
    @observable color?: number;
    @observable width?: number;
    @observable dynamicGap?: boolean;
    @observable gapX?: number;
    @observable gapY?: number;

    @computed get styleString() {
        let astString = new ASTSettingsString();
        astString.add("Grid", this.visible);
        astString.add("Color(Grid)", this.color, this.customColor);
        astString.add("Width(Grid)", this.width, (this.width > 0));
        astString.add("Gap(1)", this.gapX, !this.dynamicGap);
        astString.add("Gap(2)", this.gapY, !this.dynamicGap);
        return astString.toString();
    }
    
    constructor() {
        this.visible = true;
        this.customColor = false;
        this.color = 4;
        this.width = 1;
        this.dynamicGap = true;
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

    @action setDynamicGap(dynamicGap: boolean = true) {
        this.dynamicGap = dynamicGap;
    }

    @action setGapX(gap: number) {
        this.gapX = gap;
    }

    @action setGapY(gap: number) {
        this.gapY = gap;
    }
    
}

export class OverlayBorderSettings {
    @observable visible?: boolean;
    @observable customColor?: boolean;
    @observable color?: number;
    @observable width?: number;

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
    @observable drawAll?: boolean;
    @observable densityX?: number;
    @observable densityY?: number;
    @observable dynamicDensity?: boolean;
    @observable customColor?: boolean;
    @observable color?: number;
    @observable width?: number;
    @observable length?: number; // percentage
    @observable majorLength?: number; // percentage

    @computed get styleString() {
        let astString = new ASTSettingsString();
        astString.add("TickAll", this.drawAll);
        astString.add("MinTick(1)", this.densityX, !this.dynamicDensity);
        astString.add("MinTick(2)", this.densityY, !this.dynamicDensity);
        astString.add("Color(Ticks)", this.color, this.customColor);
        astString.add("Width(Ticks)", this.width, (this.width > 0));
        astString.add("MinTickLen", (this.length / 100).toFixed(2)); // convert to fraction
        astString.add("MajTickLen", (this.majorLength / 100).toFixed(2)); // convert to fraction
        return astString.toString();
    }
    
    constructor() {
        this.drawAll = true;
        this.dynamicDensity = true;
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

    @action setDynamicDensity(dynamicDensity: boolean = true) {
        this.dynamicDensity = dynamicDensity;
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
    @observable visible?: boolean;
    @observable customColor?: boolean;
    @observable color?: number;
    @observable width?: number;
    
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
    @observable visible?: boolean;
    @observable font?: number;
    @observable fontSize?: number;
    @observable customColor?: boolean;
    @observable color?: number;
    @observable format?: string;
    @observable dynamicPrecision?: boolean;
    @observable precision?: number;

    constructor() {
        this.visible = true;
        this.fontSize = 10;
        this.font = 1;
        this.customColor = false;
        this.color = 4;
        this.format = "d";
        this.dynamicPrecision = true;
        this.precision = 3;
    }
    
    @computed get formatString() {
        return (this.dynamicPrecision ? `${this.format}.*` : `${this.format}.${this.precision}`);
    }

    @computed get styleString() {
        let astString = new ASTSettingsString();
        
        astString.add("NumLab", this.visible);
        astString.add("Font(NumLab)", this.font);
        astString.add("Size(NumLab)", this.fontSize);
        astString.add("Color(NumLab)", this.color, this.customColor);
                
        // Add settings for individual axes
        astString.add("Format(1)", this.formatString);
        astString.add("Format(2)", this.formatString);
        
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

    @action setFormat(format: string) {
        this.format = format;
    }

    @action setDynamicPrecision(dynamicPrecision: boolean) {
        this.dynamicPrecision = dynamicPrecision;
    }

    @action setPrecision(precision: number) {
        this.precision = precision;
    }
}

export class OverlayLabelSettings {
    @observable visible?: boolean;
    @observable customColor?: boolean;
    @observable color?: number;
    @observable gap?: number;
    @observable font?: number;
    @observable fontSize?: number;
    @observable dynamicText?: boolean;
    @observable textX?: string;
    @observable textY?: string;

    constructor() {
        this.visible = true;
        this.fontSize = 15;
        this.font = 1;
        this.customColor = false;
        this.color = 4;
        this.dynamicText = true;
    }

    @computed get styleString() {
        let astString = new ASTSettingsString();

        astString.add("TextLab", this.visible);
        astString.add("Font(TextLab)", this.font);
        astString.add("Size(TextLab)", this.fontSize);
        astString.add("Color(TextLab)", this.color, this.customColor);
        astString.add("TextLabGap", this.gap);
        
        // Add settings for individual axes
        astString.add(`Label(1)`, this.textX, !this.dynamicText);
        astString.add(`Label(2)`, this.textY, !this.dynamicText);
        
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

    @action setDynamicText(dynamicText: boolean) {
        this.dynamicText = dynamicText;
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
    @observable title: OverlayTitleSettings;
    @observable border: OverlayBorderSettings;
    @observable axes: OverlayAxisSettings;
    @observable numbers: OverlayNumberSettings;
    @observable labels: OverlayLabelSettings;
    @observable ticks: OverlayTickSettings;
    
    // Extra settings
    
    @observable extra?: string;
    
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
        this.title = new OverlayTitleSettings();
        this.border = new OverlayBorderSettings();
        this.axes = new OverlayAxisSettings();
        this.numbers = new OverlayNumberSettings();
        this.labels = new OverlayLabelSettings();
        this.ticks = new OverlayTickSettings();
    }

    @computed get styleString() {
        return this.stringify();
    }

    @computed get padding(): Padding {
        const displayTitle = this.title.visible;
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
            Math.max(minimumPaddingRatio, (displayLabelText ? 0.5 : 0) + (displayNumText ? 0.6 : 0)),
            minimumPaddingRatio,
            (displayTitle ? 1.0 : minimumPaddingRatio),
            Math.max(minimumPaddingRatio, (displayLabelText ? 0.4 : 0) + (displayNumText ? 0.6 : 0))
        ];

        const paddingValues = paddingRatios.map(r => r * paddingSize);
        return {
            left: paddingValues[0],
            right: paddingValues[1],
            top: paddingValues[2],
            bottom: paddingValues[3]
        };
    }

    private stringify() {
        let astString = new ASTSettingsString();

        astString.addSection(this.global.styleString);
        astString.addSection(this.title.styleString);
        astString.addSection(this.grid.styleString);
        astString.addSection(this.border.styleString);
        astString.addSection(this.ticks.styleString);
        astString.addSection(this.axes.styleString);
        astString.addSection(this.numbers.styleString);
        astString.addSection(this.labels.styleString);
        
        astString.addSection(this.extra);

        return astString.toString();
    }
}
