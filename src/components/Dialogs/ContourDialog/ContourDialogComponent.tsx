import * as React from "react";
import {observer} from "mobx-react";
import {AnchorButton, Button, Classes, FormGroup, HTMLSelect, IDialogProps, Intent, MenuItem, NonIdealState, NumericInput} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import {ColorResult} from "react-color";
import {DraggableDialogComponent} from "components/Dialogs";
import {ColormapComponent, ColorPickerComponent} from "components/Shared";
import {AppStore, ContourDashMode, FrameStore} from "stores";
import {SWATCH_COLORS} from "utilities";
import "./ContourDialogComponent.css";

const DataSourceSelect = Select.ofType<FrameStore>();
const DashModeSelect = Select.ofType<ContourDashMode>();

@observer
export class ContourDialogComponent extends React.Component<{ appStore: AppStore }> {
    constructor(props: { appStore: AppStore }) {
        super(props);
    }

    private renderDataSourceSelectItem = (frame: FrameStore, {handleClick, modifiers, query}) => {
        if (!frame) {
            return null;
        }
        return <MenuItem text={frame.frameInfo.fileInfo.name} onClick={handleClick} key={frame.frameInfo.fileId}/>;
    };

    private renderDashModeSelectItem = (mode: ContourDashMode, {handleClick, modifiers, query}) => {
        return <MenuItem text={ContourDashMode[mode]} onClick={handleClick} key={mode}/>;
    };

    private handleDataSourceSelected = (frame: FrameStore) => {
        this.props.appStore.setActiveFrame(frame.frameInfo.fileId);
    };

    private handleApplyContours = () => {
        const appStore = this.props.appStore;
        if (!appStore || !appStore.activeFrame) {
            return;
        }

        appStore.activeFrame.applyContours();

    };

    private handleClearContours = () => {
        const appStore = this.props.appStore;
        if (!appStore || !appStore.activeFrame) {
            return;
        }

        appStore.activeFrame.clearContours();
    };

    public render() {
        const appStore = this.props.appStore;

        const dialogProps: IDialogProps = {
            icon: "heatmap",
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.contourDialogVisible,
            onClose: appStore.hideContourDialog,
            className: "contour-dialog",
            canEscapeKeyClose: false,
            title: "Contour Configuration",
        };

        if (!appStore || !appStore.activeFrame) {
            return (
                <DraggableDialogComponent dialogProps={dialogProps} defaultWidth={960} defaultHeight={620} enableResizing={true}>
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"}/>
                </DraggableDialogComponent>
            );
        }

        const frame = appStore.activeFrame;

        return (
            <DraggableDialogComponent dialogProps={dialogProps} defaultWidth={960} defaultHeight={620} enableResizing={true}>
                <div className={Classes.DIALOG_BODY}>
                    <div className="contour-left-dialog">
                        <FormGroup inline={true} label="Data Source">
                            <DataSourceSelect
                                activeItem={frame}
                                onItemSelect={this.handleDataSourceSelected}
                                popoverProps={{minimal: true, position: "bottom"}}
                                filterable={false}
                                items={appStore.frames}
                                itemRenderer={this.renderDataSourceSelectItem}
                            >
                                <Button text={frame.frameInfo.fileInfo.name} rightIcon="double-caret-vertical" alignText={"right"}/>
                            </DataSourceSelect>
                        </FormGroup>
                        <FormGroup inline={true} label="Thickness">
                            <NumericInput
                                placeholder="Thickness"
                                min={0.5}
                                max={10}
                                value={frame.contourConfig.thickness}
                                majorStepSize={0.5}
                                stepSize={0.5}
                                onValueChange={frame.contourConfig.setThickness}
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
                                <Button text={ContourDashMode[frame.contourConfig.dashMode]} rightIcon="double-caret-vertical" alignText={"right"}/>
                            </DashModeSelect>
                        </FormGroup>
                        <FormGroup inline={true} label="Color Mode">
                            <HTMLSelect value={frame.contourConfig.colormapEnabled ? 1 : 0} onChange={(ev) => frame.contourConfig.setColormapEnabled(parseInt(ev.currentTarget.value) > 0)}>
                                <option key={0} value={0}>Constant Color</option>
                                <option key={1} value={1}>Color-mapped</option>
                            </HTMLSelect>
                        </FormGroup>
                        <FormGroup inline={true} label="Color Map" disabled={!frame.contourConfig.colormapEnabled}>
                            <ColormapComponent
                                inverted={false}
                                disabled={!frame.contourConfig.colormapEnabled}
                                selectedItem={frame.contourConfig.colormap}
                                onItemSelect={frame.contourConfig.setColormap}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Color" disabled={frame.contourConfig.colormapEnabled}>
                            <ColorPickerComponent
                                color={frame.contourConfig.color}
                                presetColors={SWATCH_COLORS}
                                setColor={(color: ColorResult) => frame.contourConfig.setColor(color.rgb)}
                                disableAlpha={true}
                                disabled={frame.contourConfig.colormapEnabled}
                                darkTheme={appStore.darkTheme}
                            />
                        </FormGroup>
                    </div>
                    <div className="contour-right-dialog">
                        <p>Placeholder</p>
                        <p>Placeholder</p>
                    </div>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <AnchorButton intent={Intent.WARNING} onClick={this.handleClearContours} text="Clear"/>
                        <AnchorButton intent={Intent.SUCCESS} onClick={this.handleApplyContours} text="Apply"/>
                        <AnchorButton intent={Intent.NONE} onClick={appStore.hideContourDialog} text="Close"/>
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}
