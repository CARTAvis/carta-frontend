import * as React from "react";
import {CSSProperties} from "react";
import {observer} from "mobx-react";
import {AnchorButton, ButtonGroup, Tooltip} from "@blueprintjs/core";
import "./ToolbarComponent.scss";

export class ToolbarComponentProps {
    darkMode: boolean;
    visible: boolean;
    exportImage?: () => void;
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
                {(this.props.exportImage) ?
                    <Tooltip content="Export image">
                        <AnchorButton icon="floppy-disk" onClick={this.props.exportImage}/>
                    </Tooltip> : null}
                <Tooltip content="Export data">
                    <AnchorButton icon="th" onClick={this.props.exportData}/>
                </Tooltip>
            </ButtonGroup>
        );
    }
}