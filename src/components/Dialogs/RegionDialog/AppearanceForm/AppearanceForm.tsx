import * as React from "react";
import * as _ from "lodash";
import {ColorResult} from "react-color";
import {FormGroup, H5, NumericInput} from "@blueprintjs/core";
import {ColorPickerComponent} from "components/Shared";
import {RegionStore} from "stores";
import {CARTA} from "carta-protobuf";
import "./AppearanceForm.css";

export class AppearanceForm extends React.Component<{ region: RegionStore, darkTheme: boolean }> {
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

    public render() {
        const region = this.props.region;
        if (!region || !region.isValid) {
            return null;
        }

        return (
            <div className="form-section appearance-form">
                <H5>Appearance</H5>
                <div className="form-contents">
                    <FormGroup label="Color" inline={true}>
                        <ColorPickerComponent
                            color={region.color}
                            presetColors={RegionStore.SWATCH_COLORS}
                            setColor={(color: ColorResult) => region.setColor(color.hex)}
                            disableAlpha={true}
                            darkTheme={this.props.darkTheme}
                        />
                    </FormGroup>
                    {region.regionType !== CARTA.RegionType.POINT &&
                        <FormGroup  inline={true} label="Line Width" labelInfo="(px)"> 
                            <NumericInput
                                    placeholder="Line Width"
                                    min={RegionStore.MIN_LINE_WIDTH}
                                    max={RegionStore.MAX_LINE_WIDTH}
                                    value={region.lineWidth}
                                    stepSize={0.5}
                                    onValueChange={this.handleLineWidthChange}
                            />
                        </FormGroup>
                    }
                    {region.regionType !== CARTA.RegionType.POINT &&
                        <FormGroup inline={true} label="Dash Length" labelInfo="(px)">  
                            <NumericInput
                                placeholder="Dash Length"
                                min={0}
                                max={RegionStore.MAX_DASH_LENGTH}
                                value={region.dashLength}
                                stepSize={1}
                                onValueChange={this.handleDashLengthChange}
                            />
                        </FormGroup>
                    }
                </div>
            </div>
        );
    }
}