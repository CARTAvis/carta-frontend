import {ImageComponent} from "../ImageComponent";
import dialogButtonFileHeader from "static/help/dialogButton_fileHeader.png";
import dialogButtonFileHeader_d from "static/help/dialogButton_fileHeader_d.png";

export const FILE_INFO_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={dialogButtonFileHeader} dark={dialogButtonFileHeader_d} width="39%" />
        </p>
        <p>
            File header dialog provides full image header (<code>Header</code> tab) and a summary of the properties of the active image (<code>File Information</code> tab). To view the file headers of other images, use the image slider in
            the animator widget, or use the image list widget.
        </p>
        <p>
            You can search the header or export the header as a text file with the tools at the bottom-right corner of the <code>Header</code> tab.
        </p>
        <h4>NOTE</h4>
        The image coordinate in FITS definition is 1-based, meaning that the image coordinate at the center of the bottom-left corner pixel is (1, 1). In CARTA, image coordinate is 0-based so that the image coordinate at the center of the
        bottom-left corner pixel is (0, 0). An index shift is applied internally. This applies to spectral axis too.
    </div>
);
