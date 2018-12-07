import * as React from "react";
import {CSSProperties} from "react";
import {observer} from "mobx-react";
import "./ToolbarComponent.css";
import {Button, ButtonGroup, Tooltip} from "@blueprintjs/core";

export class ToolbarComponentProps {
    darkMode: boolean;
    visible: boolean;
    disabled: boolean;
    exportImage: () => void;
    exportData: () => void;
}

@observer
export class ToolbarComponent extends React.Component<ToolbarComponentProps> {

    render() {
        let styleProps: CSSProperties = {
            opacity: this.props.visible ? 1 : 0
        };

        let className = "profiler-toolbar";

        if (this.props.darkMode) {
            className += " bp3-dark";
        }

        return (
            <ButtonGroup className={className} style={styleProps}>
                <Tooltip content="Export image">
                    <Button icon="floppy-disk" disabled={this.props.disabled} onClick={this.props.exportImage}/>
                </Tooltip>
                <Tooltip content="Export data">
                    <Button icon="th" disabled={this.props.disabled} onClick={this.props.exportData}/>
                </Tooltip>
            </ButtonGroup>
        );
    }
}
