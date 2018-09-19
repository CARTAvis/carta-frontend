import * as React from "react";
import {AppStore} from "../../../stores/AppStore";
import {LabelType, SystemType} from "../../../stores/OverlayStore";
import {observer} from "mobx-react";
import "./OverlaySettingsDialogComponent.css";
import {Button, Switch, Dialog, IDialogProps, Intent, Tab, Tabs, NumericInput, FormGroup, MenuItem, HTMLSelect, Collapse, Divider} from "@blueprintjs/core";
import {Select, ItemRenderer} from "@blueprintjs/select";
import * as AST from "ast_wrapper";
import {DraggableDialogComponent} from "../DraggableDialog/DraggableDialogComponent";

// Color selector
export class Color {
    name: string;
    id: number;
    
    constructor(name: string, id: number) {
        this.name = name;
        this.id = id;
    }
}

const ColorSelect = Select.ofType<Color>();

export const renderColor: ItemRenderer<Color> = (color, { handleClick, modifiers, query }) => {
    return (
        <MenuItem
            active={modifiers.active}
            disabled={modifiers.disabled}
            key={color.id}
            onClick={handleClick}
            text={(<div className="dropdown-color" style={{background: color.name}}>&nbsp;</div>)}
        />
    );
};

// Font selector

export class Font {
    name: string;
    id: number;
    style: string;
    weight: number;
    family: string;
    
    constructor(name: string, id: number) {
        this.name = name.replace("{size} ", "");
        this.id = id;
        
        let family = this.name;
        
        if (family.indexOf("bold") === 0) {
            family = family.replace("bold ", "");
            this.weight = 700;
        } else {
            this.weight = 400;
        }
        
        if (family.indexOf("italic") === 0) {
            family = family.replace("italic ", "");
            this.style = "italic";
        } else {
            this.style = "";
        }
        
        this.family = family;
    }
}

const astFonts: Font[] = AST.fonts.map((x, i) => (new Font(x, i)));

const FontSelect = Select.ofType<Font>();

export const renderFont: ItemRenderer<Font> = (font, { handleClick, modifiers, query }) => {
    return (
        <MenuItem
            active={modifiers.active}
            disabled={modifiers.disabled}
            key={font.id}
            onClick={handleClick}
            text={(<span style={{fontFamily: font.family, fontWeight: font.weight, fontStyle: font.style}}>{font.name}</span>)}
        />
    );
};

@observer
export class OverlaySettingsDialogComponent extends React.Component<{ appStore: AppStore }> {

    private colorSelect(visible: boolean, currentColorId: number, colorSetter: Function) {
    
        const astColors: Color[] = AST.colors.map((x, i) => ({name: x, id: i}));
    
        let currentColor: Color = astColors[currentColorId];
        if (typeof currentColor === "undefined") {
            currentColor = astColors[0];
        }
        
        return (
            <ColorSelect
                activeItem={currentColor}
                itemRenderer={renderColor}
                items={astColors}
                disabled={!visible}
                filterable={false}
                popoverProps={{minimal: true, position: "auto-end", popoverClassName: "colorselect"}}
                onItemSelect={(color) => colorSetter(color.id)}
            >
                <Button className="colorselect" text={(<div className="dropdown-color" style={{background: currentColor.name}}>&nbsp;</div>)} disabled={!visible} rightIcon="double-caret-vertical" />
            </ColorSelect>
        );
    }

    private fontSelect(visible: boolean, currentFontId: number, fontSetter: Function) {
        let currentFont: Font = astFonts[currentFontId];
        if (typeof currentFont === "undefined") {
            currentFont = astFonts[0];
        }
        
        return (
            <FontSelect
                activeItem={currentFont}
                itemRenderer={renderFont}
                items={astFonts}
                disabled={!visible}
                filterable={false}
                popoverProps={{minimal: true, position: "auto-end"}}
                onItemSelect={(font) => fontSetter(font.id)}
            >
                <Button text={(<span style={{fontFamily: currentFont.family, fontWeight: currentFont.weight, fontStyle: currentFont.style}}>{currentFont.name}</span>)} disabled={!visible} rightIcon="double-caret-vertical" />
            </FontSelect>
        );
    }

