import * as React from "react";
import {type ColorResult} from "react-color";
import {FormGroup, HTMLSelect, Label, type OptionProps, Switch} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import * as _ from "lodash";
import {observer} from "mobx-react";

import {ColorPickerComponent, PointShapeSelectComponent, SafeNumericInput} from "components/Shared";
import {AppearanceControl, Font, FontStyle} from "enums";
import {AppStore} from "stores";
import {type CompassAnnotationStore, type PointAnnotationStore, RegionStore, type RulerAnnotationStore, type TextAnnotationStore, type VectorAnnotationStore} from "stores/Frame";
import {SWATCH_COLORS} from "utilities";

import "./AppearanceForm.scss";

interface AppearanceFormProps {
    region: RegionStore;
    darkTheme: boolean;
    visibleControls?: Set<AppearanceControl>;
    // Group mode: invoke handler on every target region. When omitted, the form operates on `props.region` only.
    applyToTargets?: (handler: (region: RegionStore) => void) => void;
}

@observer
export class AppearanceForm extends React.Component<AppearanceFormProps> {
    private static readonly AppearanceChangeDelay = 100;

    private static readonly TextAlignmentOptions: OptionProps[] = [
        {value: CARTA.TextAnnotationPosition.CENTER, label: "Center"},
        {value: CARTA.TextAnnotationPosition.UPPER_LEFT, label: "Upper left"},
        {value: CARTA.TextAnnotationPosition.UPPER_RIGHT, label: "Upper right"},
        {value: CARTA.TextAnnotationPosition.LOWER_LEFT, label: "Lower left"},
        {value: CARTA.TextAnnotationPosition.LOWER_RIGHT, label: "Lower right"},
        {value: CARTA.TextAnnotationPosition.TOP, label: "Top"},
        {value: CARTA.TextAnnotationPosition.BOTTOM, label: "Bottom"},
        {value: CARTA.TextAnnotationPosition.LEFT, label: "Left"},
        {value: CARTA.TextAnnotationPosition.RIGHT, label: "Right"}
    ];

    private static readonly DefaultControls = [AppearanceControl.Color, AppearanceControl.LineWidth, AppearanceControl.DashLength];

    private static readonly REGION_CONTROLS = new Map<CARTA.RegionType, AppearanceControl[]>([
        [CARTA.RegionType.POINT, [AppearanceControl.Color]],
        [CARTA.RegionType.ANNPOINT, [AppearanceControl.Color, AppearanceControl.Point]],
        [CARTA.RegionType.ANNTEXT, [AppearanceControl.Color, AppearanceControl.Font, AppearanceControl.TextAlignment]],
        [CARTA.RegionType.ANNCOMPASS, [AppearanceControl.Color, AppearanceControl.LineWidth, AppearanceControl.DashLength, AppearanceControl.Font, AppearanceControl.Compass]],
        [CARTA.RegionType.ANNRULER, [AppearanceControl.Color, AppearanceControl.LineWidth, AppearanceControl.DashLength, AppearanceControl.Font, AppearanceControl.Ruler]],
        [CARTA.RegionType.ANNVECTOR, [AppearanceControl.Color, AppearanceControl.LineWidth, AppearanceControl.DashLength, AppearanceControl.VectorPointer]]
    ]);

    public static getControlsForRegion(region: RegionStore): Set<AppearanceControl> {
        return new Set(AppearanceForm.REGION_CONTROLS.get(region.regionType) ?? AppearanceForm.DefaultControls);
    }

    private static intersectControls(left: Set<AppearanceControl>, right: Set<AppearanceControl>): Set<AppearanceControl> {
        return new Set(Array.from(left).filter(control => right.has(control)));
    }

    public static getCommonControls(regions: RegionStore[]): Set<AppearanceControl> {
        if (!regions.length) {
            return new Set();
        }

        const [firstControls, ...remainingControls] = regions.map(region => AppearanceForm.getControlsForRegion(region));
        return remainingControls.reduce((commonControls, controls) => AppearanceForm.intersectControls(commonControls, controls), firstControls);
    }

    private apply = (handler: (region: RegionStore) => void) => {
        if (this.props.applyToTargets) {
            this.props.applyToTargets(handler);
        } else if (this.props.region) {
            handler(this.props.region);
        }
    };

    private handleLineWidthChange = _.throttle((value: number) => {
        if (this.props.region) {
            const clampedValue = Math.max(RegionStore.MIN_LINE_WIDTH, Math.min(RegionStore.MAX_LINE_WIDTH, value));
            this.apply(region => region.setLineWidth(clampedValue));
        }
    }, AppearanceForm.AppearanceChangeDelay);

