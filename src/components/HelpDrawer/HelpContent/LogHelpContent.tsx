import widgetButtonLog from "static/help/widgetButton_log.png";
import widgetButtonLog_d from "static/help/widgetButton_log_d.png";

import {ImageComponent} from "../ImageComponent";

export const LOG_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={widgetButtonLog} dark={widgetButtonLog_d} width="90%" />
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
            If you believe that something is wrong, please contact the <a href="mailto:support@carta.freshdesk.com">helpdesk</a> or file an issue on{" "}
            <a href="https://github.com/CARTAvis/carta/issues" target="_blank" rel="noreferrer">
                Github
            </a>
            .
        </p>
    </div>
);
