import * as React from "react";
import * as helpFileBrowserPng from "static/help/carta_fn_fileBrowser.png";

export class FileBrowserHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p>File browser, accessible via the menu 
                    <strong>File</strong> -&gt; <strong>Open image</strong> or the menu <strong>File</strong> -&gt; <strong>Append image</strong>, provides information of images supported by CARTA. Currently CARTA supports images in:
                </p>
                <ul >
                    <li>CASA format</li>
                    <li>HDF5 format (IDIA schema)</li>
                    <li>FITS format</li>
                    <li>MIRIAD format</li>
                </ul>
                <p>Only the images matched these formats will be shown in the file list with image type and file size. When an image is selected, a brief summary of image properties is provided on the right side of the dialogue. 
                    Full header is also available in the second tab. To view an image, click the <strong>Load</strong> button at the bottom-right corner. To view a new image with all the loaded images closed, 
                    use <strong>File</strong> -&gt; <strong>Open image</strong> -&gt; <strong>Load</strong>. To view multiple images, use <strong>File</strong> -&gt; <strong>Append image</strong> -&gt; <strong>Append</strong>.</p>
                <img src={helpFileBrowserPng} style={{width: "100%", height: "auto"}}/>
                <p>File browser remembers the last path where an image was opened within one CARTA session and the path is displayed (breadcrumbs) at the top of the dialogue. 
                    Therefore, when the file browser is re-opened to load other images, a file list will be displayed at the last path where the previous image was opened. 
                    Users can use the breadcrumbs to navigate to parent directories.</p>
                <p>For the CARTA-server application, the server administrator can limit the global directory access through the “<em>root</em>” keyword argument when launching the CARTA backend service.</p>
                <div><div><pre><span>exec</span> carta_backend <span>port</span><span>=</span><span>6002</span> <span>base</span><span>=</span>/scratch/images/Orion <span>root</span><span>=</span>/scratch/images
                </pre></div>
                </div>
                <p>In the above example, users will see a list of images at “/scratch/images/Orion” when accessing the file browser dialogue for the first time in a new session. 
                    Users can navigate to any other folders inside “/scratch/images/Orion”. Users can also navigate one level up to “/scratch/images”, but not beyond that (neither “/scratch” nor “/”).</p>
                <div>
                <p>Note</p>
                <p>When viewing images in appending mode, alignments in the world coordinate system (WCS) and the frequency/velocity space are not available in this version. This feature is expected in v1.3.</p>
                </div>
                <div>
                <p>Note</p>
                <p>Position-velocity (PV) images are not currently supported yet.</p>
                </div>
                <div>
                <p>Note</p>
                <p>The ability to close a loaded image will be addressed in v1.3.</p>
                </div>
                <div>
                <p>Warning</p>
                <p>When the file information of an image cube with a <em>per-plane-beam</em> is requested, CARTA will spend a significant amount of time to calculate the beam information. 
                This also applies when opening images with a per-plane-beam. This is a known issue and the development team will try to solve it in future releases.</p>
                </div>
            </div>
        );
    }
}
