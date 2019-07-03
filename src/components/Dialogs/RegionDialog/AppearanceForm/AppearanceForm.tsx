import * as React from "react";
import * as _ from "lodash";
import {observer} from "mobx-react";
import {observable} from "mobx";
import {SketchPicker, ColorResult} from "react-color";
import {AnchorButton, FormGroup, H5, NumericInput, Popover, PopoverPosition} from "@blueprintjs/core";
import {RegionStore} from "stores";
import "./AppearanceForm.css";

@observer
export class AppearanceForm extends React.Component<{ region: RegionStore, darkTheme: boolean, isPreference?: boolean }> {
    @observable displayColorPicker: boolean;

    private static readonly APPEARANCE_CHANGE_DELAY = 100;

    private handleColorClick = () => {
        this.displayColorPicker = true;
    };

    private handleColorClose = () => {
        this.displayColorPicker = false;
    };

    private handleColorChange = _.throttle((newColor: ColorResult) => {
        if (this.props.region) {
            this.props.region.setColor(newColor.hex);
        }
    }, AppearanceForm.APPEARANCE_CHANGE_DELAY);

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

        let popoverClassName = "appearance-picker-popup";
        if (this.props.darkTheme) {
            popoverClassName += " bp3-dark";
        }

        return (
            <div className="form-section appearance-form">
                {!this.props.isPreference && <H5>Appearance</H5>}
                <div className="form-contents">
                    <FormGroup label="Line Color" inline={true}>
                        <Popover isOpen={this.displayColorPicker} onClose={this.handleColorClose} position={PopoverPosition.RIGHT} popoverClassName={popoverClassName}>
                            <AnchorButton onClick={this.handleColorClick} className="color-swatch-button">
                                <div style={{backgroundColor: region.color}}/>
                            </AnchorButton>
                            <SketchPicker color={region.color} onChange={this.handleColorChange} disableAlpha={true} presetColors={RegionStore.SWATCH_COLORS}/>
                        </Popover>
                    </FormGroup>
                    <FormGroup inline={true} label="Line Width" labelInfo="(px)">
                        <NumericInput
                            placeholder="Line Width"
                            min={RegionStore.MIN_LINE_WIDTH}
                            max={RegionStore.MAX_LINE_WIDTH}
                            value={region.lineWidth}
                            stepSize={0.5}
                            onValueChange={this.handleLineWidthChange}
                        />
                    </FormGroup>
                    <FormGroup inline={true} label="Dash Length" labelInfo="(px)">
                        <NumericInput
                            placeholder="Line Width"
                            min={0}
                            max={RegionStore.MAX_DASH_LENGTH}
                            value={region.dashLength}
                            stepSize={1}
                            onValueChange={this.handleDashLengthChange}
                        />
                    </FormGroup>
                </div>
            </div>
        );
    }
}