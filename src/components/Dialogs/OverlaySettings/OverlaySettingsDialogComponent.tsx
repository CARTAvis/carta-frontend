import * as React from "react";
import {AppStore} from "../../../stores/AppStore";
import {observer} from "mobx-react";
import "./OverlaySettingsDialogComponent.css";
import {Button, Switch, Dialog, Intent, Tab, Tabs, HTMLSelect, NumericInput, FormGroup, MenuItem} from "@blueprintjs/core";
import {Select, ItemRenderer} from "@blueprintjs/select";
import * as AST from "ast_wrapper";

// OLD -- to be replaced by new dialogs
const astFonts = AST.fonts.map((x, i) => ({label: x.replace("{size} ", ""), value: i}));

// Color dialog
export class Color {
    name: string;
    id: number;
    
    constructor(name: string, id: number) {
        this.name = name;
        this.id = id;
    }
}

const astColors: Color[] = AST.colors.map((x, i) => ({name: x, id: i}));

const ColorSelect = Select.ofType<Color>();

export const renderColor: ItemRenderer<Color> = (color, { handleClick, modifiers, query }) => {
    return (
        <MenuItem
            active={modifiers.active}
            disabled={modifiers.disabled}
            label={String(color.id)}
            key={color.id}
            onClick={handleClick}
            text={(<div style={{background: color.name, border: "solid 1px black", width: "100px"}}>&nbsp;</div>)}
        />
    );
};


@observer
export class OverlaySettingsDialogComponent extends React.Component<{ appStore: AppStore }> {

    private colorSelect(visible: boolean, currentColorId: number, colorSetter: Function) {
        var currentColor: Color = astColors[currentColorId];
        if (typeof currentColor === 'undefined') {
            currentColor = astColors[0];
        }
        
        return (
            <ColorSelect
                activeItem={currentColor}
                itemRenderer={renderColor}
                items={astColors}
                disabled={!visible}
                onItemSelect={(color) => colorSetter(color.id)}
            >
                <Button text={(<div style={{background: currentColor.name, border: "solid 1px black", width: "100px"}}>&nbsp;</div>)} disabled={!visible} rightIcon="double-caret-vertical" />
            </ColorSelect>
        )
    }
    
