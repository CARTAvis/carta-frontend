import * as React from "react";
import {Button, Divider, NonIdealState} from "@blueprintjs/core";
import "./PopoverSettingsComponent.scss";

export interface PopoverSettingsComponentProps {
    isOpen: boolean;
    contentWidth: number;
    onShowClicked?: () => void;
    onHideClicked?: () => void;
}

export class PopoverSettingsComponent extends React.Component<PopoverSettingsComponentProps> {
    render() {
        return (
            <div className={"popover-settings-container"}>
                <Divider />
                {this.props.isOpen && <Button className="popover-settings-button" icon={"caret-right"} minimal={true} onClick={this.props.onHideClicked} />}
                {this.props.isOpen && (
                    <div className="popover-settings-content" style={{width: this.props.contentWidth}}>
                        {this.props.children ? this.props.children : <NonIdealState icon={"settings"} title={"Placeholder Settings"} />}
                    </div>
                )}
                {!this.props.isOpen && <Button className="popover-settings-button" icon={"cog"} minimal={true} onClick={this.props.onShowClicked} />}
            </div>
        );
    }
}
