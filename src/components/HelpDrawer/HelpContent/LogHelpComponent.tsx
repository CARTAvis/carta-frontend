import * as React from "react";
import {ImageComponent} from "./ImageComponent";
import headLogButton from "static/help/head_log_button.png";
import headLogButton_d from "static/help/head_log_button_d.png";

export class LogHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p>
                    <ImageComponent light={headLogButton} dark={headLogButton_d} width="90%" />
                </p>
                <p>Log widget provides information for diagnostics when something went wrong. The log levels include:</p>
                <ul>
                    <li>Debug</li>
                    <li>Info (default)</li>
                    <li>Warning</li>
                    <li>Error</li>
                    <li>Critical</li>
                </ul>
                <p>
                    When you believe there is something wrong, please contact the <a href="mailto:carta_helpdesk@asiaa.sinica.edu.tw">helpdesk</a> or file an
                    issue on <a href="https://github.com/CARTAvis/carta/issues">Github</a> (recommended).
                </p>
            </div>
        );
    }
}