    private axisTabGroup(id: number) {
        const overlayStore = this.props.appStore.overlayStore;
        
        var tabId;
        var tabTitle;
        var axis;
        var perAxisComponent;
        
        if (id === 0) {
            tabId = "axes";
            tabTitle = "Axes";
            axis = overlayStore.axes;
        } else {
            tabId = `axis${id}`;
            tabTitle = `Axis ${id}`;
            axis = overlayStore.axis[id - 1];
        }
        
        const tabGroupSelected = (
            overlayStore.overlaySettingsActiveTab === tabId || 
            overlayStore.overlaySettingsActiveTab === `${tabId}Numbers` ||
            overlayStore.overlaySettingsActiveTab === `${tabId}Labels`
        );
                
        const axisPanel = (
            <div className="panel-container">
                <Switch
                    checked={axis.visible}
                    label="Visible"
                    onChange={(ev) => axis.setVisible(ev.currentTarget.checked)}
                />
                <FormGroup label="Color" disabled={!axis.visible}>
                    {this.colorSelect(axis.visible, axis.color, axis.setColor)}
                </FormGroup>
                <FormGroup label="Width" disabled={!axis.visible}>
                    <NumericInput
                        style={{width: "60px"}}
                        placeholder="Width"
                        min={0}
                        value={axis.width}
                        disabled={!axis.visible}
                        onValueChange={(value: number) => axis.setWidth(value)}
                    />
                </FormGroup>
                <FormGroup label="Gap" disabled={!axis.visible}>
                    <NumericInput
                        style={{width: "60px"}}
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
                { id === 0 ?
                    [<Switch
                        key="axis1custom"
                        checked={overlayStore.axis[0].customConfig}
                        label="Use custom configuration for axis 1"
                        onChange={(ev) => overlayStore.axis[0].setCustomConfig(ev.currentTarget.checked)}
                    />,
                    <Switch
                        key="axis2custom"
                        checked={overlayStore.axis[1].customConfig}
                        label="Use custom configuration for axis 2"
                        onChange={(ev) => overlayStore.axis[1].setCustomConfig(ev.currentTarget.checked)}
                    />]
                :
                    <Button onClick={(ev) => { axis.setCustomConfig(false); overlayStore.setOverlaySettingsActiveTab("axes"); }} text="Use default axis settings"/>
                }
            </div>
        );
        
        const axisNumbersPanel = (
            <div className="panel-container">
                <Switch
                    checked={axis.numberVisible}
                    label="Visible"
                    onChange={(ev) => axis.setNumberVisible(ev.currentTarget.checked)}
                />
                <FormGroup label="Font" disabled={!axis.numberVisible}>
                    <HTMLSelect
                        value={axis.numberFont}
                        options={astFonts}
                        disabled={!axis.numberVisible}
                        onChange={(ev) => axis.setNumberFont(Number(ev.currentTarget.value))}
                    />
                    <NumericInput
                        style={{width: "60px"}}
                        min={7}
                        placeholder="Font size"
                        value={axis.numberFontSize}
                        disabled={!axis.numberVisible}
                        onValueChange={(value: number) => axis.setNumberFontSize(value)}
                    />
                </FormGroup>
                <FormGroup label="Color" disabled={!axis.numberVisible}>
                    {this.colorSelect(axis.numberVisible, axis.numberColor, axis.setNumberColor)}
                </FormGroup>
                <FormGroup label="Format" disabled={!axis.numberVisible}>
                    <input
                        className="bp3-input"
                        type="text"
                        placeholder="Format"
                        value={axis.numberFormat}
                        disabled={!axis.numberVisible}
                        onChange={(ev) => axis.setNumberFormat(ev.currentTarget.value)}
                    />
                </FormGroup>
            </div>
        );
        
        const axisLabelsPanel = (
            <div className="panel-container">
                <Switch
                    checked={axis.labelVisible}
                    label="Visible"
                    onChange={(ev) => axis.setLabelVisible(ev.currentTarget.checked)}
                />
                <FormGroup label="Text" disabled={!axis.labelVisible}>
                    <input
                        className="bp3-input"
                        type="text"
                        placeholder="Text input"
                        value={axis.labelText}
                        disabled={!axis.labelVisible}
                        onChange={(ev) => axis.setLabelText(ev.currentTarget.value)}
                    />
                </FormGroup>
                <FormGroup label="Font" disabled={!axis.labelVisible}>
                    <HTMLSelect
                        value={axis.labelFont}
                        options={astFonts}
                        disabled={!axis.labelVisible}
                        onChange={(ev) => axis.setLabelFont(Number(ev.currentTarget.value))}
                    />
                    <NumericInput
                        style={{width: "60px"}}
                        min={7}
                        placeholder="Font size"
                        value={axis.labelFontSize}
                        disabled={!axis.labelVisible}
                        onValueChange={(value: number) => axis.setLabelFontSize(value)}
                    />
                </FormGroup>
                <FormGroup label="Gap" disabled={!axis.labelVisible}>
                    <NumericInput
                        style={{width: "60px"}}
                        placeholder="Gap"
                        min={0}
                        stepSize={0.01}
                        minorStepSize={0.001}
                        majorStepSize={0.1}
                        value={axis.labelGap}
                        disabled={!axis.labelVisible}
                        onValueChange={(value: number) => axis.setLabelGap(value)}
                    />
                </FormGroup>
                <FormGroup label="Color" disabled={!axis.labelVisible}>
                    {this.colorSelect(axis.labelVisible, axis.labelColor, axis.setLabelColor)}
                </FormGroup>
            </div>
        );
        
        var axisTabs = [
            <Tab key={tabId} id={tabId} title={tabTitle} panel={axisPanel}/>
        ];
        
        if (tabGroupSelected) {
            axisTabs.push(<Tab key={`${tabId}Numbers`} id={`${tabId}Numbers`} title="&#8227; Numbers" disabled={!axis.visible} panel={axisNumbersPanel}/>);
            axisTabs.push(<Tab key={`${tabId}Labels`} id={`${tabId}Labels`} title="&#8227; Labels" disabled={!axis.visible} panel={axisLabelsPanel}/>);
        }
    
        return axisTabs;
    }

