import * as React from "react";
import * as _ from "lodash";
import tinycolor from "tinycolor2";
import classNames from "classnames";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import {AnchorButton, Button, Callout, Checkbox, FormGroup, HTMLSelect, IDialogProps, Intent, MenuItem, Position, Radio, RadioGroup, Switch, Tab, Tabs} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {Select} from "@blueprintjs/select";
import {ColorResult} from "react-color";
import {CARTA} from "carta-protobuf";
import {DraggableDialogComponent} from "components/Dialogs";
import {ScalingSelectComponent} from "components/Shared/ScalingSelectComponent/ScalingSelectComponent";
import {AppToaster, AutoColorPickerComponent, ColormapComponent, ColorPickerComponent, SafeNumericInput, SuccessToast} from "components/Shared";
import {
    CompressionQuality,
    CursorInfoVisibility,
    CursorPosition,
    Event,
    FileFilterMode,
    RegionCreationMode,
    SPECTRAL_MATCHING_TYPES,
    SPECTRAL_TYPE_STRING,
    SpectralType,
    Theme,
    TileCache,
    WCSMatchingType,
    WCSType,
    Zoom,
    ZoomPoint
} from "models";
import {AppStore, BeamType, ContourGeneratorType, FrameScaling, HelpType, PreferenceKeys, PreferenceStore, RegionStore, RenderConfigStore} from "stores";
import {SWATCH_COLORS} from "utilities";
import {TelemetryMode} from "services";
import "./PreferenceDialogComponent.scss";

enum PreferenceDialogTabs {
    GLOBAL,
    RENDER_CONFIG,
    CONTOUR_CONFIG,
    OVERLAY_CONFIG,
    REGION,
    PERFORMANCE,
    LOG_EVENT,
    CATALOG,
    TELEMETRY
}

const PercentileSelect = Select.ofType<string>();

@observer
export class PreferenceDialogComponent extends React.Component {
    @observable selectedTab: PreferenceDialogTabs = PreferenceDialogTabs.GLOBAL;

    @action private setSelectedTab = (tab: PreferenceDialogTabs) => {
        this.selectedTab = tab;
    };

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    private renderPercentileSelectItem = (percentile: string, {handleClick, modifiers, query}) => {
        return <MenuItem text={percentile + "%"} onClick={handleClick} key={percentile} />;
    };

    private handleImageCompressionQualityChange = _.throttle((value: number) => {
        PreferenceStore.Instance.setPreference(PreferenceKeys.PERFORMANCE_IMAGE_COMPRESSION_QUALITY, value);
    }, 100);

    private handleAnimationCompressionQualityChange = _.throttle((value: number) => {
        PreferenceStore.Instance.setPreference(PreferenceKeys.PERFORMANCE_ANIMATION_COMPRESSION_QUALITY, value);
    }, 100);

    private handleGPUTileCacheChange = _.throttle((value: number) => {
        PreferenceStore.Instance.setPreference(PreferenceKeys.PERFORMANCE_GPU_TILE_CACHE, value);
    }, 100);

    private handleSystemTileCacheChange = _.throttle((value: number) => {
        PreferenceStore.Instance.setPreference(PreferenceKeys.PERFORMANCE_SYSTEM_TILE_CACHE, value);
    }, 100);

    private reset = () => {
        const preference = PreferenceStore.Instance;
        switch (this.selectedTab) {
            case PreferenceDialogTabs.RENDER_CONFIG:
                preference.resetRenderConfigSettings();
                break;
            case PreferenceDialogTabs.CONTOUR_CONFIG:
                preference.resetContourConfigSettings();
                break;
            case PreferenceDialogTabs.OVERLAY_CONFIG:
                preference.resetOverlayConfigSettings();
                break;
            case PreferenceDialogTabs.REGION:
                preference.resetRegionSettings();
                break;
            case PreferenceDialogTabs.PERFORMANCE:
                preference.resetPerformanceSettings();
                break;
            case PreferenceDialogTabs.LOG_EVENT:
                preference.resetLogEventSettings();
                break;
            case PreferenceDialogTabs.CATALOG:
                preference.resetCatalogSettings();
                break;
            case PreferenceDialogTabs.TELEMETRY:
                preference.resetTelemetrySettings();
                break;
            case PreferenceDialogTabs.GLOBAL:
            default:
                preference.resetGlobalSettings();
                break;
        }
    };

