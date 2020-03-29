import * as React from "react";
import {AppStore} from "stores";
import {ImageComponent} from "./ImageComponent";
import * as underConstruction from "static/help/under_construction.png";

export class LogHelpComponent extends React.Component<{ appStore: AppStore }> {
    public render() {
        return (
            <div>
                <p>Log widget provides information for diagnostics when something went wrong. The log levels include:</p>
                <ul>
                    <li>Debug</li>
                    <li>Info (default)</li>
                    <li>Warning</li>
                    <li>Error</li>
                    <li>Critical</li>
                </ul>
                <p>
                    When users believe there is something wrong, please contact the <a href="mailto:carta_helpdesk@asiaa.sinica.edu.tw">helpdesk</a> or 
                    file an issue on <a href="https://github.com/CARTAvis/carta/issues">Github</a> (recommended).
                </p>

            </div>
        );
    }
}
