import * as React from "react";
import {ColorResult} from "react-color";
import {FormGroup, HTMLSelect, Label, OptionProps, Switch} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import * as _ from "lodash";
import {observer} from "mobx-react";

import {ColorPickerComponent, PointShapeSelectComponent, SafeNumericInput} from "components/Shared";
import {AppStore} from "stores";
import {CompassAnnotationStore, Font, FontStyle, PointAnnotationStore, RegionStore, RulerAnnotationStore, TextAnnotationStore, VectorAnnotationStore} from "stores/Frame";
import {SWATCH_COLORS} from "utilities";

import "./AppearanceForm.scss";

@observer
export class AppearanceForm extends React.Component<{region: RegionStore; darkTheme: boolean}> {
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

    private handleLineWidthChange = _.throttle((value: number) => {
        if (this.props.region) {
            this.props.region.setLineWidth(Math.max(RegionStore.MIN_LINE_WIDTH, Math.min(RegionStore.MAX_LINE_WIDTH, value)));
        }
    }, AppearanceForm.APPEARANCE_CHANGE_DELAY);

    private handleDashLengthChange = _.throttle((value: number) => {
        if (this.props.region) {
            this.props.region.setDashLength(Math.max(0, Math.min(RegionStore.MAX_DASH_LENGTH, value)));
        }
    }, AppearanceForm.APPEARANCE_CHANGE_DELAY);

    private handlePointShapeChange = (item: CARTA.PointAnnotationShape) => {
        const appStore = AppStore.Instance;
        const region = appStore.activeFrame.regionSet.selectedRegion;
        const frame = appStore.activeFrame.spatialReference ?? appStore.activeFrame;
        (region as PointAnnotationStore).setPointShape(item);
        frame.pointShapeCache = item;
    };

