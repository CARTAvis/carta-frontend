import * as React from "react";
import {Button, Collapse, Divider, FormGroup, HTMLSelect, InputGroup, MenuItem, Switch, Tab, TabId, Tabs} from "@blueprintjs/core";
import {ItemRenderer, Select} from "@blueprintjs/select";
import * as AST from "ast_wrapper";
import classNames from "classnames";
import {action, autorun, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {AutoColorPickerComponent, CoordinateComponent, CoordNumericInput, InputType, SafeNumericInput, SpectralSettingsComponent} from "components/Shared";
import {ImagePanelMode} from "models";
import {AppStore, BeamType, DefaultWidgetConfig, HelpType, LabelType, NUMBER_FORMAT_LABEL, NumberFormatType, PreferenceKeys, SystemType, WidgetProps} from "stores";
import {ColorbarStore, CoordinateMode} from "stores/Frame";
import {SWATCH_COLORS, toFixed} from "utilities";

import "./ImageViewSettingsPanelComponent.scss";

enum ImageViewSettingsPanelTabs {
    PAN_AND_ZOOM = "Pan and Zoom",
    GLOBAL = "Global",
    TITLE = "Title",
    TICKS = "Ticks",
    GRIDS = "Grids",
    BORDER = "Border",
    AXES = "Axes",
    NUMBERS = "Numbers",
    LABELS = "Labels",
    BEAM = "Beam",
    COLORBAR = "Colorbar",
    CONVERSION = "Conversion"
}

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

const astFonts: Font[] = AST.fonts.map((x, i) => new Font(x, i));
const FontSelect = Select.ofType<Font>();

export const renderFont: ItemRenderer<Font> = (font, {handleClick, modifiers, query}) => {
    return <MenuItem active={modifiers.active} disabled={modifiers.disabled} key={font.id} onClick={handleClick} text={<span style={{fontFamily: font.family, fontWeight: font.weight, fontStyle: font.style}}>{font.name}</span>} />;
};

@observer
export class ImageViewSettingsPanelComponent extends React.Component<WidgetProps> {
    @observable selectedTab: TabId = ImageViewSettingsPanelTabs.PAN_AND_ZOOM;
    @observable panAndZoomCoord: CoordinateMode = CoordinateMode.World;

    @action private setSelectedTab = (tab: TabId) => {
        this.selectedTab = tab;
    };

    @action private setPanAndZoomCoord = (coord: CoordinateMode) => {
        this.panAndZoomCoord = coord;
    };

    constructor(props: any) {
        super(props);
        makeObservable(this);

        autorun(() => {
            if (!AppStore.Instance.activeFrame?.isPVImage && this.selectedTab === ImageViewSettingsPanelTabs.CONVERSION) {
                this.selectedTab = ImageViewSettingsPanelTabs.GLOBAL;
            }
        });
    }

    private fontSelect(visible: boolean, currentFontId: number, fontSetter: Function) {
        let currentFont: Font = astFonts[currentFontId];
        if (typeof currentFont === "undefined") {
            currentFont = astFonts[0];
        }

        return (
            <FontSelect activeItem={currentFont} itemRenderer={renderFont} items={astFonts} disabled={!visible} filterable={false} popoverProps={{minimal: true, popoverClassName: "fontselect"}} onItemSelect={font => fontSetter(font.id)}>
                <Button text={<span style={{fontFamily: currentFont.family, fontWeight: currentFont.weight, fontStyle: currentFont.style}}>{currentFont.name}</span>} disabled={!visible} rightIcon="double-caret-vertical" />
            </FontSelect>
        );
    }

    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "image-view-floating-settings",
            type: "floating-settings",
            minWidth: 280,
            minHeight: 400,
            defaultWidth: 660,
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
        const preferences = appStore.preferenceStore;

        const interior: boolean = global.labelType === LabelType.Interior;

        const disabledIfInterior = interior && "Does not apply to interior labelling.";
        const disabledIfExterior = !interior && "Does not apply to exterior labelling.";
        const disabledIfNoWcs = !global.validWcs && "This image has no valid WCS data.";

        const frame = appStore.activeFrame;
        const isPVImage = frame?.isPVImage;

        const getFovInfoString = (value: number, valueWcs: string) => {
            return this.panAndZoomCoord === CoordinateMode.Image ? `WCS: ${valueWcs}` : `Image: ${toFixed(value, 3)} px`;
        };
        const fovLabelInfo = this.panAndZoomCoord === CoordinateMode.Image ? "(px)" : "";
        const panAndZoomPanel = (
            <div className="panel-pan-and-zoom">
                <FormGroup inline={true} label="Coordinate">
                    <CoordinateComponent selectedValue={this.panAndZoomCoord} onChange={this.setPanAndZoomCoord} />
                </FormGroup>
                <FormGroup inline={true} label="Center (X)" labelInfo={fovLabelInfo}>
                    <CoordNumericInput
                        coord={this.panAndZoomCoord}
                        inputType={InputType.XCoord}
                        value={frame?.center?.x}
                        onChange={val => frame?.setCenter(val, frame?.center?.y)}
                        valueWcs={frame?.centerWCS?.x}
                        onChangeWcs={val => frame?.setCenterWcs(val, frame?.centerWCS?.y)}
                        wcsDisabled={isPVImage}
                    />
                    <span className="info-string">{getFovInfoString(frame?.center?.x, frame?.centerWCS?.x)}</span>
                </FormGroup>
                <FormGroup inline={true} label="Center (Y)" labelInfo={fovLabelInfo}>
                    <CoordNumericInput
                        coord={this.panAndZoomCoord}
                        inputType={InputType.YCoord}
                        value={frame?.center?.y}
                        onChange={val => frame?.setCenter(frame?.center?.x, val)}
                        valueWcs={frame?.centerWCS?.y}
                        onChangeWcs={val => frame?.setCenterWcs(frame?.centerWCS?.x, val)}
                        wcsDisabled={isPVImage}
                    />
                    <span className="info-string">{getFovInfoString(frame?.center?.y, frame?.centerWCS?.y)}</span>
                </FormGroup>
                <FormGroup inline={true} label="Size (X)" labelInfo={fovLabelInfo}>
                    <CoordNumericInput
                        coord={this.panAndZoomCoord}
                        inputType={InputType.Size}
                        value={frame?.fovSize?.x}
                        onChange={frame?.zoomToSizeX}
                        valueWcs={frame?.fovSizeWCS?.x}
                        onChangeWcs={frame?.zoomToSizeXWcs}
                        wcsDisabled={isPVImage}
                        customPlaceholder="Width"
                    />
                    <span className="info-string">{getFovInfoString(frame?.fovSize?.x, frame?.fovSizeWCS?.x)}</span>
                </FormGroup>
                <FormGroup inline={true} label="Size (Y)" labelInfo={fovLabelInfo}>
                    <CoordNumericInput
                        coord={this.panAndZoomCoord}
                        inputType={InputType.Size}
                        value={frame?.fovSize?.y}
                        onChange={frame?.zoomToSizeY}
                        valueWcs={frame?.fovSizeWCS?.y}
                        onChangeWcs={frame?.zoomToSizeYWcs}
                        wcsDisabled={isPVImage}
                        customPlaceholder="Height"
                    />
                    <span className="info-string">{getFovInfoString(frame?.fovSize?.y, frame?.fovSizeWCS?.y)}</span>
                </FormGroup>
            </div>
        );

        const globalPanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Enable multi-panel">
                    <Switch checked={preferences.imageMultiPanelEnabled} onChange={ev => appStore.widgetsStore.setImageMultiPanelEnabled(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Multi-panel mode" disabled={!preferences.imageMultiPanelEnabled}>
                    <HTMLSelect value={preferences.imagePanelMode} disabled={!preferences.imageMultiPanelEnabled} onChange={event => preferences.setPreference(PreferenceKeys.IMAGE_PANEL_MODE, event.currentTarget.value as ImagePanelMode)}>
                        <option value={ImagePanelMode.Dynamic}>Dynamic grid size</option>
                        <option value={ImagePanelMode.Fixed}>Fixed grid size</option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Columns" labelInfo={preferences.imagePanelMode === ImagePanelMode.Dynamic ? "(Maximum)" : "(Fixed)"} disabled={!preferences.imageMultiPanelEnabled}>
                    <SafeNumericInput
                        placeholder="Columns"
                        min={1}
                        value={preferences.imagePanelColumns}
                        disabled={!preferences.imageMultiPanelEnabled}
                        stepSize={1}
                        minorStepSize={null}
                        onValueChange={value => preferences.setPreference(PreferenceKeys.IMAGE_PANEL_COLUMNS, value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Rows" labelInfo={preferences.imagePanelMode === ImagePanelMode.Dynamic ? "(Maximum)" : "(Fixed)"} disabled={!preferences.imageMultiPanelEnabled}>
                    <SafeNumericInput
                        placeholder="Rows"
                        min={1}
                        disabled={!preferences.imageMultiPanelEnabled}
                        value={preferences.imagePanelRows}
                        stepSize={1}
                        minorStepSize={null}
                        onValueChange={value => preferences.setPreference(PreferenceKeys.IMAGE_PANEL_ROWS, value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Overlay color">
                    <AutoColorPickerComponent color={global.color} presetColors={SWATCH_COLORS} setColor={global.setColor} disableAlpha={true} />
                </FormGroup>
                <FormGroup inline={true} label="Tolerance" labelInfo="(%)">
                    <SafeNumericInput placeholder="Tolerance" min={0.1} value={global.tolerance} stepSize={0.1} minorStepSize={null} majorStepSize={10} onValueChange={(value: number) => global.setTolerance(value)} />
                </FormGroup>
                <FormGroup inline={true} label="Labelling">
                    <HTMLSelect
                        options={Object.keys(LabelType).map(key => ({label: key, value: LabelType[key]}))}
                        value={global.labelType}
                        onChange={(event: React.FormEvent<HTMLSelectElement>) => global.setLabelType(event.currentTarget.value as LabelType)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Coordinate system" disabled={!global.validWcs} helperText={disabledIfNoWcs}>
                    <HTMLSelect
                        options={Object.keys(SystemType).map(key => ({label: key, value: SystemType[key]}))}
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
                        onChange={ev => {
                            title.setVisible(ev.currentTarget.checked);
                            title.setCustomText(ev.currentTarget.checked);
                        }}
                    />
                </FormGroup>
                <FormGroup inline={true} className="font-group" label="Font" disabled={!title.visible}>
                    {this.fontSelect(title.visible, title.font, title.setFont)}
                    <SafeNumericInput min={7} max={96} placeholder="Font size" value={title.fontSize} disabled={!title.visible} onValueChange={(value: number) => title.setFontSize(value)} />
                </FormGroup>
                <FormGroup inline={true} label="Custom text" disabled={!title.visible}>
                    <Switch checked={title.customText} disabled={!title.visible} onChange={ev => title.setCustomText(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={title.customText}>
                    <FormGroup inline={true} label="Text" labelInfo="(Current image only)" disabled={!title.visible}>
                        <InputGroup disabled={!title.visible} value={appStore.activeFrame?.titleCustomText} placeholder="Enter title text" onChange={ev => appStore.activeFrame?.setTitleCustomText(ev.currentTarget.value)} />
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Custom color" disabled={!title.visible}>
                    <Switch checked={title.customColor} disabled={!title.visible} onChange={ev => title.setCustomColor(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={title.customColor}>
                    <FormGroup inline={true} label="Color" disabled={!title.visible}>
                        {title.visible && <AutoColorPickerComponent color={title.color} presetColors={SWATCH_COLORS} setColor={title.setColor} disableAlpha={true} />}
                    </FormGroup>
                </Collapse>
            </div>
        );

        const ticksPanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Draw on all edges" disabled={interior} helperText={disabledIfInterior}>
                    <Switch checked={ticks.drawAll} disabled={interior} onChange={ev => ticks.setDrawAll(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Custom density">
                    <Switch checked={ticks.customDensity} onChange={ev => ticks.setCustomDensity(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={ticks.customDensity}>
                    <FormGroup inline={true} label="Density" labelInfo="(X)">
                        <SafeNumericInput placeholder="Density" min={0} value={ticks.densityX} onValueChange={(value: number) => ticks.setDensityX(value)} />
                    </FormGroup>
                    <FormGroup inline={true} label="Density" labelInfo="(Y)">
                        <SafeNumericInput placeholder="Density" min={0} value={ticks.densityY} onValueChange={(value: number) => ticks.setDensityY(value)} />
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Custom color">
                    <Switch checked={ticks.customColor} onChange={ev => ticks.setCustomColor(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={ticks.customColor}>
                    <FormGroup inline={true} label="Color">
                        <AutoColorPickerComponent color={ticks.color} presetColors={SWATCH_COLORS} setColor={ticks.setColor} disableAlpha={true} />
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Width" labelInfo="(px)">
                    <SafeNumericInput placeholder="Width" min={0.001} max={30} value={ticks.width} stepSize={0.5} minorStepSize={0.1} majorStepSize={1} onValueChange={(value: number) => ticks.setWidth(value)} />
                </FormGroup>
                <FormGroup inline={true} label="Minor length" labelInfo="(%)">
                    <SafeNumericInput placeholder="Length" min={0} max={100} value={ticks.length} stepSize={1} minorStepSize={null} majorStepSize={10} onValueChange={(value: number) => ticks.setLength(value)} />
                </FormGroup>
                <FormGroup inline={true} label="Major length" labelInfo="(%)">
                    <SafeNumericInput placeholder="Length" min={0} max={100} value={ticks.majorLength} stepSize={1} minorStepSize={null} majorStepSize={10} onValueChange={(value: number) => ticks.setMajorLength(value)} />
                </FormGroup>
            </div>
        );

        const gridPanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="WCS grid">
                    <Switch checked={grid.visible} onChange={ev => grid.setVisible(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Custom color" disabled={!grid.visible}>
                    <Switch checked={grid.customColor} disabled={!grid.visible} onChange={ev => grid.setCustomColor(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={grid.customColor}>
                    <FormGroup inline={true} label="Color" disabled={!grid.visible}>
                        {grid.visible && <AutoColorPickerComponent color={grid.color} presetColors={SWATCH_COLORS} setColor={grid.setColor} disableAlpha={true} />}
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Width" labelInfo="(px)" disabled={!grid.visible}>
                    <SafeNumericInput placeholder="Width" min={0.001} value={grid.width} stepSize={0.5} minorStepSize={0.1} majorStepSize={1} disabled={!grid.visible} onValueChange={(value: number) => grid.setWidth(value)} />
                </FormGroup>
                <FormGroup inline={true} label="Custom gap" disabled={!grid.visible}>
                    <Switch checked={grid.customGap} disabled={!grid.visible} onChange={ev => grid.setCustomGap(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={grid.customGap}>
                    <FormGroup inline={true} label="Gap" labelInfo="(X)" disabled={!grid.visible}>
                        <SafeNumericInput placeholder="Gap" min={0.001} stepSize={0.01} minorStepSize={0.001} majorStepSize={0.1} value={grid.gapX} disabled={!grid.visible} onValueChange={(value: number) => grid.setGapX(value)} />
                    </FormGroup>
                    <FormGroup inline={true} label="Gap" labelInfo="(Y)" disabled={!grid.visible}>
                        <SafeNumericInput placeholder="Gap" min={0.001} stepSize={0.01} minorStepSize={0.001} majorStepSize={0.1} value={grid.gapY} disabled={!grid.visible} onValueChange={(value: number) => grid.setGapY(value)} />
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Pixel grid">
                    <Switch checked={preferences.pixelGridVisible} onChange={ev => preferences.setPreference(PreferenceKeys.PIXEL_GRID_VISIBLE, ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Pixel grid color">
                    <AutoColorPickerComponent color={preferences.pixelGridColor} presetColors={SWATCH_COLORS} setColor={color => preferences.setPreference(PreferenceKeys.PIXEL_GRID_COLOR, color)} disableAlpha={true} />
                </FormGroup>
            </div>
        );

        const borderPanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Visible">
                    <Switch checked={border.visible} onChange={ev => border.setVisible(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Custom color" disabled={!border.visible}>
                    <Switch checked={border.customColor} disabled={!border.visible} onChange={ev => border.setCustomColor(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={border.customColor}>
                    <FormGroup inline={true} label="Color" disabled={!border.visible}>
                        {border.visible && <AutoColorPickerComponent color={border.color} presetColors={SWATCH_COLORS} setColor={border.setColor} disableAlpha={true} />}
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Width" labelInfo="(px)" disabled={!border.visible}>
                    <SafeNumericInput placeholder="Width" min={0.5} max={30} value={border.width} stepSize={0.5} minorStepSize={0.1} majorStepSize={1} disabled={!border.visible} onValueChange={(value: number) => border.setWidth(value)} />
                </FormGroup>
            </div>
        );

        const axesPanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Visible" disabled={!interior} helperText={disabledIfExterior}>
                    <Switch checked={axes.visible} disabled={!interior} onChange={ev => axes.setVisible(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Custom color" disabled={!interior || !axes.visible}>
                    <Switch checked={axes.customColor} disabled={!interior || !axes.visible} onChange={ev => axes.setCustomColor(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={axes.customColor}>
                    <FormGroup inline={true} label="Color" disabled={!interior || !axes.visible} helperText={disabledIfExterior}>
                        {interior && axes.visible && <AutoColorPickerComponent color={axes.color} presetColors={SWATCH_COLORS} setColor={axes.setColor} disableAlpha={true} />}
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Width" labelInfo="(px)" disabled={!interior || !axes.visible} helperText={disabledIfExterior}>
                    <SafeNumericInput placeholder="Width" min={0.001} value={axes.width} stepSize={0.5} minorStepSize={0.1} majorStepSize={1} disabled={!interior || !axes.visible} onValueChange={(value: number) => axes.setWidth(value)} />
                </FormGroup>
            </div>
        );

        const numbersPanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Visible">
                    <Switch checked={numbers.visible} onChange={ev => numbers.setVisible(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} className="font-group" label="Font" disabled={!numbers.visible}>
                    {this.fontSelect(numbers.visible, numbers.font, numbers.setFont)}
                    <SafeNumericInput min={7} max={96} placeholder="Font size" value={numbers.fontSize} disabled={!numbers.visible} onValueChange={(value: number) => numbers.setFontSize(value)} />
                </FormGroup>
                <FormGroup inline={true} label="Custom color" disabled={!numbers.visible}>
                    <Switch checked={numbers.customColor} disabled={!numbers.visible} onChange={ev => numbers.setCustomColor(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={numbers.customColor}>
                    <FormGroup inline={true} label="Color" disabled={!numbers.visible}>
                        {numbers.visible && <AutoColorPickerComponent color={numbers.color} presetColors={SWATCH_COLORS} setColor={numbers.setColor} disableAlpha={true} />}
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Custom format" disabled={!numbers.validWcs} helperText={disabledIfNoWcs}>
                    <Switch checked={numbers.customFormat} disabled={!numbers.validWcs} onChange={ev => numbers.setCustomFormat(ev.currentTarget.checked)} />
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
                <FormGroup inline={true} label="Custom precision" disabled={!numbers.validWcs} helperText={disabledIfNoWcs}>
                    <Switch checked={numbers.customPrecision} disabled={!numbers.validWcs} onChange={ev => numbers.setCustomPrecision(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={numbers.customPrecision && numbers.validWcs}>
                    <FormGroup inline={true} label="Precision">
                        <SafeNumericInput placeholder="Precision" min={0} value={numbers.precision} onValueChange={(value: number) => numbers.setPrecision(value)} />
                    </FormGroup>
                </Collapse>
            </div>
        );

        const labelsPanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Visible">
                    <Switch checked={labels.visible} onChange={ev => labels.setVisible(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} className="font-group" label="Font" disabled={!labels.visible}>
                    {this.fontSelect(labels.visible, labels.font, labels.setFont)}
                    <SafeNumericInput min={7} max={96} placeholder="Font size" value={labels.fontSize} disabled={!labels.visible} onValueChange={(value: number) => labels.setFontSize(value)} />
                </FormGroup>
                <FormGroup inline={true} label="Custom text" disabled={!labels.visible}>
                    <Switch checked={labels.customText} disabled={!labels.visible} onChange={ev => labels.setCustomText(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={labels.customText}>
                    <FormGroup inline={true} label="Label text (X)" disabled={!labels.visible}>
                        <InputGroup disabled={!labels.visible} value={labels.customLabelX} placeholder="Enter label text" onChange={ev => labels.setCustomLabelX(ev.currentTarget.value)} />
                    </FormGroup>
                    <FormGroup inline={true} label="Label text (Y)" disabled={!labels.visible}>
                        <InputGroup disabled={!labels.visible} value={labels.customLabelY} placeholder="Enter label text" onChange={ev => labels.setCustomLabelY(ev.currentTarget.value)} />
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Custom color" disabled={!labels.visible}>
                    <Switch checked={labels.customColor} disabled={!labels.visible} onChange={ev => labels.setCustomColor(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={labels.customColor}>
                    <FormGroup inline={true} label="Color" disabled={!labels.visible}>
                        {labels.visible && <AutoColorPickerComponent color={labels.color} presetColors={SWATCH_COLORS} setColor={labels.setColor} disableAlpha={true} />}
                    </FormGroup>
                </Collapse>
            </div>
        );

        const colorbarPanel = (
            <div className="panel-colorbar">
                <FormGroup inline={true} label="Visible">
                    <Switch checked={colorbar.visible} onChange={ev => colorbar.setVisible(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Interactive" disabled={!colorbar.visible}>
                    <Switch disabled={!colorbar.visible} checked={colorbar.interactive} onChange={ev => colorbar.setInteractive(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Position" disabled={!colorbar.visible}>
                    <HTMLSelect value={colorbar.position} disabled={!colorbar.visible} onChange={ev => colorbar.setPosition(ev.currentTarget.value)}>
                        <option value={"right"}>Right</option>
                        <option value={"top"}>Top</option>
                        <option value={"bottom"}>Bottom</option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Width" labelInfo="(px)" disabled={!colorbar.visible}>
                    <SafeNumericInput
                        placeholder="Width"
                        min={1}
                        max={100}
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
                        max={100}
                        value={colorbar.offset}
                        stepSize={1}
                        minorStepSize={1}
                        majorStepSize={5}
                        disabled={!colorbar.visible}
                        onValueChange={(value: number) => colorbar.setOffset(value)}
                        intOnly={true}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Ticks density" labelInfo="(per 100px)" disabled={!colorbar.visible || (!colorbar.tickVisible && !colorbar.numberVisible)}>
                    <SafeNumericInput
                        placeholder="Ticks density"
                        min={0.2}
                        max={20}
                        value={colorbar.tickDensity}
                        stepSize={0.2}
                        minorStepSize={0.1}
                        majorStepSize={1}
                        disabled={!colorbar.visible || (!colorbar.tickVisible && !colorbar.numberVisible)}
                        onValueChange={(value: number) => colorbar.setTickDensity(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Custom color" disabled={!colorbar.visible}>
                    <Switch checked={colorbar.customColor} disabled={!colorbar.visible} onChange={ev => colorbar.setCustomColor(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={colorbar.customColor}>
                    <FormGroup inline={true} label="color" disabled={!colorbar.visible}>
                        {colorbar.visible && <AutoColorPickerComponent color={colorbar.color} presetColors={SWATCH_COLORS} setColor={colorbar.setColor} disableAlpha={true} />}
                    </FormGroup>
                </Collapse>
                <hr></hr>
                <FormGroup inline={true} label="Label" disabled={!colorbar.visible}>
                    <Switch checked={colorbar.labelVisible} disabled={!colorbar.visible} onChange={ev => colorbar.setLabelVisible(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Label rotation" disabled={!colorbar.visible || !colorbar.labelVisible || colorbar.position !== "right"}>
                    <HTMLSelect
                        value={colorbar.labelRotation}
                        disabled={!colorbar.visible || !colorbar.labelVisible || colorbar.position !== "right"}
                        onChange={ev => {
                            colorbar.setLabelRotation(Number(ev.currentTarget.value));
                            if (colorbar.numberRotation !== 0 && (Number(ev.currentTarget.value) === 90 || Number(ev.currentTarget.value) === -90)) {
                                colorbar.setNumberRotation(Number(ev.currentTarget.value));
                            }
                        }}
                    >
                        <option value={-90}>-90</option>
                        <option value={90}>90</option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} className="font-group" label="Label font" disabled={!colorbar.visible || !colorbar.labelVisible}>
                    {this.fontSelect(colorbar.visible && colorbar.labelVisible, colorbar.labelFont, colorbar.setLabelFont)}
                    <SafeNumericInput min={7} max={96} value={colorbar.labelFontSize} disabled={!colorbar.visible || !colorbar.labelVisible} onValueChange={(value: number) => colorbar.setLabelFontSize(value)} />
                </FormGroup>
                <FormGroup inline={true} label="Label custom text" disabled={!colorbar.visible || !colorbar.labelVisible}>
                    <Switch checked={colorbar.labelCustomText} disabled={!colorbar.visible || !colorbar.labelVisible} onChange={ev => colorbar.setLabelCustomText(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={colorbar.labelCustomText}>
                    <FormGroup inline={true} label="Label text" disabled={!colorbar.visible || !colorbar.labelVisible}>
                        <InputGroup
                            disabled={!colorbar.visible || !colorbar.labelVisible}
                            value={appStore.activeFrame?.colorbarLabelCustomText}
                            placeholder="Enter label text"
                            onChange={ev => appStore.activeFrame?.setColorbarLabelCustomText(ev.currentTarget.value)}
                        />
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Label custom color" disabled={!colorbar.visible || !colorbar.labelVisible}>
                    <Switch checked={colorbar.labelCustomColor} disabled={!colorbar.visible || !colorbar.labelVisible} onChange={ev => colorbar.setLabelCustomColor(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={colorbar.labelCustomColor}>
                    <FormGroup inline={true} label="Label color" disabled={!colorbar.visible || !colorbar.labelVisible}>
                        {colorbar.visible && colorbar.labelVisible && <AutoColorPickerComponent color={colorbar.labelColor} presetColors={SWATCH_COLORS} setColor={colorbar.setLabelColor} disableAlpha={true} />}
                    </FormGroup>
                </Collapse>
                <hr></hr>
                <FormGroup inline={true} label="Numbers" disabled={!colorbar.visible}>
                    <Switch checked={colorbar.numberVisible} disabled={!colorbar.visible} onChange={ev => colorbar.setNumberVisible(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Numbers rotation" disabled={!colorbar.visible || !colorbar.numberVisible || colorbar.position !== "right"}>
                    <HTMLSelect value={colorbar.numberRotation} disabled={!colorbar.visible || !colorbar.numberVisible || colorbar.position !== "right"} onChange={ev => colorbar.setNumberRotation(Number(ev.currentTarget.value))}>
                        <option value={-90}>-90</option>
                        <option value={0}>0</option>
                        <option value={90}>90</option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} className="font-group" label="Numbers font" disabled={!colorbar.visible || !colorbar.numberVisible}>
                    {this.fontSelect(colorbar.visible && colorbar.numberVisible, colorbar.numberFont, colorbar.setNumberFont)}
                    <SafeNumericInput min={7} max={96} value={colorbar.numberFontSize} disabled={!colorbar.visible || !colorbar.numberVisible} onValueChange={(value: number) => colorbar.setNumberFontSize(value)} />
                </FormGroup>
                <FormGroup inline={true} label="Numbers custom precision" disabled={!colorbar.visible || !colorbar.numberVisible}>
                    <Switch checked={colorbar.numberCustomPrecision} disabled={!colorbar.visible || !colorbar.numberVisible} onChange={ev => colorbar.setNumberCustomPrecision(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={colorbar.numberCustomPrecision}>
                    <FormGroup inline={true} label="Numbers precision" disabled={!colorbar.visible || !colorbar.numberVisible}>
                        <SafeNumericInput
                            min={0}
                            max={ColorbarStore.PRECISION_MAX}
                            stepSize={1}
                            value={colorbar.numberPrecision}
                            disabled={!colorbar.visible || !colorbar.numberVisible}
                            onValueChange={(value: number) => colorbar.setNumberPrecision(value)}
                            intOnly={true}
                        />
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Numbers custom color" disabled={!colorbar.visible || !colorbar.numberVisible}>
                    <Switch checked={colorbar.numberCustomColor} disabled={!colorbar.visible || !colorbar.numberVisible} onChange={ev => colorbar.setNumberCustomColor(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={colorbar.numberCustomColor}>
                    <FormGroup inline={true} label="Numbers color" disabled={!colorbar.visible || !colorbar.numberVisible}>
                        {colorbar.visible && colorbar.numberVisible && <AutoColorPickerComponent color={colorbar.numberColor} presetColors={SWATCH_COLORS} setColor={colorbar.setNumberColor} disableAlpha={true} />}
                    </FormGroup>
                </Collapse>
                <hr></hr>
                <FormGroup inline={true} label="Ticks" disabled={!colorbar.visible}>
                    <Switch checked={colorbar.tickVisible} disabled={!colorbar.visible} onChange={ev => colorbar.setTickVisible(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Ticks length" labelInfo="(px)" disabled={!colorbar.visible || !colorbar.tickVisible}>
                    <SafeNumericInput
                        placeholder="Ticks length"
                        min={0.5}
                        max={colorbar.width}
                        value={colorbar.tickLen}
                        stepSize={0.5}
                        minorStepSize={0.1}
                        majorStepSize={1}
                        disabled={!colorbar.visible || !colorbar.tickVisible}
                        onValueChange={(value: number) => colorbar.setTickLen(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Ticks width" labelInfo="(px)" disabled={!colorbar.visible || !colorbar.tickVisible}>
                    <SafeNumericInput
                        placeholder="Ticks width"
                        min={0.5}
                        max={30}
                        value={colorbar.tickWidth}
                        stepSize={0.5}
                        minorStepSize={0.1}
                        majorStepSize={1}
                        disabled={!colorbar.visible || !colorbar.tickVisible}
                        onValueChange={(value: number) => colorbar.setTickWidth(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Ticks custom color" disabled={!colorbar.visible || !colorbar.tickVisible}>
                    <Switch checked={colorbar.tickCustomColor} disabled={!colorbar.visible || !colorbar.tickVisible} onChange={ev => colorbar.setTickCustomColor(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={colorbar.tickCustomColor}>
                    <FormGroup inline={true} label="Ticks color" disabled={!colorbar.visible || !colorbar.tickVisible}>
                        {colorbar.visible && colorbar.tickVisible && <AutoColorPickerComponent color={colorbar.tickColor} presetColors={SWATCH_COLORS} setColor={colorbar.setTickColor} disableAlpha={true} />}
                    </FormGroup>
                </Collapse>
                <hr></hr>
                <FormGroup inline={true} label="Border" disabled={!colorbar.visible}>
                    <Switch checked={colorbar.borderVisible} disabled={!colorbar.visible} onChange={ev => colorbar.setBorderVisible(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Border width" labelInfo="(px)" disabled={!colorbar.visible || !colorbar.borderVisible}>
                    <SafeNumericInput
                        placeholder="Border width"
                        min={0.5}
                        max={30}
                        value={colorbar.borderWidth}
                        stepSize={0.5}
                        minorStepSize={0.1}
                        majorStepSize={1}
                        disabled={!colorbar.visible || !colorbar.borderVisible}
                        onValueChange={(value: number) => colorbar.setBorderWidth(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Border custom color" disabled={!colorbar.visible || !colorbar.borderVisible}>
                    <Switch checked={colorbar.borderCustomColor} disabled={!colorbar.visible || !colorbar.borderVisible} onChange={ev => colorbar.setBorderCustomColor(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={colorbar.borderCustomColor}>
                    <FormGroup inline={true} label="Border color" disabled={!colorbar.visible || !colorbar.borderVisible}>
                        {colorbar.visible && colorbar.borderVisible && <AutoColorPickerComponent color={colorbar.borderColor} presetColors={SWATCH_COLORS} setColor={colorbar.setBorderColor} disableAlpha={true} />}
                    </FormGroup>
                </Collapse>
            </div>
        );

        const beamPanel = beam.isSelectedFrameValid ? (
            <div className="panel-container">
                <FormGroup inline={true} label="Image">
                    <HTMLSelect options={appStore.frameNames} value={beam.selectedFileId} onChange={(event: React.FormEvent<HTMLSelectElement>) => beam.setSelectedFrame(parseInt(event.currentTarget.value))} />
                </FormGroup>
                <FormGroup inline={true} label="Visible">
                    <Switch checked={beamSettings.visible} onChange={ev => beamSettings.setVisible(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Color">
                    <AutoColorPickerComponent color={beamSettings.color} presetColors={SWATCH_COLORS} setColor={beamSettings.setColor} disableAlpha={true} />
                </FormGroup>
                <FormGroup inline={true} label="Type">
                    <HTMLSelect
                        options={Object.keys(BeamType).map(key => ({label: key, value: BeamType[key]}))}
                        value={beamSettings.type}
                        onChange={(event: React.FormEvent<HTMLSelectElement>) => beamSettings.setType(event.currentTarget.value as BeamType)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Width" labelInfo="(px)">
                    <SafeNumericInput placeholder="Width" min={0.5} max={10} value={beamSettings.width} stepSize={0.5} minorStepSize={0.1} majorStepSize={1} onValueChange={(value: number) => beamSettings.setWidth(value)} />
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

        const spectralPanel = isPVImage ? (
            <div className="panel-container">
                <p>For spatial-spectral image</p>
                <Divider />
                <p>Spectral axis</p>
                <SpectralSettingsComponent frame={appStore.activeFrame} onSpectralCoordinateChange={frame.setSpectralCoordinate} onSpectralSystemChange={frame.setSpectralSystem} disable={!isPVImage} disableChannelOption={true} />
            </div>
        ) : null;

        const className = classNames("image-view-settings", {"bp3-dark": appStore.darkTheme});

        return (
            <div className={className}>
                <Tabs id="imageViewSettingsTabs" vertical={true} selectedTabId={this.selectedTab} onChange={this.setSelectedTab}>
                    <Tab id={ImageViewSettingsPanelTabs.PAN_AND_ZOOM} title={ImageViewSettingsPanelTabs.PAN_AND_ZOOM} panel={panAndZoomPanel} />
                    <Tab id={ImageViewSettingsPanelTabs.GLOBAL} title={ImageViewSettingsPanelTabs.GLOBAL} panel={globalPanel} />
                    <Tab id={ImageViewSettingsPanelTabs.TITLE} title={ImageViewSettingsPanelTabs.TITLE} panel={titlePanel} />
                    <Tab id={ImageViewSettingsPanelTabs.TICKS} title={ImageViewSettingsPanelTabs.TICKS} panel={ticksPanel} />
                    <Tab id={ImageViewSettingsPanelTabs.GRIDS} title={ImageViewSettingsPanelTabs.GRIDS} panel={gridPanel} />
                    <Tab id={ImageViewSettingsPanelTabs.BORDER} title={ImageViewSettingsPanelTabs.BORDER} panel={borderPanel} />
                    <Tab id={ImageViewSettingsPanelTabs.AXES} title={ImageViewSettingsPanelTabs.AXES} panel={axesPanel} />
                    <Tab id={ImageViewSettingsPanelTabs.NUMBERS} title={ImageViewSettingsPanelTabs.NUMBERS} panel={numbersPanel} />
                    <Tab id={ImageViewSettingsPanelTabs.LABELS} title={ImageViewSettingsPanelTabs.LABELS} panel={labelsPanel} />
                    <Tab id={ImageViewSettingsPanelTabs.COLORBAR} title={ImageViewSettingsPanelTabs.COLORBAR} panel={colorbarPanel} />
                    <Tab id={ImageViewSettingsPanelTabs.BEAM} title={ImageViewSettingsPanelTabs.BEAM} panel={beamPanel} disabled={appStore.frameNum <= 0} />
                    <Tab id={ImageViewSettingsPanelTabs.CONVERSION} title={ImageViewSettingsPanelTabs.CONVERSION} panel={spectralPanel} disabled={!isPVImage} />
                </Tabs>
            </div>
        );
    }
}