    public render() {
        const overlayStore = this.props.appStore.overlayStore;
        const global = overlayStore.global;
        const title = overlayStore.title;
        const grid = overlayStore.grid;
        const border = overlayStore.border;
        const ticks = overlayStore.ticks;
        const axes = overlayStore.axes;
        const numbers = overlayStore.numbers;
        const labels = overlayStore.labels;
        
        const interior: boolean = (global.labelType === LabelType.Interior);
        
        const disabledIfInterior = (interior && "Does not apply to interior labelling.");
        const disabledIfExterior = (!interior && "Does not apply to exterior labelling.");
        
        const globalPanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Font">
                    {this.fontSelect(true, global.font, global.setFont)}
                    <NumericInput
                        min={7}
                        placeholder="Font size"
                        value={global.fontSize}
                        onValueChange={(value: number) => global.setFontSize(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Color">
                    {this.colorSelect(true, global.color, global.setColor)}
                </FormGroup>
                <FormGroup inline={true} label="Width" labelInfo="(px)">
                    <NumericInput
                        placeholder="Width"
                        min={0.001}
                        value={global.width}
                        stepSize={0.5}
                        minorStepSize={0.1}
                        majorStepSize={1}
                        onValueChange={(value: number) => global.setWidth(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Tolerance" labelInfo="(%)">
                    <NumericInput
                        placeholder="Tolerance"
                        min={0.1}
                        value={global.tolerance}
                        stepSize={1}
                        minorStepSize={null}
                        majorStepSize={10}
                        onValueChange={(value: number) => global.setTolerance(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Labelling">
                    <HTMLSelect
                        options={Object.keys(LabelType).map((key) => ({label: key, value: LabelType[key]}))}
                        value={global.labelType}
                        onChange={(event: React.FormEvent<HTMLSelectElement>) => global.setLabelType(event.currentTarget.value as LabelType)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Coordinate system">
                    <HTMLSelect
                        options={Object.keys(SystemType).map((key) => ({label: key, value: SystemType[key]}))}
                        value={global.system}
                        onChange={(event: React.FormEvent<HTMLSelectElement>) => global.setSystem(event.currentTarget.value as SystemType)}
                    />
                </FormGroup>
            </div>
        );
        
        const titlePanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Visible">
                    <Switch 
                        checked={title.visible}
                        onChange={(ev) => title.setVisible(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Text" disabled={!title.visible}>
                    <input
                        className="bp3-input"
                        type="text"
                        placeholder="Text input"
                        value={title.text}
                        disabled={!title.visible}
                        onChange={(ev) => title.setText(ev.currentTarget.value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Font" disabled={!title.visible}>
                    {this.fontSelect(title.visible, title.font, title.setFont)}
                    <NumericInput
                        min={7}
                        placeholder="Font size"
                        value={title.fontSize}
                        disabled={!title.visible}
                        onValueChange={(value: number) => title.setFontSize(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Gap" disabled={!title.visible}>
                    <NumericInput
                        placeholder="Gap"
                        min={0}
                        stepSize={0.01}
                        minorStepSize={0.001}
                        majorStepSize={0.1}
                        value={title.gap}
                        disabled={!title.visible}
                        onValueChange={(value: number) => title.setGap(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Color" disabled={!title.visible}>
                    {this.colorSelect(title.visible, title.color, title.setColor)}
                </FormGroup>
            </div>
        );
        
        const ticksPanel = (
            <div className="panel-container">
                <FormGroup 
                    inline={true}
                    label="Draw on all edges"
                    disabled={interior}
                    helperText={disabledIfInterior}
                >
                    <Switch 
                        checked={ticks.drawAll}
                        disabled={interior}
                        onChange={(ev) => ticks.setDrawAll(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Density">
                    <NumericInput
                        placeholder="Density"
                        min={0}
                        value={ticks.density}
                        onValueChange={(value: number) => ticks.setDensity(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Color">
                    {this.colorSelect(true, ticks.color, ticks.setColor)}
                </FormGroup>
                <FormGroup inline={true} label="Width" labelInfo="(px)">
                    <NumericInput
                        placeholder="Width"
                        min={0.001}
                        value={ticks.width}
                        stepSize={0.5}
                        minorStepSize={0.1}
                        majorStepSize={1}
                        onValueChange={(value: number) => ticks.setWidth(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Minor length" labelInfo="(%)">
                    <NumericInput
                        placeholder="Length"
                        min={0}
                        max={100}
                        value={ticks.length}
                        stepSize={1}
                        minorStepSize={null}
                        majorStepSize={10}
                        onValueChange={(value: number) => ticks.setLength(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Major length" labelInfo="(%)">
                    <NumericInput
                        placeholder="Length"
                        min={0}
                        max={100}
                        value={ticks.majorLength}
                        stepSize={1}
                        minorStepSize={null}
                        majorStepSize={10}
                        onValueChange={(value: number) => ticks.setMajorLength(value)}
                    />
                </FormGroup>
            </div>
        );
        
        const gridPanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Visible">
                    <Switch
                        checked={grid.visible}
                        onChange={(ev) => grid.setVisible(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Color" disabled={!grid.visible}>
                    {this.colorSelect(grid.visible, grid.color, grid.setColor)}
                </FormGroup>
                <FormGroup inline={true} label="Width" labelInfo="(px)" disabled={!grid.visible}>
                    <NumericInput
                        placeholder="Width"
                        min={0.001}
                        value={grid.width}
                        stepSize={0.5}
                        minorStepSize={0.1}
                        majorStepSize={1}
                        disabled={!grid.visible}
                        onValueChange={(value: number) => grid.setWidth(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Gap">
                    <NumericInput
                        placeholder="Gap"
                        min={0.001}
                        stepSize={0.01}
                        minorStepSize={0.001}
                        majorStepSize={0.1}
                        value={grid.gap}
                        onValueChange={(value: number) => grid.setGap(value)}
                    />
                </FormGroup>
            </div>
        );
        
        const borderPanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Visible">
                    <Switch
                        checked={border.visible}
                        onChange={(ev) => border.setVisible(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Color" disabled={!border.visible}>
                    {this.colorSelect(border.visible, border.color, border.setColor)}
                </FormGroup>
                <FormGroup inline={true} label="Width" labelInfo="(px)" disabled={!border.visible}>
                    <NumericInput
                        placeholder="Width"
                        min={0.001}
                        value={border.width}
                        stepSize={0.5}
                        minorStepSize={0.1}
                        majorStepSize={1}
                        disabled={!border.visible}
                        onValueChange={(value: number) => border.setWidth(value)}
                    />
                </FormGroup>
            </div>
        );
        
        const multiAxisPanel = (axesObj, settingsFunction) => {
            return (
                <div className="panel-container">
                    {settingsFunction(axesObj)}
                    <Divider/>
                    <FormGroup
                        inline={true}
                        label="Custom X axis"
                        disabled={!interior}
                        helperText={disabledIfExterior}
                    >
                        <Switch
                            checked={axesObj.axis[0].customConfig}
                            disabled={!interior}
                            onChange={(ev) => axesObj.axis[0].setCustomConfig(ev.currentTarget.checked)}
                        />
                    </FormGroup>
                    <Collapse isOpen={axesObj.axis[0].customConfig}>
                        {settingsFunction(axesObj.axis[0])}
                    </Collapse>
                    <Divider/>
                    <FormGroup
                        inline={true}
                        label="Custom Y axis"
                        disabled={!interior}
                        helperText={disabledIfExterior}
                    >
                        <Switch
                            checked={axesObj.axis[1].customConfig}
                            disabled={!interior}
                            onChange={(ev) => axesObj.axis[1].setCustomConfig(ev.currentTarget.checked)}
                        />
                    </FormGroup>
                    <Collapse isOpen={axesObj.axis[1].customConfig}>
                        {settingsFunction(axesObj.axis[1])}
                    </Collapse>
                </div>
            );
        };
        
        const axisSettings = (axis) => {
            return (
                <React.Fragment>
                    <FormGroup
                        inline={true}
                        label="Visible"
                        disabled={!interior}
                        helperText={disabledIfExterior}
                    >
                        <Switch
                            checked={axis.visible}
                            disabled={!interior}
                            onChange={(ev) => axis.setVisible(ev.currentTarget.checked)}
                        />
                    </FormGroup>
                    <FormGroup
                        inline={true}
                        label="Color"
                        disabled={!interior || !axis.visible}
                        helperText={disabledIfExterior}
                    >
                        {this.colorSelect(interior && axis.visible, axis.color, axis.setColor)}
                    </FormGroup>
                    <FormGroup
                        inline={true}
                        label="Width"
                        labelInfo="(px)"
                        disabled={!interior || !axis.visible}
                        helperText={disabledIfExterior}
                    >
                        <NumericInput
                            placeholder="Width"
                            min={0.001}
                            value={axis.width}
                            stepSize={0.5}
                            minorStepSize={0.1}
                            majorStepSize={1}
                            disabled={!interior || !axis.visible}
                            onValueChange={(value: number) => axis.setWidth(value)}
                        />
                    </FormGroup>
                </React.Fragment>
            );
        };
        
        const numberSettings = (axis) => {
            return (
                <React.Fragment>
                    <FormGroup inline={true} label="Visible">
                        <Switch
                            checked={axis.visible}
                            onChange={(ev) => axis.setVisible(ev.currentTarget.checked)}
                        />
                    </FormGroup>
                    <FormGroup inline={true} label="Font" disabled={!axis.visible}>
                        {this.fontSelect(axis.visible, axis.font, axis.setFont)}
                        <NumericInput
                            min={7}
                            placeholder="Font size"
                            value={axis.fontSize}
                            disabled={!axis.visible}
                            onValueChange={(value: number) => axis.setFontSize(value)}
                        />
                    </FormGroup>
                    <FormGroup inline={true} label="Color" disabled={!axis.visible}>
                        {this.colorSelect(axis.visible, axis.color, axis.setColor)}
                    </FormGroup>
                    { "axisIndex" in axis && 
                    <FormGroup inline={true} label="Format" disabled={!axis.visible}>
                        <input
                            className="bp3-input"
                            type="text"
                            placeholder="Format"
                            value={axis.format}
                            disabled={!axis.visible}
                            onChange={(ev) => axis.setFormat(ev.currentTarget.value)}
                        />
                    </FormGroup>
                    }
                </React.Fragment>
            );
        };

        const labelSettings = (axis) => {
            return (
                <React.Fragment>
                    <FormGroup inline={true} label="Visible">
                        <Switch
                            checked={axis.visible}
                            onChange={(ev) => axis.setVisible(ev.currentTarget.checked)}
                        />
                    </FormGroup>
                    { "axisIndex" in axis && 
                    <FormGroup inline={true} label="Text" disabled={!axis.visible}>
                        <input
                            className="bp3-input"
                            type="text"
                            placeholder="Text"
                            value={axis.text}
                            disabled={!axis.visible}
                            onChange={(ev) => axis.setText(ev.currentTarget.value)}
                        />
                    </FormGroup>
                    }
                    <FormGroup inline={true} label="Font" disabled={!axis.visible}>
                        {this.fontSelect(axis.visible, axis.font, axis.setFont)}
                        <NumericInput
                            min={7}
                            placeholder="Font size"
                            value={axis.fontSize}
                            disabled={!axis.visible}
                            onValueChange={(value: number) => axis.setFontSize(value)}
                        />
                    </FormGroup>
                    <FormGroup inline={true} label="Gap" disabled={!axis.visible}>
                        <NumericInput
                            placeholder="Gap"
                            min={0}
                            stepSize={0.01}
                            minorStepSize={0.001}
                            majorStepSize={0.1}
                            value={axis.gap}
                            disabled={!axis.visible}
                            onValueChange={(value: number) => axis.setGap(value)}
                        />
                    </FormGroup>
                    <FormGroup inline={true} label="Color" disabled={!axis.visible}>
                        {this.colorSelect(axis.visible, axis.color, axis.setColor)}
                    </FormGroup>
                </React.Fragment>
            );
        };
        
        const axesPanel = multiAxisPanel(axes, axisSettings);
        const numbersPanel = multiAxisPanel(numbers, numberSettings);
        const labelsPanel = multiAxisPanel(labels, labelSettings);

        let className = "overlay-settings-dialog";
        if (this.props.appStore.darkTheme) {
            className += " bp3-dark";
        }

        const dialogProps: IDialogProps = {
            icon: "settings",
            backdropClassName: "minimal-dialog-backdrop",
            className: className,
            canOutsideClickClose: false,
            lazy: true,
            isOpen: overlayStore.overlaySettingsDialogVisible,
            onClose: overlayStore.hideOverlaySettings,
            title: "Overlay Settings",
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} minWidth={300} minHeight={300} defaultWidth={600} defaultHeight={450} enableResizing={true}>
                <div className="bp3-dialog-body">
                    <Tabs
                        id="overlayTabs"
                        vertical={true}
                        selectedTabId={overlayStore.overlaySettingsActiveTab}
                        onChange={(tabId) => overlayStore.setOverlaySettingsActiveTab(String(tabId))}
                    >
                        <Tab id="global" title="Global" panel={globalPanel}/>
                        <Tab id="title" title="Title" panel={titlePanel}/>
                        <Tab id="ticks" title="Ticks" panel={ticksPanel}/>
                        <Tab id="grid" title="Grid" panel={gridPanel}/>
                        <Tab id="border" title="Border" panel={borderPanel}/>
                        <Tab id="axes" title="Axes" panel={axesPanel}/>
                        <Tab id="numbers" title="Numbers" panel={numbersPanel}/>
                        <Tab id="labels" title="Labels" panel={labelsPanel}/>
                    </Tabs>
                </div>
                <div className="bp3-dialog-footer">
                    <div className="bp3-dialog-footer-actions">
                        <Button intent={Intent.PRIMARY} onClick={overlayStore.hideOverlaySettings} text="Close"/>
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}
