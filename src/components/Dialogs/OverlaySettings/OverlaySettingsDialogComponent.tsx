import * as React from "react";
import {AppStore} from "../../../stores/AppStore";
import {LabelType, SystemType} from "../../../stores/OverlayStore";
import {observer} from "mobx-react";
import "./OverlaySettingsDialogComponent.css";
import {Button, Switch, Dialog, IDialogProps, Intent, Tab, Tabs, NumericInput, FormGroup, MenuItem, HTMLSelect} from "@blueprintjs/core";
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
        
        const globalPanel = (
            <div className="panel-container">
                <FormGroup label="Font">
                    {this.fontSelect(true, global.font, global.setFont)}
                    <NumericInput
                        min={7}
                        placeholder="Font size"
                        value={global.fontSize}
                        onValueChange={(value: number) => global.setFontSize(value)}
                    />
                </FormGroup>
                <FormGroup label="Color">
                    {this.colorSelect(true, global.color, global.setColor)}
                </FormGroup>
                <FormGroup label="Width (px)">
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
                <FormGroup label="Tolerance (%)">
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
                <FormGroup label="Labelling">
                    <HTMLSelect
                        options={Object.keys(LabelType).map((key) => ({label: key, value: LabelType[key]}))}
                        value={global.labelType}
                        onChange={(event: React.FormEvent<HTMLSelectElement>) => global.setLabelType(event.currentTarget.value as LabelType)}
                    />
                </FormGroup>
                <FormGroup label="Coordinate system">
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
                <Switch 
                    checked={title.visible}
                    label="Visible"
                    onChange={(ev) => title.setVisible(ev.currentTarget.checked)}
                />
                <FormGroup label="Text" disabled={!title.visible}>
                    <input
                        className="bp3-input"
                        type="text"
                        placeholder="Text input"
                        value={title.text}
                        disabled={!title.visible}
                        onChange={(ev) => title.setText(ev.currentTarget.value)}
                    />
                </FormGroup>
                <FormGroup label="Font" disabled={!title.visible}>
                    {this.fontSelect(title.visible, title.font, title.setFont)}
                    <NumericInput
                        min={7}
                        placeholder="Font size"
                        value={title.fontSize}
                        disabled={!title.visible}
                        onValueChange={(value: number) => title.setFontSize(value)}
                    />
                </FormGroup>
                <FormGroup label="Gap" disabled={!title.visible}>
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
                <FormGroup label="Color" disabled={!title.visible}>
                    {this.colorSelect(title.visible, title.color, title.setColor)}
                </FormGroup>
            </div>
        );
        
        const ticksPanel = (
            <div className="panel-container">
                <FormGroup label="Density">
                    <NumericInput
                        placeholder="Density"
                        min={0}
                        value={ticks.density}
                        onValueChange={(value: number) => ticks.setDensity(value)}
                    />
                </FormGroup>
                <FormGroup label="Color">
                    {this.colorSelect(true, ticks.color, ticks.setColor)}
                </FormGroup>
                <FormGroup label="Width (px)">
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
                <FormGroup label="Minor length (%)">
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
                <FormGroup label="Major length (%)">
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
                <Switch
                    checked={grid.visible}
                    label="Visible"
                    onChange={(ev) => grid.setVisible(ev.currentTarget.checked)}
                />
                <FormGroup label="Color" disabled={!grid.visible}>
                    {this.colorSelect(grid.visible, grid.color, grid.setColor)}
                </FormGroup>
                <FormGroup label="Width (px)" disabled={!grid.visible}>
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
                <FormGroup label="Gap">
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
                <Switch
                    checked={border.visible}
                    label="Visible"
                    onChange={(ev) => border.setVisible(ev.currentTarget.checked)}
                />
                <FormGroup label="Color" disabled={!border.visible}>
                    {this.colorSelect(border.visible, border.color, border.setColor)}
                </FormGroup>
                <FormGroup label="Width (px)" disabled={!border.visible}>
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
        
        const axesPanel = (
            <div className="panel-container">
                <Switch
                    checked={axes.visible}
                    label="Visible"
                    onChange={(ev) => axes.setVisible(ev.currentTarget.checked)}
                />
                <FormGroup label="Color" disabled={!axes.visible}>
                    {this.colorSelect(axes.visible, axes.color, axes.setColor)}
                </FormGroup>
                <FormGroup label="Width (px)" disabled={!axes.visible}>
                    <NumericInput
                        placeholder="Width"
                        min={0.001}
                        value={axes.width}
                        stepSize={0.5}
                        minorStepSize={0.1}
                        majorStepSize={1}
                        disabled={!axes.visible}
                        onValueChange={(value: number) => axes.setWidth(value)}
                    />
                </FormGroup>
            </div>
        );
        
        const numbersPanel = (
            <div className="panel-container">
                <Switch
                    checked={numbers.visible}
                    label="Visible"
                    onChange={(ev) => numbers.setVisible(ev.currentTarget.checked)}
                />
                <FormGroup label="Font" disabled={!numbers.visible}>
                    {this.fontSelect(numbers.visible, numbers.font, numbers.setFont)}
                    <NumericInput
                        min={7}
                        placeholder="Font size"
                        value={numbers.fontSize}
                        disabled={!numbers.visible}
                        onValueChange={(value: number) => numbers.setFontSize(value)}
                    />
                </FormGroup>
                <FormGroup label="Color" disabled={!numbers.visible}>
                    {this.colorSelect(numbers.visible, numbers.color, numbers.setColor)}
                </FormGroup>
                <FormGroup label="Axis 1 format" disabled={!numbers.axis[0].visible}>
                    <input
                        className="bp3-input"
                        type="text"
                        placeholder="Format"
                        value={numbers.axis[0].format}
                        disabled={!numbers.axis[0].visible}
                        onChange={(ev) => numbers.axis[0].setFormat(ev.currentTarget.value)}
                    />
                </FormGroup>
                <FormGroup label="Axis 2 format" disabled={!numbers.axis[1].visible}>
                    <input
                        className="bp3-input"
                        type="text"
                        placeholder="Format"
                        value={numbers.axis[1].format}
                        disabled={!numbers.axis[1].visible}
                        onChange={(ev) => numbers.axis[1].setFormat(ev.currentTarget.value)}
                    />
                </FormGroup>
            </div>
        );
        
        const labelsPanel = (
            <div className="panel-container">
                <Switch
                    checked={labels.visible}
                    label="Visible"
                    onChange={(ev) => labels.setVisible(ev.currentTarget.checked)}
                />
                <FormGroup label="Axis 1 text" disabled={!labels.axis[0].visible}>
                    <input
                        className="bp3-input"
                        type="text"
                        placeholder="Text"
                        value={labels.axis[0].text}
                        disabled={!labels.axis[0].visible}
                        onChange={(ev) => labels.axis[0].setText(ev.currentTarget.value)}
                    />
                </FormGroup>
                <FormGroup label="Axis 2 text" disabled={!labels.axis[1].visible}>
                    <input
                        className="bp3-input"
                        type="text"
                        placeholder="Text"
                        value={labels.axis[1].text}
                        disabled={!labels.axis[1].visible}
                        onChange={(ev) => labels.axis[1].setText(ev.currentTarget.value)}
                    />
                </FormGroup>
                <FormGroup label="Font" disabled={!labels.visible}>
                    {this.fontSelect(labels.visible, labels.font, labels.setFont)}
                    <NumericInput
                        min={7}
                        placeholder="Font size"
                        value={labels.fontSize}
                        disabled={!labels.visible}
                        onValueChange={(value: number) => labels.setFontSize(value)}
                    />
                </FormGroup>
                <FormGroup label="Gap" disabled={!labels.visible}>
                    <NumericInput
                        placeholder="Gap"
                        min={0}
                        stepSize={0.01}
                        minorStepSize={0.001}
                        majorStepSize={0.1}
                        value={labels.gap}
                        disabled={!labels.visible}
                        onValueChange={(value: number) => labels.setGap(value)}
                    />
                </FormGroup>
                <FormGroup label="Color" disabled={!labels.visible}>
                    {this.colorSelect(labels.visible, labels.color, labels.setColor)}
                </FormGroup>
            </div>
        );

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
