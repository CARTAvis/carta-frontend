import * as React from "react";
import {CSSProperties} from "react";
import {AnchorButton, ButtonGroup, Tooltip} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {AppStore} from "stores";

import "./ToolbarComponent.scss";

export class ToolbarComponentProps {
    darkMode: boolean;
    visible: boolean;
    exportImage?: () => void;
    exportData: () => void;
}

@observer
export class ToolbarComponent extends React.Component<ToolbarComponentProps> {
    exportImageTooltip = () => {
        return (
            <span>
                <br />
                <i>
                    <small>
                        Background color is {AppStore.Instance.preferenceStore.transparentImageBackground ? "transparent" : "filled"}.<br />
                        {AppStore.Instance.preferenceStore.transparentImageBackground ? "Disable" : "Enable"} transparent image background in Preferences.
                        <br />
                    </small>
                </i>
            </span>
        );
    };

    render() {
        let styleProps: CSSProperties = {
            opacity: this.props.visible ? 1 : 0
        };
        const className = classNames("profiler-toolbar", {"bp5-dark": this.props.darkMode});

        return (
            <ButtonGroup className={className} style={styleProps}>
                {this.props.exportImage ? (
                    <Tooltip content={<span>Export image {this.exportImageTooltip()}</span>}>
                        <AnchorButton icon="floppy-disk" onClick={this.props.exportImage} />
                    </Tooltip>
                ) : null}
                <Tooltip content="Export data">
                    <AnchorButton icon="th" onClick={this.props.exportData} />
                </Tooltip>
            </ButtonGroup>
        );
    }
}
