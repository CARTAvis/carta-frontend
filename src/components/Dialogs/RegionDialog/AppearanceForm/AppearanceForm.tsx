import * as React from "react";
import {ColorResult} from "react-color";
import {FormGroup, HTMLSelect, Label} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import * as _ from "lodash";
import {observer} from "mobx-react";

import {ColorPickerComponent, SafeNumericInput} from "components/Shared";
import {CompassAnnotationStore, Font, FontStyle, RegionStore, TextAnnotationStore} from "stores/Frame";
import {SWATCH_COLORS} from "utilities";

import "./AppearanceForm.scss";

@observer
export class AppearanceForm extends React.Component<{region: RegionStore; darkTheme: boolean}> {
    private static readonly APPEARANCE_CHANGE_DELAY = 100;

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

    private compassTextOffsetForm = (isNorth: boolean) => {
        if (this.props.region.regionType !== CARTA.RegionType.ANNCOMPASS) {
            return null;
        }

        return (
            <>
                {isNorth ? (
                    <>
                        <Label>North Label</Label>
                        <FormGroup inline={true} label="X Offset" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="North X Offset"
                                min={-50}
                                max={RegionStore.MAX_DASH_LENGTH}
                                value={(this.props.region as CompassAnnotationStore).northTextOffset.x}
                                stepSize={0.5}
                                onValueChange={value => (this.props.region as CompassAnnotationStore).setNorthTextOffset(value, true)}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Y Offset" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="North Y Offset"
                                min={-50}
                                max={RegionStore.MAX_DASH_LENGTH}
                                value={(this.props.region as CompassAnnotationStore).northTextOffset.y}
                                stepSize={0.5}
                                onValueChange={value => (this.props.region as CompassAnnotationStore).setNorthTextOffset(value, false)}
                            />
                        </FormGroup>
                    </>
                ) : (
                    <>
                        <Label>East Label</Label>
                        <FormGroup inline={true} label="X Offset" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="East X Offset"
                                min={-50}
                                max={RegionStore.MAX_DASH_LENGTH}
                                value={(this.props.region as CompassAnnotationStore).eastTextOffset.x}
                                stepSize={0.5}
                                onValueChange={value => (this.props.region as CompassAnnotationStore).setEastTextOffset(value, true)}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Y Offset" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="East Y Offset"
                                min={-50}
                                max={RegionStore.MAX_DASH_LENGTH}
                                value={(this.props.region as CompassAnnotationStore).eastTextOffset.y}
                                stepSize={0.5}
                                onValueChange={value => (this.props.region as CompassAnnotationStore).setEastTextOffset(value, false)}
                            />
                        </FormGroup>
                    </>
                )}
            </>
        );
    };

    public render() {
        const region = this.props.region;
        if (!region || !region.isValid) {
            return null;
        }

        return (
            <div className="form-section appearance-form">
                <div className="form-contents">
                    <FormGroup label="Color" inline={true}>
                        <ColorPickerComponent color={region.color} presetColors={SWATCH_COLORS} setColor={(color: ColorResult) => region.setColor(color.hex)} disableAlpha={true} darkTheme={this.props.darkTheme} />
                    </FormGroup>
                    {region.regionType !== CARTA.RegionType.POINT && region.regionType !== CARTA.RegionType.ANNPOINT && region.regionType !== CARTA.RegionType.ANNTEXT && (
                        <FormGroup inline={true} label="Line Width" labelInfo="(px)">
                            <SafeNumericInput placeholder="Line Width" min={RegionStore.MIN_LINE_WIDTH} max={RegionStore.MAX_LINE_WIDTH} value={region.lineWidth} stepSize={0.5} onValueChange={this.handleLineWidthChange} />
                        </FormGroup>
                    )}
                    {region.regionType !== CARTA.RegionType.POINT && region.regionType !== CARTA.RegionType.ANNPOINT && region.regionType !== CARTA.RegionType.ANNTEXT && (
                        <FormGroup inline={true} label="Dash Length" labelInfo="(px)">
                            <SafeNumericInput placeholder="Dash Length" min={0} max={RegionStore.MAX_DASH_LENGTH} value={region.dashLength} stepSize={1} onValueChange={this.handleDashLengthChange} />
                        </FormGroup>
                    )}
                    {(region.regionType === CARTA.RegionType.ANNCOMPASS || region.regionType === CARTA.RegionType.ANNTEXT || region.regionType === CARTA.RegionType.ANNRULER) && (
                        <>
                            <FormGroup inline={true} label="Font Size" labelInfo="(px)">
                                <SafeNumericInput placeholder="Font Size" min={0.5} max={100} value={(region as TextAnnotationStore)?.fontSize} stepSize={1} onValueChange={value => (region as TextAnnotationStore)?.setFontSize(value)} />
                            </FormGroup>
                            <FormGroup inline={true} label="Font">
                                <HTMLSelect options={Object.values(Font)} value={(this.props.region as TextAnnotationStore).font} onChange={ev => (this.props.region as TextAnnotationStore).setFont(ev.target.value as Font)} />
                            </FormGroup>
                            <FormGroup inline={true} label="Font Style">
                                <HTMLSelect
                                    options={Object.values(FontStyle)}
                                    value={(this.props.region as TextAnnotationStore).fontStyle}
                                    onChange={ev => (this.props.region as TextAnnotationStore).setFontStyle(ev.target.value as FontStyle)}
                                />
                            </FormGroup>
                        </>
                    )}
                    {region.regionType === CARTA.RegionType.ANNCOMPASS && (
                        <>
                            {this.compassTextOffsetForm(true)}
                            {this.compassTextOffsetForm(false)}
                        </>
                    )}
                    {region.regionType === CARTA.RegionType.ANNTEXT && (
                        <FormGroup label="Text Alignment" inline={true}>
                            <HTMLSelect
                                options={Object.keys(CARTA.TextAnnotationPosition)}
                                value={CARTA.TextAnnotationPosition[(this.props.region as TextAnnotationStore).position]}
                                onChange={ev => (this.props.region as TextAnnotationStore).setPosition(CARTA.TextAnnotationPosition[ev.target.value])}
                            />
                        </FormGroup>
                    )}
                    {this.props.children}
                </div>
            </div>
        );
    }
}
