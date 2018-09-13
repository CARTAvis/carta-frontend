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

export class OverlayTitleSettings {
    @observable visible?: boolean;
    @observable font?: number;
    @observable fontSize?: number;
    @observable gap?: number;
    @observable color?: number;
    @observable text: string;

    @computed get styleString() {
        let astString = new ASTSettingsString();
        astString.add("DrawTitle", this.visible);
        astString.add("Font(Title)", this.font);
        astString.add("Size(Title)", this.fontSize);
        astString.add("TitleGap", this.gap);
        astString.add("Color(Title)", this.color);
        astString.add("Title(1)", this.text);
        return astString.toString();
    }
    
    constructor() {
        this.visible = false;
        this.gap = 0.02;
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

    @action setColor = (color: number) => {
        this.color = color;
    };
}

export class OverlayGridSettings {
    @observable visible?: boolean;
    @observable color?: number;
    @observable width?: number;

    @computed get styleString() {
        let astString = new ASTSettingsString();
        astString.add("Grid", this.visible);
        astString.add("Color(Grid)", this.color);
        astString.add("Width(Grid)", this.width, (this.width > 0));
        return astString.toString();
    }
    
    constructor() {
        this.visible = true;
        this.color = 4;
    }

    @action setVisible(visible: boolean = true) {
        this.visible = visible;
    }

    @action setColor = (color: number) => {
        this.color = color;
    };

    @action setWidth(width: number) {
        this.width = width;
    }
    
}

export class OverlayBorderSettings {
    @observable visible?: boolean;
    @observable color?: number;
    @observable width?: number;

    @computed get styleString() {
        let astString = new ASTSettingsString();
        astString.add("Border", this.visible);
        astString.add("Color(Border)", this.color);
        astString.add("Width(Border)", this.width, (this.width > 0));
        return astString.toString();
    }
    
    constructor() {
        this.visible = true;
    }

    @action setVisible(visible: boolean = true) {
        this.visible = visible;
    }

    @action setColor = (color: number) => {
        this.color = color;
    };

    @action setWidth(width: number) {
        this.width = width;
    }
}

export class OverlayTickSettings {
    @observable density?: number;
    @observable color?: number;
    @observable width?: number;
    @observable length?: number;
    @observable majorLength?: number;

    @computed get styleString() {
        let astString = new ASTSettingsString();
        astString.add("MinTick", this.density);
        astString.add("Color(Ticks)", this.color);
        astString.add("Width(Ticks)", this.width, (this.width > 0));
        astString.add("MinTickLen", this.length);
        astString.add("MajTickLen", this.majorLength);
        return astString.toString();
    }

