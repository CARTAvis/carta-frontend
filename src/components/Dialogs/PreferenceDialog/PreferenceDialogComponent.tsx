import * as React from "react";
import * as _ from "lodash";
import {observable} from "mobx";
import {observer} from "mobx-react";
import {
    Button, IDialogProps, Intent, Tab, Tabs,
    FormGroup, TabId, MenuItem, Switch, RadioGroup,
    Radio, HTMLSelect, AnchorButton, NumericInput, Tooltip,
    Position, Checkbox
} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import {ColorResult} from "react-color";
import {CARTA} from "carta-protobuf";
import {DraggableDialogComponent} from "components/Dialogs";
import {ScalingSelectComponent} from "components/Shared/ScalingSelectComponent/ScalingSelectComponent";
import {ColorComponent} from "components/Dialogs/OverlaySettings/ColorComponent";
import {ColorPickerComponent, ColormapComponent} from "components/Shared";
import {Theme, CursorPosition, Zoom, ZoomPoint, WCSType, RegionCreationMode, CompressionQuality, TileCache, Event} from "models";
import {AppStore, BeamType, ContourGeneratorType, FrameScaling, PreferenceKeys, RegionStore, RenderConfigStore, HelpType} from "stores";
import {hexStringToRgba, SWATCH_COLORS} from "utilities";
import "./PreferenceDialogComponent.css";

enum TABS {
    GLOBAL,
    RENDER_CONFIG,
    CONTOUR_CONFIG,
    OVERLAY_CONFIG,
    REGION,
    PERFORMANCE,
    LOG_EVENT
}

const PercentileSelect = Select.ofType<string>();

@observer
export class PreferenceDialogComponent extends React.Component<{ appStore: AppStore }> {
    @observable selectedTab: TabId = TABS.GLOBAL;

    private renderPercentileSelectItem = (percentile: string, {handleClick, modifiers, query}) => {
        return <MenuItem text={percentile + "%"} onClick={handleClick} key={percentile}/>;
    };

    private handleImageCompressionQualityChange = _.throttle((value: number) => {
        this.props.appStore.preferenceStore.setPreference(PreferenceKeys.PERFORMANCE_IMAGE_COMPRESSION_QUALITY, value);
    }, 100);

    private handleAnimationCompressionQualityChange = _.throttle((value: number) => {
        this.props.appStore.preferenceStore.setPreference(PreferenceKeys.PERFORMANCE_ANIMATION_COMPRESSION_QUALITY, value);
    }, 100);

    private handleGPUTileCacheChange = _.throttle((value: number) => {
        this.props.appStore.preferenceStore.setPreference(PreferenceKeys.PERFORMANCE_GPU_TILE_CACHE, value);
    }, 100);

    private handleSystemTileCacheChange = _.throttle((value: number) => {
        this.props.appStore.preferenceStore.setPreference(PreferenceKeys.PERFORMANCE_SYSTEM_TILE_CACHE, value);
    }, 100);

    private reset = () => {
        const preference = this.props.appStore.preferenceStore;
        switch (this.selectedTab) {
            case TABS.RENDER_CONFIG:
                preference.resetRenderConfigSettings();
                break;
            case TABS.CONTOUR_CONFIG:
                preference.resetContourConfigSettings();
                break;
            case TABS.OVERLAY_CONFIG:
                preference.resetOverlayConfigSettings();
                break;
            case TABS.REGION:
                preference.resetRegionSettings();
                break;
            case TABS.PERFORMANCE:
                preference.resetPerformanceSettings();
                break;
            case TABS.LOG_EVENT:
                preference.resetLogEventSettings();
                break;
            case TABS.GLOBAL:
            default:
                preference.resetGlobalSettings();
                break;
        }
    };

