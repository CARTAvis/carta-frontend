import dialogButtonFileHeader from "static/help/dialogButton_fileHeader.png";
import dialogButtonFileHeader_d from "static/help/dialogButton_fileHeader_d.png";

import {ImageComponent} from "../ImageComponent";

export const FILE_INFO_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={dialogButtonFileHeader} dark={dialogButtonFileHeader_d} width="39%" />
        </p>
        <p>
            The File Header Dialog provides both a detailed image header (accessible through the <b>Header</b> tab) and a summary of the active image's properties (available under the <b>File Information</b> tab). To view the file headers
            of different images, use either the <b>Image</b> slider in the Animator Widget, or the Image List Widget.
        </p>
        <p>
            You can perform a keyword search in the header or export the header as a text file with the tools in the bottom-right corner of the <b>Header</b> tab.
        </p>
        <h4>NOTE</h4>
        The FITS standard uses a 1-based coordinate system. This means that the origin, defined as the center of the bottom-left pixel, is at <code>(1, 1)</code>. In contrast, CARTA uses a 0-based coordinate system, and the origin (at the
        center of the same pixel) is interpreted as <code>(0, 0)</code>. This adjustment is made through an internal index shift, and also extends to the spectral axis, which ensures consistency across the application.
    </div>
);