    public render() {
        const overlayStore = this.props.appStore.overlayStore;
        const title = overlayStore.title;
        const grid = overlayStore.grid;
        const border = overlayStore.border;
        const ticks = overlayStore.ticks;
        const axes = overlayStore.axes;
        const axis = overlayStore.axis;
        
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
                    <HTMLSelect
                        value={title.font}
                        options={astFonts}
                        disabled={!title.visible}
                        onChange={(ev) => title.setFont(Number(ev.currentTarget.value))}
                    />
                    <NumericInput
                        style={{width: "60px"}}
                        min={7}
                        placeholder="Font size"
                        value={title.fontSize}
                        disabled={!title.visible}
                        onValueChange={(value: number) => title.setFontSize(value)}
                    />
                </FormGroup>
                <FormGroup label="Gap" disabled={!title.visible}>
                    <NumericInput
                        style={{width: "60px"}}
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
                        style={{width: "60px"}}
                        placeholder="Density"
                        min={0}
                        value={ticks.density}
                        onValueChange={(value: number) => ticks.setDensity(value)}
                    />
                </FormGroup>
                <FormGroup label="Color">
                    {this.colorSelect(true, ticks.color, ticks.setColor)}
                </FormGroup>
                <FormGroup label="Width">
                    <NumericInput
                        style={{width: "60px"}}
                        placeholder="Width"
                        min={0}
                        value={ticks.width}
                        onValueChange={(value: number) => ticks.setWidth(value)}
                    />
                </FormGroup>
                <FormGroup label="Length">
                    <NumericInput
                        style={{width: "60px"}}
                        placeholder="Length"
                        min={0}
                        value={ticks.length}
                        onValueChange={(value: number) => ticks.setLength(value)}
                    />
                </FormGroup>
                <FormGroup label="Major length">
                    <NumericInput
                        style={{width: "60px"}}
                        placeholder="Major length"
                        min={0}
                        value={ticks.majorLength}
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
                <FormGroup label="Width" disabled={!grid.visible}>
                    <NumericInput
                        style={{width: "60px"}}
                        placeholder="Width"
                        min={0}
                        value={grid.width}
                        disabled={!grid.visible}
                        onValueChange={(value: number) => grid.setWidth(value)}
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
                <FormGroup label="Width" disabled={!border.visible}>
                    <NumericInput
                        style={{width: "60px"}}
                        placeholder="Width"
                        min={0}
                        value={border.width}
                        disabled={!border.visible}
                        onValueChange={(value: number) => border.setWidth(value)}
                    />
                </FormGroup>
            </div>
        );

        return (
            <Dialog
                icon={"settings"}                        
                lazy={true}
                backdropClassName="minimal-dialog-backdrop"
                isOpen={overlayStore.overlaySettingsDialogVisible} 
                onClose={overlayStore.hideOverlaySettings}
                title="Overlay Settings"
            >
                <div className="bp3-dialog-body">
                    <Tabs
                        id="overlayTabs"
                        vertical={true}
                        selectedTabId={overlayStore.overlaySettingsActiveTab}
                        onChange={(tabId) => overlayStore.setOverlaySettingsActiveTab(String(tabId))}
                    >
                        <Tab id="title" title="Title" panel={titlePanel}/>
                        <Tab id="ticks" title="Ticks" panel={ticksPanel}/>
                        <Tab id="grid" title="Grid" panel={gridPanel}/>
                        <Tab id="border" title="Border" panel={borderPanel}/>
                        {this.axisTabGroup(0)}
                        {overlayStore.axis[0].customConfig && this.axisTabGroup(1)}
                        {overlayStore.axis[1].customConfig && this.axisTabGroup(2)}
                    </Tabs>
                </div>
                <div className="bp3-dialog-footer">
                    <div className="bp3-dialog-footer-actions">
                        <Button intent={Intent.PRIMARY} onClick={overlayStore.hideOverlaySettings} text="Close"/>
                    </div>
                </div>
            </Dialog>
        );
    }
}
