import * as React from "react";
import "./LogComponent.css";
import {LogState} from "../../states/LogState";
import {observer} from "mobx-react";
import {Tooltip} from "@blueprintjs/core";

@observer
export class LogComponent extends React.Component<{ logState: LogState }> {

    handleClick = () => {
        if (this.props.logState) {
            this.props.logState.clearLog();
        }
    };

    render() {
        const entries = this.props.logState.logEntries;
        const logString = entries.map(entry => entry.message).join("\n");
        return (
            <div className="log">
                <pre>{logString}</pre>
                <Tooltip content="Clear log entries">
                    <button type="button" className="pt-button pt-minimal pt-small pt-intent-warning pt-icon-delete" onClick={this.handleClick}/>
                </Tooltip>
            </div>);
    }
}