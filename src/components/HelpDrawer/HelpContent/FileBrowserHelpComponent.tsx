import * as React from "react";
import {AppStore} from "stores";
import {ImageComponent} from "./ImageComponent";
import * as underConstruction from "static/help/under_construction.png";

export class FileBrowserHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p>File browser allows users to</p>
                <ul>
                    <li>load images in CASA, FITS, MIRIAD, and HDF5-IDIA schema formats as raster</li>
                    <li>import and export region text files in CASA (.crtf) and ds9 (.reg) formats</li>
                </ul>
                <h3 id="images">Images</h3>
                <p>Images can be loaded as raster via <strong>File</strong> -&gt; <strong>Load image</strong>, or appended as raster
        via <strong>File</strong> -&gt; <strong>Append image</strong>. All loaded images will be closed if users load an
        image with <strong>Load image</strong>. Image shown in the image viewer can be closed via <strong>File</strong>
                    -&gt; <strong>Close image</strong></p>
                <p>When an image file is selected, its basic image properties are summarized in the &quot;File Information&quot; tab
        on the right-hand side. Full image header is shown in the &quot;Header&quot; tab.</p>
                <h3 id="regions">Regions</h3>
                <p>Region files can be imported via <strong>File</strong> -&gt; <strong>Import regions</strong>. When a region file
                    is selected, its content is shown in the &quot;Region Information&quot; tab. Regions can be exported as region
        text files via <strong>File</strong> -&gt; <strong>Export regions</strong>. CASA and ds9 region text file
                    definitions in world or image coordinates are supported. Note that when exporting a region text file, the server
        side needs to provide write permission (not a problem for the Desktop release).</p>
            </div>
        );
    }
}
