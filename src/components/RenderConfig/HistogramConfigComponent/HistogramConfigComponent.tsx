import * as React from "react";
import {Alert, Button, Classes, FormGroup, MenuItem} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import classNames from "classnames";
import {makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {SCALING_POPOVER_PROPS} from "components/Shared";
import {AppStore} from "stores";
import {type RenderConfigStore} from "stores/Frame";

// eslint-disable-next-line @typescript-eslint/naming-convention
const HistogramSelect = Select<boolean>;

interface HistogramConfigProps {
    renderConfig: RenderConfigStore;
    onCubeHistogramSelected: () => void;
    onCubeHistogramCancelled?: () => void;
    darkTheme: boolean;
    warnOnCubeHistogram: boolean;
    showHistogramSelect: boolean;
    disableHistogramSelect: boolean;
}

@observer
export class HistogramConfigComponent extends React.Component<HistogramConfigProps> {
    @observable shouldShowCubeHistogramAlert: boolean = false;

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    renderHistogramSelectItem = (isCube: boolean, {handleClick, modifiers, query}) => {
        return <MenuItem text={isCube ? "Per-cube" : "Per-channel"} onClick={handleClick} key={isCube ? "cube" : "channel"} />;
    };

    handleHistogramChange = (shouldUseCubeHistogram: boolean) => {
        if (shouldUseCubeHistogram && !this.props.renderConfig.cubeHistogram) {
            if (this.props.warnOnCubeHistogram) {
                this.shouldShowCubeHistogramAlert = true;
            } else {
                this.handleAlertConfirm();
            }
        } else {
            this.props.renderConfig.setUseCubeHistogram(shouldUseCubeHistogram);
        }
    };

    render() {
        if (!this.props.renderConfig) {
            return null;
        }

        const renderConfig = this.props.renderConfig;
        return (
            <React.Fragment>
                {this.props.showHistogramSelect && (
                    <FormGroup label={"Histogram"} inline={true} disabled={this.props.disableHistogramSelect}>
                        <HistogramSelect
                            activeItem={renderConfig.isUsingCubeHistogram}
                            popoverProps={SCALING_POPOVER_PROPS}
                            filterable={false}
                            items={[true, false]}
                            onItemSelect={this.handleHistogramChange}
                            itemRenderer={this.renderHistogramSelectItem}
                            disabled={this.props.disableHistogramSelect}
                        >
                            <Button
                                text={renderConfig.isUsingCubeHistogram ? "Per-cube" : "Per-channel"}
                                endIcon="double-caret-vertical"
                                alignText={"right"}
                                disabled={this.props.disableHistogramSelect}
                                data-testid="histogram-mode-dropdown"
                            />
                        </HistogramSelect>
                    </FormGroup>
                )}
                <Alert
                    className={classNames({[Classes.DARK]: AppStore.Instance.isDarkTheme})}
                    icon={"time"}
                    isOpen={this.shouldShowCubeHistogramAlert}
                    onCancel={this.handleAlertCancel}
                    onConfirm={this.handleAlertConfirm}
                    cancelButtonText={"Cancel"}
                >
                    <p>Calculating a cube histogram may take a long time, depending on the size of the file. Are you sure you want to continue?</p>
                </Alert>
            </React.Fragment>
        );
    }

    private handleAlertConfirm = () => {
        this.props.onCubeHistogramSelected();
        this.shouldShowCubeHistogramAlert = false;
    };

    private handleAlertCancel = () => {
        this.shouldShowCubeHistogramAlert = false;
    };
}