    private handleDashLengthChange = _.throttle((value: number) => {
        if (this.props.region) {
            const clampedValue = Math.max(0, Math.min(RegionStore.MAX_DASH_LENGTH, value));
            this.apply(region => region.setDashLength(clampedValue));
        }
    }, AppearanceForm.AppearanceChangeDelay);

    private handlePointShapeChange = (item: CARTA.PointAnnotationShape) => {
        this.apply(region => (region as PointAnnotationStore).setPointShape(item));
        // Cache the shape for new point regions in single-region mode only.
        if (!this.props.applyToTargets) {
            const activeFrame = AppStore.Instance.activeFrame;
            if (activeFrame) {
                const frame = activeFrame.spatialReference ?? activeFrame;
                frame.pointShapeCache = item;
            }
        }
    };

    private static getCompassArrowheadSelection(region: CompassAnnotationStore) {
        if (region.northArrowhead && region.eastArrowhead) return "both";
        if (region.eastArrowhead) return "east";
        return "north";
    }

    private handleCompassAnnotationArrowhead = (selection: string) => {
        this.apply(region => {
            const compass = region as CompassAnnotationStore;
            compass.setNorthArrowhead(selection !== "east");
            compass.setEastArrowhead(selection !== "north");
        });
    };

    public render() {
        const region = this.props.region;
        if (!region || !region.isValid) {
            return null;
        }
        const visibleControls = this.props.visibleControls ?? AppearanceForm.getControlsForRegion(region);

        return (
            <div className="appearance-form">
                {visibleControls.has(AppearanceControl.Color) && (
                    <FormGroup label="Color" inline={true}>
                        <ColorPickerComponent color={region.color} presetColors={SWATCH_COLORS} setColor={(color: ColorResult) => this.apply(r => r.setColor(color.hex))} disableAlpha={true} darkTheme={this.props.darkTheme} />
                    </FormGroup>
                )}
                {visibleControls.has(AppearanceControl.LineWidth) && (
                    <FormGroup inline={true} label="Line width" labelInfo="(px)">
                        <SafeNumericInput
                            placeholder="Line width"
                            min={RegionStore.MIN_LINE_WIDTH}
                            max={RegionStore.MAX_LINE_WIDTH}
                            value={region.lineWidth}
                            stepSize={0.5}
                            onValueChange={this.handleLineWidthChange}
                            data-testid="region-dialog-line-width-input"
                        />
                    </FormGroup>
                )}
                {visibleControls.has(AppearanceControl.DashLength) && (
                    <FormGroup inline={true} label="Dash length" labelInfo="(px)">
                        <SafeNumericInput placeholder="Dash length" min={0} max={RegionStore.MAX_DASH_LENGTH} value={region.dashLength} stepSize={1} onValueChange={this.handleDashLengthChange} />
                    </FormGroup>
                )}
                {visibleControls.has(AppearanceControl.Font) && (
                    <>
                        <FormGroup inline={true} label="Font size" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="Font size"
                                min={0.5}
                                max={100}
                                value={(region as TextAnnotationStore)?.fontSize}
                                stepSize={1}
                                onValueChange={value => this.apply(r => (r as TextAnnotationStore).setFontSize(value))}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Font">
                            <HTMLSelect options={Object.values(Font)} value={(this.props.region as TextAnnotationStore).font} onChange={ev => this.apply(r => (r as TextAnnotationStore).setFont(ev.target.value as Font))} />
                        </FormGroup>
                        <FormGroup inline={true} label="Font style">
                            <HTMLSelect
                                options={Object.values(FontStyle)}
                                value={(this.props.region as TextAnnotationStore).fontStyle}
                                onChange={ev => this.apply(r => (r as TextAnnotationStore).setFontStyle(ev.target.value as FontStyle))}
                            />
                        </FormGroup>
                    </>
                )}
                {visibleControls.has(AppearanceControl.Point) && (
                    <>
                        <FormGroup inline={true} label="Shape">
                            <PointShapeSelectComponent handleChange={this.handlePointShapeChange} pointShape={(region as PointAnnotationStore).pointShape} />
                        </FormGroup>
                        <FormGroup inline={true} label="Size" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="Point size"
                                min={0.5}
                                max={50}
                                value={(region as PointAnnotationStore).pointWidth}
                                stepSize={0.5}
                                onValueChange={width => this.apply(r => (r as PointAnnotationStore).setPointWidth(width))}
                            />
                        </FormGroup>
                    </>
                )}
                {visibleControls.has(AppearanceControl.VectorPointer) && (
                    <>
                        <FormGroup inline={true} label="Arrowhead length" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="Length"
                                min={0}
                                max={RegionStore.MAX_DASH_LENGTH}
                                value={(region as VectorAnnotationStore).pointerLength}
                                stepSize={1}
                                onValueChange={value => this.apply(r => (r as VectorAnnotationStore).setPointerLength(value))}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Arrowhead width" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="Width"
                                min={0}
                                max={RegionStore.MAX_DASH_LENGTH}
                                value={(region as VectorAnnotationStore).pointerWidth}
                                stepSize={1}
                                onValueChange={value => this.apply(r => (r as VectorAnnotationStore).setPointerWidth(value))}
                            />
                        </FormGroup>
                    </>
                )}
                {visibleControls.has(AppearanceControl.Compass) && (
                    <>
                        <Label>North label offset</Label>
                        <FormGroup inline={true} label="X" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="North label X offset"
                                min={RegionStore.MIN_LABEL_OFFSET}
                                max={RegionStore.MAX_LABEL_OFFSET}
                                value={(this.props.region as CompassAnnotationStore).northTextOffset.x}
                                stepSize={0.5}
                                onValueChange={value => this.apply(r => (r as CompassAnnotationStore).setNorthTextOffset(value, true))}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Y" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="North label Y offset"
                                min={RegionStore.MIN_LABEL_OFFSET}
                                max={RegionStore.MAX_LABEL_OFFSET}
                                value={(this.props.region as CompassAnnotationStore).northTextOffset.y}
                                stepSize={0.5}
                                onValueChange={value => this.apply(r => (r as CompassAnnotationStore).setNorthTextOffset(value, false))}
                            />
                        </FormGroup>
                        <Label>East label offset</Label>
                        <FormGroup inline={true} label="X" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="East label X offset"
                                min={RegionStore.MIN_LABEL_OFFSET}
                                max={RegionStore.MAX_LABEL_OFFSET}
                                value={(this.props.region as CompassAnnotationStore).eastTextOffset.x}
                                stepSize={0.5}
                                onValueChange={value => this.apply(r => (r as CompassAnnotationStore).setEastTextOffset(value, true))}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Y" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="East label Y offset"
                                min={RegionStore.MIN_LABEL_OFFSET}
                                max={RegionStore.MAX_LABEL_OFFSET}
                                value={(this.props.region as CompassAnnotationStore).eastTextOffset.y}
                                stepSize={0.5}
                                onValueChange={value => this.apply(r => (r as CompassAnnotationStore).setEastTextOffset(value, false))}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Show arrowhead">
                            <HTMLSelect value={AppearanceForm.getCompassArrowheadSelection(region as CompassAnnotationStore)} onChange={ev => this.handleCompassAnnotationArrowhead(ev.target.value)}>
                                <option value={"north"}>North</option>
                                <option value={"east"}>East</option>
                                <option value={"both"}>Both</option>
                            </HTMLSelect>
                        </FormGroup>
                        <FormGroup inline={true} label="Arrowhead length" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="Length"
                                min={0}
                                max={RegionStore.MAX_DASH_LENGTH}
                                value={(region as CompassAnnotationStore).pointerLength}
                                stepSize={1}
                                onValueChange={value => this.apply(r => (r as CompassAnnotationStore).setPointerLength(value))}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Arrowhead width" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="Width"
                                min={0}
                                max={RegionStore.MAX_DASH_LENGTH}
                                value={(region as CompassAnnotationStore).pointerWidth}
                                stepSize={1}
                                onValueChange={value => this.apply(r => (r as CompassAnnotationStore).setPointerWidth(value))}
                            />
                        </FormGroup>
                    </>
                )}
                {visibleControls.has(AppearanceControl.Ruler) && (
                    <>
                        <FormGroup inline={true} label="Number of decimals">
                            <SafeNumericInput
                                placeholder="Number of decimals"
                                min={0}
                                max={6}
                                value={(region as RulerAnnotationStore).decimals}
                                stepSize={1}
                                onValueChange={value => this.apply(r => (r as RulerAnnotationStore).setDecimals(value))}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Show auxiliary lines">
                            <Switch
                                checked={(region as RulerAnnotationStore).auxiliaryLineVisible}
                                onChange={(ev: React.ChangeEvent<HTMLInputElement>) => this.apply(r => (r as RulerAnnotationStore).setAuxiliaryLineVisible(ev.target.checked))}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Auxiliary lines dash length" labelInfo="(px)">
                            <SafeNumericInput
                                disabled={!(region as RulerAnnotationStore).auxiliaryLineVisible}
                                placeholder="Dash length"
                                min={0}
                                max={RegionStore.MAX_DASH_LENGTH}
                                value={(region as RulerAnnotationStore).auxiliaryLineDashLength}
                                stepSize={1}
                                onValueChange={value => this.apply(r => (r as RulerAnnotationStore).setAuxiliaryLineDashLength(value))}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Text X offset" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="Text X offset"
                                min={RegionStore.MIN_LABEL_OFFSET}
                                max={RegionStore.MAX_LABEL_OFFSET}
                                value={(region as RulerAnnotationStore).textOffset.x}
                                stepSize={1}
                                onValueChange={value => this.apply(r => (r as RulerAnnotationStore).setTextOffset(value, true))}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Text Y offset" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="Text Y offset"
                                min={RegionStore.MIN_LABEL_OFFSET}
                                max={RegionStore.MAX_LABEL_OFFSET}
                                value={(region as RulerAnnotationStore).textOffset.y}
                                stepSize={1}
                                onValueChange={value => this.apply(r => (r as RulerAnnotationStore).setTextOffset(value, false))}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Show auxiliary labels">
                            <Switch
                                disabled={!(region as RulerAnnotationStore).auxiliaryLineVisible}
                                checked={(region as RulerAnnotationStore).auxiliaryTextVisible}
                                onChange={(ev: React.ChangeEvent<HTMLInputElement>) => this.apply(r => (r as RulerAnnotationStore).setAuxiliaryTextVisible(ev.target.checked))}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="X label X offset" labelInfo="(px)">
                            <SafeNumericInput
                                disabled={!(region as RulerAnnotationStore).auxiliaryTextVisible}
                                placeholder="X label X offset"
                                min={RegionStore.MIN_LABEL_OFFSET}
                                max={RegionStore.MAX_LABEL_OFFSET}
                                value={(region as RulerAnnotationStore).xTextOffset.x}
                                stepSize={1}
                                onValueChange={value => this.apply(r => (r as RulerAnnotationStore).setXTextOffset(value, true))}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="X label Y offset" labelInfo="(px)">
                            <SafeNumericInput
                                disabled={!(region as RulerAnnotationStore).auxiliaryTextVisible}
                                placeholder="X label Y offset"
                                min={RegionStore.MIN_LABEL_OFFSET}
                                max={RegionStore.MAX_LABEL_OFFSET}
                                value={(region as RulerAnnotationStore).xTextOffset.y}
                                stepSize={1}
                                onValueChange={value => this.apply(r => (r as RulerAnnotationStore).setXTextOffset(value, false))}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Y label X offset" labelInfo="(px)">
                            <SafeNumericInput
                                disabled={!(region as RulerAnnotationStore).auxiliaryTextVisible}
                                placeholder="Y label X offset"
                                min={RegionStore.MIN_LABEL_OFFSET}
                                max={RegionStore.MAX_LABEL_OFFSET}
                                value={(region as RulerAnnotationStore).yTextOffset.x}
                                stepSize={1}
                                onValueChange={value => this.apply(r => (r as RulerAnnotationStore).setYTextOffset(value, true))}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Y label Y offset" labelInfo="(px)">
                            <SafeNumericInput
                                disabled={!(region as RulerAnnotationStore).auxiliaryTextVisible}
                                placeholder="Y label Y offset"
                                min={RegionStore.MIN_LABEL_OFFSET}
                                max={RegionStore.MAX_LABEL_OFFSET}
                                value={(region as RulerAnnotationStore).yTextOffset.y}
                                stepSize={1}
                                onValueChange={value => this.apply(r => (r as RulerAnnotationStore).setYTextOffset(value, false))}
                            />
                        </FormGroup>
                    </>
                )}
                {visibleControls.has(AppearanceControl.TextAlignment) && (
                    <FormGroup label="Text alignment" inline={true}>
                        <HTMLSelect options={AppearanceForm.TextAlignmentOptions} value={(region as TextAnnotationStore).position} onChange={ev => this.apply(r => (r as TextAnnotationStore).setPosition(parseInt(ev.target.value)))} />
                    </FormGroup>
                )}
            </div>
        );
    }
}
