import widgetButtonLog from "static/help/widgetButton_log.png";
import widgetButtonLog_d from "static/help/widgetButton_log_d.png";

import {ImageComponent} from "../ImageComponent";

export const LOG_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={widgetButtonLog} dark={widgetButtonLog_d} width="90%" />
        </p>
        <p>The Log widget serves as a vital diagnostic tool, providing essential information when anomalies arise. It offers distinct log levels, each catering to a specific level of detail:</p>
        <ul>
            <li>Debug: intended for in-depth analysis and troubleshooting.</li>
            <li>Info (default): presents general information and updates.</li>
            <li>Warning: highlights potential issues or concerns.</li>
            <li>Error: indicates encountered errors that require attention.</li>
            <li>Critical: identifies critical errors demanding immediate intervention.</li>
        </ul>
        <p>
            Should you encounter situations that raise concerns, we encourage you to reach out for assistance. You can connect with our <a href="mailto:support@carta.freshdesk.com">helpdesk</a> or utilize our{" "}
            <a href="https://github.com/CARTAvis/carta/issues" target="_blank" rel="noreferrer">
                Github
            </a>{" "}
            repository to file an issue.
        </p>
    </div>
);
