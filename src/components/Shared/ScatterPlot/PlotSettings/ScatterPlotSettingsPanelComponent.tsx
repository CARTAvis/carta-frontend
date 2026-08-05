import * as React from "react";
import {FormGroup, Switch} from "@blueprintjs/core";
import {observer} from "mobx-react";

import {ColormapComponent, SafeNumericInput} from "components/Shared";
import {ScatterSettings} from "enums";

import "./ScatterPlotSettingsPanelComponent.scss";

export class ScatterPlotSettingsPanelComponentProps {
    colorMap: string;
    scatterPlotPointSize: number;
    pointTransparency: number;
    areAxesEqual: boolean;
    isColorMapInverted: boolean;
    setPointTransparency: (val: number) => void;
    setScatterPlotPointSize: (val: number) => void;
    setColormap: (val: string) => void;
    handleEqualAxesValuesChanged: (changeEvent: React.ChangeEvent<HTMLInputElement>) => void;
    handleInvertedColorMapChanged: (changeEvent: React.ChangeEvent<HTMLInputElement>) => void;
    shouldShowReferenceAxes: boolean;
    referenceAxesThickness: number;
    referenceAxesColor: string;
    setShowReferenceAxes: (val: boolean) => void;
}

interface ColormapPreviewSession {
    baseColormap: string;
    setColormap: (val: string) => void;
}

@observer
export class ScatterPlotSettingsPanelComponent extends React.Component<ScatterPlotSettingsPanelComponentProps> {
    private colormapPreviewSession: ColormapPreviewSession | null = null;

    componentDidUpdate(prevProps: ScatterPlotSettingsPanelComponentProps) {
        if (prevProps.setColormap !== this.props.setColormap) {
            this.revertColormapPreview();
        }
    }

    componentWillUnmount() {
        this.revertColormapPreview();
    }

    private revertColormapPreview() {
        const session = this.colormapPreviewSession;
        this.colormapPreviewSession = null;
        if (session) {
            session.setColormap(session.baseColormap);
        }
    }

    private handleColormapHovered(colormap: string) {
        if (!this.colormapPreviewSession) {
            this.colormapPreviewSession = {baseColormap: this.props.colorMap, setColormap: this.props.setColormap};
        }
        if (this.props.colorMap !== colormap) {
            this.props.setColormap(colormap);
        }
    }

    private handleColormapSelected(colormap: string) {
        this.colormapPreviewSession = null;
        this.props.setColormap(colormap);
    }

    private handleColormapDropdownOpenChange(isOpen: boolean) {
        if (!isOpen) {
            this.revertColormapPreview();
        }
    }

    render() {
        const props = this.props;
        return (
            <div className="scatter-settings-panel">
                <React.Fragment>
                    <FormGroup inline={true} label="Colormap">
                        <ColormapComponent
                            inverted={props.isColorMapInverted}
                            selectedColormap={props.colorMap}
                            onColormapSelect={selected => this.handleColormapSelected(selected)}
                            onColormapHover={colormap => this.handleColormapHovered(colormap)}
                            onDropdownOpenChange={isOpen => this.handleColormapDropdownOpenChange(isOpen)}
                        />
                    </FormGroup>
                    <FormGroup label={"Invert colormap"} inline={true}>
                        <Switch checked={props.isColorMapInverted} onChange={props.handleInvertedColorMapChanged} />
                    </FormGroup>
                    <FormGroup inline={true} label="Symbol size" labelInfo="(px)">
                        <SafeNumericInput
                            placeholder="Symbol size"
                            min={ScatterSettings.MIN_POINT_SIZE}
                            max={ScatterSettings.MAX_POINT_SIZE}
                            value={props.scatterPlotPointSize}
                            stepSize={ScatterSettings.POINT_SIZE_STEP_SIZE}
                            onValueChange={(value: number) => props.setScatterPlotPointSize(value)}
                        />
                    </FormGroup>
                    <FormGroup inline={true} label="Transparency">
                        <SafeNumericInput
                            placeholder="Transparency"
                            min={ScatterSettings.MIN_TRANSPARENCY}
                            max={ScatterSettings.MAX_TRANSPARENCY}
                            value={props.pointTransparency}
                            stepSize={ScatterSettings.TRANSPARENCY_STEP_SIZE}
                            onValueChange={(value: number) => props.setPointTransparency(value)}
                        />
                    </FormGroup>
                    <FormGroup inline={true} label={"Equal axes"}>
                        <Switch checked={props.areAxesEqual} onChange={props.handleEqualAxesValuesChanged} />
                    </FormGroup>
                </React.Fragment>
                <FormGroup inline={true} label="Reference axes">
                    <Switch checked={props.shouldShowReferenceAxes} onChange={e => props.setShowReferenceAxes((e.target as HTMLInputElement).checked)} />
                </FormGroup>
            </div>
        );
    }
}
