import * as React from "react";
import {observer} from "mobx-react";
import {Checkbox, FormGroup} from "@blueprintjs/core";
import {RenderConfigWidgetStore} from "../../../stores/widgets/RenderConfigWidgetStore";


@observer
export class RenderConfigSettingsPanelComponent extends React.Component<{ widgetStore: RenderConfigWidgetStore }> {

    handleLogScaleChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.props.widgetStore.setLogScale(changeEvent.target.checked);
    };

    render() {
        return (
            <React.Fragment>
                <FormGroup label={"Logarithmic"} inline={true}>
                    <Checkbox checked={this.props.widgetStore.logScaleY} onChange={this.handleLogScaleChanged}/>
                </FormGroup>
            </React.Fragment>
        );
    }
}