import * as React from "react";
import {type ColorResult} from "react-color";
import {FormGroup, HTMLSelect, Label, type OptionProps, Switch} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import * as _ from "lodash";
import {observer} from "mobx-react";

import {ColorPickerComponent, PointShapeSelectComponent, SafeNumericInput} from "components/Shared";
import {Font, FontStyle} from "enums";
import {AppStore} from "stores";
import {type CompassAnnotationStore, type PointAnnotationStore, RegionStore, type RulerAnnotationStore, type TextAnnotationStore, type VectorAnnotationStore} from "stores/Frame";
import {SWATCH_COLORS} from "utilities";

import "./AppearanceForm.scss";

export interface AppearanceFormHandlers {
    setColor?: (hex: string) => void;
    setLineWidth?: (value: number) => void;
    setDashLength?: (value: number) => void;
    setPointShape?: (shape: CARTA.PointAnnotationShape) => void;
    setPointWidth?: (value: number) => void;
    setFontSize?: (value: number) => void;
    setFont?: (value: Font) => void;
    setFontStyle?: (value: FontStyle) => void;
    setVectorPointerLength?: (value: number) => void;
    setVectorPointerWidth?: (value: number) => void;
    setCompassNorthTextOffsetX?: (value: number) => void;
    setCompassNorthTextOffsetY?: (value: number) => void;
    setCompassEastTextOffsetX?: (value: number) => void;
    setCompassEastTextOffsetY?: (value: number) => void;
    setCompassArrowheads?: (selection: "north" | "east" | "both") => void;
    setCompassPointerLength?: (value: number) => void;
    setCompassPointerWidth?: (value: number) => void;
    setRulerDecimals?: (value: number) => void;
    setRulerAuxiliaryLineVisible?: (value: boolean) => void;
    setRulerAuxiliaryLineDashLength?: (value: number) => void;
    setRulerTextOffsetX?: (value: number) => void;
    setRulerTextOffsetY?: (value: number) => void;
    setRulerAuxiliaryTextVisible?: (value: boolean) => void;
    setRulerXTextOffsetX?: (value: number) => void;
    setRulerXTextOffsetY?: (value: number) => void;
    setRulerYTextOffsetX?: (value: number) => void;
    setRulerYTextOffsetY?: (value: number) => void;
    setTextAlignment?: (value: CARTA.TextAnnotationPosition) => void;
}

interface AppearanceFormProps {
    region: RegionStore;
    darkTheme: boolean;
    handlers?: AppearanceFormHandlers;
}

@observer
export class AppearanceForm extends React.Component<AppearanceFormProps> {
    private static readonly APPEARANCE_CHANGE_DELAY = 100;

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

    private applyOrSet = <T,>(handler: ((value: T) => void) | undefined, value: T, fallback: (value: T) => void) => {
        if (handler) {
            handler(value);
        } else {
            fallback(value);
        }
    };

    private handleLineWidthChange = _.throttle((value: number) => {
        if (this.props.region) {
            const clampedValue = Math.max(RegionStore.MIN_LINE_WIDTH, Math.min(RegionStore.MAX_LINE_WIDTH, value));
            this.applyOrSet(this.props.handlers?.setLineWidth, clampedValue, nextValue => this.props.region.setLineWidth(nextValue));
        }
    }, AppearanceForm.APPEARANCE_CHANGE_DELAY);

    private handleDashLengthChange = _.throttle((value: number) => {
        if (this.props.region) {
            const clampedValue = Math.max(0, Math.min(RegionStore.MAX_DASH_LENGTH, value));
            this.applyOrSet(this.props.handlers?.setDashLength, clampedValue, nextValue => this.props.region.setDashLength(nextValue));
        }
    }, AppearanceForm.APPEARANCE_CHANGE_DELAY);

