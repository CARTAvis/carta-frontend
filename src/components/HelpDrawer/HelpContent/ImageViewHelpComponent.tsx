import * as React from "react";
import {ImageComponent} from "./ImageComponent";
import catalogSelectionButton from "static/help/catalogue_selection_button.png";
import catalogSelectionButton_d from "static/help/catalogue_selection_button_d.png";
import contourButton from "static/help/contour_button.png";
import contourButton_d from "static/help/contour_button_d.png";
import exportPNGButton from "static/help/export_png_button.png";
import exportPNGButton_d from "static/help/export_png_button_d.png";
import imageInfoButton from "static/help/image_info_button.png";
import imageInfoButton_d from "static/help/image_info_button_d.png";
import imageTools from "static/help/image_tools.png";
import imageTools_d from "static/help/image_tools_d.png";
import regionButton from "static/help/region_button.png";
import regionButton_d from "static/help/region_button_d.png";
import WCSMatchButton from "static/help/wcs_match_button.png";
import WCSMatchButton_d from "static/help/wcs_match_button_d.png";
import zoomButton from "static/help/zoom_button.png";
import zoomButton_d from "static/help/zoom_button_d.png";
import headCatalogueButton from "static/help/head_catalogue_button.png";
import headCatalogueButton_d from "static/help/head_catalogue_button_d.png";

export class ImageViewHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p>The image viewer widget serves as the core component of CARTA. It allows you to visualize images in rasters and in contours. Region of interests can be defined interactively with the image viewer and subsequent image
                    analysis can be performed with other widgets. Catalogue files can be loaded and visualized in the image viewer with the Catalogue widget.</p>
                <p>Images can be loaded via <strong>File</strong> -&gt; <strong>Open image</strong> (will close all loaded image first). You may load multiple images via <strong>File</strong> -&gt; <strong>Append image</strong>. All
                    images are loaded as raster by default. Contour layers can be further generated via the contour configuration dialog.</p>
                <p>Information of world coordinates and image coordinates at the cursor position is shown at the top of the image viewer. To freeze/unfreeze the cursor position, press <code>F</code> key.</p>

                <h3 id="image-tool-buttons">Image tool buttons</h3>
                <p>A set of tool buttons is provided at the bottom-right corner when hovering over the image viewer. You may use these buttons to</p>
                <ul>
                    <li>Select a source from catalog overlay</li>
                    <li>Create regions</li>
                    <li>Change image zoom scale</li>
                    <li>Trigger WCS matching</li>
                    <li>Change grid overlay reference frame</li>
                    <li>Enable/disable grid lines and coordinate labels</li>
                    <li>Export image</li>
                </ul>
                <p><ImageComponent light={imageTools} dark={imageTools_d} width="90%"/></p>

                <h3 id="zoom-and-pan">Zoom and pan</h3>
                <p>Zoom actions can be triggered in different ways. The most common one is to use mouse and scroll wheel. By scrolling up, image is zoomed in, while by scrolling down, image is zoomed out. Alternatively, you may use the
                    tool buttons at the bottom-right corner of the image viewer to zoom in, zoom out, zoom to fit screen resolution, or zoom to fit image view.</p>
                <p><ImageComponent light={zoomButton} dark={zoomButton_d} width="70%"/></p>
                <p>Panning is achieved by <code>drag-end-drop</code> as default. This default can be changed via the preferences dialog (<strong>File</strong> -&gt; <strong>Preferences</strong> -&gt; <strong>Global</strong>). The
                    alternative mode is <code>click</code>, which causes the clicked pixel to be centered in the image viewer.</p>

                <h3 id="matching-image-spatially-and-spectrally">Matching image spatially and spectrally</h3>
                <p>Different images may be matched in world coordinate spatially and/or spectrally. This can be triggered by the <code>WCS matching</code> button. Matching WCS on appending can be enabled in the preferences dialog.</p>
                <p><ImageComponent light={WCSMatchButton} dark={WCSMatchButton_d} width="70%"/></p>
                <p>CARTA supports the following matching schemes:</p>
                <ul>
                    <li>None: zoom levels of different images are independent. No matching in the spectral domain.</li>
                    <li>Spatial only: images are matched to the reference image in the spatial domain by translation, rotation, and scaling.</li>
                    <li>Spectral only: images are matched to the reference image in the spectral domain with nearest interpolation.</li>
                    <li>Spatial and spectral: images are matched to the reference image both in the spatial domain and spectral domain.</li>
                </ul>
                <p>Note that images are spatially matched through application of translation, rotation, and scaling. You may see prominent inconsistencies if you attempt to match wide field images or images with different projection schemes. However, grid
                    lines are still accurate per image. If contour layers exist, they will match the raster image in the current image view with high position accuracy. Spectral matching is performed with nearest interpolation.</p>

                <h3 id="contour-layers">Contour layers</h3>
                <p>A contour layer can be generated via the contour configuration dialog. Contours of spatially matched image are re-projected precisely to other spatially matched raster images.</p>
                <p><ImageComponent light={contourButton} dark={contourButton_d} width="85%"/></p>

                <h3 id="region-of-interest">Region of interest</h3>
                <p>Four types of region of interest are supported, including:</p>
                <ul>
                    <li>Point</li>
                    <li>Rectangle (rotatable)</li>
                    <li>Ellipse (rotatable)</li>
                    <li>Polygon</li>
                </ul>
                <p><ImageComponent light={regionButton} dark={regionButton_d} width="70%"/></p>
                <p>The default region type and the default region creation mode are customizable in the preferences dialog. Region shortcut buttons are available at the top of the CARTA GUI. The tooltip of a region shortcut button
                    provides instructions to create a region.</p>

                <h3 id="catalogue-layers">Catalog overlay</h3>
                <p>A catalog overlay can be generated via the Catalog widget.</p>
                <p><ImageComponent light={headCatalogueButton} dark={headCatalogueButton_d} width="85%"/></p>
                <p>To select a source, use the Catalog selection button. The selected source will be highlighted in the table of the Catalog widget.</p>
                <p><ImageComponent light={catalogSelectionButton} dark={catalogSelectionButton_d} width="70%"/></p>

                <h3 id="customizing-the-image-plot">Image plot cosmetics</h3>
                <p> Elements of the image plot such as grid line style, label style, colorbar style, etc., can be customized via the image viewer settings dialog.</p>

                <h3 id="exports">Image plot export</h3>
                <p>What you see in the current image view can be exported as a PNG file with the <code>Export image</code> button in the image tool bar.</p>
                <p><ImageComponent light={exportPNGButton} dark={exportPNGButton_d} width="70%"/></p>

                <h3 id="image-information-and-header">Image information and header</h3>
                <p>Basic image information and full image headers are displayed in the file header dialog.</p>
                <p><ImageComponent light={imageInfoButton} dark={imageInfoButton_d} width="85%"/></p>
            </div>
        );
    }
}
