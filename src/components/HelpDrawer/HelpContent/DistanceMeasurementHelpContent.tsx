import dialogButtonDistanceMeasure from "static/help/dialogButton_DistanceMeasure.png";
import dialogButtonDistanceMeasure_d from "static/help/dialogButton_DistanceMeasure_d.png";

import {ImageComponent} from "../ImageComponent";

export const DISTANCE_MEASUREMENT_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={dialogButtonDistanceMeasure} dark={dialogButtonDistanceMeasure_d} width="39%" />
        </p>
        <p>
            With this dialog, you can provide two coordinates for the distance calculations in the <code>Configuration</code> tab. The result will be rendered in the image viewer. The rendering style, including color, line width, and font
            size, can be modified in the <code>Styling</code> tab.
        </p>
    </div>
);