    private handlePointShapeChange = (item: CARTA.PointAnnotationShape) => {
        if (this.props.handlers?.setPointShape) {
            this.props.handlers.setPointShape(item);
            return;
        }

        const activeFrame = AppStore.Instance.activeFrame;
        if (activeFrame) {
            const region = activeFrame.regionSet.selectedRegion;
            const frame = activeFrame.spatialReference ?? activeFrame;
            (region as PointAnnotationStore).setPointShape(item);
            frame.pointShapeCache = item;
        }
    };

    private handleCompassAnnotationArrowhead = (selection: string) => {
        const value = selection as "north" | "east" | "both";
        if (this.props.handlers?.setCompassArrowheads) {
            this.props.handlers.setCompassArrowheads(value);
            return;
        }

        const region = this.props.region as CompassAnnotationStore;
        switch (value) {
            case "north":
                region.setNorthArrowhead(true);
                region.setEastArrowhead(false);
                break;
            case "east":
                region.setNorthArrowhead(false);
                region.setEastArrowhead(true);
                break;
            case "both":
                region.setNorthArrowhead(true);
                region.setEastArrowhead(true);
                break;
        }
    };

    public render() {
        const region = this.props.region;
        if (!region || !region.isValid) {
            return null;
        }

        return (
            <div className="appearance-form">
                <FormGroup label="Color" inline={true}>
                    <ColorPickerComponent
                        color={region.color}
                        presetColors={SWATCH_COLORS}
                        setColor={(color: ColorResult) => this.applyOrSet(this.props.handlers?.setColor, color.hex, value => region.setColor(value))}
                        disableAlpha={true}
                        darkTheme={this.props.darkTheme}
                    />
                </FormGroup>
                {region.regionType !== CARTA.RegionType.POINT && region.regionType !== CARTA.RegionType.ANNPOINT && region.regionType !== CARTA.RegionType.ANNTEXT && (
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
                {region.regionType !== CARTA.RegionType.POINT && region.regionType !== CARTA.RegionType.ANNPOINT && region.regionType !== CARTA.RegionType.ANNTEXT && (
                    <FormGroup inline={true} label="Dash length" labelInfo="(px)">
                        <SafeNumericInput placeholder="Dash length" min={0} max={RegionStore.MAX_DASH_LENGTH} value={region.dashLength} stepSize={1} onValueChange={this.handleDashLengthChange} />
                    </FormGroup>
                )}
                {(region.regionType === CARTA.RegionType.ANNCOMPASS || region.regionType === CARTA.RegionType.ANNTEXT || region.regionType === CARTA.RegionType.ANNRULER) && (
                    <>
                        <FormGroup inline={true} label="Font size" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="Font size"
                                min={0.5}
                                max={100}
                                value={(region as TextAnnotationStore)?.fontSize}
                                stepSize={1}
                                onValueChange={value => this.applyOrSet(this.props.handlers?.setFontSize, value, nextValue => (region as TextAnnotationStore)?.setFontSize(nextValue))}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Font">
                            <HTMLSelect
                                options={Object.values(Font)}
                                value={(this.props.region as TextAnnotationStore).font}
                                onChange={ev => this.applyOrSet(this.props.handlers?.setFont, ev.target.value as Font, value => (this.props.region as TextAnnotationStore).setFont(value))}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Font style">
                            <HTMLSelect
                                options={Object.values(FontStyle)}
                                value={(this.props.region as TextAnnotationStore).fontStyle}
                                onChange={ev => this.applyOrSet(this.props.handlers?.setFontStyle, ev.target.value as FontStyle, value => (this.props.region as TextAnnotationStore).setFontStyle(value))}
                            />
                        </FormGroup>
                    </>
                )}
                {region.regionType === CARTA.RegionType.ANNPOINT && (
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
                                onValueChange={width => this.applyOrSet(this.props.handlers?.setPointWidth, width, value => (region as PointAnnotationStore).setPointWidth(value))}
                            />
                        </FormGroup>
                    </>
                )}
                {region.regionType === CARTA.RegionType.ANNVECTOR && (
                    <>
                        <FormGroup inline={true} label="Arrowhead length" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="Length"
                                min={0}
                                max={RegionStore.MAX_DASH_LENGTH}
                                value={(region as VectorAnnotationStore).pointerLength}
                                stepSize={1}
                                onValueChange={value => this.applyOrSet(this.props.handlers?.setVectorPointerLength, value, nextValue => (region as VectorAnnotationStore).setPointerLength(nextValue))}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Arrowhead width" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="Width"
                                min={0}
                                max={RegionStore.MAX_DASH_LENGTH}
                                value={(region as VectorAnnotationStore).pointerWidth}
                                stepSize={1}
                                onValueChange={value => this.applyOrSet(this.props.handlers?.setVectorPointerWidth, value, nextValue => (region as VectorAnnotationStore).setPointerWidth(nextValue))}
                            />
                        </FormGroup>
                    </>
                )}
                {region.regionType === CARTA.RegionType.ANNCOMPASS && (
                    <>
                        <Label>North label offset</Label>
                        <FormGroup inline={true} label="X" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="North label X offset"
                                min={RegionStore.MIN_LABEL_OFFSET}
                                max={RegionStore.MAX_LABEL_OFFSET}
                                value={(this.props.region as CompassAnnotationStore).northTextOffset.x}
                                stepSize={0.5}
                                onValueChange={value => this.applyOrSet(this.props.handlers?.setCompassNorthTextOffsetX, value, nextValue => (this.props.region as CompassAnnotationStore).setNorthTextOffset(nextValue, true))}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Y" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="North label Y offset"
                                min={RegionStore.MIN_LABEL_OFFSET}
                                max={RegionStore.MAX_LABEL_OFFSET}
                                value={(this.props.region as CompassAnnotationStore).northTextOffset.y}
                                stepSize={0.5}
                                onValueChange={value => this.applyOrSet(this.props.handlers?.setCompassNorthTextOffsetY, value, nextValue => (this.props.region as CompassAnnotationStore).setNorthTextOffset(nextValue, false))}
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
                                onValueChange={value => this.applyOrSet(this.props.handlers?.setCompassEastTextOffsetX, value, nextValue => (this.props.region as CompassAnnotationStore).setEastTextOffset(nextValue, true))}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Y" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="East label Y offset"
                                min={RegionStore.MIN_LABEL_OFFSET}
                                max={RegionStore.MAX_LABEL_OFFSET}
                                value={(this.props.region as CompassAnnotationStore).eastTextOffset.y}
                                stepSize={0.5}
                                onValueChange={value => this.applyOrSet(this.props.handlers?.setCompassEastTextOffsetY, value, nextValue => (this.props.region as CompassAnnotationStore).setEastTextOffset(nextValue, false))}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Show arrowhead">
                            <HTMLSelect
                                value={(region as CompassAnnotationStore).eastArrowhead ? ((region as CompassAnnotationStore).northArrowhead ? "both" : "east") : "north"}
                                onChange={ev => this.handleCompassAnnotationArrowhead(ev.target.value)}
                            >
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
                                onValueChange={value => this.applyOrSet(this.props.handlers?.setCompassPointerLength, value, nextValue => (region as CompassAnnotationStore).setPointerLength(nextValue))}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Arrowhead width" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="Width"
                                min={0}
                                max={RegionStore.MAX_DASH_LENGTH}
                                value={(region as CompassAnnotationStore).pointerWidth}
                                stepSize={1}
                                onValueChange={value => this.applyOrSet(this.props.handlers?.setCompassPointerWidth, value, nextValue => (region as CompassAnnotationStore).setPointerWidth(nextValue))}
                            />
                        </FormGroup>
                    </>
                )}
                {region.regionType === CARTA.RegionType.ANNRULER && (
                    <>
                        <FormGroup inline={true} label="Number of decimals">
                            <SafeNumericInput
                                placeholder="Number of decimals"
                                min={0}
                                max={6}
                                value={(region as RulerAnnotationStore).decimals}
                                stepSize={1}
                                onValueChange={value => this.applyOrSet(this.props.handlers?.setRulerDecimals, value, nextValue => (region as RulerAnnotationStore).setDecimals(nextValue))}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Show auxiliary lines">
                            <Switch
                                checked={(region as RulerAnnotationStore).auxiliaryLineVisible}
                                onChange={(ev: React.ChangeEvent<HTMLInputElement>) =>
                                    this.applyOrSet(this.props.handlers?.setRulerAuxiliaryLineVisible, ev.target.checked, value => (region as RulerAnnotationStore).setAuxiliaryLineVisible(value))
                                }
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
                                onValueChange={value => this.applyOrSet(this.props.handlers?.setRulerAuxiliaryLineDashLength, value, nextValue => (region as RulerAnnotationStore).setAuxiliaryLineDashLength(nextValue))}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Text X offset" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="Text X offset"
                                min={RegionStore.MIN_LABEL_OFFSET}
                                max={RegionStore.MAX_LABEL_OFFSET}
                                value={(region as RulerAnnotationStore).textOffset.x}
                                stepSize={1}
                                onValueChange={value => this.applyOrSet(this.props.handlers?.setRulerTextOffsetX, value, nextValue => (region as RulerAnnotationStore).setTextOffset(nextValue, true))}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Text Y offset" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="Text Y offset"
                                min={RegionStore.MIN_LABEL_OFFSET}
                                max={RegionStore.MAX_LABEL_OFFSET}
                                value={(region as RulerAnnotationStore).textOffset.y}
                                stepSize={1}
                                onValueChange={value => this.applyOrSet(this.props.handlers?.setRulerTextOffsetY, value, nextValue => (region as RulerAnnotationStore).setTextOffset(nextValue, false))}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Show auxiliary labels">
                            <Switch
                                disabled={!(region as RulerAnnotationStore).auxiliaryLineVisible}
                                checked={(region as RulerAnnotationStore).auxiliaryTextVisible}
                                onChange={(ev: React.ChangeEvent<HTMLInputElement>) =>
                                    this.applyOrSet(this.props.handlers?.setRulerAuxiliaryTextVisible, ev.target.checked, value => (region as RulerAnnotationStore).setAuxiliaryTextVisible(value))
                                }
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
                                onValueChange={value => this.applyOrSet(this.props.handlers?.setRulerXTextOffsetX, value, nextValue => (region as RulerAnnotationStore).setXTextOffset(nextValue, true))}
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
                                onValueChange={value => this.applyOrSet(this.props.handlers?.setRulerXTextOffsetY, value, nextValue => (region as RulerAnnotationStore).setXTextOffset(nextValue, false))}
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
                                onValueChange={value => this.applyOrSet(this.props.handlers?.setRulerYTextOffsetX, value, nextValue => (region as RulerAnnotationStore).setYTextOffset(nextValue, true))}
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
                                onValueChange={value => this.applyOrSet(this.props.handlers?.setRulerYTextOffsetY, value, nextValue => (region as RulerAnnotationStore).setYTextOffset(nextValue, false))}
                            />
                        </FormGroup>
                    </>
                )}
                {region.regionType === CARTA.RegionType.ANNTEXT && (
                    <FormGroup label="Text alignment" inline={true}>
                        <HTMLSelect
                            options={AppearanceForm.TextAlignmentOptions}
                            value={(region as TextAnnotationStore).position}
                            onChange={ev => this.applyOrSet(this.props.handlers?.setTextAlignment, parseInt(ev.target.value), value => (region as TextAnnotationStore).setPosition(value))}
                        />
                    </FormGroup>
                )}
            </div>
        );
    }
}