    @action setDensity(density: number) {
        this.density = density;
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
    @observable color?: number;
    @observable width?: number;
    @observable gap?: number;

    @observable numberVisible?: boolean;
    @observable numberFont?: number;
    @observable numberFontSize?: number;
    @observable numberColor?: number;
    @observable numberFormat?: string;

    @observable labelVisible?: boolean;
    @observable labelColor?: number;
    @observable labelGap?: number;
    @observable labelFont?: number;
    @observable labelFontSize?: number;
    @observable labelText?: string;

    @observable customConfig?: boolean;
    
    axisIndex: number;

    constructor(axisIndex: number) {
        this.axisIndex = axisIndex;
        
        this.visible = false;
        this.numberVisible = false;
        this.labelVisible = false;
        
        this.labelFontSize = 15;
        this.labelFont = 1;
        
        this.numberFontSize = 10;
        this.numberFont = 1;
        
        this.customConfig = !axisIndex;
    }

    @computed get styleString() {
        const indexStringBrackets = (this.axisIndex > 0) ? `(${this.axisIndex})` : "";
        const indexString = (this.axisIndex > 0) ? `${this.axisIndex}` : "";
        
        let astString = new ASTSettingsString();

        // Axes settings
        astString.add(`DrawAxes${indexStringBrackets}`, this.visible);
        astString.add(`Color(Axis${indexString})`, this.color);
        astString.add(`Width(Axis${indexString})`, this.width, (this.width > 0));
        astString.add(`Gap${indexStringBrackets}`, this.gap);
        
        // Number settings
        astString.add(`NumLab${indexStringBrackets}`, this.numberVisible);
        astString.add(`Font(NumLab${indexString})`, this.numberFont);
        astString.add(`Size(NumLab${indexString})`, this.numberFontSize);
        astString.add(`Color(NumLab${indexString})`, this.numberColor);
        
        // Label settings
        astString.add(`TextLab${indexStringBrackets}`, this.labelVisible);
        astString.add(`Font(TextLab${indexString})`, this.labelFont);
        astString.add(`Size(TextLab${indexString})`, this.labelFontSize);
        astString.add(`Color(TextLab${indexString})`, this.labelColor);
        astString.add(`TextLabGap${indexStringBrackets}`, this.labelGap);
        
        // Settings which are per-axis only
        if (this.axisIndex > 0) {
            astString.add(`Label${indexStringBrackets}`, this.labelText);
            astString.add(`Format${indexStringBrackets}`, this.numberFormat, (this.numberFormat && this.numberFormat.length > 0));
        }
        
        return astString.toString();
    }

    @action setVisible(visible: boolean = true) {
        this.visible = visible;
    }

    @action setColor = (color: number) => {
        this.color = color;
    };

    @action setWidth(width: number) {
        this.width = width;
    }

    @action setGap(gap: number) {
        this.gap = gap;
    }

    @action setNumberVisible(visible: boolean = true) {
        this.numberVisible = visible;
    }

    @action setNumberFont = (font: number) => {
        this.numberFont = font;
    };

    @action setNumberFontSize(fontSize: number) {
        this.numberFontSize = fontSize;
    }

    @action setNumberColor = (color: number) => {
        this.numberColor = color;
    };
    
    @action setNumberFormat(format: string) {
        this.numberFormat = format;
    }

    @action setLabelVisible(visible: boolean = true) {
        this.labelVisible = visible;
    }

    @action setLabelColor = (color: number) => {
        this.labelColor = color;
    };

    @action setLabelGap(gap: number) {
        this.labelGap = gap;
    }

    @action setLabelFont = (font: number) => {
        this.labelFont = font;
    };

    @action setLabelFontSize(fontSize: number) {
        this.labelFontSize = fontSize;
    }

    @action setLabelText(text: string) {
        this.labelText = text;
    }
    
    @action setCustomConfig(customConfig: boolean = true) {
        this.customConfig = customConfig;
    }

}

export class OverlayStore {
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
        this.grid = new OverlayGridSettings();
        this.title = new OverlayTitleSettings();
        this.border = new OverlayBorderSettings();
        this.axes = new OverlayAxisSettings(0);
        this.axis = [new OverlayAxisSettings(1), new OverlayAxisSettings(2)];
        this.ticks = new OverlayTickSettings();

        // Default settings
        this.system = SystemType.Native;
        this.labelType = LabelType.Exterior;
        this.color = 4;
        this.width = 1;
        this.tolerance = 0.02;
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

    @computed get styleString() {
        return this.stringify();
    }

    @computed get padding(): Padding {
        const displayTitle = this.title.visible;
        const displayLabelText = this.axis.map((axis) => {
            if (axis.customConfig && axis.labelVisible !== undefined) {
                return axis.labelVisible;
            }
            return this.axes.labelVisible !== false;
        });
        const displayNumText = this.axis.map((axis) => {
            if (this.labelType === LabelType.Interior) {
                return false;
            }
            if (axis.customConfig && axis.numberVisible !== undefined) {
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
        astString.add("Labelling", this.labelType);
        astString.add("Color", this.color);
        astString.add("Width", this.width, (this.width > 0));
        astString.add("Font", this.font);
        astString.add("Size", this.fontSize);
        astString.add("Tol", this.tolerance);
        astString.add("System", this.system, (this.system !== SystemType.Native));
        
        astString.addSection(this.grid.styleString);
        astString.addSection(this.title.styleString);
        astString.addSection(this.border.styleString);
        astString.addSection(this.axes.styleString);
        for (let axis of this.axis) {
            if (axis.customConfig) {
                astString.addSection(axis.styleString);
            }
        }
        astString.addSection(this.ticks.styleString);
        
        astString.addSection(this.extra);

        return astString.toString();
    }
}