    public render() {
        const appStore = this.props.appStore;
        const preference = appStore.preferenceStore;
        const layoutStore = appStore.layoutStore;

        const globalPanel = (
            <React.Fragment>
                <FormGroup inline={true} label="Theme">
                    <RadioGroup
                        selectedValue={preference.theme}
                        onChange={(ev) => {
                            ev.currentTarget.value === Theme.LIGHT ? appStore.setLightTheme() : appStore.setDarkTheme();
                        }}
                        inline={true}
                    >
                        <Radio label="Light" value={Theme.LIGHT}/>
                        <Radio label="Dark" value={Theme.DARK}/>
                    </RadioGroup>
                </FormGroup>
                <FormGroup inline={true} label="Auto-launch File Browser">
                    <Switch checked={preference.autoLaunch} onChange={(ev) => preference.setPreference(PreferenceKeys.GLOBAL_AUTOLAUNCH, ev.currentTarget.checked)}/>
                </FormGroup>
                <FormGroup inline={true} label="Initial Layout">
                    <HTMLSelect value={preference.layout} onChange={(ev) => preference.setPreference(PreferenceKeys.GLOBAL_LAYOUT, ev.currentTarget.value)}>
                        {layoutStore.orderedLayouts.map((layout) => <option key={layout} value={layout}>{layout}</option>)}
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Initial Cursor Position">
                    <RadioGroup
                        selectedValue={preference.cursorPosition}
                        onChange={(ev) => preference.setPreference(PreferenceKeys.GLOBAL_CURSOR_POSITION, ev.currentTarget.value)}
                        inline={true}
                    >
                        <Radio label="Fixed" value={CursorPosition.FIXED}/>
                        <Radio label="Tracking" value={CursorPosition.TRACKING}/>
                    </RadioGroup>
                </FormGroup>
                <FormGroup inline={true} label="Initial Zoom Level">
                    <RadioGroup
                        selectedValue={preference.zoomMode}
                        onChange={(ev) => preference.setPreference(PreferenceKeys.GLOBAL_ZOOM_MODE, ev.currentTarget.value)}
                        inline={true}
                    >
                        <Radio label="Zoom to fit" value={Zoom.FIT}/>
                        <Radio label="Zoom to 1.0x" value={Zoom.RAW}/>
                    </RadioGroup>
                </FormGroup>
                <FormGroup inline={true} label="Zoom to">
                    <RadioGroup
                        selectedValue={preference.zoomPoint}
                        onChange={(ev) => preference.setPreference(PreferenceKeys.GLOBAL_ZOOM_POINT, ev.currentTarget.value)}
                        inline={true}
                    >
                        <Radio label="Cursor" value={ZoomPoint.CURSOR}/>
                        <Radio label="Current Center" value={ZoomPoint.CENTER}/>
                    </RadioGroup>
                </FormGroup>
                <FormGroup inline={true} label="Enable drag-to-pan">
                    <Switch checked={preference.dragPanning} onChange={(ev) => preference.setPreference(PreferenceKeys.GLOBAL_DRAG_PANNING, ev.currentTarget.checked)}/>
                </FormGroup>
            </React.Fragment>
        );

        const renderConfigPanel = (
            <React.Fragment>
                <FormGroup inline={true} label="Default Scaling">
                    <ScalingSelectComponent selectedItem={preference.scaling} onItemSelect={(selected) => preference.setPreference(PreferenceKeys.RENDER_CONFIG_SCALING, selected)}/>
                </FormGroup>
                <FormGroup inline={true} label="Default Color Map">
                    <ColormapComponent
                        inverted={false}
                        selectedItem={preference.colormap}
                        onItemSelect={(selected) => preference.setPreference(PreferenceKeys.RENDER_CONFIG_COLORMAP, selected)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Default Percentile Ranks">
                    <PercentileSelect
                        activeItem={preference.percentile.toString(10)}
                        onItemSelect={(selected) => preference.setPreference(PreferenceKeys.RENDER_CONFIG_PERCENTILE, Number(selected))}
                        popoverProps={{minimal: true, position: "auto"}}
                        filterable={false}
                        items={RenderConfigStore.PERCENTILE_RANKS.map(String)}
                        itemRenderer={this.renderPercentileSelectItem}
                    >
                        <Button text={preference.percentile.toString(10) + "%"} rightIcon="double-caret-vertical" alignText={"right"}/>
                    </PercentileSelect>
                </FormGroup>
                {(preference.scaling === FrameScaling.LOG || preference.scaling === FrameScaling.POWER) &&
                <FormGroup label={"Alpha"} inline={true}>
                    <NumericInput
                        buttonPosition={"none"}
                        value={preference.scalingAlpha}
                        onValueChange={(value: number) => {
                            if (isFinite(value)) {
                                preference.setPreference(PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA, value);
                            }
                        }}
                    />
                </FormGroup>
                }
                {preference.scaling === FrameScaling.GAMMA &&
                <FormGroup label={"Gamma"} inline={true}>
                    <NumericInput
                        min={RenderConfigStore.GAMMA_MIN}
                        max={RenderConfigStore.GAMMA_MAX}
                        stepSize={0.1}
                        minorStepSize={0.01}
                        majorStepSize={0.5}
                        value={preference.scalingGamma}
                        onValueChange={(value: number) => {
                            if (isFinite(value)) {
                                preference.setPreference(PreferenceKeys.RENDER_CONFIG_SCALING_GAMMA, value);
                            }
                        }}
                    />
                </FormGroup>
                }
                <FormGroup inline={true} label="NaN Color">
                    <ColorPickerComponent
                        color={hexStringToRgba(preference.nanColorHex, preference.nanAlpha)}
                        presetColors={[...SWATCH_COLORS, "transparent"]}
                        setColor={(color: ColorResult) => {
                            preference.setPreference(PreferenceKeys.RENDER_CONFIG_NAN_COLOR_HEX, color.hex === "transparent" ? "#000000" : color.hex);
                            preference.setPreference(PreferenceKeys.RENDER_CONFIG_NAN_ALPHA, color.rgb.a);
                        }}
                        disableAlpha={false}
                        darkTheme={appStore.darkTheme}
                    />
                </FormGroup>
            </React.Fragment>
        );

        const contourConfigPanel = (
            <React.Fragment>
                <FormGroup inline={true} label="Generator Type">
                    <HTMLSelect
                        value={preference.contourGeneratorType}
                        options={Object.keys(ContourGeneratorType).map((key) => ({label: ContourGeneratorType[key], value: ContourGeneratorType[key]}))}
                        onChange={(ev) => preference.setPreference(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_GENERATOR_TYPE, ev.currentTarget.value as ContourGeneratorType)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Smoothing Mode">
                    <HTMLSelect
                        value={preference.contourSmoothingMode}
                        onChange={(ev) => preference.setPreference(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_SMOOTHING_MODE, Number(ev.currentTarget.value))}
                    >
                        <option key={CARTA.SmoothingMode.NoSmoothing} value={CARTA.SmoothingMode.NoSmoothing}>No Smoothing</option>
                        <option key={CARTA.SmoothingMode.BlockAverage} value={CARTA.SmoothingMode.BlockAverage}>Block</option>
                        <option key={CARTA.SmoothingMode.GaussianBlur} value={CARTA.SmoothingMode.GaussianBlur}>Gaussian</option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Default Smoothing Factor">
                    <NumericInput
                        placeholder="Default Smoothing Factor"
                        min={1}
                        max={33}
                        value={preference.contourSmoothingFactor}
                        majorStepSize={1}
                        stepSize={1}
                        onValueChange={value => preference.setPreference(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_SMOOTHING_FACTOR, value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Default Contour Levels">
                    <NumericInput
                        placeholder="Default Contour Levels"
                        min={1}
                        max={15}
                        value={preference.contourNumLevels}
                        majorStepSize={1}
                        stepSize={1}
                        onValueChange={value => preference.setPreference(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_NUM_LEVELS, value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Thickness">
                    <NumericInput
                        placeholder="Thickness"
                        min={0.5}
                        max={10}
                        value={preference.contourThickness}
                        majorStepSize={0.5}
                        stepSize={0.5}
                        onValueChange={value => preference.setPreference(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_THICKNESS, value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Default Color Mode">
                    <HTMLSelect value={preference.contourColormapEnabled ? 1 : 0} onChange={(ev) => preference.setPreference(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLORMAP_ENABLED, parseInt(ev.currentTarget.value) > 0)}>
                        <option key={0} value={0}>Constant Color</option>
                        <option key={1} value={1}>Color-mapped</option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Default Color Map">
                    <ColormapComponent
                        inverted={false}
                        selectedItem={preference.contourColormap}
                        onItemSelect={(selected) => preference.setPreference(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLORMAP, selected)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Default Color">
                    <ColorPickerComponent
                        color={preference.contourColor}
                        presetColors={SWATCH_COLORS}
                        setColor={(color: ColorResult) => preference.setPreference(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLOR, color.hex)}
                        disableAlpha={true}
                        darkTheme={appStore.darkTheme}
                    />
                </FormGroup>
            </React.Fragment>
        );

        const overlayConfigPanel = (
            <React.Fragment>
                <FormGroup inline={true} label="AST Color">
                    <ColorComponent
                        selectedItem={preference.astColor}
                        onItemSelect={(selected) => preference.setPreference(PreferenceKeys.WCS_OVERLAY_AST_COLOR, selected)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="AST Grid Visible">
                    <Switch
                        checked={preference.astGridVisible}
                        onChange={(ev) => preference.setPreference(PreferenceKeys.WCS_OVERLAY_AST_GRID_VISIBLE, ev.currentTarget.checked)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="AST Label Visible">
                    <Switch
                        checked={preference.astLabelsVisible}
                        onChange={(ev) => preference.setPreference(PreferenceKeys.WCS_OVERLAY_AST_LABELS_VISIBLE, ev.currentTarget.checked)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="WCS Format">
                    <HTMLSelect
                        options={[WCSType.AUTOMATIC, WCSType.DEGREES, WCSType.SEXAGESIMAL]}
                        value={preference.wcsType}
                        onChange={(event: React.FormEvent<HTMLSelectElement>) => preference.setPreference(PreferenceKeys.WCS_OVERLAY_WCS_TYPE, event.currentTarget.value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Beam Visible">
                    <Switch
                        checked={preference.beamVisible}
                        onChange={(ev) => preference.setPreference(PreferenceKeys.WCS_OVERLAY_BEAM_VISIBLE, ev.currentTarget.checked)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Beam Color">
                    <ColorPickerComponent
                        color={hexStringToRgba(preference.beamColor)}
                        presetColors={SWATCH_COLORS}
                        setColor={(color: ColorResult) => preference.setPreference(PreferenceKeys.WCS_OVERLAY_BEAM_COLOR, color.hex)}
                        disableAlpha={true}
                        darkTheme={this.props.appStore.darkTheme}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Beam Type">
                    <HTMLSelect
                        options={Object.keys(BeamType).map((key) => ({label: key, value: BeamType[key]}))}
                        value={preference.beamType}
                        onChange={(event: React.FormEvent<HTMLSelectElement>) => preference.setPreference(PreferenceKeys.WCS_OVERLAY_BEAM_TYPE, event.currentTarget.value as BeamType)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Beam Width" labelInfo="(px)">
                    <NumericInput
                        placeholder="Beam Width"
                        min={0.5}
                        max={10}
                        value={preference.beamWidth}
                        stepSize={0.5}
                        minorStepSize={0.1}
                        majorStepSize={1}
                        onValueChange={(value: number) => preference.setPreference(PreferenceKeys.WCS_OVERLAY_BEAM_WIDTH, value)}
                    />
                </FormGroup>
            </React.Fragment>
        );

        let regionTypes = [];
        RegionStore.AVAILABLE_REGION_TYPES.forEach((name, regionType) => {
            regionTypes.push(<option key={regionType} value={regionType}>{name}</option>);
        });

        const regionSettingsPanel = (
            <React.Fragment>
                <FormGroup inline={true} label="Color">
                    <ColorPickerComponent
                        color={preference.regionColor}
                        presetColors={SWATCH_COLORS}
                        setColor={(color: ColorResult) => preference.setPreference(PreferenceKeys.REGION_COLOR, color.hex)}
                        disableAlpha={true}
                        darkTheme={appStore.darkTheme}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Line Width" labelInfo="(px)">
                    <NumericInput
                        placeholder="Line Width"
                        min={RegionStore.MIN_LINE_WIDTH}
                        max={RegionStore.MAX_LINE_WIDTH}
                        value={preference.regionLineWidth}
                        stepSize={0.5}
                        onValueChange={(value: number) => preference.setPreference(PreferenceKeys.REGION_LINE_WIDTH, Math.max(RegionStore.MIN_LINE_WIDTH, Math.min(RegionStore.MAX_LINE_WIDTH, value)))}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Dash Length" labelInfo="(px)">
                    <NumericInput
                        placeholder="Dash Length"
                        min={0}
                        max={RegionStore.MAX_DASH_LENGTH}
                        value={preference.regionDashLength}
                        stepSize={1}
                        onValueChange={(value: number) => preference.setPreference(PreferenceKeys.REGION_DASH_LENGTH, Math.max(0, Math.min(RegionStore.MAX_DASH_LENGTH, value)))}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Region Type">
                    <HTMLSelect value={preference.regionType} onChange={(ev) => preference.setPreference(PreferenceKeys.REGION_TYPE, Number(ev.currentTarget.value))}>
                        {regionTypes}
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Creation Mode">
                    <RadioGroup
                        selectedValue={preference.regionCreationMode}
                        onChange={(ev) => preference.setPreference(PreferenceKeys.REGION_CREATION_MODE, ev.currentTarget.value)}
                    >
                        <Radio label="Center to corner" value={RegionCreationMode.CENTER}/>
                        <Radio label="Corner to corner" value={RegionCreationMode.CORNER}/>
                    </RadioGroup>
                </FormGroup>
            </React.Fragment>
        );

        const performancePanel = (
            <React.Fragment>
                <FormGroup inline={true} label="Low bandwidth mode">
                    <Switch checked={preference.lowBandwidthMode} onChange={(ev) => preference.setPreference(PreferenceKeys.PERFORMANCE_LOW_BAND_WIDTH_MODE, ev.currentTarget.checked)}/>
                </FormGroup>
                <FormGroup inline={true} label="Compression Quality" labelInfo={"(Images)"}>
                    <NumericInput
                        placeholder="Compression Quality"
                        min={CompressionQuality.IMAGE_MIN}
                        max={CompressionQuality.IMAGE_MAX}
                        value={preference.imageCompressionQuality}
                        stepSize={CompressionQuality.IMAGE_STEP}
                        onValueChange={this.handleImageCompressionQualityChange}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Compression Quality" labelInfo={"(Animation)"}>
                    <NumericInput
                        placeholder="Compression Quality"
                        min={CompressionQuality.ANIMATION_MIN}
                        max={CompressionQuality.ANIMATION_MAX}
                        value={preference.animationCompressionQuality}
                        stepSize={CompressionQuality.ANIMATION_STEP}
                        onValueChange={this.handleAnimationCompressionQualityChange}
                    />
                </FormGroup>
                <FormGroup inline={true} label="GPU Tile Cache Size">
                    <NumericInput
                        placeholder="GPU Tile Cache Size"
                        min={TileCache.GPU_MIN}
                        max={TileCache.GPU_MAX}
                        value={preference.gpuTileCache}
                        majorStepSize={TileCache.GPU_STEP}
                        stepSize={TileCache.GPU_STEP}
                        onValueChange={this.handleGPUTileCacheChange}
                    />
                </FormGroup>
                <FormGroup inline={true} label="System Tile Cache Size">
                    <NumericInput
                        placeholder="System Tile Cache Size"
                        min={TileCache.SYSTEM_MIN}
                        max={TileCache.SYSTEM_MAX}
                        value={preference.systemTileCache}
                        majorStepSize={TileCache.SYSTEM_STEP}
                        stepSize={TileCache.SYSTEM_STEP}
                        onValueChange={this.handleSystemTileCacheChange}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Contour Rounding Factor">
                    <NumericInput
                        placeholder="Contour Rounding Factor"
                        min={1}
                        max={32}
                        value={preference.contourDecimation}
                        majorStepSize={1}
                        stepSize={1}
                        onValueChange={value => preference.setPreference(PreferenceKeys.PERFORMANCE_CONTOUR_DECIMATION, value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Contour Compression Level">
                    <NumericInput
                        placeholder="Contour Compression Level"
                        min={0}
                        max={19}
                        value={preference.contourCompressionLevel}
                        majorStepSize={1}
                        stepSize={1}
                        onValueChange={value => preference.setPreference(PreferenceKeys.PERFORMANCE_CONTOUR_COMPRESSION_LEVEL, value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Contour Chunk Size">
                    <HTMLSelect value={preference.contourChunkSize} onChange={(ev) => preference.setPreference(PreferenceKeys.PERFORMANCE_CONTOUR_CHUNK_SIZE, parseInt(ev.currentTarget.value))}>
                        <option key={0} value={25000}>25K</option>
                        <option key={1} value={50000}>50K</option>
                        <option key={2} value={100000}>100K</option>
                        <option key={3} value={250000}>250K</option>
                        <option key={4} value={500000}>500K</option>
                        <option key={5} value={1000000}>1M</option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Contour Control Map Resolution">
                    <HTMLSelect value={preference.contourControlMapWidth} onChange={(ev) => preference.setPreference(PreferenceKeys.PERFORMANCE_CONTOUR_CONTROL_MAP_WIDTH, parseInt(ev.currentTarget.value))}>
                        <option key={0} value={128}>128&times;128 (128 KB)</option>
                        <option key={1} value={256}>256&times;256 (512 KB)</option>
                        <option key={2} value={512}>512&times;512 (2 MB)</option>
                        <option key={3} value={1024}>1024&times;1024 (8 MB)</option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Stream image tiles while zooming">
                    <Switch checked={preference.streamContoursWhileZooming} onChange={(ev) => preference.setPreference(PreferenceKeys.PERFORMANCE_STREAM_CONTOURS_WHILE_ZOOMING, ev.currentTarget.checked)}/>
                </FormGroup>
                <FormGroup inline={true} label="Stop animation playback in">
                    <HTMLSelect value={preference.stopAnimationPlaybackMinutes} onChange={(ev) => preference.setPreference(PreferenceKeys.PERFORMANCE_STOP_ANIMATION_PLAYBACK_MINUTES, parseInt(ev.currentTarget.value))}>
                        <option key={0} value={5}>5 minutes</option>
                        <option key={1} value={10}>10 minutes</option>
                        <option key={2} value={15}>15 minutes</option>
                        <option key={3} value={20}>20 minutes</option>
                        <option key={4} value={30}>30 minutes</option>
                    </HTMLSelect>
                </FormGroup>
            </React.Fragment>
        );

        const logEventsPanel = (
            <React.Fragment>
                <FormGroup inline={false} label="Enable logged event type" className="log-event-list">
                    {Event.EVENT_TYPES.map((eventType) =>
                        <Checkbox
                            className="log-event-checkbox"
                            key={eventType}
                            checked={preference.isEventLoggingEnabled(eventType)}
                            label={Event.getEventNameFromType(eventType)}
                            onChange={() => preference.setPreference(PreferenceKeys.LOG_EVENT, eventType)}
                        />
                    )}
                </FormGroup>
            </React.Fragment>
        );

        let className = "preference-dialog";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        const dialogProps: IDialogProps = {
            icon: "cog",
            backdropClassName: "minimal-dialog-backdrop",
            className: className,
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.preferenceDialogVisible,
            onClose: appStore.dialogStore.hidePreferenceDialog,
            title: "Preferences",
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} appStore={appStore} helpType={HelpType.PREFERENCES} minWidth={450} minHeight={300} defaultWidth={775} defaultHeight={500} enableResizing={true}>
                <div className="bp3-dialog-body">
                    <Tabs
                        id="preferenceTabs"
                        vertical={true}
                        selectedTabId={this.selectedTab}
                        onChange={(tabId) => this.selectedTab = tabId}
                    >
                        <Tab id={TABS.GLOBAL} title="Global" panel={globalPanel}/>
                        <Tab id={TABS.RENDER_CONFIG} title="Render Configuration" panel={renderConfigPanel}/>
                        <Tab id={TABS.CONTOUR_CONFIG} title="Contour Configuration" panel={contourConfigPanel}/>
                        <Tab id={TABS.OVERLAY_CONFIG} title="Overlay Configuration" panel={overlayConfigPanel}/>
                        <Tab id={TABS.REGION} title="Region" panel={regionSettingsPanel}/>
                        <Tab id={TABS.PERFORMANCE} title="Performance" panel={performancePanel}/>
                        <Tab id={TABS.LOG_EVENT} title="Log Events" panel={logEventsPanel}/>
                    </Tabs>
                </div>
                <div className="bp3-dialog-footer">
                    <div className="bp3-dialog-footer-actions">
                        <Tooltip content="Apply to current tab only." position={Position.TOP}>
                            <AnchorButton intent={Intent.WARNING} icon={"refresh"} onClick={this.reset} text="Restore defaults"/>
                        </Tooltip>
                        <Button intent={Intent.NONE} onClick={appStore.dialogStore.hidePreferenceDialog} text="Close"/>
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}
