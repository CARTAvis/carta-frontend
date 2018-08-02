import * as React from "react";
import {AppStore} from "../../../stores/AppStore";
import {observer} from "mobx-react";
import "./OverlaySettingsDialogComponent.css";
import {Button, Checkbox, Dialog, Intent, Tab, Tabs, HTMLSelect, NumericInput, FormGroup} from "@blueprintjs/core";
import * as AST from "ast_wrapper";

@observer
export class OverlaySettingsDialogComponent extends React.Component<{ appStore: AppStore }> {
    
    private axisTabGroup(id: number) {
        const overlayStore = this.props.appStore.overlayStore;
        
        // TODO: eliminate duplication by making these properties
        const astFonts = AST.fonts.map((x, i) => ({label: x.replace("{size} ", ""), value: i}));
        const astColors = AST.colors.map((x, i) => ({label: x, value: i}));
        
        var tabId;
        var tabTitle;
        var axis;
        
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
                <Checkbox
                    checked={axis.visible}
                    label="Visible"
                    onChange={(ev) => axis.setVisible(ev.currentTarget.checked)}
                />
                <FormGroup label="Color" disabled={!axis.visible}>
                    <HTMLSelect
                        value={axis.color}
                        options={astColors}
                        disabled={!axis.visible}
                        onChange={(ev) => axis.setColor(Number(ev.currentTarget.value))}
                    />
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
                <FormGroup label="Cursor format" disabled={!axis.visible}>
                    <input
                        className="bp3-input"
                        type="text"
                        placeholder="Format"
                        value={axis.cursorFormat}
                        disabled={!axis.visible}
                        onChange={(ev) => axis.setCursorFormat(ev.currentTarget.value)}
                    />
                </FormGroup>
            </div>
        );
        
        const axisNumbersPanel = (
            <div className="panel-container">
                <Checkbox
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
                    <HTMLSelect
                        value={axis.numberColor}
                        options={astColors}
                        disabled={!axis.numberVisible}
                        onChange={(ev) => axis.setNumberColor(Number(ev.currentTarget.value))}
                    />
                </FormGroup>
            </div>
        );
        
        const axisLabelsPanel = (
            <div className="panel-container">
                <Checkbox
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
                    <HTMLSelect
                        value={axis.labelColor}
                        options={astColors}
                        disabled={!axis.labelVisible}
                        onChange={(ev) => axis.setLabelColor(Number(ev.currentTarget.value))}
                    />
                </FormGroup>
                <FormGroup label="Format" disabled={!axis.labelVisible}>
                    <input
                        className="bp3-input"
                        type="text"
                        placeholder="Format"
                        value={axis.labelFormat}
                        disabled={!axis.labelVisible}
                        onChange={(ev) => axis.setLabelFormat(ev.currentTarget.value)}
                    />
                </FormGroup>
            </div>
        );
        
        var axisTabs = [
            <Tab id={tabId} title={tabTitle} panel={axisPanel}/>
        ];
        
        if (tabGroupSelected) {
            axisTabs.push(<Tab id={`${tabId}Numbers`} title="&#8227; Numbers" disabled={!axis.visible} panel={axisNumbersPanel}/>);
            axisTabs.push(<Tab id={`${tabId}Labels`} title="&#8227; Labels" disabled={!axis.visible} panel={axisLabelsPanel}/>);
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
        
        const astFonts = AST.fonts.map((x, i) => ({label: x.replace("{size} ", ""), value: i}));
        const astColors = AST.colors.map((x, i) => ({label: x, value: i}));
        
        const titlePanel = (
            <div className="panel-container">
                <Checkbox 
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
                    <HTMLSelect
                        value={title.color}
                        options={astColors}
                        disabled={!title.visible}
                        onChange={(ev) => title.setColor(Number(ev.currentTarget.value))}
                    />
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
                    <HTMLSelect
                        value={ticks.color}
                        options={astColors}
                        onChange={(ev) => ticks.setColor(Number(ev.currentTarget.value))}
                    />
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
                <Checkbox
                    checked={grid.visible}
                    label="Visible"
                    onChange={(ev) => grid.setVisible(ev.currentTarget.checked)}
                />
                <FormGroup label="Color" disabled={!grid.visible}>
                    <HTMLSelect
                        value={grid.color}
                        options={astColors}
                        disabled={!grid.visible}
                        onChange={(ev) => grid.setColor(Number(ev.currentTarget.value))}
                    />
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
                <Checkbox
                    checked={border.visible}
                    label="Visible"
                    onChange={(ev) => border.setVisible(ev.currentTarget.checked)}
                />
                <FormGroup label="Color" disabled={!border.visible}>
                    <HTMLSelect
                        value={border.color}
                        options={astColors}
                        disabled={!border.visible}
                        onChange={(ev) => border.setColor(Number(ev.currentTarget.value))}
                    />
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
                onClose={overlayStore.hideOverlaySettings} title="Overlay Settings"
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
                        {overlayStore.axis.map((x, i) => (this.axisTabGroup(i + 1)))}
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
