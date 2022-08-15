import * as React from "react";
import {observer} from "mobx-react";
import {Button, FormGroup, HTMLSelect} from "@blueprintjs/core";
import {MenuItem2} from "@blueprintjs/popover2";
import {Select2} from "@blueprintjs/select";
import {ColorResult} from "react-color";
import {ContourDashMode, FrameStore} from "stores/Frame";
import {ColormapComponent, ColorPickerComponent, SafeNumericInput} from "components/Shared";
import {SWATCH_COLORS} from "utilities";
import "./ContourStylePanelComponent.scss";

const DashModeSelect = Select2.ofType<ContourDashMode>();

@observer
export class ContourStylePanelComponent extends React.Component<{frame: FrameStore; darkTheme: boolean}> {
    private renderDashModeSelectItem = (mode: ContourDashMode, {handleClick, modifiers, query}) => {
        return <MenuItem2 text={ContourDashMode[mode]} onClick={handleClick} key={mode} />;
    };

    render() {
        const frame = this.props.frame;
        return (
            <div className="contour-style-panel">
                <FormGroup inline={true} label="Thickness">
                    <SafeNumericInput placeholder="Thickness" min={0.5} max={10} value={frame.contourConfig.thickness} majorStepSize={0.5} stepSize={0.5} onValueChange={frame.contourConfig.setThickness} />
                </FormGroup>
                <FormGroup inline={true} label="Dashes">
                    <DashModeSelect
                        activeItem={frame.contourConfig.dashMode}
                        onItemSelect={frame.contourConfig.setDashMode}
                        popoverProps={{minimal: true, position: "bottom"}}
                        filterable={false}
                        items={[ContourDashMode.None, ContourDashMode.Dashed, ContourDashMode.NegativeOnly]}
                        itemRenderer={this.renderDashModeSelectItem}
                    >
                        <Button text={ContourDashMode[frame.contourConfig.dashMode]} rightIcon="double-caret-vertical" alignText={"right"} />
                    </DashModeSelect>
                </FormGroup>
                <FormGroup inline={true} label="Color Mode">
                    <HTMLSelect value={frame.contourConfig.colormapEnabled ? 1 : 0} onChange={ev => frame.contourConfig.setColormapEnabled(parseInt(ev.currentTarget.value) > 0)}>
                        <option key={0} value={0}>
                            Constant Color
                        </option>
                        <option key={1} value={1}>
                            Color-mapped
                        </option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Color Map" disabled={!frame.contourConfig.colormapEnabled}>
                    <ColormapComponent inverted={false} disabled={!frame.contourConfig.colormapEnabled} selectedItem={frame.contourConfig.colormap} onItemSelect={frame.contourConfig.setColormap} />
                </FormGroup>
                <FormGroup inline={true} label="Bias" disabled={!frame.contourConfig.colormapEnabled}>
                    <SafeNumericInput
                        disabled={!frame.contourConfig.colormapEnabled}
                        placeholder="Bias"
                        min={-1.0}
                        max={1.0}
                        value={frame.contourConfig.colormapBias}
                        majorStepSize={0.1}
                        stepSize={0.1}
                        onValueChange={frame.contourConfig.setColormapBias}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Contrast" disabled={!frame.contourConfig.colormapEnabled}>
                    <SafeNumericInput
                        disabled={!frame.contourConfig.colormapEnabled}
                        placeholder="Contrast"
                        min={0.0}
                        max={3.0}
                        value={frame.contourConfig.colormapContrast}
                        majorStepSize={0.1}
                        stepSize={0.1}
                        onValueChange={frame.contourConfig.setColormapContrast}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Color" disabled={frame.contourConfig.colormapEnabled}>
                    <ColorPickerComponent
                        color={frame.contourConfig.color}
                        presetColors={SWATCH_COLORS}
                        setColor={(color: ColorResult) => frame.contourConfig.setColor(color.rgb)}
                        disableAlpha={true}
                        disabled={frame.contourConfig.colormapEnabled}
                        darkTheme={this.props.darkTheme}
                    />
                </FormGroup>
            </div>
        );
    }
}
