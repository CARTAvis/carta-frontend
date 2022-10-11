import * as React from "react";
import {observer} from "mobx-react";
import * as _ from "lodash";
import {ColorResult} from "react-color";
import {FormGroup, H5} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {ColorPickerComponent, SafeNumericInput} from "components/Shared";
import {RegionStore, TextAnnotationStore} from "stores/Frame";
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
                        <ColorPickerComponent color={region.color} presetColors={SWATCH_COLORS} setColor={(color: ColorResult) => region.setColor(color.hex)} disableAlpha={true} darkTheme={this.props.darkTheme} />
                    </FormGroup>
                    {region.regionType !== CARTA.RegionType.POINT && (
                        <FormGroup inline={true} label="Line Width" labelInfo="(px)">
                            <SafeNumericInput placeholder="Line Width" min={RegionStore.MIN_LINE_WIDTH} max={RegionStore.MAX_LINE_WIDTH} value={region.lineWidth} stepSize={0.5} onValueChange={this.handleLineWidthChange} />
                        </FormGroup>
                    )}
                    {region.regionType !== CARTA.RegionType.POINT && (
                        <FormGroup inline={true} label="Dash Length" labelInfo="(px)">
                            <SafeNumericInput placeholder="Dash Length" min={0} max={RegionStore.MAX_DASH_LENGTH} value={region.dashLength} stepSize={1} onValueChange={this.handleDashLengthChange} />
                        </FormGroup>
                    )}
                    {(region.regionType === CARTA.RegionType.ANNCOMPASS || region.regionType === CARTA.RegionType.ANNTEXT || region.regionType === CARTA.RegionType.ANNRULER) && (
                        <FormGroup inline={true} label="Font Size" labelInfo="(px)">
                            <SafeNumericInput placeholder="Font Size" min={0.5} max={100} value={(region as TextAnnotationStore)?.fontSize} stepSize={1} onValueChange={value => (region as TextAnnotationStore)?.setFontSize(value)} />
                        </FormGroup>
                    )}
                </div>
            </div>
        );
    }
}