    private handleUserIdCopied = async () => {
        const appStore = AppStore.Instance;
        try {
            await navigator.clipboard?.writeText(appStore.telemetryService.decodedUserId);
            AppToaster.show(SuccessToast("clipboard", "Copied user ID to clipboard."));
        } catch (err) {
            console.log(err);
        }
    };

    public render() {
        const appStore = AppStore.Instance;
        const preference = appStore.preferenceStore;
        const layoutStore = appStore.layoutStore;

        const globalPanel = (
            <React.Fragment>
                <FormGroup inline={true} label="Theme">
                    <HTMLSelect value={preference.theme} onChange={ev => appStore.setTheme(ev.currentTarget.value)}>
                        <option value={Theme.AUTO}>Automatic</option>
                        <option value={Theme.LIGHT}>Light</option>
                        <option value={Theme.DARK}>Dark</option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Enable Code Snippets">
                    <Switch checked={preference.codeSnippetsEnabled} onChange={ev => preference.setPreference(PreferenceKeys.GLOBAL_CODE_SNIPPETS_ENABLED, ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Auto-launch File Browser">
                    <Switch checked={preference.autoLaunch} onChange={ev => preference.setPreference(PreferenceKeys.GLOBAL_AUTOLAUNCH, ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="File List">
                    <HTMLSelect value={preference.fileFilterMode} onChange={ev => preference.setPreference(PreferenceKeys.GLOBAL_FILE_FILTER_MODE, ev.currentTarget.value)}>
                        <option value={FileFilterMode.Content}>Filter by file content</option>
                        <option value={FileFilterMode.Extension}>Filter by extension</option>
                        <option value={FileFilterMode.All}>All files</option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Initial Layout">
                    <HTMLSelect value={preference.layout} onChange={ev => preference.setPreference(PreferenceKeys.GLOBAL_LAYOUT, ev.currentTarget.value)}>
                        {layoutStore.orderedLayoutNames.map(layout => (
                            <option key={layout} value={layout}>
                                {layout}
                            </option>
                        ))}
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Initial Cursor Position">
                    <RadioGroup selectedValue={preference.cursorPosition} onChange={ev => preference.setPreference(PreferenceKeys.GLOBAL_CURSOR_POSITION, ev.currentTarget.value)} inline={true}>
                        <Radio label="Fixed" value={CursorPosition.FIXED} />
                        <Radio label="Tracking" value={CursorPosition.TRACKING} />
                    </RadioGroup>
                </FormGroup>
                <FormGroup inline={true} label="Initial Zoom Level">
                    <RadioGroup selectedValue={preference.zoomMode} onChange={ev => preference.setPreference(PreferenceKeys.GLOBAL_ZOOM_MODE, ev.currentTarget.value)} inline={true}>
                        <Radio label="Zoom to fit" value={Zoom.FIT} />
                        <Radio label="Zoom to 1.0x" value={Zoom.FULL} />
                    </RadioGroup>
                </FormGroup>
                <FormGroup inline={true} label="Zoom to">
                    <RadioGroup selectedValue={preference.zoomPoint} onChange={ev => preference.setPreference(PreferenceKeys.GLOBAL_ZOOM_POINT, ev.currentTarget.value)} inline={true}>
                        <Radio label="Cursor" value={ZoomPoint.CURSOR} />
                        <Radio label="Current Center" value={ZoomPoint.CENTER} />
                    </RadioGroup>
                </FormGroup>
                <FormGroup inline={true} label="Enable drag-to-pan">
                    <Switch checked={preference.dragPanning} onChange={ev => preference.setPreference(PreferenceKeys.GLOBAL_DRAG_PANNING, ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="WCS matching on append">
                    <HTMLSelect value={preference.autoWCSMatching} onChange={ev => preference.setPreference(PreferenceKeys.GLOBAL_AUTO_WCS_MATCHING, Number(ev.currentTarget.value))}>
                        <option value={WCSMatchingType.NONE}>None</option>
                        <option value={WCSMatchingType.SPATIAL}>Spatial Only</option>
                        <option value={WCSMatchingType.SPECTRAL}>Spectral Only</option>
                        <option value={WCSMatchingType.SPATIAL | WCSMatchingType.SPECTRAL}>Spatial and Spectral</option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Spectral Matching">
                    <HTMLSelect value={preference.spectralMatchingType} onChange={ev => appStore.setSpectralMatchingType(ev.currentTarget.value as SpectralType)}>
                        {SPECTRAL_MATCHING_TYPES.map(type => (
                            <option key={type} value={type}>
                                {SPECTRAL_TYPE_STRING.get(type)}
                            </option>
                        ))}
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Transparent Image Background">
                    <Switch checked={preference.transparentImageBackground} onChange={ev => preference.setPreference(PreferenceKeys.GLOBAL_TRANSPARENT_IMAGE_BACKGROUND, ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Save last used directory">
                    <Switch checked={preference.keepLastUsedFolder} onChange={ev => preference.setPreference(PreferenceKeys.GLOBAL_KEEP_LAST_USED_FOLDER, ev.currentTarget.checked)} />
                </FormGroup>
            </React.Fragment>
        );

        const renderConfigPanel = (
            <React.Fragment>
                <FormGroup inline={true} label="Default Scaling">
                    <ScalingSelectComponent selectedItem={preference.scaling} onItemSelect={selected => preference.setPreference(PreferenceKeys.RENDER_CONFIG_SCALING, selected)} />
                </FormGroup>
                <FormGroup inline={true} label="Default Color Map">
                    <ColormapComponent inverted={false} selectedItem={preference.colormap} onItemSelect={selected => preference.setPreference(PreferenceKeys.RENDER_CONFIG_COLORMAP, selected)} />
                </FormGroup>
                <FormGroup inline={true} label="Default Percentile Ranks">
                    <PercentileSelect
                        activeItem={preference.percentile.toString(10)}
                        onItemSelect={selected => preference.setPreference(PreferenceKeys.RENDER_CONFIG_PERCENTILE, Number(selected))}
                        popoverProps={{minimal: true, position: "auto"}}
                        filterable={false}
                        items={RenderConfigStore.PERCENTILE_RANKS.map(String)}
                        itemRenderer={this.renderPercentileSelectItem}
                    >
                        <Button text={preference.percentile.toString(10) + "%"} rightIcon="double-caret-vertical" alignText={"right"} />
                    </PercentileSelect>
                </FormGroup>
                {(preference.scaling === FrameScaling.LOG || preference.scaling === FrameScaling.POWER) && (
                    <FormGroup label={"Alpha"} inline={true}>
                        <SafeNumericInput buttonPosition={"none"} value={preference.scalingAlpha} onValueChange={value => preference.setPreference(PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA, value)} />
                    </FormGroup>
                )}
                {preference.scaling === FrameScaling.GAMMA && (
                    <FormGroup label={"Gamma"} inline={true}>
                        <SafeNumericInput
                            min={RenderConfigStore.GAMMA_MIN}
                            max={RenderConfigStore.GAMMA_MAX}
                            stepSize={0.1}
                            minorStepSize={0.01}
                            majorStepSize={0.5}
                            value={preference.scalingGamma}
                            onValueChange={value => preference.setPreference(PreferenceKeys.RENDER_CONFIG_SCALING_GAMMA, value)}
                        />
                    </FormGroup>
                )}
                <FormGroup inline={true} label="NaN Color">
                    <ColorPickerComponent
                        color={tinycolor(preference.nanColorHex).setAlpha(preference.nanAlpha).toRgb()}
                        presetColors={[...SWATCH_COLORS, "transparent"]}
                        setColor={(color: ColorResult) => {
                            preference.setPreference(PreferenceKeys.RENDER_CONFIG_NAN_COLOR_HEX, color.hex === "transparent" ? "#000000" : color.hex);
                            preference.setPreference(PreferenceKeys.RENDER_CONFIG_NAN_ALPHA, color.rgb.a);
                        }}
                        disableAlpha={false}
                        darkTheme={appStore.darkTheme}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Smoothed Bias/Contrast">
                    <Switch checked={preference.useSmoothedBiasContrast} onChange={ev => preference.setPreference(PreferenceKeys.RENDER_CONFIG_USE_SMOOTHED_BIAS_CONTRAST, ev.currentTarget.checked)} />
                </FormGroup>
            </React.Fragment>
        );

        const contourConfigPanel = (
            <React.Fragment>
                <FormGroup inline={true} label="Generator Type">
                    <HTMLSelect
                        value={preference.contourGeneratorType}
                        options={Object.keys(ContourGeneratorType).map(key => ({label: ContourGeneratorType[key], value: ContourGeneratorType[key]}))}
                        onChange={ev => preference.setPreference(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_GENERATOR_TYPE, ev.currentTarget.value as ContourGeneratorType)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Smoothing Mode">
                    <HTMLSelect value={preference.contourSmoothingMode} onChange={ev => preference.setPreference(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_SMOOTHING_MODE, Number(ev.currentTarget.value))}>
                        <option key={CARTA.SmoothingMode.NoSmoothing} value={CARTA.SmoothingMode.NoSmoothing}>
                            No Smoothing
                        </option>
                        <option key={CARTA.SmoothingMode.BlockAverage} value={CARTA.SmoothingMode.BlockAverage}>
                            Block
                        </option>
                        <option key={CARTA.SmoothingMode.GaussianBlur} value={CARTA.SmoothingMode.GaussianBlur}>
                            Gaussian
                        </option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Default Smoothing Factor">
                    <SafeNumericInput
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
                    <SafeNumericInput
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
                    <SafeNumericInput
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
                    <HTMLSelect value={preference.contourColormapEnabled ? 1 : 0} onChange={ev => preference.setPreference(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLORMAP_ENABLED, parseInt(ev.currentTarget.value) > 0)}>
                        <option key={0} value={0}>
                            Constant Color
                        </option>
                        <option key={1} value={1}>
                            Color-mapped
                        </option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Default Color Map">
                    <ColormapComponent inverted={false} selectedItem={preference.contourColormap} onItemSelect={selected => preference.setPreference(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLORMAP, selected)} />
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
                <FormGroup inline={true} label="Color">
                    <AutoColorPickerComponent color={preference.astColor} presetColors={SWATCH_COLORS} setColor={(color: string) => preference.setPreference(PreferenceKeys.WCS_OVERLAY_AST_COLOR, color)} disableAlpha={true} />
                </FormGroup>
                <FormGroup inline={true} label="WCS Grid Visible">
                    <Switch checked={preference.astGridVisible} onChange={ev => preference.setPreference(PreferenceKeys.WCS_OVERLAY_AST_GRID_VISIBLE, ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Labels Visible">
                    <Switch checked={preference.astLabelsVisible} onChange={ev => preference.setPreference(PreferenceKeys.WCS_OVERLAY_AST_LABELS_VISIBLE, ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Cursor Info Visible">
                    <HTMLSelect value={preference.cursorInfoVisible} onChange={ev => preference.setPreference(PreferenceKeys.WCS_OVERLAY_CURSOR_INFO, ev.currentTarget.value)}>
                        <option value={CursorInfoVisibility.Always}>Always</option>
                        <option value={CursorInfoVisibility.ActiveImage}>Active image only</option>
                        <option value={CursorInfoVisibility.HideTiled}>Hide when tiled</option>
                        <option value={CursorInfoVisibility.Never}>Never</option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="WCS Format">
                    <HTMLSelect
                        options={[WCSType.AUTOMATIC, WCSType.DEGREES, WCSType.SEXAGESIMAL]}
                        value={preference.wcsType}
                        onChange={(event: React.FormEvent<HTMLSelectElement>) => preference.setPreference(PreferenceKeys.WCS_OVERLAY_WCS_TYPE, event.currentTarget.value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Colorbar Visible">
                    <Switch checked={preference.colorbarVisible} onChange={ev => preference.setPreference(PreferenceKeys.WCS_OVERLAY_COLORBAR_VISIBLE, ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Colorbar Interactive">
                    <Switch checked={preference.colorbarInteractive} onChange={ev => preference.setPreference(PreferenceKeys.WCS_OVERLAY_COLORBAR_INTERACTIVE, ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Colorbar Position">
                    <HTMLSelect value={preference.colorbarPosition} onChange={ev => preference.setPreference(PreferenceKeys.WCS_OVERLAY_COLORBAR_POSITION, ev.currentTarget.value)}>
                        <option value={"right"}>right</option>
                        <option value={"top"}>top</option>
                        <option value={"bottom"}>bottom</option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Colorbar Width" labelInfo="(px)">
                    <SafeNumericInput
                        placeholder="Colorbar Width"
                        min={1}
                        max={100}
                        value={preference.colorbarWidth}
                        stepSize={1}
                        minorStepSize={1}
                        majorStepSize={2}
                        intOnly={true}
                        onValueChange={(value: number) => preference.setPreference(PreferenceKeys.WCS_OVERLAY_COLORBAR_WIDTH, value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Colorbar Ticks Density" labelInfo="(per 100px)">
                    <SafeNumericInput
                        placeholder="Colorbar Ticks Density"
                        min={0.2}
                        max={20}
                        value={preference.colorbarTicksDensity}
                        stepSize={0.2}
                        minorStepSize={0.1}
                        majorStepSize={1}
                        onValueChange={(value: number) => preference.setPreference(PreferenceKeys.WCS_OVERLAY_COLORBAR_TICKS_DENSITY, value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Colorbar Label Visible">
                    <Switch checked={preference.colorbarLabelVisible} onChange={ev => preference.setPreference(PreferenceKeys.WCS_OVERLAY_COLORBAR_LABEL_VISIBLE, ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Beam Visible">
                    <Switch checked={preference.beamVisible} onChange={ev => preference.setPreference(PreferenceKeys.WCS_OVERLAY_BEAM_VISIBLE, ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Beam Color">
                    <AutoColorPickerComponent color={preference.beamColor} presetColors={SWATCH_COLORS} setColor={(color: string) => preference.setPreference(PreferenceKeys.WCS_OVERLAY_BEAM_COLOR, color)} disableAlpha={true} />
                </FormGroup>
                <FormGroup inline={true} label="Beam Type">
                    <HTMLSelect value={preference.beamType} onChange={(event: React.FormEvent<HTMLSelectElement>) => preference.setPreference(PreferenceKeys.WCS_OVERLAY_BEAM_TYPE, event.currentTarget.value as BeamType)}>
                        <option key={0} value={BeamType.Open}>
                            Open
                        </option>
                        <option key={1} value={BeamType.Solid}>
                            Solid
                        </option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Beam Width" labelInfo="(px)">
                    <SafeNumericInput
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
            regionTypes.push(
                <option key={regionType} value={regionType}>
                    {name}
                </option>
            );
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
                    <SafeNumericInput
                        placeholder="Line Width"
                        min={RegionStore.MIN_LINE_WIDTH}
                        max={RegionStore.MAX_LINE_WIDTH}
                        value={preference.regionLineWidth}
                        stepSize={0.5}
                        onValueChange={(value: number) => preference.setPreference(PreferenceKeys.REGION_LINE_WIDTH, Math.max(RegionStore.MIN_LINE_WIDTH, Math.min(RegionStore.MAX_LINE_WIDTH, value)))}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Dash Length" labelInfo="(px)">
                    <SafeNumericInput
                        placeholder="Dash Length"
                        min={0}
                        max={RegionStore.MAX_DASH_LENGTH}
                        value={preference.regionDashLength}
                        stepSize={1}
                        onValueChange={(value: number) => preference.setPreference(PreferenceKeys.REGION_DASH_LENGTH, Math.max(0, Math.min(RegionStore.MAX_DASH_LENGTH, value)))}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Region Type">
                    <HTMLSelect value={preference.regionType} onChange={ev => preference.setPreference(PreferenceKeys.REGION_TYPE, Number(ev.currentTarget.value))}>
                        {regionTypes}
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Region size" labelInfo="(px)">
                    <SafeNumericInput placeholder="Region size" min={1} value={preference.regionSize} stepSize={1} onValueChange={(value: number) => preference.setPreference(PreferenceKeys.REGION_SIZE, Math.max(1, value))} />
                </FormGroup>
                <FormGroup inline={true} label="Creation Mode">
                    <RadioGroup selectedValue={preference.regionCreationMode} onChange={ev => preference.setPreference(PreferenceKeys.REGION_CREATION_MODE, ev.currentTarget.value)}>
                        <Radio label="Center to corner" value={RegionCreationMode.CENTER} />
                        <Radio label="Corner to corner" value={RegionCreationMode.CORNER} />
                    </RadioGroup>
                </FormGroup>
            </React.Fragment>
        );

        const performancePanel = (
            <React.Fragment>
                <FormGroup inline={true} label="Low bandwidth mode">
                    <Switch checked={preference.lowBandwidthMode} onChange={ev => preference.setPreference(PreferenceKeys.PERFORMANCE_LOW_BAND_WIDTH_MODE, ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Limit overlay redraw">
                    <Switch checked={preference.limitOverlayRedraw} onChange={ev => preference.setPreference(PreferenceKeys.PERFORMANCE_LIMIT_OVERLAY_REDRAW, ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Compression Quality" labelInfo={"(Images)"}>
                    <SafeNumericInput
                        placeholder="Compression Quality"
                        min={CompressionQuality.IMAGE_MIN}
                        max={CompressionQuality.IMAGE_MAX}
                        value={preference.imageCompressionQuality}
                        stepSize={CompressionQuality.IMAGE_STEP}
                        onValueChange={this.handleImageCompressionQualityChange}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Compression Quality" labelInfo={"(Animation)"}>
                    <SafeNumericInput
                        placeholder="Compression Quality"
                        min={CompressionQuality.ANIMATION_MIN}
                        max={CompressionQuality.ANIMATION_MAX}
                        value={preference.animationCompressionQuality}
                        stepSize={CompressionQuality.ANIMATION_STEP}
                        onValueChange={this.handleAnimationCompressionQualityChange}
                    />
                </FormGroup>
                <FormGroup inline={true} label="GPU Tile Cache Size">
                    <SafeNumericInput
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
                    <SafeNumericInput
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
                    <SafeNumericInput
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
                    <SafeNumericInput
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
                    <HTMLSelect value={preference.contourChunkSize} onChange={ev => preference.setPreference(PreferenceKeys.PERFORMANCE_CONTOUR_CHUNK_SIZE, parseInt(ev.currentTarget.value))}>
                        <option key={0} value={25000}>
                            25K
                        </option>
                        <option key={1} value={50000}>
                            50K
                        </option>
                        <option key={2} value={100000}>
                            100K
                        </option>
                        <option key={3} value={250000}>
                            250K
                        </option>
                        <option key={4} value={500000}>
                            500K
                        </option>
                        <option key={5} value={1000000}>
                            1M
                        </option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Control Map Resolution">
                    <HTMLSelect value={preference.contourControlMapWidth} onChange={ev => preference.setPreference(PreferenceKeys.PERFORMANCE_CONTOUR_CONTROL_MAP_WIDTH, parseInt(ev.currentTarget.value))}>
                        <option key={0} value={128}>
                            128&times;128 (128 KB)
                        </option>
                        <option key={1} value={256}>
                            256&times;256 (512 KB)
                        </option>
                        <option key={2} value={512}>
                            512&times;512 (2 MB)
                        </option>
                        <option key={3} value={1024}>
                            1024&times;1024 (8 MB)
                        </option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Stream image tiles while zooming">
                    <Switch checked={preference.streamContoursWhileZooming} onChange={ev => preference.setPreference(PreferenceKeys.PERFORMANCE_STREAM_CONTOURS_WHILE_ZOOMING, ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup inline={true} label="Stop animation playback in">
                    <HTMLSelect value={preference.stopAnimationPlaybackMinutes} onChange={ev => preference.setPreference(PreferenceKeys.PERFORMANCE_STOP_ANIMATION_PLAYBACK_MINUTES, parseInt(ev.currentTarget.value))}>
                        <option key={0} value={5}>
                            5 minutes
                        </option>
                        <option key={1} value={10}>
                            10 minutes
                        </option>
                        <option key={2} value={15}>
                            15 minutes
                        </option>
                        <option key={3} value={20}>
                            20 minutes
                        </option>
                        <option key={4} value={30}>
                            30 minutes
                        </option>
                    </HTMLSelect>
                </FormGroup>
            </React.Fragment>
        );

        const logEventsPanel = (
            <div className="log-event-panel">
                <FormGroup inline={true} label="Enable logged event type" className="log-event-header">
                    <Checkbox label="Select all" checked={preference.isSelectingAllLogEvents} indeterminate={preference.isSelectingIndeterminateLogEvents} onChange={() => preference.selectAllLogEvents()} />
                </FormGroup>
                <FormGroup inline={false} className="log-event-list">
                    {Event.EVENT_TYPES.map(eventType => (
                        <Checkbox
                            className="log-event-checkbox"
                            key={eventType}
                            checked={preference.isEventLoggingEnabled(eventType)}
                            label={Event.getEventNameFromType(eventType)}
                            onChange={() => preference.setPreference(PreferenceKeys.LOG_EVENT, eventType)}
                        />
                    ))}
                </FormGroup>
            </div>
        );

        const catalogPanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Displayed columns">
                    <SafeNumericInput
                        placeholder="Default Displayed Columns"
                        min={1}
                        value={preference.catalogDisplayedColumnSize}
                        stepSize={1}
                        onValueChange={(value: number) => preference.setPreference(PreferenceKeys.CATALOG_DISPLAYED_COLUMN_SIZE, value)}
                    />
                </FormGroup>
            </div>
        );

        let telemetryHelperText: string;

        if (preference.telemetryMode === TelemetryMode.Usage) {
            telemetryHelperText = "Operating system and browser information will be collected, as well as anonymous usage data.";
        } else if (preference.telemetryMode === TelemetryMode.Minimal) {
            telemetryHelperText = "Operating system and browser information will be collected. No usage data will be collected.";
        } else {
            telemetryHelperText = "No data will be collected.";
        }

        const telemetryPanel = (
            <div className="panel-container">
                <div className="telemetry-callout">
                    <Callout intent="primary">
                        <p>
                            CARTA can collect anonymous usage data, in order to help the development team prioritize additional features and platforms. No personal or scientific information will be collected. Please see our{" "}
                            <a rel="noopener noreferrer" href="https://cartavis.org/telemetry" target="_blank">
                                data collection policy
                            </a>{" "}
                            for more details.
                        </p>
                        {preference.telemetryUuid && (
                            <div className="telemetry-id-text">
                                <p>Anonymous user ID: {appStore.telemetryService.decodedUserId}</p>
                                <Button minimal={true} intent="primary" icon="clipboard" onClick={this.handleUserIdCopied} />
                            </div>
                        )}
                    </Callout>
                </div>
                <FormGroup inline={true} label="Telemetry mode" helperText={telemetryHelperText} className="telemetry-mode-form-group">
                    <HTMLSelect value={preference.telemetryMode} onChange={ev => preference.setPreference(PreferenceKeys.TELEMETRY_MODE, ev.currentTarget.value)}>
                        <option value={TelemetryMode.None}>Disabled</option>
                        <option value={TelemetryMode.Minimal}>Minimal</option>
                        <option value={TelemetryMode.Usage}>Full</option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Log telemetry output">
                    <Switch checked={preference.telemetryLogging} onChange={ev => preference.setPreference(PreferenceKeys.TELEMETRY_LOGGING, ev.currentTarget.checked)} />
                </FormGroup>
            </div>
        );

        const className = classNames("preference-dialog", {"bp3-dark": appStore.darkTheme});

        const dialogProps: IDialogProps = {
            icon: "wrench",
            backdropClassName: "minimal-dialog-backdrop",
            className: className,
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.preferenceDialogVisible,
            onClose: appStore.dialogStore.hidePreferenceDialog,
            title: "Preferences"
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} helpType={HelpType.PREFERENCES} minWidth={450} minHeight={300} defaultWidth={775} defaultHeight={500} enableResizing={true}>
                <div className="bp3-dialog-body">
                    <Tabs id="preferenceTabs" vertical={true} selectedTabId={this.selectedTab} onChange={this.setSelectedTab}>
                        <Tab id={PreferenceDialogTabs.GLOBAL} title="Global" panel={globalPanel} />
                        <Tab id={PreferenceDialogTabs.RENDER_CONFIG} title="Render Configuration" panel={renderConfigPanel} />
                        <Tab id={PreferenceDialogTabs.CONTOUR_CONFIG} title="Contour Configuration" panel={contourConfigPanel} />
                        <Tab id={PreferenceDialogTabs.OVERLAY_CONFIG} title="Overlay Configuration" panel={overlayConfigPanel} />
                        <Tab id={PreferenceDialogTabs.CATALOG} title="Catalog" panel={catalogPanel} />
                        <Tab id={PreferenceDialogTabs.REGION} title="Region" panel={regionSettingsPanel} />
                        <Tab id={PreferenceDialogTabs.PERFORMANCE} title="Performance" panel={performancePanel} />
                        {process.env.REACT_APP_SKIP_TELEMETRY !== "true" && <Tab id={PreferenceDialogTabs.TELEMETRY} title="Telemetry" panel={telemetryPanel} />}
                        <Tab id={PreferenceDialogTabs.LOG_EVENT} title="Log Events" panel={logEventsPanel} />
                    </Tabs>
                </div>
                <div className="bp3-dialog-footer">
                    <div className="bp3-dialog-footer-actions">
                        <Tooltip2 content="Apply to current tab only." position={Position.TOP}>
                            <AnchorButton intent={Intent.WARNING} icon={"refresh"} onClick={this.reset} text="Restore defaults" />
                        </Tooltip2>
                        <Button intent={Intent.NONE} onClick={appStore.dialogStore.hidePreferenceDialog} text="Close" />
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}
