import * as React from "react";
import * as AST from "ast_wrapper";
import tinycolor from "tinycolor2";
import {observer} from "mobx-react";
import {action, makeObservable, observable} from "mobx";
import {Select, ItemRenderer} from "@blueprintjs/select";
import {
    Button, Collapse, FormGroup, HTMLSelect,
    InputGroup, MenuItem,
    Switch, Tab, Tabs, TabId
} from "@blueprintjs/core";
import {ColorComponent} from "./ColorComponent";
import {ColorResult} from "react-color";
import {ColorPickerComponent, SafeNumericInput} from "components/Shared";
import {AppStore, BeamType, LabelType, SystemType, HelpType, NumberFormatType, NUMBER_FORMAT_LABEL, DefaultWidgetConfig, WidgetProps} from "stores";
import { SWATCH_COLORS} from "utilities";
import "./ImageViewSettingsPanelComponent.scss";

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

export const renderFont: ItemRenderer<Font> = (font, {handleClick, modifiers, query}) => {
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
export class ImageViewSettingsPanelComponent extends React.Component<WidgetProps> {
    @observable selectedTab: TabId = "global";

    @action private setSelectedTab = (tab: TabId) => {
        this.selectedTab = tab;
    };

    constructor(props: any) {
        super(props);
        makeObservable(this);
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
                popoverProps={{minimal: true, placement: "bottom", popoverClassName: "fontselect"}}
                onItemSelect={(font) => fontSetter(font.id)}
            >
                <Button text={(<span style={{fontFamily: currentFont.family, fontWeight: currentFont.weight, fontStyle: currentFont.style}}>{currentFont.name}</span>)} disabled={!visible} rightIcon="double-caret-vertical"/>
            </FontSelect>
        );
    }

    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "image-view-floating-settings",
            type: "floating-settings",
            minWidth: 280,
            minHeight: 225,
            defaultWidth: 600,
            defaultHeight: 420,
            title: "image-view-settings",
            isCloseable: true,
            parentId: "image-view",
            parentType: "image-view",
            helpType: HelpType.IMAGE_VIEW_SETTINGS
        };
    }

    public render() {
        const appStore = AppStore.Instance;
        const overlayStore = appStore.overlayStore;
        const global = overlayStore.global;
        const title = overlayStore.title;
        const grid = overlayStore.grid;
        const border = overlayStore.border;
        const ticks = overlayStore.ticks;
        const axes = overlayStore.axes;
        const numbers = overlayStore.numbers;
        const labels = overlayStore.labels;
        const colorbar = overlayStore.colorbar;
        const beam = overlayStore.beam;
        const beamSettings = beam.settingsForDisplay;

        const interior: boolean = (global.labelType === LabelType.Interior);

        const disabledIfInterior = (interior && "Does not apply to interior labelling.");
        const disabledIfExterior = (!interior && "Does not apply to exterior labelling.");
        const disabledIfNoWcs = (!global.validWcs && "This image has no valid WCS data.");

        const globalPanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Color">
                    <ColorComponent selectedItem={global.color} onItemSelect={global.setColor}/>
                </FormGroup>
                <FormGroup inline={true} label="Tolerance" labelInfo="(%)">
                    <SafeNumericInput
                        placeholder="Tolerance"
                        min={0.1}
                        value={global.tolerance}
                        stepSize={0.1}
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
                <FormGroup
                    inline={true}
                    label="Coordinate system"
                    disabled={!global.validWcs}
                    helperText={disabledIfNoWcs}
                >
                    <HTMLSelect
                        options={Object.keys(SystemType).map((key) => ({label: key, value: SystemType[key]}))}
                        value={global.system}
                        disabled={!global.validWcs}
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
                <FormGroup inline={true} className="font-group" label="Font" disabled={!title.visible}>
                    {this.fontSelect(title.visible, title.font, title.setFont)}
                    <SafeNumericInput
                        min={7}
                        placeholder="Font size"
                        value={title.fontSize}
                        disabled={!title.visible}
                        onValueChange={(value: number) => title.setFontSize(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Custom text" disabled={!title.visible}>
                    <Switch
                        checked={title.customText}
                        disabled={!title.visible}
                        onChange={(ev) => title.setCustomText(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <Collapse isOpen={title.customText}>
                    <FormGroup inline={true} label="Title Text" disabled={!title.visible}>
                        <InputGroup disabled={!title.visible} value={title.customTitleString} placeholder="Enter title text" onChange={ev => title.setCustomTitleString(ev.currentTarget.value)}/>
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Custom color" disabled={!title.visible}>
                    <Switch
                        checked={title.customColor}
                        disabled={!title.visible}
                        onChange={(ev) => title.setCustomColor(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <Collapse isOpen={title.customColor}>
                    <FormGroup inline={true} label="Color" disabled={!title.visible}>
                        {title.visible && <ColorComponent selectedItem={title.color} onItemSelect={title.setColor}/>}
                    </FormGroup>
                </Collapse>
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
                <FormGroup inline={true} label="Custom density">
                    <Switch
                        checked={ticks.customDensity}
                        onChange={(ev) => ticks.setCustomDensity(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <Collapse isOpen={ticks.customDensity}>
                    <FormGroup inline={true} label="Density" labelInfo="(X)">
                        <SafeNumericInput
                            placeholder="Density"
                            min={0}
                            value={ticks.densityX}
                            onValueChange={(value: number) => ticks.setDensityX(value)}
                        />
                    </FormGroup>
                    <FormGroup inline={true} label="Density" labelInfo="(Y)">
                        <SafeNumericInput
                            placeholder="Density"
                            min={0}
                            value={ticks.densityY}
                            onValueChange={(value: number) => ticks.setDensityY(value)}
                        />
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Custom color">
                    <Switch
                        checked={ticks.customColor}
                        onChange={(ev) => ticks.setCustomColor(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <Collapse isOpen={ticks.customColor}>
                    <FormGroup inline={true} label="Color">
                        <ColorComponent selectedItem={ticks.color} onItemSelect={ticks.setColor}/>
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Width" labelInfo="(px)">
                    <SafeNumericInput
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
                    <SafeNumericInput
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
                    <SafeNumericInput
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
                <FormGroup inline={true} label="Custom color" disabled={!grid.visible}>
                    <Switch
                        checked={grid.customColor}
                        disabled={!grid.visible}
                        onChange={(ev) => grid.setCustomColor(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <Collapse isOpen={grid.customColor}>
                    <FormGroup inline={true} label="Color" disabled={!grid.visible}>
                        {grid.visible && <ColorComponent selectedItem={grid.color} onItemSelect={grid.setColor}/>}
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Width" labelInfo="(px)" disabled={!grid.visible}>
                    <SafeNumericInput
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
                <FormGroup inline={true} label="Custom gap" disabled={!grid.visible}>
                    <Switch
                        checked={grid.customGap}
                        disabled={!grid.visible}
                        onChange={(ev) => grid.setCustomGap(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <Collapse isOpen={grid.customGap}>
                    <FormGroup inline={true} label="Gap" labelInfo="(X)" disabled={!grid.visible}>
                        <SafeNumericInput
                            placeholder="Gap"
                            min={0.001}
                            stepSize={0.01}
                            minorStepSize={0.001}
                            majorStepSize={0.1}
                            value={grid.gapX}
                            disabled={!grid.visible}
                            onValueChange={(value: number) => grid.setGapX(value)}
                        />
                    </FormGroup>
                    <FormGroup inline={true} label="Gap" labelInfo="(Y)" disabled={!grid.visible}>
                        <SafeNumericInput
                            placeholder="Gap"
                            min={0.001}
                            stepSize={0.01}
                            minorStepSize={0.001}
                            majorStepSize={0.1}
                            value={grid.gapY}
                            disabled={!grid.visible}
                            onValueChange={(value: number) => grid.setGapY(value)}
                        />
                    </FormGroup>
                </Collapse>
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
                <FormGroup inline={true} label="Custom color" disabled={!border.visible}>
                    <Switch
                        checked={border.customColor}
                        disabled={!border.visible}
                        onChange={(ev) => border.setCustomColor(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <Collapse isOpen={border.customColor}>
                    <FormGroup inline={true} label="Color" disabled={!border.visible}>
                        {border.visible && <ColorComponent selectedItem={border.color} onItemSelect={border.setColor}/>}
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Width" labelInfo="(px)" disabled={!border.visible}>
                    <SafeNumericInput
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
                <FormGroup
                    inline={true}
                    label="Visible"
                    disabled={!interior}
                    helperText={disabledIfExterior}
                >
                    <Switch
                        checked={axes.visible}
                        disabled={!interior}
                        onChange={(ev) => axes.setVisible(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Custom color" disabled={!interior || !axes.visible}>
                    <Switch
                        checked={axes.customColor}
                        disabled={!interior || !axes.visible}
                        onChange={(ev) => axes.setCustomColor(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <Collapse isOpen={axes.customColor}>
                    <FormGroup
                        inline={true}
                        label="Color"
                        disabled={!interior || !axes.visible}
                        helperText={disabledIfExterior}
                    >
                        {interior && axes.visible && <ColorComponent selectedItem={axes.color} onItemSelect={axes.setColor}/>}
                    </FormGroup>
                </Collapse>
                <FormGroup
                    inline={true}
                    label="Width"
                    labelInfo="(px)"
                    disabled={!interior || !axes.visible}
                    helperText={disabledIfExterior}
                >
                    <SafeNumericInput
                        placeholder="Width"
                        min={0.001}
                        value={axes.width}
                        stepSize={0.5}
                        minorStepSize={0.1}
                        majorStepSize={1}
                        disabled={!interior || !axes.visible}
                        onValueChange={(value: number) => axes.setWidth(value)}
                    />
                </FormGroup>
            </div>
        );

        const numbersPanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Visible">
                    <Switch
                        checked={numbers.visible}
                        onChange={(ev) => numbers.setVisible(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <FormGroup inline={true} className="font-group" label="Font" disabled={!numbers.visible}>
                    {this.fontSelect(numbers.visible, numbers.font, numbers.setFont)}
                    <SafeNumericInput
                        min={7}
                        placeholder="Font size"
                        value={numbers.fontSize}
                        disabled={!numbers.visible}
                        onValueChange={(value: number) => numbers.setFontSize(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Custom color" disabled={!numbers.visible}>
                    <Switch
                        checked={numbers.customColor}
                        disabled={!numbers.visible}
                        onChange={(ev) => numbers.setCustomColor(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <Collapse isOpen={numbers.customColor}>
                    <FormGroup inline={true} label="Color" disabled={!numbers.visible}>
                        {numbers.visible && <ColorComponent selectedItem={numbers.color} onItemSelect={numbers.setColor}/>}
                    </FormGroup>
                </Collapse>
                <FormGroup
                    inline={true}
                    label="Custom format"
                    disabled={!numbers.validWcs}
                    helperText={disabledIfNoWcs}
                >
                    <Switch
                        checked={numbers.customFormat}
                        disabled={!numbers.validWcs}
                        onChange={(ev) => numbers.setCustomFormat(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <Collapse isOpen={numbers.customFormat && numbers.validWcs}>
                    <FormGroup inline={true} label="Format" labelInfo="(X)">
                        <HTMLSelect
                            options={[
                                {label: NUMBER_FORMAT_LABEL.get(NumberFormatType.HMS), value: NumberFormatType.HMS},
                                {label: NUMBER_FORMAT_LABEL.get(NumberFormatType.DMS), value: NumberFormatType.DMS},
                                {label: NUMBER_FORMAT_LABEL.get(NumberFormatType.Degrees), value: NumberFormatType.Degrees}
                            ]}
                            value={numbers.formatX}
                            onChange={(event: React.FormEvent<HTMLSelectElement>) => numbers.setFormatX(event.currentTarget.value as NumberFormatType)}
                        />
                    </FormGroup>
                    <FormGroup inline={true} label="Format" labelInfo="(Y)">
                        <HTMLSelect
                            options={[
                                {label: NUMBER_FORMAT_LABEL.get(NumberFormatType.HMS), value: NumberFormatType.HMS},
                                {label: NUMBER_FORMAT_LABEL.get(NumberFormatType.DMS), value: NumberFormatType.DMS},
                                {label: NUMBER_FORMAT_LABEL.get(NumberFormatType.Degrees), value: NumberFormatType.Degrees}
                            ]}
                            value={numbers.formatY}
                            onChange={(event: React.FormEvent<HTMLSelectElement>) => numbers.setFormatY(event.currentTarget.value as NumberFormatType)}
                        />
                    </FormGroup>
                </Collapse>
                <FormGroup
                    inline={true}
                    label="Custom precision"
                    disabled={!numbers.validWcs}
                    helperText={disabledIfNoWcs}
                >
                    <Switch
                        checked={numbers.customPrecision}
                        disabled={!numbers.validWcs}
                        onChange={(ev) => numbers.setCustomPrecision(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <Collapse isOpen={numbers.customPrecision && numbers.validWcs}>
                    <FormGroup inline={true} label="Precision">
                        <SafeNumericInput
                            placeholder="Precision"
                            min={0}
                            value={numbers.precision}
                            onValueChange={(value: number) => numbers.setPrecision(value)}
                        />
                    </FormGroup>
                </Collapse>
            </div>
        );

        const labelsPanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Visible">
                    <Switch
                        checked={labels.visible}
                        onChange={(ev) => labels.setVisible(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <FormGroup inline={true} className="font-group" label="Font" disabled={!labels.visible}>
                    {this.fontSelect(labels.visible, labels.font, labels.setFont)}
                    <SafeNumericInput
                        min={7}
                        placeholder="Font size"
                        value={labels.fontSize}
                        disabled={!labels.visible}
                        onValueChange={(value: number) => labels.setFontSize(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Custom text" disabled={!labels.visible}>
                    <Switch
                        checked={labels.customText}
                        disabled={!labels.visible}
                        onChange={(ev) => labels.setCustomText(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <Collapse isOpen={labels.customText}>
                    <FormGroup inline={true} label="Label Text (X)" disabled={!labels.visible}>
                        <InputGroup disabled={!labels.visible} value={labels.customLabelX} placeholder="Enter label text" onChange={ev => labels.setCustomLabelX(ev.currentTarget.value)}/>
                    </FormGroup>
                    <FormGroup inline={true} label="Label Text (Y)" disabled={!labels.visible}>
                        <InputGroup disabled={!labels.visible} value={labels.customLabelY} placeholder="Enter label text" onChange={ev => labels.setCustomLabelY(ev.currentTarget.value)}/>
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Custom color" disabled={!labels.visible}>
                    <Switch
                        checked={labels.customColor}
                        disabled={!labels.visible}
                        onChange={(ev) => labels.setCustomColor(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <Collapse isOpen={labels.customColor}>
                    <FormGroup inline={true} label="Color" disabled={!labels.visible}>
                        {labels.visible && <ColorComponent selectedItem={labels.color} onItemSelect={labels.setColor}/>}
                    </FormGroup>
                </Collapse>
            </div>
        );

        const colorbarPanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Visible">
                    <Switch
                        checked={colorbar.visible}
                        onChange={(ev) => colorbar.setVisible(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Cursor Info" disabled={!colorbar.visible}>
                    <Switch
                        checked={colorbar.showHoverInfo}
                        onChange={(ev) => colorbar.setShowHoverInfo(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Width" labelInfo="(px)" disabled={!colorbar.visible}>
                    <SafeNumericInput
                        placeholder="Width"
                        min={1}
                        max={overlayStore.viewWidth * 0.3}
                        value={colorbar.width}
                        stepSize={1}
                        minorStepSize={1}
                        majorStepSize={2}
                        disabled={!colorbar.visible}
                        onValueChange={(value: number) => colorbar.setWidth(value)}
                        intOnly={true}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Offset" labelInfo="(px)" disabled={!colorbar.visible}>
                    <SafeNumericInput
                        placeholder="Offset"
                        min={0}
                        max={overlayStore.viewWidth * 0.3}
                        value={colorbar.offset}
                        stepSize={1}
                        minorStepSize={1}
                        majorStepSize={5}
                        disabled={!colorbar.visible}
                        onValueChange={(value: number) => colorbar.setOffset(value)}
                        intOnly={true}
                    />
                </FormGroup>
                <hr></hr>
                <FormGroup inline={true} label="Border" disabled={!colorbar.visible}>
                    <Switch
                        checked={colorbar.borderVisible}
                        disabled={!colorbar.visible}
                        onChange={(ev) => colorbar.setBorderVisible(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Border Width" labelInfo="(px)" disabled={!colorbar.visible || !colorbar.borderVisible}>
                    <SafeNumericInput
                        placeholder="Border Width"
                        min={0.5}
                        value={colorbar.borderWidth}
                        stepSize={0.5}
                        minorStepSize={0.1}
                        majorStepSize={1}
                        disabled={!colorbar.visible || !colorbar.borderVisible}
                        onValueChange={(value: number) => colorbar.setBorderWidth(value)}
                    />
                </FormGroup>
                <hr></hr>
                <FormGroup inline={true} label="Ticks" disabled={!colorbar.visible}>
                    <Switch
                        checked={colorbar.tickVisible}
                        disabled={!colorbar.visible}
                        onChange={(ev) => colorbar.setTickVisible(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Ticks Density" labelInfo="(per 100px)" disabled={!colorbar.visible || !colorbar.tickVisible}>
                    <SafeNumericInput
                        placeholder="Ticks Density"
                        min={0.2}
                        max={20}
                        value={colorbar.tickDensity}
                        stepSize={0.2}
                        minorStepSize={0.1}
                        majorStepSize={1}
                        disabled={!colorbar.visible || !colorbar.tickVisible}
                        onValueChange={(value: number) => colorbar.setTickDensity(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Ticks Len" labelInfo="(px)" disabled={!colorbar.visible || !colorbar.tickVisible}>
                    <SafeNumericInput
                        placeholder="Ticks Len"
                        min={0.5}
                        value={colorbar.tickLen}
                        stepSize={0.5}
                        minorStepSize={0.1}
                        majorStepSize={1}
                        disabled={!colorbar.visible || !colorbar.tickVisible}
                        onValueChange={(value: number) => colorbar.setTickLen(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Ticks Width" labelInfo="(px)" disabled={!colorbar.visible || !colorbar.tickVisible}>
                    <SafeNumericInput
                        placeholder="Ticks Width"
                        min={0.5}
                        value={colorbar.tickWidth}
                        stepSize={0.5}
                        minorStepSize={0.1}
                        majorStepSize={1}
                        disabled={!colorbar.visible || !colorbar.tickVisible}
                        onValueChange={(value: number) => colorbar.setTickWidth(value)}
                    />
                </FormGroup>
                <hr></hr>
                <FormGroup inline={true} label="Numbers" disabled={!colorbar.visible}>
                    <Switch
                        checked={colorbar.numberVisible}
                        disabled={!colorbar.visible}
                        onChange={(ev) => colorbar.setNumberVisible(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <FormGroup inline={true} className="font-group" label="Numbers Font" disabled={!colorbar.visible || !colorbar.numberVisible}>
                    {this.fontSelect((colorbar.visible && colorbar.numberVisible), colorbar.numberFont, colorbar.setNumberFont)}
                    <SafeNumericInput
                        min={7}
                        value={colorbar.numberFontSize}
                        disabled={!colorbar.visible || !colorbar.numberVisible}
                        onValueChange={(value: number) => colorbar.setNumberFontSize(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Numbers Rotated" disabled={!colorbar.visible || !colorbar.numberVisible}>
                    <Switch
                        checked={colorbar.numberRotated}
                        disabled={!colorbar.visible || !colorbar.numberVisible}
                        onChange={(ev) => colorbar.setNumberRotated(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Numbers Custom Precision" disabled={!colorbar.visible || !colorbar.numberVisible}>
                    <Switch
                        checked={colorbar.numberCustomPrecision}
                        disabled={!colorbar.visible || !colorbar.numberVisible}
                        onChange={(ev) => colorbar.setNumberCustomPrecision(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <Collapse isOpen={colorbar.numberCustomPrecision}>
                    <FormGroup inline={true} label="Precision" disabled={!colorbar.visible || !colorbar.numberVisible}>
                        <SafeNumericInput
                            min={0}
                            stepSize={1}
                            value={colorbar.numberPrecision}
                            disabled={!colorbar.visible || !colorbar.numberVisible}
                            onValueChange={(value: number) => colorbar.setNumberPrecision(value)}
                            intOnly={true}
                        />
                    </FormGroup>
                </Collapse>
                <hr></hr>
                <FormGroup inline={true} label="Label" disabled={!colorbar.visible}>
                    <Switch
                        checked={colorbar.labelVisible}
                        disabled={!colorbar.visible}
                        onChange={(ev) => colorbar.setLabelVisible(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <FormGroup inline={true} className="font-group" label="Label Font" disabled={!colorbar.visible || !colorbar.labelVisible}>
                    {this.fontSelect((colorbar.visible && colorbar.labelVisible), colorbar.labelFont, colorbar.setLabelFont)}
                    <SafeNumericInput
                        min={7}
                        value={colorbar.labelFontSize}
                        disabled={!colorbar.visible || !colorbar.labelVisible}
                        onValueChange={(value: number) => colorbar.setLabelFontSize(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Label Custom Text" disabled={!colorbar.visible || !colorbar.labelVisible}>
                    <Switch
                        checked={colorbar.labelCustomText}
                        disabled={!colorbar.visible || !colorbar.labelVisible}
                        onChange={(ev) => colorbar.setLabelCustomText(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <Collapse isOpen={colorbar.labelCustomText}>
                    <FormGroup inline={true} label="Label Text" disabled={!colorbar.visible || !colorbar.labelVisible}>
                        <InputGroup
                            disabled={!colorbar.visible || !colorbar.labelVisible}
                            value={colorbar.labelText}
                            placeholder="Enter label text"
                            onChange={ev => colorbar.setLabelText(ev.currentTarget.value)}
                        />
                    </FormGroup>
                </Collapse>
            </div>
        );

        const beamPanel = beam.isSelectedFrameValid ? (
            <div className="panel-container">
                <FormGroup inline={true} label="Image">
                    <HTMLSelect
                        options={appStore.frameNames}
                        value={beam.selectedFileId}
                        onChange={(event: React.FormEvent<HTMLSelectElement>) => beam.setSelectedFrame(parseInt(event.currentTarget.value))}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Visible">
                    <Switch
                        checked={beamSettings.visible}
                        onChange={(ev) =>  beamSettings.setVisible(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Color">
                    <ColorPickerComponent
                        color={tinycolor(beamSettings.color).toHexString()}
                        presetColors={SWATCH_COLORS}
                        setColor={(color: ColorResult) => beamSettings.setColor(color.hex)}
                        disableAlpha={true}
                        darkTheme={appStore.darkTheme}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Type">
                    <HTMLSelect
                        options={Object.keys(BeamType).map((key) => ({label: key, value: BeamType[key]}))}
                        value={beamSettings.type}
                        onChange={(event: React.FormEvent<HTMLSelectElement>) => beamSettings.setType(event.currentTarget.value as BeamType)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Width" labelInfo="(px)">
                    <SafeNumericInput
                        placeholder="Width"
                        min={0.5}
                        max={10}
                        value={beamSettings.width}
                        stepSize={0.5}
                        minorStepSize={0.1}
                        majorStepSize={1}
                        onValueChange={(value: number) => beamSettings.setWidth(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Position (X)" labelInfo="(px)">
                    <SafeNumericInput
                        placeholder="Position (X)"
                        min={0}
                        max={overlayStore.renderWidth}
                        value={beamSettings.shiftX}
                        stepSize={5}
                        minorStepSize={1}
                        majorStepSize={10}
                        onValueChange={(value: number) => beamSettings.setShiftX(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Position (Y)" labelInfo="(px)">
                    <SafeNumericInput
                        placeholder="Position (Y)"
                        min={0}
                        max={overlayStore.renderHeight}
                        value={beamSettings.shiftY}
                        stepSize={5}
                        minorStepSize={1}
                        majorStepSize={10}
                        onValueChange={(value: number) => beamSettings.setShiftY(value)}
                    />
                </FormGroup>
            </div>
        ) : null;

        let className = "image-view-settings";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        return (
            <div className={className}>
                <Tabs
                    id="imageViewSettingsTabs"
                    vertical={true}
                    selectedTabId={this.selectedTab}
                    onChange={this.setSelectedTab}
                >
                    <Tab id="global" title="Global" panel={globalPanel}/>
                    <Tab id="title" title="Title" panel={titlePanel}/>
                    <Tab id="ticks" title="Ticks" panel={ticksPanel}/>
                    <Tab id="grid" title="Grid" panel={gridPanel}/>
                    <Tab id="border" title="Border" panel={borderPanel}/>
                    <Tab id="axes" title="Axes" panel={axesPanel}/>
                    <Tab id="numbers" title="Numbers" panel={numbersPanel}/>
                    <Tab id="labels" title="Labels" panel={labelsPanel}/>
                    <Tab id="colorbar" title="Colorbar" panel={colorbarPanel}/>
                    <Tab id="beam" title="Beam" panel={beamPanel} disabled={appStore.frameNum <= 0}/>
                </Tabs>
            </div>
        );
    }
}