    private handleCompassAnnotationArrowhead = (selection: string) => {
        const region = AppStore.Instance.activeFrame.regionSet.selectedRegion as CompassAnnotationStore;
        switch (selection) {
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
                    <ColorPickerComponent color={region.color} presetColors={SWATCH_COLORS} setColor={(color: ColorResult) => region.setColor(color.hex)} disableAlpha={true} darkTheme={this.props.darkTheme} />
                </FormGroup>
                {region.regionType !== CARTA.RegionType.POINT && region.regionType !== CARTA.RegionType.ANNPOINT && region.regionType !== CARTA.RegionType.ANNTEXT && (
                    <FormGroup inline={true} label="Line width" labelInfo="(px)">
                        <SafeNumericInput placeholder="Line width" min={RegionStore.MIN_LINE_WIDTH} max={RegionStore.MAX_LINE_WIDTH} value={region.lineWidth} stepSize={0.5} onValueChange={this.handleLineWidthChange} />
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
                            <SafeNumericInput placeholder="Font size" min={0.5} max={100} value={(region as TextAnnotationStore)?.fontSize} stepSize={1} onValueChange={value => (region as TextAnnotationStore)?.setFontSize(value)} />
                        </FormGroup>
                        <FormGroup inline={true} label="Font">
                            <HTMLSelect options={Object.values(Font)} value={(this.props.region as TextAnnotationStore).font} onChange={ev => (this.props.region as TextAnnotationStore).setFont(ev.target.value as Font)} />
                        </FormGroup>
                        <FormGroup inline={true} label="Font style">
                            <HTMLSelect
                                options={Object.values(FontStyle)}
                                value={(this.props.region as TextAnnotationStore).fontStyle}
                                onChange={ev => (this.props.region as TextAnnotationStore).setFontStyle(ev.target.value as FontStyle)}
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
                            <SafeNumericInput placeholder="Point size" min={0.5} max={50} value={(region as PointAnnotationStore).pointWidth} stepSize={0.5} onValueChange={width => (region as PointAnnotationStore).setPointWidth(width)} />
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
                                onValueChange={value => (region as VectorAnnotationStore).setPointerLength(value)}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Arrowhead width" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="Width"
                                min={0}
                                max={RegionStore.MAX_DASH_LENGTH}
                                value={(region as VectorAnnotationStore).pointerWidth}
                                stepSize={1}
                                onValueChange={value => (region as VectorAnnotationStore).setPointerWidth(value)}
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
                                min={-50}
                                max={RegionStore.MAX_DASH_LENGTH}
                                value={(this.props.region as CompassAnnotationStore).northTextOffset.x}
                                stepSize={0.5}
                                onValueChange={value => (this.props.region as CompassAnnotationStore).setNorthTextOffset(value, true)}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Y" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="North label Y offset"
                                min={-50}
                                max={RegionStore.MAX_DASH_LENGTH}
                                value={(this.props.region as CompassAnnotationStore).northTextOffset.y}
                                stepSize={0.5}
                                onValueChange={value => (this.props.region as CompassAnnotationStore).setNorthTextOffset(value, false)}
                            />
                        </FormGroup>
                        <Label>East label offset</Label>
                        <FormGroup inline={true} label="X" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="East label X offset"
                                min={-50}
                                max={RegionStore.MAX_DASH_LENGTH}
                                value={(this.props.region as CompassAnnotationStore).eastTextOffset.x}
                                stepSize={0.5}
                                onValueChange={value => (this.props.region as CompassAnnotationStore).setEastTextOffset(value, true)}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Y" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="East label Y offset"
                                min={-50}
                                max={RegionStore.MAX_DASH_LENGTH}
                                value={(this.props.region as CompassAnnotationStore).eastTextOffset.y}
                                stepSize={0.5}
                                onValueChange={value => (this.props.region as CompassAnnotationStore).setEastTextOffset(value, false)}
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
                                onValueChange={value => (region as CompassAnnotationStore).setPointerLength(value)}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Arrowhead width" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="Width"
                                min={0}
                                max={RegionStore.MAX_DASH_LENGTH}
                                value={(region as CompassAnnotationStore).pointerWidth}
                                stepSize={1}
                                onValueChange={value => (region as CompassAnnotationStore).setPointerWidth(value)}
                            />
                        </FormGroup>
                    </>
                )}
                {region.regionType === CARTA.RegionType.ANNRULER && (
                    <>
                        <FormGroup inline={true} label="Show auxiliary lines">
                            <Switch checked={(region as RulerAnnotationStore).auxiliaryLineVisible} onChange={(ev: React.ChangeEvent<HTMLInputElement>) => (region as RulerAnnotationStore).setAuxiliaryLineVisible(ev.target.checked)} />
                        </FormGroup>
                        <FormGroup inline={true} label="Auxiliary lines dash length" labelInfo="(px)">
                            <SafeNumericInput
                                disabled={!(region as RulerAnnotationStore).auxiliaryLineVisible}
                                placeholder="Dash length"
                                min={0}
                                max={RegionStore.MAX_DASH_LENGTH}
                                value={(region as RulerAnnotationStore).auxiliaryLineDashLength}
                                stepSize={1}
                                onValueChange={value => (region as RulerAnnotationStore).setAuxiliaryLineDashLength(value)}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Text X offset" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="Text X offset"
                                min={-50}
                                max={RegionStore.MAX_DASH_LENGTH}
                                value={(region as RulerAnnotationStore).textOffset.x}
                                stepSize={1}
                                onValueChange={value => (region as RulerAnnotationStore).setTextOffset(value, true)}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Text Y offset" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="Text Y offset"
                                min={-50}
                                max={RegionStore.MAX_DASH_LENGTH}
                                value={(region as RulerAnnotationStore).textOffset.y}
                                stepSize={1}
                                onValueChange={value => (region as RulerAnnotationStore).setTextOffset(value, false)}
                            />
                        </FormGroup>
                    </>
                )}
                {region.regionType === CARTA.RegionType.ANNTEXT && (
                    <FormGroup label="Text alignment" inline={true}>
                        <HTMLSelect options={AppearanceForm.TextAlignmentOptions} value={(region as TextAnnotationStore).position} onChange={ev => (region as TextAnnotationStore).setPosition(parseInt(ev.target.value))} />
                    </FormGroup>
                )}
            </div>
        );
    }
}
