import dialogButtonPreferences from "static/help/dialogButton_preferences.png";
import dialogButtonPreferences_d from "static/help/dialogButton_preferences_d.png";

import {ImageComponent} from "../ImageComponent";

export const PREFERENCES_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={dialogButtonPreferences} dark={dialogButtonPreferences_d} width="39%" />
        </p>
        <p>
            The Preferences Dialog provides a centralized place to customize the entire graphical user interface and performance control parameters. All settings are recorded and applied to new CARTA sessions. Some settings are effective
            immediately.
        </p>
        <h3 id="global">Global</h3>
        <p>This section provides usability customization.</p>
        <ul>
            <li>Theme: the color theme of the graphical user interface (effective immediately)</li>
            <li>Enable code snippets: enable the in-browser scripting capability in JavaScript</li>
            <li>Auto-launch file browser: launch file browser when CARTA is initialized</li>
            <li>File list: the file parsing mode for file list generation</li>
            <li>Initial layout: the default layout for a new CARTA session</li>
            <li>Initial cursor position: fix cursor at the image center or have cursor free to move when CARTA is initialized</li>
            <li>Initial zoom level: view full image or view image with one image pixel to one screen pixel ratio when CARTA is initialized</li>
            <li>Zoom to: control the focus of zooming with scrolling wheel</li>
            <li>
                Enable drag-to-pan: when enabled, pan action is achieved by <code>drag-and-drop</code>. When disabled, pan action is achieved by a click where the clicked pixel will be centered in the Image Viewer.
            </li>
            <li>WCS matching on append: trigger WCS matching automatically for newly appended images</li>
            <li>Spectral matching: spectral convention to be used for spectral matching of image cubes</li>
            <li>Transparent image background: when this is enabled, the exported png image will have a transparent background. When it is disabled (default), a white or a black background is added depending on the GUI theme.</li>
            <li>Save last used directory: when this is enabled, the starting directory of a new CARTA session will be the last one used to load an image in the previous CARTA session.</li>
        </ul>
        <h3 id="render-configuration">Render Configuration</h3>
        <p>This section provides customization of how a raster image is rendered by default.</p>
        <ul>
            <li>Default scaling: scaling function to be applied to the pixel value-to-color mapping</li>
            <li>Default colormap: colormap for rendering a raster image</li>
            <li>Default percentile ranks: clip level to be applied to the pixel value-to-color mapping</li>
            <li>NaN color: color to render a NaN (not a number) pixel (effective immediately)</li>
            <li>Smoothed bias/contrast: when this is enabled (default), smoothed bias and contrast functions are applied, resulting in a smooth scaling function. When it is disabled, the final scaling function contains kinks.</li>
        </ul>
        <h3 id="contour-configuration">Contour Configuration</h3>
        <p>This section provides customization of how a contour layer is calculated and rendered by default.</p>
        <ul>
            <li>Generator type: default level generator type</li>
            <li>Smoothing mode: smoothing method to be applied to the image before calculating contour vertices</li>
            <li>Default smoothing factor: kernel size of the selected smoothing mode in pixel</li>
            <li>Default contour levels: number of contour levels to be generated</li>
            <li>Thickness: contour line thickness</li>
            <li>Default color mode: to render contours with constant color or to render color-mapped contours</li>
            <li>Default colormap: the colormap for rendering color-mapped contours</li>
            <li>Default color: the color for rendering contours in constant color</li>
        </ul>
        <h3 id="vector-overlay-configuration">Vector Overlay Configuration</h3>
        <p>This section provides customization of how a vector field layer is calculated and rendered by default.</p>
        <ul>
            <li>Default pixel averaging: square kernel size for averaging before computing the vector field elements</li>
            <li>Use fractional intensity: compute fractional linear polarization intensity instead of linear polarization intensity</li>
            <li>Thickness: the line thickness for each vector field element</li>
            <li>Default color mode: to render a vector field with constant color or to render a color-mapped vector field</li>
            <li>Default colormap: the colormap for rendering a color-mapped vector field</li>
            <li>Default color: the color for rendering a vector field in constant color</li>
        </ul>
        <h3 id="wcs-image-overlay-configuration">WCS and Image Overlay</h3>
        <p>This section provides customization of the image overlay in the Image Viewer.</p>
        <ul>
            <li>Color: the default color of the grid layer and the coordinate bound box</li>
            <li>WCS grid visible: grid line rendering</li>
            <li>Labels visible: x and y grid labels rendering</li>
            <li>Cursor info visible: the condition when the cursor info bar in the Image Viewer should be rendered</li>
            <li>WCS format: show world coordinate in degrees or sexagesimal or auto-formatted</li>
            <li>Colorbar visible: show a colorbar along with the image</li>
            <li>Colorbar interactive: enable the interactive mode of the colorbar to trigger interactive raster image cutoff rendering</li>
            <li>Colorbar position: the position where the colorbar is rendered</li>
            <li>Colorbar width (px): the width of the colorbar in screen pixel</li>
            <li>Colorbar ticks density (per 100px): the ticks density of the colorbar per 100 screen pixels</li>
            <li>Colorbar label visible: show a colorbar label</li>
            <li>Beam visible: beam rendering at the bottom-left corner of the Image Viewer</li>
            <li>Beam color: the color to render a beam element</li>
            <li>Beam type: render a beam as an open ellipse or a filled ellipse</li>
            <li>Beam width: line width to render an open beam</li>
        </ul>
        <h3>Catalog</h3>
        <p>This section provides options to configure the Catalog Widget.</p>
        <ul>
            <li>Displayed columns: default displayed number of columns of a catalog in the widget.</li>
        </ul>
        <h3 id="region">Region</h3>
        <p>This section provides customization of region rendering properties and region creation interactivity.</p>
        <ul>
            <li>Color: default color to render a region</li>
            <li>Line width: default line width to render a region</li>
            <li>Dash length: when greater than zero, region is rendered in dashed line</li>
            <li>Region type: default region type</li>
            <li>Region size (px): the size of a region in screen pixels when it is created with a click</li>
            <li>Creation mode: the way how rectangle and ellipse regions are created with cursor</li>
        </ul>
        <h3 id="region">Annotation</h3>
        <p>This section provides customization of annotation rendering properties.</p>
        <ul>
            <li>Color: default color to render an annotation element</li>
            <li>Line width: default line width to render an annotation element</li>
            <li>Dash length: when greater than zero, an annotation element is rendered in dashed line</li>
            <li>Point shape: default shape of the point annotation element</li>
            <li>Point size (px): the size of a point annotation element in screen pixels</li>
        </ul>
        <h3 id="performance">Performance</h3>
        <p>
            Performance related control parameters are included here. We do not recommend you to change the settings here. If the bandwidth connecting to a CARTA server is limited, you may enable the <b>low bandwidth mode</b> which reduces
            displayed image resolution and cursor responsiveness.
        </p>
        <h3 id="telemetry">Telemetry</h3>
        <p>This section provides customization of the telemetry configuration. Anonymous usage data are collected as a reference for future developments only.</p>
        <ul>
            <li>Telemetry mode: disable telemetry or enable telemetry in minimal or full mode</li>
            <li>Log telemetry output: show telemetry output in the browser's console</li>
        </ul>
        <h3 id="compatibility">Compatibility</h3>
        <p>This section provides customization of the data compatibility.</p>
        <ul>
            <li>AIPS cube beam support: when it is enabled, CARTA will try to derive the beam size information from the HISTORY headers</li>
        </ul>
        <h3 id="log-events">Log Events</h3>
        <p>This is for development and debugging purposes. General users do not need to enable anything here. When messages are enabled, they show up in the browser console when being called.</p>
    </div>
);
