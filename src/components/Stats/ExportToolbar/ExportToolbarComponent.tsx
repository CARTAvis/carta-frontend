import * as React from "react";
import {CSSProperties} from "react";
import {observer} from "mobx-react";
import {AnchorButton, ButtonGroup, Tooltip} from "@blueprintjs/core";
import "./ExportToolbarComponent.scss";

export class ExportToolbarComponentProps {
    visible: boolean;
    exportData: () => void;
}

@observer
export class ExportToolbarComponent extends React.Component<ExportToolbarComponentProps> {

    render() {

        let styleProps: CSSProperties = {
            opacity: this.props.visible ? 1 : 0
        };

        let className = "stats-export-toolbar";

        return (
            <ButtonGroup className={className} style={styleProps}>
                <Tooltip content="Export data">
                    <AnchorButton icon="th" onClick={this.props.exportData}/>
                </Tooltip>
            </ButtonGroup>
        );
    }
}