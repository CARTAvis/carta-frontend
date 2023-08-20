import dialogButtonFileHeader from "static/help/dialogButton_fileHeader.png";
import dialogButtonFileHeader_d from "static/help/dialogButton_fileHeader_d.png";

import {ImageComponent} from "../ImageComponent";

export const FILE_INFO_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={dialogButtonFileHeader} dark={dialogButtonFileHeader_d} width="39%" />
        </p>
        <p>
            The File Header Dialog provides both a detailed image header (accessible through the <b>Header</b> tab) and a succinct overview of the active image's properties (available under the <b>File Information</b> tab). To access file
            headers of different images, utilize either the <b>Image</b> slider within the Animator Widget or employ the Image List Widget.
        </p>
        <p>
            You can perform keyword search to the header or export the header as a text file with the tools at the bottom-right corner of the <b>Header</b> tab.
        </p>
        <h4>NOTE</h4>
        In the FITS definition, image coordinates originate from a 1-based system, signifying that the reference point lies at the center of the bottom-left corner pixel, denoted as <code>(1, 1)</code>. In contrast, CARTA adopts a 0-based
        coordinate system, resulting in the reference point residing at the center of the same pixel, marked as <code>(0, 0)</code>. This adjustment entails an internal index shift. It's important to note that this indexing adjustment also
        extends to the spectral axis, ensuring consistency across the application.
    </div>
);
