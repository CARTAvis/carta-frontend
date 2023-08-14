import contourButton from "static/help/dialogButton_contourConfig.png";
import contourButton_d from "static/help/dialogButton_contourConfig_d.png";
import imageInfoButton from "static/help/dialogButton_fileHeader.png";
import imageInfoButton_d from "static/help/dialogButton_fileHeader_d.png";
import vectorOverlayButton from "static/help/dialogButton_vectorOverlay.png";
import vectorOverlayButton_d from "static/help/dialogButton_vectorOverlay_d.png";
import imageTools from "static/help/imageTools_annotated.png";
import imageTools_d from "static/help/imageTools_annotated_d.png";
import catalogSelectionButton from "static/help/imageTools_catalogSelectionButton.png";
import catalogSelectionButton_d from "static/help/imageTools_catalogSelectionButton_d.png";
import distanceMeasureButton from "static/help/imageTools_distanceMeasureButton.png";
import distanceMeasureButton_d from "static/help/imageTools_distanceMeasureButton_d.png";
import exportPNGButton from "static/help/imageTools_exportButton.png";
import exportPNGButton_d from "static/help/imageTools_exportButton_d.png";
import WCSMatchButton from "static/help/imageTools_matchButton.png";
import WCSMatchButton_d from "static/help/imageTools_matchButton_d.png";
import regionButton from "static/help/imageTools_regionButton.png";
import regionButton_d from "static/help/imageTools_regionButton_d.png";
import zoomButton from "static/help/imageTools_zoomButtons.png";
import zoomButton_d from "static/help/imageTools_zoomButtons_d.png";
import regionButtonSet from "static/help/regionButtonSet.png";
import regionButtonSet_d from "static/help/regionButtonSet_d.png";
import widgetButtonCatalog from "static/help/widgetButton_catalog.png";
import widgetButtonCatalog_d from "static/help/widgetButton_catalog_d.png";

import {ImageComponent} from "../ImageComponent";

