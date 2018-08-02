import * as React from "react";
import {AppStore} from "../../../stores/AppStore";
import {observer} from "mobx-react";
import "./OverlaySettingsDialogComponent.css";
import {Button, Checkbox, Dialog, Intent, Tab, Tabs, HTMLSelect, NumericInput, FormGroup} from "@blueprintjs/core";
import * as AST from "ast_wrapper";

@observer
export class OverlaySettingsDialogComponent extends React.Component<{ appStore: AppStore }> {

    public render() {
        const overlayStore = this.props.appStore.overlayStore;
        const title = overlayStore.title;
        const grid = overlayStore.grid;
        const border = overlayStore.border;
        const ticks = overlayStore.ticks;
        const axes = overlayStore.axes;
        
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
        
        const axesPanel = (
            <div className="panel-container">
                <Checkbox
                    checked={axes.visible}
                    label="Visible"
                    onChange={(ev) => axes.setVisible(ev.currentTarget.checked)}
                />
                <FormGroup label="Color" disabled={!axes.visible}>
                    <HTMLSelect
                        value={axes.color}
                        options={astColors}
                        disabled={!axes.visible}
                        onChange={(ev) => axes.setColor(Number(ev.currentTarget.value))}
                    />
                </FormGroup>
                <FormGroup label="Width" disabled={!axes.visible}>
                    <NumericInput
                        style={{width: "60px"}}
                        placeholder="Width"
                        min={0}
                        value={axes.width}
                        disabled={!axes.visible}
                        onValueChange={(value: number) => axes.setWidth(value)}
                    />
                </FormGroup>
                <FormGroup label="Gap" disabled={!axes.visible}>
                    <NumericInput
                        style={{width: "60px"}}
                        placeholder="Gap"
                        min={0}
                        stepSize={0.01}
                        minorStepSize={0.001}
                        majorStepSize={0.1}
                        value={axes.gap}
                        disabled={!axes.visible}
                        onValueChange={(value: number) => axes.setGap(value)}
                    />
                </FormGroup>
                <FormGroup label="Cursor format" disabled={!axes.visible}>
                    <input
                        className="bp3-input"
                        type="text"
                        placeholder="Format"
                        value={axes.cursorFormat}
                        disabled={!axes.visible}
                        onChange={(ev) => axes.setCursorFormat(ev.currentTarget.value)}
                    />
                </FormGroup>
            </div>
        );
        
        const axesNumbersPanel = (
            <div className="panel-container">
                <Checkbox
                    checked={axes.numberVisible}
                    label="Visible"
                    onChange={(ev) => axes.setNumberVisible(ev.currentTarget.checked)}
                />
                <FormGroup label="Font" disabled={!axes.numberVisible}>
                    <HTMLSelect
                        value={axes.numberFont}
                        options={astFonts}
                        disabled={!axes.numberVisible}
                        onChange={(ev) => axes.setNumberFont(Number(ev.currentTarget.value))}
                    />
                    <NumericInput
                        style={{width: "60px"}}
                        min={7}
                        placeholder="Font size"
                        value={axes.numberFontSize}
                        disabled={!axes.numberVisible}
                        onValueChange={(value: number) => axes.setNumberFontSize(value)}
                    />
                </FormGroup>
                <FormGroup label="Color" disabled={!axes.numberVisible}>
                    <HTMLSelect
                        value={axes.numberColor}
                        options={astColors}
                        disabled={!axes.numberVisible}
                        onChange={(ev) => axes.setNumberColor(Number(ev.currentTarget.value))}
                    />
                </FormGroup>
            </div>
        );
        
        const axesLabelsPanel = (
            <div className="panel-container">
                <Checkbox
                    checked={axes.labelVisible}
                    label="Visible"
                    onChange={(ev) => axes.setLabelVisible(ev.currentTarget.checked)}
                />
                <FormGroup label="Text" disabled={!axes.labelVisible}>
                    <input
                        className="bp3-input"
                        type="text"
                        placeholder="Text input"
                        value={axes.labelText}
                        disabled={!axes.labelVisible}
                        onChange={(ev) => axes.setLabelText(ev.currentTarget.value)}
                    />
                </FormGroup>
                <FormGroup label="Font" disabled={!axes.labelVisible}>
                    <HTMLSelect
                        value={axes.labelFont}
                        options={astFonts}
                        disabled={!axes.labelVisible}
                        onChange={(ev) => axes.setLabelFont(Number(ev.currentTarget.value))}
                    />
                    <NumericInput
                        style={{width: "60px"}}
                        min={7}
                        placeholder="Font size"
                        value={axes.labelFontSize}
                        disabled={!axes.labelVisible}
                        onValueChange={(value: number) => axes.setLabelFontSize(value)}
                    />
                </FormGroup>
                <FormGroup label="Gap" disabled={!axes.labelVisible}>
                    <NumericInput
                        style={{width: "60px"}}
                        placeholder="Gap"
                        min={0}
                        stepSize={0.01}
                        minorStepSize={0.001}
                        majorStepSize={0.1}
                        value={axes.labelGap}
                        disabled={!axes.labelVisible}
                        onValueChange={(value: number) => axes.setLabelGap(value)}
                    />
                </FormGroup>
                <FormGroup label="Color" disabled={!axes.labelVisible}>
                    <HTMLSelect
                        value={axes.labelColor}
                        options={astColors}
                        disabled={!axes.labelVisible}
                        onChange={(ev) => axes.setLabelColor(Number(ev.currentTarget.value))}
                    />
                </FormGroup>
                <FormGroup label="Format" disabled={!axes.labelVisible}>
                    <input
                        className="bp3-input"
                        type="text"
                        placeholder="Format"
                        value={axes.labelFormat}
                        disabled={!axes.labelVisible}
                        onChange={(ev) => axes.setLabelFormat(ev.currentTarget.value)}
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
                        <Tab id="axes" title="Axes" panel={axesPanel}/>
                        <Tab id="axesNumbers" title="Axes numbers" disabled={!axes.visible} panel={axesNumbersPanel}/>
                        <Tab id="axesLabels" title="Axes labels" disabled={!axes.visible} panel={axesLabelsPanel}/>
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
