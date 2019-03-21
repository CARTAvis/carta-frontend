import * as React from "react";
import * as _ from "lodash";
import {observer} from "mobx-react";
import {observable} from "mobx";
import {SketchPicker, ColorResult} from "react-color";
import {AnchorButton, Callout, Colors, FormGroup, NonIdealState, NumericInput, Popover, PopoverPosition} from "@blueprintjs/core";
import {RegionStore} from "stores";
import "./AppearanceForm.css";

@observer
export class AppearanceForm extends React.Component<{ region: RegionStore, darkTheme: boolean}> {
    @observable displayColorPicker: boolean;

    private static readonly APPEARANCE_CHANGE_DELAY = 100;
    private static readonly MIN_LINE_WIDTH = 0.5;
    private static readonly MAX_LINE_WIDTH = 10;
    private static readonly MAX_DASH_LENGTH = 50;

    private static readonly SWATCH_COLORS = [
        Colors.BLUE3,
        Colors.GREEN3,
        Colors.ORANGE3,
        Colors.RED3,
        Colors.VERMILION3,
        Colors.ROSE3,
        Colors.VIOLET3,
        Colors.INDIGO3,
        Colors.COBALT3,
        Colors.TURQUOISE3,
        Colors.FOREST3,
        Colors.LIME3,
        Colors.GOLD3,
        Colors.SEPIA3,
        Colors.BLACK,
        Colors.DARK_GRAY3,
        Colors.GRAY3,
        Colors.LIGHT_GRAY3,
        Colors.WHITE
    ];

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
            this.props.region.setLineWidth(Math.max(AppearanceForm.MIN_LINE_WIDTH, Math.min(AppearanceForm.MAX_LINE_WIDTH, value)));
        }
    }, AppearanceForm.APPEARANCE_CHANGE_DELAY);

    private handleDashLengthChange = _.throttle((value: number) => {
        if (this.props.region) {
            this.props.region.setDashLength(Math.max(0, Math.min(AppearanceForm.MAX_DASH_LENGTH, value)));
        }
    }, AppearanceForm.APPEARANCE_CHANGE_DELAY);

    public render() {
        const region = this.props.region;
        if (!region || !region.isValid) {
            return <NonIdealState icon={"error"} title={"Missing region"} description={"Region not found"}/>;
        }

        let popoverClassName = "appearance-picker-popup";
        if (this.props.darkTheme) {
            popoverClassName += " bp3-dark";
        }

        return (
            <Callout title="Appearance" className="appearance-form">
                <div className="form-contents">
                    <FormGroup label="Line Color" inline={true}>
                        <Popover isOpen={this.displayColorPicker} onClose={this.handleColorClose} position={PopoverPosition.RIGHT} popoverClassName={popoverClassName}>
                            <AnchorButton onClick={this.handleColorClick} className="color-swatch-button">
                                <div style={{backgroundColor: region.color}}/>
                            </AnchorButton>
                            <SketchPicker color={region.color} onChange={this.handleColorChange} disableAlpha={true} presetColors={AppearanceForm.SWATCH_COLORS}/>
                        </Popover>
                    </FormGroup>
                    <FormGroup inline={true} label="Line Width" labelInfo="(px)">
                        <NumericInput
                            placeholder="Line Width"
                            min={AppearanceForm.MIN_LINE_WIDTH}
                            max={AppearanceForm.MAX_LINE_WIDTH}
                            value={region.lineWidth}
                            stepSize={0.5}
                            onValueChange={this.handleLineWidthChange}
                        />
                    </FormGroup>
                    <FormGroup inline={true} label="Dash Length" labelInfo="(px)">
                        <NumericInput
                            placeholder="Line Width"
                            min={0}
                            max={AppearanceForm.MAX_DASH_LENGTH}
                            value={region.dashLength}
                            stepSize={1}
                            onValueChange={this.handleDashLengthChange}
                        />
                    </FormGroup>
                </div>
            </Callout>
        );
    }
}