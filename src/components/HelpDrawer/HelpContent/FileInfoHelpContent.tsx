import dialogButtonFileHeader from "static/help/dialogButton_fileHeader.png";
import dialogButtonFileHeader_d from "static/help/dialogButton_fileHeader_d.png";

import {ImageComponent} from "../ImageComponent";

export const FILE_INFO_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={dialogButtonFileHeader} dark={dialogButtonFileHeader_d} width="39%" />
        </p>
        <p>
            The File header dialog provides both a detailed image header (accessible through the Header tab) and a succinct overview of the active image's properties (available under the File Information tab). To access file headers of
            different images, utilize either the image slider within the animator widget or employ the image list widget.
        </p>
        <p>
            You can perform keyword search to the header or export the header as a text file with the tools at the bottom-right corner of the <code>Header</code> tab.
        </p>
        <h4>NOTE</h4>
        In the FITS definition, image coordinates originate from a 1-based system, signifying that the reference point lies at the center of the bottom-left pixel, denoted as (1, 1). In contrast, CARTA adopts a 0-based coordinate system,
        resulting in the reference point residing at the center of the same pixel, marked as (0, 0). This adjustment entails an internal index shift. It's important to note that this indexing adjustment also extends to the spectral axis,
        ensuring consistency across the application.
    </div>
);
