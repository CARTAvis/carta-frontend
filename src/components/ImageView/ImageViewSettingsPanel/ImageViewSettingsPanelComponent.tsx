import * as React from "react";
import {Button, Classes, Collapse, Divider, FormGroup, HTMLSelect, InputGroup, Position, Switch, Tab, type TabId, Tabs, Tooltip} from "@blueprintjs/core";
import classNames from "classnames";
import {action, autorun, type IReactionDisposer, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {AutoColorPickerComponent, CoordinateComponent, CoordNumericInput, fontSelect, SafeNumericInput, ScrollShadow, SpectralSettingsComponent} from "components/Shared";
import {BeamType, CoordinateMode, HelpType, ImagePanelMode, ImageViewSettingsPanelTabs, InputType, LabelType, NumberFormatType, PreferenceKeys, SystemType} from "enums";
import {AppStore, type DefaultWidgetConfig, type WidgetProps} from "stores";
import {ColorbarStore} from "stores/Frame";
import {NUMBER_FORMAT_LABEL, SWATCH_COLORS, toFixed} from "utilities";

import "./ImageViewSettingsPanelComponent.scss";

@observer
export class ImageViewSettingsPanelComponent extends React.Component<WidgetProps> {
    @observable selectedTab: TabId = ImageViewSettingsPanelTabs.PAN_AND_ZOOM;
    @observable panAndZoomCoord: CoordinateMode = CoordinateMode.World;
    private readonly disposers: IReactionDisposer[] = [];

    @action private setSelectedTab = (tab: TabId) => {
        this.selectedTab = tab;
    };

    @action private setPanAndZoomCoord = (coord: CoordinateMode) => {
        this.panAndZoomCoord = coord;
    };

    constructor(props: any) {
        super(props);
        makeObservable(this);

        this.disposers.push(
            autorun(() => {
                if (!AppStore.Instance.activeFrame?.isPVImage && this.selectedTab === ImageViewSettingsPanelTabs.CONVERSION) {
                    this.selectedTab = ImageViewSettingsPanelTabs.GLOBAL;
                }
            })
        );
    }

    componentWillUnmount() {
        this.disposers.forEach(disposer => disposer());
        this.disposers.length = 0;
    }

    public static get WidgetConfig(): DefaultWidgetConfig {
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
        const frame = appStore.activeFrame;
        const overlaySettings = appStore.overlaySettings;
        const global = overlaySettings.global;
        const title = overlaySettings.title;
        const grid = overlaySettings.grid;
        const border = overlaySettings.border;
        const ticks = overlaySettings.ticks;
        const axes = overlaySettings.axes;
        const numbers = overlaySettings.numbers;
        const labels = overlaySettings.labels;
        const colorbar = overlaySettings.colorbar;
        const beam = overlaySettings.beam;
        const beamSettings = beam.settingsForDisplay;
        const preferences = appStore.preferenceStore;

        const isInterior: boolean = global.labelType === LabelType.Interior;

        const disabledIfInterior = isInterior && "Does not apply to interior labelling.";
        const disabledIfExterior = !isInterior && "Does not apply to exterior labelling.";
        const disabledIfNoWcs = !global.isValidWcs && "This image has no valid WCS data.";

        const isPVImage = frame?.isPVImage;

        const getInfoString = (value: number, valueWcs: string | undefined) => {
            return this.panAndZoomCoord === CoordinateMode.Image ? `WCS: ${global.system !== SystemType.Image ? valueWcs : "-"}` : `Image: ${toFixed(value, 3)} px`;
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
                        value={frame?.center?.x ?? 0}
                        onChange={val => frame?.setCenter(val, frame?.center?.y ?? 0) ?? false}
                        valueWcs={frame?.centerWCS?.x ?? null}
                        onChangeWcs={val => frame?.setCenterWcs(val, frame?.centerWCS?.y ?? null) ?? false}
                        wcsDisabled={isPVImage}
                    />
                    <span className="info-string">{getInfoString(frame?.center?.x ?? 0, frame?.centerWCS?.x ?? undefined)}</span>
                </FormGroup>
                <FormGroup inline={true} label="Center (Y)" labelInfo={fovLabelInfo}>
                    <CoordNumericInput
                        coord={this.panAndZoomCoord}
                        inputType={InputType.YCoord}
                        value={frame?.center?.y ?? 0}
                        onChange={val => frame?.setCenter(frame?.center?.x ?? 0, val) ?? false}
                        valueWcs={frame?.centerWCS?.y ?? null}
                        onChangeWcs={val => frame?.setCenterWcs(frame?.centerWCS?.x ?? null, val) ?? false}
                        wcsDisabled={isPVImage}
                    />
                    <span className="info-string">{getInfoString(frame?.center?.y ?? 0, frame?.centerWCS?.y ?? undefined)}</span>
                </FormGroup>
                <FormGroup inline={true} label="Size (X)" labelInfo={fovLabelInfo}>
                    <CoordNumericInput
                        coord={this.panAndZoomCoord}
                        inputType={InputType.Size}
                        value={frame?.fovSize?.x ?? 0}
                        onChange={val => frame?.zoomToSizeX(val) ?? false}
                        valueWcs={frame?.fovSizeWCS?.x ?? null}
                        onChangeWcs={val => frame?.zoomToSizeXWcs(val) ?? false}
                        wcsDisabled={isPVImage}
                        customPlaceholder="Width"
                    />
                    <span className="info-string">{getInfoString(frame?.fovSize?.x ?? 0, frame?.fovSizeWCS?.x)}</span>
                </FormGroup>
                <FormGroup inline={true} label="Size (Y)" labelInfo={fovLabelInfo}>
                    <CoordNumericInput
                        coord={this.panAndZoomCoord}
                        inputType={InputType.Size}
                        value={frame?.fovSize?.y ?? 0}
                        onChange={val => frame?.zoomToSizeY(val) ?? false}
                        valueWcs={frame?.fovSizeWCS?.y ?? null}
                        onChangeWcs={val => frame?.zoomToSizeYWcs(val) ?? false}
                        wcsDisabled={isPVImage}
                        customPlaceholder="Height"
                    />
                    <span className="info-string">{getInfoString(frame?.fovSize?.y ?? 0, frame?.fovSizeWCS?.y)}</span>
                </FormGroup>
                <FormGroup inline={true} label="Offset coordinates">
                    <Switch checked={frame?.isOffsetCoord} disabled={frame?.isPVImage || frame?.isSwappedZ || frame?.isUVImage} onChange={frame?.toggleOffsetCoord} />
                    <Collapse isOpen={frame?.isOffsetCoord}>
                        <Tooltip content="Set offset to current view center" position={Position.BOTTOM} hoverOpenDelay={300}>
                            <Button icon="locate" disabled={!frame?.isOffsetCoord} onClick={() => frame?.updateOffsetCenter()} />
                        </Tooltip>
                    </Collapse>
                </FormGroup>
                <Collapse isOpen={frame?.isOffsetCoord}>
                    <FormGroup inline={true} label="Offset center (X)" labelInfo={fovLabelInfo}>
                        <CoordNumericInput
                            coord={this.panAndZoomCoord}
                            inputType={InputType.XCoord}
                            value={frame?.offsetCenter?.x ?? 0}
                            onChange={val => frame?.setOffsetCenter(val, frame?.offsetCenter?.y ?? 0) ?? false}
                            valueWcs={frame?.offsetCenterWCS?.x ?? null}
                            onChangeWcs={val => frame?.setOffsetCenterWcs(val, frame?.offsetCenterWCS?.y ?? null) ?? false}
                            wcsDisabled={isPVImage}
                        />
                        <span className="info-string">{getInfoString(frame?.offsetCenter?.x ?? 0, frame?.offsetCenterWCS?.x ?? undefined)}</span>
                    </FormGroup>
                    <FormGroup inline={true} label="Offset center (Y)" labelInfo={fovLabelInfo}>
                        <CoordNumericInput
                            coord={this.panAndZoomCoord}
                            inputType={InputType.YCoord}
                            value={frame?.offsetCenter?.y ?? 0}
                            onChange={val => frame?.setOffsetCenter(frame?.offsetCenter?.x ?? 0, val) ?? false}
                            valueWcs={frame?.offsetCenterWCS?.y ?? null}
                            onChangeWcs={val => frame?.setOffsetCenterWcs(frame?.offsetCenterWCS?.x ?? null, val) ?? false}
                            wcsDisabled={isPVImage}
                        />
                        <span className="info-string">{getInfoString(frame?.offsetCenter?.y ?? 0, frame?.offsetCenterWCS?.y ?? undefined)}</span>
                    </FormGroup>
                </Collapse>
            </div>
        );

        const globalPanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Enable multi-panel">
                    <Switch checked={preferences.isImageMultiPanelEnabled} onChange={ev => appStore.widgetsStore.setImageMultiPanelEnabled(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Multi-panel mode" disabled={!preferences.isImageMultiPanelEnabled}>
                    <HTMLSelect value={preferences.imagePanelMode} disabled={!preferences.isImageMultiPanelEnabled} onChange={event => preferences.setPreference(PreferenceKeys.IMAGE_PANEL_MODE, event.currentTarget.value as ImagePanelMode)}>
                        <option value={ImagePanelMode.Dynamic}>Dynamic grid size</option>
                        <option value={ImagePanelMode.Fixed}>Fixed grid size</option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Columns" labelInfo={preferences.imagePanelMode === ImagePanelMode.Dynamic ? "(Maximum)" : "(Fixed)"} disabled={!preferences.isImageMultiPanelEnabled}>
                    <SafeNumericInput
                        placeholder="Columns"
                        min={1}
                        value={preferences.imagePanelColumns}
                        disabled={!preferences.isImageMultiPanelEnabled}
                        stepSize={1}
                        minorStepSize={null}
                        onValueChange={value => preferences.setPreference(PreferenceKeys.IMAGE_PANEL_COLUMNS, value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Rows" labelInfo={preferences.imagePanelMode === ImagePanelMode.Dynamic ? "(Maximum)" : "(Fixed)"} disabled={!preferences.isImageMultiPanelEnabled}>
                    <SafeNumericInput
                        placeholder="Rows"
                        min={1}
                        disabled={!preferences.isImageMultiPanelEnabled}
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
                        onChange={(event: React.ChangeEvent<HTMLSelectElement>) => global.setLabelType(event.currentTarget.value as LabelType)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Coordinate system" disabled={!global.isValidWcs} helperText={disabledIfNoWcs}>
                    <HTMLSelect
                        options={Object.keys(SystemType).map(key => ({label: key, value: SystemType[key]}))}
                        value={global.system}
                        disabled={!global.isValidWcs}
                        onChange={(event: React.ChangeEvent<HTMLSelectElement>) => global.setSystem(event.currentTarget.value as SystemType)}
                    />
                </FormGroup>
            </div>
        );

        const titlePanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Visible">
                    <Switch checked={title.isVisible} onChange={ev => title.setVisible(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} className="font-group" label="Font" disabled={!title.isVisible}>
                    {fontSelect(title.isVisible, title.font, title.setFont)}
                    <SafeNumericInput min={7} max={96} placeholder="Font size" value={title.fontSize} disabled={!title.isVisible} onValueChange={(value: number) => title.setFontSize(value)} />
                </FormGroup>
                <FormGroup inline={true} label="Custom text" disabled={!title.isVisible}>
                    <Switch checked={title.hasCustomText} disabled={!title.isVisible} onChange={ev => title.setCustomText(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={title.hasCustomText}>
                    <FormGroup inline={true} label="Text" labelInfo="(Current image only)" disabled={!title.isVisible}>
                        <InputGroup disabled={!title.isVisible} value={appStore.activeImage?.store?.titleCustomText} placeholder="Enter title text" onChange={ev => appStore.activeImage?.store?.setTitleCustomText(ev.currentTarget.value)} />
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Custom color" disabled={!title.isVisible}>
                    <Switch checked={title.hasCustomColor} disabled={!title.isVisible} onChange={ev => title.setCustomColor(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={title.hasCustomColor}>
                    <FormGroup inline={true} label="Color" disabled={!title.isVisible}>
                        {title.isVisible && <AutoColorPickerComponent color={title.color} presetColors={SWATCH_COLORS} setColor={title.setColor} disableAlpha={true} />}
                    </FormGroup>
                </Collapse>
            </div>
        );

        const ticksPanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Draw on all edges" disabled={isInterior} helperText={disabledIfInterior}>
                    <Switch checked={ticks.shouldDrawAll} disabled={isInterior} onChange={ev => ticks.setDrawAll(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Custom density">
                    <Switch checked={ticks.hasCustomDensity} onChange={ev => ticks.setCustomDensity(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={ticks.hasCustomDensity}>
                    <FormGroup inline={true} label="Density" labelInfo="(X)">
                        <SafeNumericInput placeholder="Density" min={0} value={ticks.densityX} onValueChange={(value: number) => ticks.setDensityX(value)} />
                    </FormGroup>
                    <FormGroup inline={true} label="Density" labelInfo="(Y)">
                        <SafeNumericInput placeholder="Density" min={0} value={ticks.densityY} onValueChange={(value: number) => ticks.setDensityY(value)} />
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Custom color">
                    <Switch checked={ticks.hasCustomColor} onChange={ev => ticks.setCustomColor(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={ticks.hasCustomColor}>
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
                    <Switch checked={grid.isVisible} onChange={ev => grid.setVisible(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Custom color" disabled={!grid.isVisible}>
                    <Switch checked={grid.hasCustomColor} disabled={!grid.isVisible} onChange={ev => grid.setCustomColor(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={grid.hasCustomColor}>
                    <FormGroup inline={true} label="Color" disabled={!grid.isVisible}>
                        {grid.isVisible && <AutoColorPickerComponent color={grid.color} presetColors={SWATCH_COLORS} setColor={grid.setColor} disableAlpha={true} />}
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Width" labelInfo="(px)" disabled={!grid.isVisible}>
                    <SafeNumericInput
                        placeholder="Width"
                        min={0.001}
                        value={grid.width}
                        stepSize={0.5}
                        minorStepSize={0.1}
                        majorStepSize={1}
                        disabled={!grid.isVisible}
                        onValueChange={(value: number) => grid.setWidth(value)}
                        data-testid="image-view-settings-grid-width-input"
                    />
                </FormGroup>
                <FormGroup inline={true} label="Custom gap" disabled={!grid.isVisible}>
                    <Switch checked={grid.hasCustomGap} disabled={!grid.isVisible} onChange={ev => grid.setCustomGap(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={grid.hasCustomGap}>
                    <FormGroup inline={true} label="Gap" labelInfo="(X)" disabled={!grid.isVisible}>
                        <SafeNumericInput placeholder="Gap" min={0.001} stepSize={0.01} minorStepSize={0.001} majorStepSize={0.1} value={grid.gapX} disabled={!grid.isVisible} onValueChange={(value: number) => grid.setGapX(value)} />
                    </FormGroup>
                    <FormGroup inline={true} label="Gap" labelInfo="(Y)" disabled={!grid.isVisible}>
                        <SafeNumericInput placeholder="Gap" min={0.001} stepSize={0.01} minorStepSize={0.001} majorStepSize={0.1} value={grid.gapY} disabled={!grid.isVisible} onValueChange={(value: number) => grid.setGapY(value)} />
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Pixel grid">
                    <Switch checked={preferences.isPixelGridVisible} onChange={ev => preferences.setPreference(PreferenceKeys.PIXEL_GRID_VISIBLE, ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Pixel grid color">
                    <AutoColorPickerComponent color={preferences.pixelGridColor} presetColors={SWATCH_COLORS} setColor={color => preferences.setPreference(PreferenceKeys.PIXEL_GRID_COLOR, color)} disableAlpha={true} />
                </FormGroup>
            </div>
        );

        const borderPanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Visible">
                    <Switch checked={border.isVisible} onChange={ev => border.setVisible(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Custom color" disabled={!border.isVisible}>
                    <Switch checked={border.hasCustomColor} disabled={!border.isVisible} onChange={ev => border.setCustomColor(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={border.hasCustomColor}>
                    <FormGroup inline={true} label="Color" disabled={!border.isVisible}>
                        {border.isVisible && <AutoColorPickerComponent color={border.color} presetColors={SWATCH_COLORS} setColor={border.setColor} disableAlpha={true} />}
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Width" labelInfo="(px)" disabled={!border.isVisible}>
                    <SafeNumericInput placeholder="Width" min={0.5} max={30} value={border.width} stepSize={0.5} minorStepSize={0.1} majorStepSize={1} disabled={!border.isVisible} onValueChange={(value: number) => border.setWidth(value)} />
                </FormGroup>
            </div>
        );

        const axesPanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Visible" disabled={!isInterior} helperText={disabledIfExterior}>
                    <Switch checked={axes.isVisible} disabled={!isInterior} onChange={ev => axes.setVisible(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Custom color" disabled={!isInterior || !axes.isVisible}>
                    <Switch checked={axes.hasCustomColor} disabled={!isInterior || !axes.isVisible} onChange={ev => axes.setCustomColor(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={axes.hasCustomColor}>
                    <FormGroup inline={true} label="Color" disabled={!isInterior || !axes.isVisible} helperText={disabledIfExterior}>
                        {isInterior && axes.isVisible && <AutoColorPickerComponent color={axes.color} presetColors={SWATCH_COLORS} setColor={axes.setColor} disableAlpha={true} />}
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Width" labelInfo="(px)" disabled={!isInterior || !axes.isVisible} helperText={disabledIfExterior}>
                    <SafeNumericInput
                        placeholder="Width"
                        min={0.001}
                        value={axes.width}
                        stepSize={0.5}
                        minorStepSize={0.1}
                        majorStepSize={1}
                        disabled={!isInterior || !axes.isVisible}
                        onValueChange={(value: number) => axes.setWidth(value)}
                    />
                </FormGroup>
            </div>
        );

        const numbersPanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Visible">
                    <Switch checked={numbers.isVisible} onChange={ev => numbers.setVisible(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} className="font-group" label="Font" disabled={!numbers.isVisible}>
                    {fontSelect(numbers.isVisible, numbers.font, numbers.setFont)}
                    <SafeNumericInput min={7} max={96} placeholder="Font size" value={numbers.fontSize} disabled={!numbers.isVisible} onValueChange={(value: number) => numbers.setFontSize(value)} />
                </FormGroup>
                <FormGroup inline={true} label="Custom color" disabled={!numbers.isVisible}>
                    <Switch checked={numbers.hasCustomColor} disabled={!numbers.isVisible} onChange={ev => numbers.setCustomColor(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={numbers.hasCustomColor}>
                    <FormGroup inline={true} label="Color" disabled={!numbers.isVisible}>
                        {numbers.isVisible && <AutoColorPickerComponent color={numbers.color} presetColors={SWATCH_COLORS} setColor={numbers.setColor} disableAlpha={true} />}
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Custom format" disabled={!numbers.isValidWcs} helperText={disabledIfNoWcs}>
                    <Switch checked={numbers.hasCustomFormat} disabled={!numbers.isValidWcs} onChange={ev => numbers.setCustomFormat(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={numbers.hasCustomFormat && numbers.isValidWcs}>
                    <FormGroup inline={true} label="Format" labelInfo="(X)">
                        <HTMLSelect
                            options={[
                                {label: NUMBER_FORMAT_LABEL.get(NumberFormatType.HMS), value: NumberFormatType.HMS},
                                {label: NUMBER_FORMAT_LABEL.get(NumberFormatType.DMS), value: NumberFormatType.DMS},
                                {label: NUMBER_FORMAT_LABEL.get(NumberFormatType.Degrees), value: NumberFormatType.Degrees}
                            ]}
                            value={numbers.formatX}
                            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => numbers.setFormatX(event.currentTarget.value as NumberFormatType)}
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
                            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => numbers.setFormatY(event.currentTarget.value as NumberFormatType)}
                        />
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Custom precision" disabled={!numbers.isValidWcs} helperText={disabledIfNoWcs}>
                    <Switch checked={numbers.hasCustomPrecision} disabled={!numbers.isValidWcs} onChange={ev => numbers.setCustomPrecision(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={numbers.hasCustomPrecision && numbers.isValidWcs}>
                    <FormGroup inline={true} label="Precision">
                        <SafeNumericInput placeholder="Precision" min={0} value={numbers.precision} onValueChange={(value: number) => numbers.setPrecision(value)} />
                    </FormGroup>
                </Collapse>
            </div>
        );

        const labelsPanel = (
            <div className="panel-labels">
                <FormGroup inline={true} label="Visible">
                    <Switch checked={labels.isVisible} onChange={ev => labels.setVisible(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} className="font-group" label="Font" disabled={!labels.isVisible}>
                    {fontSelect(labels.isVisible, labels.font, labels.setFont)}
                    <SafeNumericInput min={7} max={96} placeholder="Font size" value={labels.fontSize} disabled={!labels.isVisible} onValueChange={(value: number) => labels.setFontSize(value)} />
                </FormGroup>
                <FormGroup inline={true} label="Show RA/Dec reference" disabled={!labels.isVisible}>
                    <Switch checked={labels.hasRaDecReference} disabled={!labels.isVisible} onChange={ev => labels.setRaDecReference(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Custom text" disabled={!labels.isVisible}>
                    <Switch checked={labels.hasCustomText} disabled={!labels.isVisible} onChange={ev => labels.setCustomText(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={labels.hasCustomText}>
                    <FormGroup inline={true} label="Label text (X)" disabled={!labels.isVisible}>
                        <InputGroup disabled={!labels.isVisible} value={labels.customLabelX} placeholder="Enter label text" onChange={ev => labels.setCustomLabelX(ev.currentTarget.value)} />
                    </FormGroup>
                    <FormGroup inline={true} label="Label text (Y)" disabled={!labels.isVisible}>
                        <InputGroup disabled={!labels.isVisible} value={labels.customLabelY} placeholder="Enter label text" onChange={ev => labels.setCustomLabelY(ev.currentTarget.value)} />
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Custom color" disabled={!labels.isVisible}>
                    <Switch checked={labels.hasCustomColor} disabled={!labels.isVisible} onChange={ev => labels.setCustomColor(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={labels.hasCustomColor}>
                    <FormGroup inline={true} label="Color" disabled={!labels.isVisible}>
                        {labels.isVisible && <AutoColorPickerComponent color={labels.color} presetColors={SWATCH_COLORS} setColor={labels.setColor} disableAlpha={true} />}
                    </FormGroup>
                </Collapse>
            </div>
        );

        const colorbarPanel = (
            <div className="panel-colorbar">
                <FormGroup inline={true} label="Visible">
                    <Switch checked={colorbar.isVisible} onChange={ev => colorbar.setVisible(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Interactive" disabled={!colorbar.isVisible}>
                    <Switch disabled={!colorbar.isVisible} checked={colorbar.isInteractive} onChange={ev => colorbar.setInteractive(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Position" disabled={!colorbar.isVisible}>
                    <HTMLSelect value={colorbar.position} disabled={!colorbar.isVisible} onChange={ev => colorbar.setPosition(ev.currentTarget.value as "right" | "top" | "bottom")}>
                        <option value={"right"}>Right</option>
                        <option value={"top"}>Top</option>
                        <option value={"bottom"}>Bottom</option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Width" labelInfo="(px)" disabled={!colorbar.isVisible}>
                    <SafeNumericInput
                        placeholder="Width"
                        min={1}
                        max={100}
                        value={colorbar.width}
                        stepSize={1}
                        minorStepSize={1}
                        majorStepSize={2}
                        disabled={!colorbar.isVisible}
                        onValueChange={(value: number) => colorbar.setWidth(value)}
                        intOnly={true}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Offset" labelInfo="(px)" disabled={!colorbar.isVisible}>
                    <SafeNumericInput
                        placeholder="Offset"
                        min={0}
                        max={100}
                        value={colorbar.offset}
                        stepSize={1}
                        minorStepSize={1}
                        majorStepSize={5}
                        disabled={!colorbar.isVisible}
                        onValueChange={(value: number) => colorbar.setOffset(value)}
                        intOnly={true}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Ticks density" labelInfo="(per 100px)" disabled={!colorbar.isVisible || (!colorbar.isTickVisible && !colorbar.isNumberVisible)}>
                    <SafeNumericInput
                        placeholder="Ticks density"
                        min={0.2}
                        max={20}
                        value={colorbar.tickDensity}
                        stepSize={0.2}
                        minorStepSize={0.1}
                        majorStepSize={1}
                        disabled={!colorbar.isVisible || (!colorbar.isTickVisible && !colorbar.isNumberVisible)}
                        onValueChange={(value: number) => colorbar.setTickDensity(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Custom color" disabled={!colorbar.isVisible}>
                    <Switch checked={colorbar.hasCustomColor} disabled={!colorbar.isVisible} onChange={ev => colorbar.setCustomColor(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={colorbar.hasCustomColor}>
                    <FormGroup inline={true} label="color" disabled={!colorbar.isVisible}>
                        {colorbar.isVisible && <AutoColorPickerComponent color={colorbar.color} presetColors={SWATCH_COLORS} setColor={colorbar.setColor} disableAlpha={true} />}
                    </FormGroup>
                </Collapse>
                <hr></hr>
                <FormGroup inline={true} label="Label" disabled={!colorbar.isVisible}>
                    <Switch checked={colorbar.isLabelVisible} disabled={!colorbar.isVisible} onChange={ev => colorbar.setLabelVisible(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Label rotation" disabled={!colorbar.isVisible || !colorbar.isLabelVisible || colorbar.position !== "right"}>
                    <HTMLSelect
                        value={colorbar.labelRotation}
                        disabled={!colorbar.isVisible || !colorbar.isLabelVisible || colorbar.position !== "right"}
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
                <FormGroup inline={true} className="font-group" label="Label font" disabled={!colorbar.isVisible || !colorbar.isLabelVisible}>
                    {fontSelect(colorbar.isVisible && colorbar.isLabelVisible, colorbar.labelFont, colorbar.setLabelFont)}
                    <SafeNumericInput min={7} max={96} value={colorbar.labelFontSize} disabled={!colorbar.isVisible || !colorbar.isLabelVisible} onValueChange={(value: number) => colorbar.setLabelFontSize(value)} />
                </FormGroup>
                <FormGroup inline={true} label="Label custom text" disabled={!colorbar.isVisible || !colorbar.isLabelVisible}>
                    <Switch checked={colorbar.hasLabelCustomText} disabled={!colorbar.isVisible || !colorbar.isLabelVisible} onChange={ev => colorbar.setLabelCustomText(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={colorbar.hasLabelCustomText}>
                    <FormGroup inline={true} label="Label text" disabled={!colorbar.isVisible || !colorbar.isLabelVisible}>
                        <InputGroup
                            disabled={!colorbar.isVisible || !colorbar.isLabelVisible}
                            value={appStore.activeFrame?.colorbarLabelCustomText}
                            placeholder="Enter label text"
                            onChange={ev => appStore.activeFrame?.setColorbarLabelCustomText(ev.currentTarget.value)}
                        />
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Label custom color" disabled={!colorbar.isVisible || !colorbar.isLabelVisible}>
                    <Switch checked={colorbar.hasLabelCustomColor} disabled={!colorbar.isVisible || !colorbar.isLabelVisible} onChange={ev => colorbar.setLabelCustomColor(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={colorbar.hasLabelCustomColor}>
                    <FormGroup inline={true} label="Label color" disabled={!colorbar.isVisible || !colorbar.isLabelVisible}>
                        {colorbar.isVisible && colorbar.isLabelVisible && <AutoColorPickerComponent color={colorbar.labelColor} presetColors={SWATCH_COLORS} setColor={colorbar.setLabelColor} disableAlpha={true} />}
                    </FormGroup>
                </Collapse>
                <hr></hr>
                <FormGroup inline={true} label="Numbers" disabled={!colorbar.isVisible}>
                    <Switch checked={colorbar.isNumberVisible} disabled={!colorbar.isVisible} onChange={ev => colorbar.setNumberVisible(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Numbers rotation" disabled={!colorbar.isVisible || !colorbar.isNumberVisible || colorbar.position !== "right"}>
                    <HTMLSelect value={colorbar.numberRotation} disabled={!colorbar.isVisible || !colorbar.isNumberVisible || colorbar.position !== "right"} onChange={ev => colorbar.setNumberRotation(Number(ev.currentTarget.value))}>
                        <option value={-90}>-90</option>
                        <option value={0}>0</option>
                        <option value={90}>90</option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} className="font-group" label="Numbers font" disabled={!colorbar.isVisible || !colorbar.isNumberVisible}>
                    {fontSelect(colorbar.isVisible && colorbar.isNumberVisible, colorbar.numberFont, colorbar.setNumberFont)}
                    <SafeNumericInput min={7} max={96} value={colorbar.numberFontSize} disabled={!colorbar.isVisible || !colorbar.isNumberVisible} onValueChange={(value: number) => colorbar.setNumberFontSize(value)} />
                </FormGroup>
                <FormGroup inline={true} label="Numbers custom precision" disabled={!colorbar.isVisible || !colorbar.isNumberVisible}>
                    <Switch checked={colorbar.hasNumberCustomPrecision} disabled={!colorbar.isVisible || !colorbar.isNumberVisible} onChange={ev => colorbar.setNumberCustomPrecision(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={colorbar.hasNumberCustomPrecision}>
                    <FormGroup inline={true} label="Numbers precision" disabled={!colorbar.isVisible || !colorbar.isNumberVisible}>
                        <SafeNumericInput
                            min={0}
                            max={ColorbarStore.PRECISION_MAX}
                            stepSize={1}
                            value={colorbar.numberPrecision}
                            disabled={!colorbar.isVisible || !colorbar.isNumberVisible}
                            onValueChange={(value: number) => colorbar.setNumberPrecision(value)}
                            intOnly={true}
                        />
                    </FormGroup>
                </Collapse>
                <FormGroup inline={true} label="Numbers custom color" disabled={!colorbar.isVisible || !colorbar.isNumberVisible}>
                    <Switch checked={colorbar.hasNumberCustomColor} disabled={!colorbar.isVisible || !colorbar.isNumberVisible} onChange={ev => colorbar.setNumberCustomColor(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={colorbar.hasNumberCustomColor}>
                    <FormGroup inline={true} label="Numbers color" disabled={!colorbar.isVisible || !colorbar.isNumberVisible}>
                        {colorbar.isVisible && colorbar.isNumberVisible && <AutoColorPickerComponent color={colorbar.numberColor} presetColors={SWATCH_COLORS} setColor={colorbar.setNumberColor} disableAlpha={true} />}
                    </FormGroup>
                </Collapse>
                <hr></hr>
                <FormGroup inline={true} label="Ticks" disabled={!colorbar.isVisible}>
                    <Switch checked={colorbar.isTickVisible} disabled={!colorbar.isVisible} onChange={ev => colorbar.setTickVisible(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Ticks length" labelInfo="(px)" disabled={!colorbar.isVisible || !colorbar.isTickVisible}>
                    <SafeNumericInput
                        placeholder="Ticks length"
                        min={0.5}
                        max={colorbar.width}
                        value={colorbar.tickLen}
                        stepSize={0.5}
                        minorStepSize={0.1}
                        majorStepSize={1}
                        disabled={!colorbar.isVisible || !colorbar.isTickVisible}
                        onValueChange={(value: number) => colorbar.setTickLen(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Ticks width" labelInfo="(px)" disabled={!colorbar.isVisible || !colorbar.isTickVisible}>
                    <SafeNumericInput
                        placeholder="Ticks width"
                        min={0.5}
                        max={30}
                        value={colorbar.tickWidth}
                        stepSize={0.5}
                        minorStepSize={0.1}
                        majorStepSize={1}
                        disabled={!colorbar.isVisible || !colorbar.isTickVisible}
                        onValueChange={(value: number) => colorbar.setTickWidth(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Ticks custom color" disabled={!colorbar.isVisible || !colorbar.isTickVisible}>
                    <Switch checked={colorbar.hasTickCustomColor} disabled={!colorbar.isVisible || !colorbar.isTickVisible} onChange={ev => colorbar.setTickCustomColor(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={colorbar.hasTickCustomColor}>
                    <FormGroup inline={true} label="Ticks color" disabled={!colorbar.isVisible || !colorbar.isTickVisible}>
                        {colorbar.isVisible && colorbar.isTickVisible && <AutoColorPickerComponent color={colorbar.tickColor} presetColors={SWATCH_COLORS} setColor={colorbar.setTickColor} disableAlpha={true} />}
                    </FormGroup>
                </Collapse>
                <hr></hr>
                <FormGroup inline={true} label="Border" disabled={!colorbar.isVisible}>
                    <Switch checked={colorbar.isBorderVisible} disabled={!colorbar.isVisible} onChange={ev => colorbar.setBorderVisible(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Border width" labelInfo="(px)" disabled={!colorbar.isVisible || !colorbar.isBorderVisible}>
                    <SafeNumericInput
                        placeholder="Border width"
                        min={0.5}
                        max={30}
                        value={colorbar.borderWidth}
                        stepSize={0.5}
                        minorStepSize={0.1}
                        majorStepSize={1}
                        disabled={!colorbar.isVisible || !colorbar.isBorderVisible}
                        onValueChange={(value: number) => colorbar.setBorderWidth(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Border custom color" disabled={!colorbar.isVisible || !colorbar.isBorderVisible}>
                    <Switch checked={colorbar.hasBorderCustomColor} disabled={!colorbar.isVisible || !colorbar.isBorderVisible} onChange={ev => colorbar.setBorderCustomColor(ev.currentTarget.checked)} />
                </FormGroup>
                <Collapse isOpen={colorbar.hasBorderCustomColor}>
                    <FormGroup inline={true} label="Border color" disabled={!colorbar.isVisible || !colorbar.isBorderVisible}>
                        {colorbar.isVisible && colorbar.isBorderVisible && <AutoColorPickerComponent color={colorbar.borderColor} presetColors={SWATCH_COLORS} setColor={colorbar.setBorderColor} disableAlpha={true} />}
                    </FormGroup>
                </Collapse>
            </div>
        );

        const beamPanel =
            beam.isSelectedFrameValid && beamSettings ? (
                <div className="panel-container">
                    <FormGroup inline={true} label="Image">
                        <HTMLSelect options={appStore.frameNames} value={beam.selectedFileId} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => beam.setSelectedFrame(parseInt(event.currentTarget.value))} />
                    </FormGroup>
                    <FormGroup inline={true} label="Visible">
                        <Switch checked={beamSettings.isVisible} onChange={ev => beamSettings.setVisible(ev.currentTarget.checked)} />
                    </FormGroup>
                    <FormGroup inline={true} label="Color">
                        <AutoColorPickerComponent color={beamSettings.color} presetColors={SWATCH_COLORS} setColor={beamSettings.setColor} disableAlpha={true} />
                    </FormGroup>
                    <FormGroup inline={true} label="Type">
                        <HTMLSelect
                            options={Object.keys(BeamType).map(key => ({label: key, value: BeamType[key]}))}
                            value={beamSettings.type}
                            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => beamSettings.setType(event.currentTarget.value as BeamType)}
                        />
                    </FormGroup>
                    <FormGroup inline={true} label="Width" labelInfo="(px)">
                        <SafeNumericInput placeholder="Width" min={0.5} max={10} value={beamSettings.width} stepSize={0.5} minorStepSize={0.1} majorStepSize={1} onValueChange={(value: number) => beamSettings.setWidth(value)} />
                    </FormGroup>
                    <FormGroup inline={true} label="Position (X)" labelInfo="(px)">
                        <SafeNumericInput
                            placeholder="Position (X)"
                            min={0}
                            max={AppStore.Instance.activeFrame?.renderWidth}
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
                            max={AppStore.Instance.activeFrame?.renderHeight}
                            value={beamSettings.shiftY}
                            stepSize={5}
                            minorStepSize={1}
                            majorStepSize={10}
                            onValueChange={(value: number) => beamSettings.setShiftY(value)}
                        />
                    </FormGroup>
                </div>
            ) : null;

        const spectralPanel =
            isPVImage && frame ? (
                <div className="panel-container">
                    <p>For spatial-spectral image</p>
                    <Divider />
                    <p>Spectral axis</p>
                    <SpectralSettingsComponent frame={frame} onSpectralCoordinateChange={frame.setSpectralCoordinate} onSpectralSystemChange={frame.setSpectralSystem} disable={!isPVImage} disableChannelOption={true} />
                </div>
            ) : null;

        const className = classNames("image-view-settings", {[Classes.DARK]: appStore.isDarkTheme});

        return (
            <div className={className}>
                <Tabs id="imageViewSettingsTabs" vertical={true} selectedTabId={this.selectedTab} onChange={this.setSelectedTab}>
                    <Tab id={ImageViewSettingsPanelTabs.PAN_AND_ZOOM} title={ImageViewSettingsPanelTabs.PAN_AND_ZOOM} panel={<ScrollShadow>{panAndZoomPanel}</ScrollShadow>} />
                    <Tab id={ImageViewSettingsPanelTabs.GLOBAL} title={ImageViewSettingsPanelTabs.GLOBAL} panel={<ScrollShadow>{globalPanel}</ScrollShadow>} />
                    <Tab id={ImageViewSettingsPanelTabs.TITLE} title={ImageViewSettingsPanelTabs.TITLE} panel={<ScrollShadow>{titlePanel}</ScrollShadow>} />
                    <Tab id={ImageViewSettingsPanelTabs.TICKS} title={ImageViewSettingsPanelTabs.TICKS} panel={<ScrollShadow>{ticksPanel}</ScrollShadow>} />
                    <Tab id={ImageViewSettingsPanelTabs.GRIDS} title={ImageViewSettingsPanelTabs.GRIDS} panel={<ScrollShadow>{gridPanel}</ScrollShadow>} data-testid="image-view-settings-grid-tab-title" />
                    <Tab id={ImageViewSettingsPanelTabs.BORDER} title={ImageViewSettingsPanelTabs.BORDER} panel={<ScrollShadow>{borderPanel}</ScrollShadow>} />
                    <Tab id={ImageViewSettingsPanelTabs.AXES} title={ImageViewSettingsPanelTabs.AXES} panel={<ScrollShadow>{axesPanel}</ScrollShadow>} />
                    <Tab id={ImageViewSettingsPanelTabs.NUMBERS} title={ImageViewSettingsPanelTabs.NUMBERS} panel={<ScrollShadow>{numbersPanel}</ScrollShadow>} />
                    <Tab id={ImageViewSettingsPanelTabs.LABELS} title={ImageViewSettingsPanelTabs.LABELS} panel={<ScrollShadow>{labelsPanel}</ScrollShadow>} />
                    <Tab id={ImageViewSettingsPanelTabs.COLORBAR} title={ImageViewSettingsPanelTabs.COLORBAR} panel={<ScrollShadow>{colorbarPanel}</ScrollShadow>} />
                    <Tab id={ImageViewSettingsPanelTabs.BEAM} title={ImageViewSettingsPanelTabs.BEAM} panel={<ScrollShadow>{beamPanel}</ScrollShadow>} disabled={appStore.frameNum <= 0} />
                    <Tab id={ImageViewSettingsPanelTabs.CONVERSION} title={ImageViewSettingsPanelTabs.CONVERSION} panel={<ScrollShadow>{spectralPanel}</ScrollShadow>} disabled={!isPVImage} />
                </Tabs>
            </div>
        );
    }
}