export const IMAGE_VIEW_HELP_CONTENT = (
    <div>
        <p>
            The image viewer widget serves as the core component of CARTA. It allows you to visualize images as rasters, contours, or vector fields. Regions of interest can be defined interactively with the image viewer and subsequent image
            analysis can be performed with other widgets. Catalog files can be loaded and visualized in the image viewer as catalog overlays with the catalog widget.
        </p>
        <p>
            Images can be loaded via <strong>File</strong> -&gt; <strong>Open image</strong> (will close all loaded images first). You may append more images via <strong>File</strong> -&gt; <strong>Append image</strong>. All images are
            loaded and rendered as raster by default. Contour layers can be generated via the contour configuration dialog. Vector field layers can be produced via the vector overlay dialog.
        </p>
        <p>The preferences dialog provides many options related to the image viewer widget that you can adjust to fit your tastes and workflow.</p>
        <h3>Image view mode</h3>
        <p>
            There are two modes of the image viewer: single-panel view and multi-panel view (default). You can use the panel mode button at the top right corner of the widget to switch to the other mode. When the current view mode cannot
            show all the loaded images in the view, you can also use the page buttons at the top-right corner of the widget to switch to other pages to view images. The grid layout of the multi-panel view mode can be configured in the{" "}
            <code>Global</code> tab of the image view settings dialog. The active image is highlighted with a red box in the multi-panel view mode. In the multi-panel view mode, the loaded images are rendered in order from left to right and
            then from top to bottom. The image order can be rearranged with the image list widget by <code>drag-and-drop</code>.
        </p>
        <h3>Cursor information</h3>
        <p>
            Information about the world coordinates and image coordinates at the cursor position is shown at the top of the image viewer. Pixel value, spectral information, and polarization information are also displayed. To freeze/unfreeze
            the cursor position, press the <code>F</code> key. To mirror cursor position on spatially matched images, press the <code>G</code> button. Different modes to display the cursor information are available in the{" "}
            <code>WCS and Image Overlay</code> tab of the preferences dialog (<strong>File</strong> -&gt; <strong>Preferences</strong>). Alternatively, you can use the cursor information widget to view cursor information from multiple
            images in one place.
        </p>
        <h3 id="image-tool-buttons">Image toolbar</h3>
        <p>A set of tool buttons is provided at the bottom-right corner when hovering over the image viewer. You may use these buttons to</p>
        <ul>
            <li>Measure angular distance on image</li>
            <li>Select a source from catalog overlay</li>
            <li>Create regions</li>
            <li>Change image zoom scale</li>
            <li>Trigger WCS matching</li>
            <li>Change grid overlay WCS reference</li>
            <li>Enable/disable grid lines and coordinate labels</li>
            <li>Export image</li>
            <li>Show or hide the toolbar</li>
        </ul>
        <p>
            <ImageComponent light={imageTools} dark={imageTools_d} width="90%" />
        </p>
        <h3 id="zoom-and-pan">Zoom and pan</h3>
        <p>
            The zoom action can be triggered in different ways. You can use the mouse scroll wheel: scroll up to zoom in, and scroll down to zoom out. Alternatively, you may use the tool buttons at the bottom-right corner of the image
            viewer to zoom in, zoom out, zoom to fit screen resolution, or zoom to fit image view.
        </p>
        <p>
            <ImageComponent light={zoomButton} dark={zoomButton_d} width="80%" />
        </p>
        <p>
            The pan action is achieved by <code>drag-and-drop</code> as default. This default can be changed via the <code>Global</code> tab of the preferences dialog (<strong>File</strong> -&gt; <strong>Preferences</strong>). The
            alternative mode is <code>click</code>, which causes the clicked pixel to be centered in the image viewer. When the <code>drag-and-drop</code> pan mode is enabled, you can temporarily switch to the alternative mode with{" "}
            <code>CMD/CTRL + click</code>. By double-clicking the <code>Pan</code> button, the <code>Pan and Zoom</code> tab of the settings dialog will show up where you can have fine controls on pan and zoom actions.
        </p>
        <h3 id="matching-image-spatially-and-spectrally">Match image spatially and spectrally</h3>
        <p>
            Different images may be matched in world coordinates spatially and/or spectrally. This can be triggered by the <code>WCS matching</code> button. Matching WCS on image appending can be enabled in the preferences dialog.
            Alternatively, you can use the image list widget to see all loaded images and apply spatial and/or spectral matching.
        </p>
        <p>
            <ImageComponent light={WCSMatchButton} dark={WCSMatchButton_d} width="80%" />
        </p>
        <p>CARTA supports the following matching schemes:</p>
        <ul>
            <li>None: zoom levels of different images are independent. No matching in the spectral domain.</li>
            <li>Spatial only: images are matched to the reference image in the spatial domain by translation, rotation, and scaling.</li>
            <li>Spectral only: images are matched to the reference image in the spectral domain with nearest interpolation.</li>
            <li>Spatial and spectral: images are matched to the reference image both in the spatial domain and spectral domain.</li>
        </ul>
        <p>
            Note that images are spatially matched through application of translation, rotation, and scaling. You may see prominent inconsistencies if you attempt to match wide field images or images with different projection schemes.
            However, grid lines are still accurate per image. If contour, vector overlay, or catalog overlay layers exist, they will match the raster image in the current image view with high position accuracy. Spectral matching is
            performed with nearest interpolation.
        </p>
        <h3 id="contour-layers">Contour layer</h3>
        <p>A contour layer can be generated via the contour configuration dialog. Contours of spatially matched images are re-projected precisely to other spatially matched raster images.</p>
        <p>
            <ImageComponent light={contourButton} dark={contourButton_d} width="38%" />
        </p>
        <h3>Vector field overlay layer</h3>
        <p>The vector field overlay layer can be generated via the vector overlay configuration dialog. Vector field overlay of spatially matched images is re-projected precisely to other spatially matched raster images.</p>
        <p>
            <ImageComponent light={vectorOverlayButton} dark={vectorOverlayButton_d} width="38%" />
        </p>

        <h3 id="catalog-layers">Catalog overlay layer</h3>
        <p>A catalog overlay can be generated via the catalog widget.</p>
        <p>
            <ImageComponent light={widgetButtonCatalog} dark={widgetButtonCatalog_d} width="80%" />
        </p>
        <p>
            To select a source on the catalog overlay layer, use the <code>Catalog selection</code> button. The selected source will be highlighted in the table of the catalog widget.
        </p>
        <p>
            <ImageComponent light={catalogSelectionButton} dark={catalogSelectionButton_d} width="80%" />
        </p>
        <h3 id="region-of-interest">Region of interest and image annotation</h3>
        <p>
            Six types of region of interest are supported, including:
            <ul>
                <li>Point</li>
                <li>Rectangle (rotatable)</li>
                <li>Ellipse (rotatable)</li>
                <li>Polygon</li>
                <li>Line (rotatable)</li>
                <li>Polyline</li>
            </ul>
            and ten kinds of image annotation elements are provided, including:
            <ul>
                <li>Point</li>
                <li>Line</li>
                <li>Rectangle</li>
                <li>Ellipse</li>
                <li>Polygon</li>
                <li>Polyline</li>
                <li>Vector</li>
                <li>Text</li>
                <li>Compass</li>
                <li>Ruler</li>
            </ul>
        </p>
        <p>
            <ImageComponent light={regionButton} dark={regionButton_d} width="80%" />
        </p>
        <p>
            The default region type, the default annotation type and the default region creation mode are customizable in the preferences dialog. Region shortcut buttons are available at the top of the CARTA GUI. The tooltip of a region
            shortcut button provides instructions to create a region.
        </p>
        <p>
            <ImageComponent light={regionButtonSet} dark={regionButtonSet_d} width="38%" />
        </p>
        <h3 id="customizing-the-image-plot">Image plot cosmetics</h3>
        <p>
            {" "}
            Elements of the image plot such as grid line style, label style, colorbar style, etc., can be customized via the image viewer settings dialog (the <code>cog</code> button at the top-right corner of the widget).
        </p>

        <h3 id="exports">Image plot export</h3>
        <p>
            What you see in the current image view can be exported as a PNG file with the <code>Export image</code> button in the image toolbar. With the 100% mode, the image resolution of the PNG is identical to the screen resolution. For
            presentation or publication purposes, you can request a higher resolution mode as 200% or 400%.
        </p>
        <p>
            <ImageComponent light={exportPNGButton} dark={exportPNGButton_d} width="80%" />
        </p>
        <h3>Distance measure</h3>
        <p>This tool allows you to measure a geodesic distance between two locations on an image with mouse clicks. The geodesic line between the two clicks as well as the iso-latitude and iso-longitude lines are visualized.</p>
        <p>
            <ImageComponent light={distanceMeasureButton} dark={distanceMeasureButton_d} width="80%" />
        </p>
        <h3>Interactive colorbar</h3>
        <p>
            When you hover over the colorbar, a cutoff value is applied to the raster image temporarily. Pixel values below the cutoff are rendered in grayscale. You may disable this feature in the <code>Colorbar</code> tab of the image
            view settings dialog.
        </p>
        <h3 id="image-information-and-header">Image information and header</h3>
        <p>Basic image information and full image headers are displayed in the file header dialog.</p>
        <p>
            <ImageComponent light={imageInfoButton} dark={imageInfoButton_d} width="38%" />
        </p>
    </div>
);
