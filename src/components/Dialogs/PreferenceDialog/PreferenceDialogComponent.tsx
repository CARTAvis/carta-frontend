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
import {ScalingComponent} from "components/RenderConfig/ColormapConfigComponent/ScalingComponent";
import {ColormapComponent} from "components/RenderConfig/ColormapConfigComponent/ColormapComponent";
import {ColorComponent} from "components/Dialogs/OverlaySettings/ColorComponent";
import {ColorPickerComponent} from "components/Shared";
import {Theme, CursorPosition, Zoom, WCSType, RegionCreationMode, CompressionQuality, TileCache, Event} from "models";
import {AppStore, FrameScaling, PreferenceKeys, RegionStore, RenderConfigStore} from "stores";
import {hexStringToRgba, parseBoolean} from "utilities";
import "./PreferenceDialogComponent.css";

enum TABS {
    GLOBAL,
    RENDER_CONFIG,
    CONTOUR_CONFIG,
    WCS_OVERLAY,
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
            case TABS.WCS_OVERLAY:
                preference.resetWCSOverlaySettings();
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
                        selectedValue={preference.getTheme()}
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
                    <Switch checked={preference.getAutoLaunch()} onChange={(ev) => preference.setPreference(PreferenceKeys.GLOBAL_AUTOLAUNCH, ev.currentTarget.checked)}/>
                </FormGroup>
                <FormGroup inline={true} label="Initial Layout">
                    <HTMLSelect value={preference.getLayout()} onChange={(ev) => preference.setPreference(PreferenceKeys.GLOBAL_LAYOUT, ev.currentTarget.value)}>
                        {layoutStore.orderedLayouts.map((layout) => <option key={layout} value={layout}>{layout}</option>)}
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Initial Cursor Position">
                    <RadioGroup
                        selectedValue={preference.getCursorPosition()}
                        onChange={(ev) => preference.setPreference(PreferenceKeys.GLOBAL_CURSOR_POSITION, ev.currentTarget.value)}
                        inline={true}
                    >
                        <Radio label="Fixed" value={CursorPosition.FIXED}/>
                        <Radio label="Tracking" value={CursorPosition.TRACKING}/>
                    </RadioGroup>
                </FormGroup>
                <FormGroup inline={true} label="Initial Zoom Level">
                    <RadioGroup
                        selectedValue={preference.getZoomMode()}
                        onChange={(ev) => preference.setPreference(PreferenceKeys.GLOBAL_ZOOM_MODE, ev.currentTarget.value)}
                        inline={true}
                    >
                        <Radio label="Zoom to fit" value={Zoom.FIT}/>
                        <Radio label="Zoom to 1.0x" value={Zoom.RAW}/>
                    </RadioGroup>
                </FormGroup>
                <FormGroup inline={true} label="Enable drag-to-pan">
                    <Switch checked={preference.getDragPanning()} onChange={(ev) => preference.setPreference(PreferenceKeys.GLOBAL_DRAG_PANNING, ev.currentTarget.checked)}/>
                </FormGroup>
            </React.Fragment>
        );

        const renderConfigPanel = (
            <React.Fragment>
                <FormGroup inline={true} label="Default Scaling">
                    <ScalingComponent selectedItem={preference.getScaling()} onItemSelect={(selected) => preference.setPreference(PreferenceKeys.RENDER_CONFIG_SCALING, selected)}/>
                </FormGroup>
                <FormGroup inline={true} label="Default Color Map">
                    <ColormapComponent
                        inverted={false}
                        selectedItem={preference.getColormap()}
                        onItemSelect={(selected) => preference.setPreference(PreferenceKeys.RENDER_CONFIG_COLORMAP, selected)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Default Percentile Ranks">
                    <PercentileSelect
                        activeItem={preference.getPercentile().toString(10)}
                        onItemSelect={(selected) => preference.setPreference(PreferenceKeys.RENDER_CONFIG_PERCENTILE, Number(selected))}
                        popoverProps={{minimal: true, position: "auto"}}
                        filterable={false}
                        items={RenderConfigStore.PERCENTILE_RANKS.map(String)}
                        itemRenderer={this.renderPercentileSelectItem}
                    >
                        <Button text={preference.getPercentile().toString(10) + "%"} rightIcon="double-caret-vertical" alignText={"right"}/>
                    </PercentileSelect>
                </FormGroup>
                {(preference.getScaling() === FrameScaling.LOG || preference.getScaling() === FrameScaling.POWER) &&
                <FormGroup label={"Alpha"} inline={true}>
                    <NumericInput
                        buttonPosition={"none"}
                        value={preference.getScalingAlpha()}
                        onValueChange={(value: number) => {
                            if (isFinite(value)) {
                                preference.setPreference(PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA, value);
                            }
                        }}
                    />
                </FormGroup>
                }
                {preference.getScaling() === FrameScaling.GAMMA &&
                <FormGroup label={"Gamma"} inline={true}>
                    <NumericInput
                        min={RenderConfigStore.GAMMA_MIN}
                        max={RenderConfigStore.GAMMA_MAX}
                        stepSize={0.1}
                        minorStepSize={0.01}
                        majorStepSize={0.5}
                        value={preference.getScalingGamma()}
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
                        color={hexStringToRgba(preference.getNaNColorHex(), preference.getNaNAlpha())}
                        presetColors={[...RegionStore.SWATCH_COLORS, "transparent"]}
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
                <FormGroup inline={true} label="Smoothing Mode">
                    <HTMLSelect
                        value={preference.getContourSmoothingMode()}
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
                        value={preference.getContourSmoothingFactor()}
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
                        value={preference.getContourNumLevels()}
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
                        value={preference.getContourThickness()}
                        majorStepSize={0.5}
                        stepSize={0.5}
                        onValueChange={value => preference.setPreference(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_THICKNESS, value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Default Color Mode">
                    <HTMLSelect value={preference.getContourColormapEnabled() ? 1 : 0} onChange={(ev) => preference.setPreference(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLORMAP_ENABLED, parseInt(ev.currentTarget.value) > 0)}>
                        <option key={0} value={0}>Constant Color</option>
                        <option key={1} value={1}>Color-mapped</option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Default Color Map">
                    <ColormapComponent
                        inverted={false}
                        selectedItem={preference.getContourColormap()}
                        onItemSelect={(selected) => preference.setPreference(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLORMAP, selected)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Default Color">
                    <ColorPickerComponent
                        color={preference.getContourColor()}
                        presetColors={RegionStore.SWATCH_COLORS}
                        setColor={(color: ColorResult) => preference.setPreference(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLOR, color.hex)}
                        disableAlpha={true}
                        darkTheme={appStore.darkTheme}
                    />
                </FormGroup>
            </React.Fragment>
        );

        const wcsOverlayPanel = (
            <React.Fragment>
                <FormGroup inline={true} label="Color">
                    <ColorComponent
                        selectedItem={preference.getASTColor()}
                        onItemSelect={(selected) => preference.setPreference(PreferenceKeys.WCS_OVERLAY_AST_COLOR, selected)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Grid Visible">
                    <Switch
                        checked={preference.getASTGridVisible()}
                        onChange={(ev) => preference.setPreference(PreferenceKeys.WCS_OVERLAY_AST_GRID_VISIBLE, ev.currentTarget.checked)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Label Visible">
                    <Switch
                        checked={preference.getASTLabelsVisible()}
                        onChange={(ev) => preference.setPreference(PreferenceKeys.WCS_OVERLAY_AST_LABELS_VISIBLE, ev.currentTarget.checked)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="WCS Format">
                    <RadioGroup selectedValue={preference.getWCSType()} onChange={(ev) => preference.setPreference(PreferenceKeys.WCS_OVERLAY_WCS_TYPE, ev.currentTarget.value)}>
                        <Radio label="Automatic" value={WCSType.AUTOMATIC}/>
                        <Radio label="Decimal degrees" value={WCSType.DEGREES}/>
                        <Radio label="Sexagesimal" value={WCSType.SEXAGESIMAL}/>
                    </RadioGroup>
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
                        color={preference.getRegionColor()}
                        presetColors={RegionStore.SWATCH_COLORS}
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
                        value={preference.getRegionLineWidth()}
                        stepSize={0.5}
                        onValueChange={(value: number) => preference.setPreference(PreferenceKeys.REGION_LINE_WIDTH, Math.max(RegionStore.MIN_LINE_WIDTH, Math.min(RegionStore.MAX_LINE_WIDTH, value)))}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Dash Length" labelInfo="(px)">
                    <NumericInput
                        placeholder="Dash Length"
                        min={0}
                        max={RegionStore.MAX_DASH_LENGTH}
                        value={preference.getRegionDashLength()}
                        stepSize={1}
                        onValueChange={(value: number) => preference.setPreference(PreferenceKeys.REGION_DASH_LENGTH, Math.max(0, Math.min(RegionStore.MAX_DASH_LENGTH, value)))}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Region Type">
                    <HTMLSelect value={preference.getRegionType()} onChange={(ev) => preference.setPreference(PreferenceKeys.REGION_TYPE, Number(ev.currentTarget.value))}>
                        {regionTypes}
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Creation Mode">
                    <RadioGroup
                        selectedValue={preference.getRegionCreationMode()}
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
                <FormGroup inline={true} label="Compression Quality" labelInfo={"(Images)"}>
                    <NumericInput
                        placeholder="Compression Quality"
                        min={CompressionQuality.IMAGE_MIN}
                        max={CompressionQuality.IMAGE_MAX}
                        value={preference.getImageCompressionQuality()}
                        stepSize={CompressionQuality.IMAGE_STEP}
                        onValueChange={this.handleImageCompressionQualityChange}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Compression Quality" labelInfo={"(Animation)"}>
                    <NumericInput
                        placeholder="Compression Quality"
                        min={CompressionQuality.ANIMATION_MIN}
                        max={CompressionQuality.ANIMATION_MAX}
                        value={preference.getAnimationCompressionQuality()}
                        stepSize={CompressionQuality.ANIMATION_STEP}
                        onValueChange={this.handleAnimationCompressionQualityChange}
                    />
                </FormGroup>
                <FormGroup inline={true} label="GPU Tile Cache Size">
                    <NumericInput
                        placeholder="GPU Tile Cache Size"
                        min={TileCache.GPU_MIN}
                        max={TileCache.GPU_MAX}
                        value={preference.getGPUTileCache()}
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
                        value={preference.getSystemTileCache()}
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
                        value={preference.getContourDecimation()}
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
                        value={preference.getContourCompressionLevel()}
                        majorStepSize={1}
                        stepSize={1}
                        onValueChange={value => preference.setPreference(PreferenceKeys.PERFORMANCE_CONTOUR_COMPRESSION_LEVEL, value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Contour Chunk Size">
                    <HTMLSelect value={preference.getContourChunkSize()} onChange={(ev) => preference.setPreference(PreferenceKeys.PERFORMANCE_CONTOUR_CHUNK_SIZE, parseInt(ev.currentTarget.value))}>
                        <option key={0} value={25000}>25K</option>
                        <option key={1} value={50000}>50K</option>
                        <option key={2} value={100000}>100K</option>
                        <option key={3} value={250000}>250K</option>
                        <option key={4} value={500000}>500K</option>
                        <option key={5} value={1000000}>1M</option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Stream image tiles while zooming">
                    <Switch checked={preference.getStreamContoursWhileZooming()} onChange={(ev) => preference.setPreference(PreferenceKeys.PERFORMANCE_STREAM_CONTOURS_WHILE_ZOOMING, ev.currentTarget.checked)}/>
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
            isOpen: appStore.preferenceDialogVisible,
            onClose: appStore.hidePreferenceDialog,
            title: "Preferences",
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} minWidth={450} minHeight={300} defaultWidth={775} defaultHeight={500} enableResizing={true}>
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
                        <Tab id={TABS.WCS_OVERLAY} title="Default WCS Overlay" panel={wcsOverlayPanel}/>
                        <Tab id={TABS.REGION} title="Default Region settings" panel={regionSettingsPanel}/>
                        <Tab id={TABS.PERFORMANCE} title="Performance" panel={performancePanel}/>
                        <Tab id={TABS.LOG_EVENT} title="Log Events" panel={logEventsPanel}/>
                    </Tabs>
                </div>
                <div className="bp3-dialog-footer">
                    <div className="bp3-dialog-footer-actions">
                        <Tooltip content="Apply to current tab only." position={Position.TOP}>
                            <AnchorButton intent={Intent.WARNING} icon={"refresh"} onClick={this.reset} text="Restore defaults"/>
                        </Tooltip>
                        <Button intent={Intent.NONE} onClick={appStore.hidePreferenceDialog} text="Close"/>
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}
