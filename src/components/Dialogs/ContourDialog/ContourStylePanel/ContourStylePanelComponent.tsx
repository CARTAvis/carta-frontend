import * as React from "react";
import {Button, FormGroup, HTMLSelect, MenuItem, Switch} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import type {ColorResult} from "@uiw/react-color";
import {observer} from "mobx-react";

import {ColormapComponent, ColorPickerComponent, SafeNumericInput} from "components/Shared";
import {ContourDashMode} from "enums";
import {type ContourConfigStore, type FrameStore} from "stores/Frame";
import {SWATCH_COLORS} from "utilities";

import "./ContourStylePanelComponent.scss";

// eslint-disable-next-line @typescript-eslint/naming-convention
const DashModeSelect = Select<ContourDashMode>;

interface ColormapPreviewSession {
    config: ContourConfigStore;
    baseColormap: string;
}

@observer
export class ContourStylePanelComponent extends React.Component<{frame: FrameStore; darkTheme: boolean}> {
    private colormapPreviewSession: ColormapPreviewSession | null = null;

    componentDidUpdate(prevProps: {frame: FrameStore; darkTheme: boolean}) {
        if (prevProps.frame.contourConfig !== this.props.frame.contourConfig) {
            this.revertColormapPreview();
        }
    }

    componentWillUnmount() {
        this.revertColormapPreview();
    }

    private revertColormapPreview() {
        const session = this.colormapPreviewSession;
        this.colormapPreviewSession = null;
        if (session && session.config.colormap !== session.baseColormap) {
            session.config.setColormap(session.baseColormap);
        }
    }

    private handleColormapHovered(config: ContourConfigStore, colormap: string) {
        if (this.colormapPreviewSession?.config !== config) {
            this.revertColormapPreview();
            this.colormapPreviewSession = {config, baseColormap: config.colormap};
        }
        if (config.colormap !== colormap) {
            config.setColormap(colormap);
        }
    }

    private handleColormapSelected(config: ContourConfigStore, colormap: string) {
        if (this.colormapPreviewSession && this.colormapPreviewSession.config !== config) {
            this.revertColormapPreview();
        } else {
            this.colormapPreviewSession = null;
        }
        config.setColormap(colormap);
    }

    private handleColormapDropdownOpenChange(isOpen: boolean) {
        if (!isOpen) {
            this.revertColormapPreview();
        }
    }

    private renderDashModeSelectItem = (mode: ContourDashMode, {handleClick, modifiers, query}) => {
        return <MenuItem text={mode} onClick={handleClick} key={mode} />;
    };

    render() {
        const frame = this.props.frame;
        return (
            <div className="contour-style-panel">
                <FormGroup inline={true} label="Thickness">
                    <SafeNumericInput
                        placeholder="Thickness"
                        min={0.5}
                        max={10}
                        value={frame.contourConfig.thickness}
                        majorStepSize={0.5}
                        stepSize={0.5}
                        onValueChange={frame.contourConfig.setThickness}
                        data-testid="contour-thickness-input"
                    />
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
                        <Button text={frame.contourConfig.dashMode} endIcon="double-caret-vertical" alignText={"right"} />
                    </DashModeSelect>
                </FormGroup>
                <FormGroup inline={true} label="Color mode">
                    <HTMLSelect value={frame.contourConfig.isColormapEnabled ? 1 : 0} onChange={ev => frame.contourConfig.setColormapEnabled(parseInt(ev.currentTarget.value) > 0)}>
                        <option key={0} value={0}>
                            Constant color
                        </option>
                        <option key={1} value={1}>
                            Color-mapped
                        </option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Colormap" disabled={!frame.contourConfig.isColormapEnabled}>
                    <ColormapComponent
                        inverted={frame.contourConfig.isColormapInverted}
                        disabled={!frame.contourConfig.isColormapEnabled}
                        selectedColormap={frame.contourConfig.colormap}
                        onColormapSelect={colormap => this.handleColormapSelected(frame.contourConfig, colormap)}
                        onColormapHover={colormap => this.handleColormapHovered(frame.contourConfig, colormap)}
                        onDropdownOpenChange={isOpen => this.handleColormapDropdownOpenChange(isOpen)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Invert colormap" disabled={!frame.contourConfig.isColormapEnabled}>
                    <Switch checked={frame.contourConfig.isColormapInverted} onChange={ev => frame.contourConfig.setColormapInverted(ev.currentTarget.checked)} disabled={!frame.contourConfig.isColormapEnabled} />
                </FormGroup>
                <FormGroup inline={true} label="Bias" disabled={!frame.contourConfig.isColormapEnabled}>
                    <SafeNumericInput
                        disabled={!frame.contourConfig.isColormapEnabled}
                        placeholder="Bias"
                        min={-1.0}
                        max={1.0}
                        value={frame.contourConfig.colormapBias}
                        majorStepSize={0.1}
                        stepSize={0.1}
                        onValueChange={frame.contourConfig.setColormapBias}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Contrast" disabled={!frame.contourConfig.isColormapEnabled}>
                    <SafeNumericInput
                        disabled={!frame.contourConfig.isColormapEnabled}
                        placeholder="Contrast"
                        min={0.0}
                        max={3.0}
                        value={frame.contourConfig.colormapContrast}
                        majorStepSize={0.1}
                        stepSize={0.1}
                        onValueChange={frame.contourConfig.setColormapContrast}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Color" disabled={frame.contourConfig.isColormapEnabled}>
                    <ColorPickerComponent
                        color={frame.contourConfig.color}
                        presetColors={SWATCH_COLORS}
                        setColor={(color: ColorResult) => frame.contourConfig.setColor(color.rgba)}
                        disableAlpha={true}
                        disabled={frame.contourConfig.isColormapEnabled}
                        darkTheme={this.props.darkTheme}
                    />
                </FormGroup>
            </div>
        );
    }
}
