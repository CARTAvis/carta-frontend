import * as React from "react";
import {
    headAnimatorButton,
    headAnimatorButton_d,
    headCatalogueButton,
    headCatalogueButton_d,
    demoCatalogueMarkerMapping,
    demoCatalogueMarkerMapping_d,
    demoImageOverlayColorMapping,
    demoImageOverlayColorMapping_d,
    demoImageOverlayOrientationMapping,
    demoImageOverlayOrientationMapping_d,
    demoImageOverlaySizeMapping,
    demoImageOverlaySizeMapping_d,
    headContourButton,
    headContourButton_d,
    headFileinfoButton,
    headFileinfoButton_d,
    headHistogramButton,
    headHistogramButton_d,
    catalogSelectionButton,
    catalogSelectionButton_d,
    contourButton,
    contourButton_d,
    exportPNGButton,
    exportPNGButton_d,
    imageInfoButton,
    imageInfoButton_d,
    imageTools,
    imageTools_d,
    regionButton,
    regionButton_d,
    WCSMatchButton,
    WCSMatchButton_d,
    zoomButton,
    zoomButton_d,
    imageOverlayDemo,
    imageOverlayDemo_d,
    headLayerButton,
    headLayerButton_d,
    headLogButton,
    headLogButton_d,
    underConstruction,
    headPreferenceButton,
    headPreferenceButton_d,
    headRegionButton,
    headRegionButton_d,
    headRenderconfigButton,
    headRenderconfigButton_d,
    headSpatialButton,
    headSpatialButton_d,
    smoothingBoxcar,
    smoothingBoxcar_d,
    smoothingGaussian,
    smoothingGaussian_d,
    smoothingHanning,
    smoothingHanning_d,
    smoothingBinning,
    smoothingBinning_d,
    smoothingSG,
    smoothingSG_d,
    smoothingDecimation,
    smoothingDecimation_d,
    headLineQueryButton,
    headLineQueryButton_d,
    headSpectralButton,
    headSpectralButton_d,
    headStatisticsButton,
    headStatisticsButton_d,
    headStokesButton,
    headStokesButton_d
} from "static/help";
import {HelpType} from "stores";
import {ImageComponent} from "./ImageComponent";

export const HELP_CONTENT_MAP = new Map<HelpType, JSX.Element>([
    [
        HelpType.ANIMATOR,
        <React.Fragment>
            <p>
                <ImageComponent light={headAnimatorButton} dark={headAnimatorButton_d} width="90%" />
            </p>
            <p>
                The animator widget controls which image, which channel (if it exists per image file), and which Stokes (if exists per image file) to view in the image viewer. You may also enable animation playback for image, channel, or
                Stokes, via the <code>Play</code> button. The radio buttons control which one to animate. Playback mode includes
            </p>
            <ul>
                <li>Forward: with index increasing</li>
                <li>Backward: with index decreasing</li>
                <li>Bouncing: with index increasing and decreasing so on and so forth between the boundary</li>
                <li>Blink: with index jumping between the boundary</li>
            </ul>
            <p>For channel, you may limit a channel range for animation playback via the double slider.</p>
            <p>A desired frame rate per second (fps) can be defined in the frame rate spinbox. Note that the real fps depends on computer performance and network performance.</p>
            <p>
                A step for animation playback (default 1) can be set with the step spinbox. Click the frame rate dropdown to select <code>Step</code> and use the spinbox to define a step.
            </p>
            <p>
                For performance reasons and resource management, animation playback will be automatically stopped after 5 minutes by default. This can be customized in the <code>Performance</code> tab of the preferences dialog (
                <strong>File</strong> -&gt; <strong>Preferences</strong>). Maximum playback time is 30 mins.
            </p>
        </React.Fragment>
    ],
    [
        HelpType.CATALOG_HISTOGRAM_PLOT,
        <React.Fragment>
            <p>
                The catalog histogram plot widget shows a histogram of one numeric column of a catalog file. The available numeric columns are determined by the <code>Display</code> column of the upper table in the Catalog widget.
            </p>
            <p>
                The data used for plotting the histogram is determined by the lower table in the Catalog widget. The table may not show all entries because of the dynamic loading feature. Thus, the histogram plot may not include all entries
                (after filtering). The <code>Plot</code> button will request a full download of all entries and the histogram plot will then include all entries (after filtering). The number of bins and the scale of the y-axis (linear or
                log) can be customized.
            </p>
            <p>
                When you click on a specific histogram bin, source entries of that bin will be highlighted in the source catalog table, in the 2D scatter plot (if it exists), and in the image viewer (if the catalog overlay is enabled). A
                certain histogram bin will be highlighted if source entries of that bin are selected in the source catalog table, in the 2D scatter plot (if exists), and in the image viewer (if the catalog overlay is enabled). The{" "}
                <code>Selected only</code> toggle will update the source catalog table to show only the selected sources.
            </p>
        </React.Fragment>
    ],
    [
        HelpType.CATALOG_OVERLAY,
        <React.Fragment>
            <p>
                <ImageComponent light={headCatalogueButton} dark={headCatalogueButton_d} width="90%" />
            </p>
            <p>
                Source catalog files in VOTable or FITS format can be loaded in CARTA (via <code>File</code>-&gt; <code>Import catalog</code>) for visualization as an image overlay, or a 2D scatter plot, or a histogram.
            </p>
            <p>
                Once a source catalog file is loaded, the information of each column will be shown in the upper table, while the actual catalog entries are displayed in the lower table. By default, only the first 10 columns are enabled and
                displayed. You may configure it to show or hide certain columns to be displayed in the lower table.
            </p>
            <p>The source catalog table accepts sub-filters such as partial string match or value range. For numeric columns, supported operators are:</p>
            <ul>
                <li>
                    <code>&gt;</code> greater than
                </li>
                <li>
                    <code>&gt;=</code> greater than or equal to
                </li>
                <li>
                    <code>&lt;</code> less than
                </li>
                <li>
                    <code>&lt;=</code> less than or equal to
                </li>
                <li>
                    <code>==</code> equal to
                </li>
                <li>
                    <code>!=</code> not equal to
                </li>
                <li>
                    <code>..</code> between (exclusive)
                </li>
                <li>
                    <code>...</code> between (inclusive)
                </li>
            </ul>
            <p>Examples:</p>
            <ul>
                <li>
                    <code>&lt; 10</code> (everything less than 10)
                </li>
                <li>
                    <code>== 1.23</code> (entries equal to 1.23)
                </li>
                <li>
                    <code>10..50</code> (everything between 10 and 50, exclusive)
                </li>
                <li>
                    <code>10...50</code> (everything between 10 and 50, inclusive)
                </li>
            </ul>
            <p>
                For string columns, partial match is adopted. For example, <code>gal</code> (no quotation) will return entries containing the &quot;gal&quot; string.
            </p>
            <p>
                Once filters are set, when the <code>Update</code> button is clicked, the filters will be applied and a filtered source catalog will be displayed up to a number of entries defined in the <code>Max Rows</code> text input
                field. When the <code>Reset</code> button is clicked, all filters will be removed and the image overlay (if exists) will be removed too. For the histogram plot or the 2D scatter plot, the plot will be reset so that only the
                first 50 entries are rendered.
            </p>
            <p>
                To visualize a source catalog, use the dropdown menu at the bottom of the widget to select a rendering type. CARTA supports three catalog rendering types including 1) image overlay, 2) 2D scatter plot, and 3) histogram plot.
                For image overlay, you need to identify two columns as the coordinates. Two numeric columns are needed to render a 2D scatter plot, and one numeric column is required to compute a histogram.
            </p>
            <p>
                CARTA supports marker-based image overlay. You may render the marker with variable size, color, or orientation by mapping data columns to these rendering options. To set up the column mapping, please use the buttons at the
                top-right corner of the widget to launch the dialog.
            </p>
            <p>
                <ImageComponent light={demoCatalogueMarkerMapping} dark={demoCatalogueMarkerMapping_d} width="100%" />
            </p>
            <p>
                The source catalog table, the image overlay, the 2D scatter plot, and the histogram plot are inter-linked or cross-referenced. This means, for example, selecting a source or a set of source in the catalog table will trigger
                source highlight in other places. Or, selecting a source or a set of sources in the 2D scatter plot will trigger source highlight in other plots and in the catalog table.
            </p>
            <p>
                Multiple catalog files can be loaded and you may use the <code>File</code> dropdown at the top of the widget to switch in between. Multiple catalog widgets may be launched to display different catalog files. The{" "}
                <code>Close</code> button at the bottom of the widget will close the selected catalog file in the <code>File</code> dropdown. If there are spatially matched images, catalog image overlays are shared between matched images
                with proper coordinate transformations.
            </p>
        </React.Fragment>
    ],
    [
        HelpType.CATALOG_SCATTER_PLOT,
        <React.Fragment>
            <p>
                The Catalog 2D scatter plot widget shows a 2D scatter plot of two numeric columns of a catalog file. The available numeric columns in the dropdown menus at the bottom of the widget are determined by the <code>Display</code>{" "}
                column of the upper table in the Catalog widget.
            </p>
            <p>
                The data used for rendering a 2D scatter plot is determined by the lower table in the Catalog widget. The table may not show all entries because of the dynamic loading feature. Thus, the 2D scatter plot may not include all
                entries (after filtering). The <code>Plot</code> button will request a full download of all entries and the 2D scatter plot will then include all entries (after filtering).
            </p>
            <p>
                Click on a point or use the selection tools from the top-right corner of the plot to highlight selected sources in the source catalog table, in the histogram plot (if exists), and in the image viewer (if the catalog overlay
                is enabled). Points on the plot will be highlighted if sources are selected in the source catalog table, in the histogram plot (if it exists), and in the image viewer (if the catalog overlay is enabled). The{" "}
                <code>Selected only</code> toggle will update the source catalog table to show only the selected sources.
            </p>
        </React.Fragment>
    ],
    [
        HelpType.CATALOG_SETTINGS_COLOR,
        <React.Fragment>
            <h3>Marker color</h3>
            <p>
                This dialog provides options to set the color or colormap to source markers of an image overlay. If the <code>Column</code> dropdown menu is None, all markers are rendered with a single color as set with the{" "}
                <code>Color</code> dropdown menu. You may assign a numeric data column for color mapping. Different scaling, colormap, or clip bounds can be applied.
            </p>
            <p>
                <ImageComponent light={demoImageOverlayColorMapping} dark={demoImageOverlayColorMapping_d} width="100%" />
            </p>
        </React.Fragment>
    ],
    [
        HelpType.CATALOG_SETTINGS_ORIENTATION,
        <React.Fragment>
            <h3>Marker orientation</h3>
            <p>
                This dialog provides options to set the orientation of source markers of an image overlay. If the <code>Column</code> dropdown menu is None, all markers are rendered without applying an additional rotation applied. You may
                assign a numeric data column for orientation mapping. Different scaling, orientation range, or clip bounds can be applied.
            </p>
            <p>
                <ImageComponent light={demoImageOverlayOrientationMapping} dark={demoImageOverlayOrientationMapping_d} width="100%" />
            </p>
        </React.Fragment>
    ],
    [
        HelpType.CATALOG_SETTINGS_SIZE,
        <React.Fragment>
            <h3>Marker size</h3>
            <p>
                This dialog provides options to set the size of source markers of an image overlay. If the <code>Column</code> dropdown menu is None, all markers are rendered with a uniform size as set with the <code>Size</code> dropdown
                menu. You may assign a numeric data column for size mapping. Different scaling, size mode, size range, or clip bounds can be applied.
            </p>
            <p>
                <ImageComponent light={demoImageOverlaySizeMapping} dark={demoImageOverlaySizeMapping_d} width="100%" />
            </p>
        </React.Fragment>
    ],
    [
        HelpType.CONTOUR,
        <React.Fragment>
            <p>
                <ImageComponent light={headContourButton} dark={headContourButton_d} width="90%" />
            </p>
            <p>
                Contour configuration dialog allows you to generate a contour layer on top of a raster image in the image viewer. Steps to create a contour layer with the <code>Levels</code> tab are:
            </p>
            <ol>
                <li>
                    <p>
                        Select an image from the <code>Data source</code> dropdown. A per-channel histogram of the current channel and current Stokes as indicated in the animator will be displayed with visualization of mean (in dashed line)
                        and mean +/- one standard deviation (in shaded area). Optionally, you can request per-cube histogram if necessary.
                    </p>
                </li>
                <li>
                    <p>Define a set of contour levels to be calculated and rendered. There are various ways to define levels:</p>
                    <ul>
                        <li>
                            <code>Click</code> on the histogram plot to create a level. &nbsp;<code>Right-Click</code> on a line to remove a level. Numerical values of levels are displayed in the <code>Levels</code> field.
                        </li>
                        <li>
                            Use the level generator. There are four preset generators. The generator will create a set of levels based on the control parameters by clicking the <code>Generate</code> button.
                        </li>
                        <li>
                            Manually input levels in the <code>Levels</code> field. Note that this field can be modified at any time, for example, after using the level generator.
                        </li>
                    </ul>
                </li>
                <li>
                    <p>
                        When a set of levels is defined, clicking the <code>Apply</code> button will trigger the contour calculations and render in the image viewer.
                    </p>
                </li>
            </ol>
            <p>
                To remove a contour layer, click the <code>Clear</code> button.
            </p>
            <p>You may use the lock button next to the data source dropdown to disable or enable synchronization of data source with the image slider in the animator.</p>
            <h3 id="contour-smoothness">Contour smoothness</h3>
            <p>
                By default, the image is Gaussian-smoothed with a kernel size of four by four pixels before contour vertices are calculated. This can be customized in the <code>Configuration</code> tab. Suppored smoothing modes are:
            </p>
            <ul>
                <li>No smoothing</li>
                <li>Block (faster, not ideal for compact objects)</li>
                <li>Gaussian (default, slower, better appearance)</li>
            </ul>
            <h3 id="contour-cosmetics">Contour styling</h3>
            <p>
                The styling of contours can be customized with the <code>Styling</code> tab. Supported options are:
            </p>
            <ul>
                <li>Line thickness</li>
                <li>Representation of dashed line</li>
                <li>Color as constant color or color-mapped</li>
                <li>Bias</li>
                <li>Contrast</li>
            </ul>
            <p>Note that changes in styling will be applied immediately if the contour level set does not change.</p>
            <h3 id="customizing-the-contour-configuration-dialog">Customizing the contour configuration dialog</h3>
            <p>
                The defaults of many options in the contour configuration dialog are customizable via the <code>Contour configuration</code> tab in the preference dialog.
            </p>
            <p>
                Performance-related options are included in the <code>Performance</code> tab of the preferences dialog. <em>Note that we do not recommend modifying the factory defaults. Change with caution.</em>
            </p>
        </React.Fragment>
    ],
    [
        HelpType.FILE_BROWSER,
        <React.Fragment>
            <p>File browser allows you to</p>
            <ul>
                <li>Load images in CASA, FITS, MIRIAD, or HDF5-IDIA schema formats as raster</li>
                <li>Save images or subimages in CASA or FITS formats</li>
                <li>Import and export region text files in CASA (.crtf) or ds9 (.reg) formats</li>
                <li>Import catalogue files in VOTable or FITS formats</li>
            </ul>
            <h3 id="fileFiltering">File filtering</h3>
            <p>A file filter can be applied to the current directory. Three methods are provided:</p>
            <ul>
                <li>Fuzzy search: free typing</li>
                <li>Unix-style search: e.g., *.fits</li>
                <li>Regular expression search: e.g., colou?r</li>
            </ul>
            <h3 id="images">Images</h3>
            <p>
                Images can be loaded as raster via <strong>File</strong> -&gt; <strong>Load image</strong>, or appended as raster via <strong>File</strong> -&gt; <strong>Append image</strong>. All loaded images will be closed if you load an
                image with <strong>Load image</strong>. The image shown in the image viewer can be closed via <strong>File</strong> -&gt; <strong>Close image</strong>. Images or subimages can be saved in CASA or FITS format via{" "}
                <strong>File</strong> -&gt; <strong>Save image</strong>. Note that images can only be saved if the appropriate write permissions are enabled on the server.
            </p>
            <p>
                When an image file is selected, its basic image properties are summarized in the <code>File Information</code> tab on the right-hand side. Full image header is shown in the <code>Header</code> tab.
            </p>
            <p>
                You can load multiple images at once by selecting multiple images with <code>ctrl/cmd+click</code> or <code>shift+click</code> from the file list, and then clicking the <code>Load selected</code> button.
            </p>
            <p>
                If you would like to use the Stokes analysis widget, but your image is split into individual files (one per Stokes), you can create a Stokes hypercube by selecting the desired Stokes image files and clicking the "Load as
                hypercube" button. CARTA will load the files combined into a single image.
            </p>
            <h3 id="regions">Regions</h3>
            <p>
                Region files can be imported via <strong>File</strong> -&gt; <strong>Import regions</strong>. When a region file is selected, its content is shown in the <code>Region Information</code> tab. Regions can be exported as region
                text files via <strong>File</strong> -&gt; <strong>Export regions</strong>. CASA and ds9 region text file definitions in world or image coordinates are supported. Note that regions can only be exported if the appropriate
                write permissions are enabled on the server.
            </p>
            <p>
                You can load multiple region files at once by selecting multiple region files with <code>ctrl/cmd+click</code> or <code>shift+click</code> from the file list, and then clicking the <code>Load Region</code> button.
            </p>
            <h3 id="catalogs">Catalogs</h3>
            <p>
                Catalogs can be loaded and visualized as tables via <strong>File</strong> -&gt; <strong>Import catalog</strong>. When a catalog file is selected, its basic catalog properties are summarized in the{" "}
                <code>Catalog Information</code> tab on the right-hand side. Full catalog column header is shown in the <code>Catalog Header</code> tab.
            </p>
            <p>
                You can load multiple catalog files at once by selecting multiple catalog files with <code>ctrl/cmd+click</code> or <code>shift+click</code> from the file list, and then clicking the <code>Load Catalog</code> button.
            </p>
        </React.Fragment>
    ],
    [
        HelpType.FILE_INFO,
        <React.Fragment>
            <p>
                <ImageComponent light={headFileinfoButton} dark={headFileinfoButton_d} width="90%" />
            </p>
            <p>File header dialog provides full image header and a summary of the properties of the image in the current image view. To switch to other images, use the image slider in the animator widget, or use the image list widget.</p>
            <p>Search function is available in the header tab. The search button appears when you hover over the header context. Matches are case-insensitive, and partial words are matched.</p>
        </React.Fragment>
    ],
    [
        HelpType.HISTOGRAM,
        <React.Fragment>
            <p>
                <ImageComponent light={headHistogramButton} dark={headHistogramButton_d} width="90%" />
            </p>
            <p>Histogram widget displays a histogram plot derived from a 2D region. When no region is created or selected, it displays a histogram derived from the current full image in the image viewer.</p>
            <h3 id="images">Images</h3>
            <p>The image dropdown defaults to &quot;Active&quot; image which means the current image in the image viewer.</p>
            <h3 id="regions">Regions</h3>
            <p>
                The region dropdown defaults to &quot;Active&quot; region which means a selected region in the image viewer. You can select a region by clicking one in the image viewer, or by clicking a region entry on the region list
                widget. Histogram plot of the selected region will be updated accordingly.
            </p>
            <h3 id="interactivity-zoom-and-pan">Interactivity: zoom and pan</h3>
            <p>The x and y ranges of the histogram plot can be modified by</p>
            <ul>
                <li>
                    <code>scrolling wheel</code> (up to zoom in and down to zoom out with respect to the cursor position)
                </li>
                <li>
                    <code>drag-and-drop</code> horizontally to zoom in x
                </li>
                <li>
                    <code>drag-and-drop</code> vertically to zoom in y
                </li>
                <li>
                    <code>drag-and-drop</code> diagonally to zoom in both x and y
                </li>
                <li>
                    <code>double-click</code> to reset x and y ranges
                </li>
                <li>
                    <code>shift + click-and-drag</code> to pan in x
                </li>
            </ul>
            <p>In addition, the x and y ranges can be explicitly set in the histogram settings dialog.</p>
            <h3 id="exports">Exports</h3>
            <p>The histogram plot can be exported as a png file or a text file in tsv format via the buttons at the bottom-right corner (shown when hovering over the plot).</p>
            <h3 id="plot-cosmetics">Plot cosmetics</h3>
            <p>The appearance of the histogram plot is customizable via the histogram settings dialog (the cog icon). Supported options are:</p>
            <ul>
                <li>color of the plot</li>
                <li>plot styles including steps (default), lines, and dots</li>
                <li>line width for steps or lines</li>
                <li>point size for dots</li>
                <li>display y in logarithmic scale (default)</li>
            </ul>
            <br />
            <h4 id="note">Note</h4>
            <p>In the current release, the number of histogram bins is automatically derived as the square root of the product of region bound box sizes in x and y. The development team will improve this in future releases.</p>
            <h4 id="tip">TIP</h4>
            <p>Multiple histogram widgets can be created to show histograms for different images with different regions.</p>
        </React.Fragment>
    ],
    [
        HelpType.HISTOGRAM_SETTINGS,
        <React.Fragment>
            <p>Histogram settings dialog allows you to customize the appearance of the histogram plot, and set x and y ranges of the plot explicitly.</p>
            <p>Supported options are:</p>
            <ul>
                <li>color of the plot</li>
                <li>plot styles including steps (default), lines, and dots</li>
                <li>line width for steps or lines</li>
                <li>point size for dots</li>
                <li>display y in logarithmic scale (default)</li>
            </ul>
        </React.Fragment>
    ],
    [
        HelpType.IMAGE_VIEW,
        <React.Fragment>
            <p>
                The image viewer widget serves as the core component of CARTA. It allows you to visualize images in rasters and in contours. Region of interests can be defined interactively with the image viewer and subsequent image
                analysis can be performed with other widgets. Catalogue files can be loaded and visualized in the image viewer with the Catalogue widget.
            </p>
            <p>
                Images can be loaded via <strong>File</strong> -&gt; <strong>Open image</strong> (will close all loaded image first). You may load multiple images via <strong>File</strong> -&gt; <strong>Append image</strong>. All images are
                loaded as raster by default. Contour layers can be further generated via the contour configuration dialog.
            </p>
            <p>
                Information of world coordinates and image coordinates at the cursor position is shown at the top of the image viewer. To freeze/unfreeze the cursor position, press <code>F</code> key.
            </p>
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
            <p>
                <ImageComponent light={imageTools} dark={imageTools_d} width="90%" />
            </p>
            <h3 id="zoom-and-pan">Zoom and pan</h3>
            <p>
                Zoom actions can be triggered in different ways. The most common one is to use mouse and scroll wheel. By scrolling up, image is zoomed in, while by scrolling down, image is zoomed out. Alternatively, you may use the tool
                buttons at the bottom-right corner of the image viewer to zoom in, zoom out, zoom to fit screen resolution, or zoom to fit image view.
            </p>
            <p>
                <ImageComponent light={zoomButton} dark={zoomButton_d} width="70%" />
            </p>
            <p>
                Panning is achieved by <code>drag-end-drop</code> as default. This default can be changed via the preferences dialog (<strong>File</strong> -&gt; <strong>Preferences</strong> -&gt; <strong>Global</strong>). The alternative
                mode is <code>click</code>, which causes the clicked pixel to be centered in the image viewer.
            </p>
            <h3 id="matching-image-spatially-and-spectrally">Matching image spatially and spectrally</h3>
            <p>
                Different images may be matched in world coordinate spatially and/or spectrally. This can be triggered by the <code>WCS matching</code> button. Matching WCS on appending can be enabled in the preferences dialog.
            </p>
            <p>
                <ImageComponent light={WCSMatchButton} dark={WCSMatchButton_d} width="70%" />
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
                However, grid lines are still accurate per image. If contour layers exist, they will match the raster image in the current image view with high position accuracy. Spectral matching is performed with nearest interpolation.
            </p>
            <h3 id="contour-layers">Contour layers</h3>
            <p>A contour layer can be generated via the contour configuration dialog. Contours of spatially matched image are re-projected precisely to other spatially matched raster images.</p>
            <p>
                <ImageComponent light={contourButton} dark={contourButton_d} width="85%" />
            </p>
            <h3 id="region-of-interest">Region of interest</h3>
            <p>Four types of region of interest are supported, including:</p>
            <ul>
                <li>Point</li>
                <li>Rectangle (rotatable)</li>
                <li>Ellipse (rotatable)</li>
                <li>Polygon</li>
            </ul>
            <p>
                <ImageComponent light={regionButton} dark={regionButton_d} width="70%" />
            </p>
            <p>
                The default region type and the default region creation mode are customizable in the preferences dialog. Region shortcut buttons are available at the top of the CARTA GUI. The tooltip of a region shortcut button provides
                instructions to create a region.
            </p>
            <h3 id="catalogue-layers">Catalog overlay</h3>
            <p>A catalog overlay can be generated via the Catalog widget.</p>
            <p>
                <ImageComponent light={headCatalogueButton} dark={headCatalogueButton_d} width="85%" />
            </p>
            <p>To select a source, use the Catalog selection button. The selected source will be highlighted in the table of the Catalog widget.</p>
            <p>
                <ImageComponent light={catalogSelectionButton} dark={catalogSelectionButton_d} width="70%" />
            </p>
            <h3 id="customizing-the-image-plot">Image plot cosmetics</h3>
            <p> Elements of the image plot such as grid line style, label style, colorbar style, etc., can be customized via the image viewer settings dialog.</p>
            <h3 id="exports">Image plot export</h3>
            <p>
                What you see in the current image view can be exported as a PNG file with the <code>Export image</code> button in the image tool bar.
            </p>
            <p>
                <ImageComponent light={exportPNGButton} dark={exportPNGButton_d} width="70%" />
            </p>
            <h3 id="image-information-and-header">Image information and header</h3>
            <p>Basic image information and full image headers are displayed in the file header dialog.</p>
            <p>
                <ImageComponent light={imageInfoButton} dark={imageInfoButton_d} width="85%" />
            </p>
        </React.Fragment>
    ],
    [
        HelpType.IMAGE_VIEW_SETTINGS,
        <React.Fragment>
            <p>The image view settings dialog allows you to customize coordinate grid related properties in the image viewer.</p>
            <h3 id="global">Global</h3>
            <p>This section allows you to</p>
            <ul>
                <li>set a global color theme for the grid overlay</li>
                <li>configure grid line rendering accuracy</li>
                <li>put coordinate labels inside or outside the image</li>
                <li>select a coordinate reference frame to generate the grid overlay</li>
            </ul>
            <h3 id="title">Title</h3>
            <p>A custom title can be added in the image view. Its font type, font size, and color are configurable.</p>
            <h3 id="ticks">Ticks</h3>
            <p>This section allows you to changes the ticks properties, including location, density, color, line width, and length of major and minor ticks</p>
            <h3 id="grid">Grid</h3>
            <p>The appearance of the coordinate grid lines is customizable, including visibility, color, and line width.</p>
            <h3 id="border">Border</h3>
            <p>This section allows you to change the style of the axis border, including visibility, color, and width.</p>
            <h3 id="axes">Axes</h3>
            <p>This section allows you to adjust the appearance of an interior axis overlay, including visibility, color, and line width.</p>
            <h3 id="numbers">Numbers</h3>
            <p>This section allows you to customize the appearance of tick values, including:</p>
            <ul>
                <li>visibility</li>
                <li>font type</li>
                <li>font size</li>
                <li>color</li>
                <li>format as sexagesimal or decimal degree</li>
                <li>coordinate precision</li>
            </ul>
            <h3 id="labels">Labels</h3>
            <p>This section allows you to modify the styles of the x and y labels, such as font type, font size, and color. A custom label can be defined.</p>
            <h3>Colorbar</h3>
            <p>The appearance of the colorbar is highly configurable. This includes:</p>
            <ul>
                <li>visibility</li>
                <li>bar width</li>
                <li>offset</li>
                <li>position</li>
                <li>ticks density</li>
                <li>border style</li>
                <li>label style</li>
                <li>tick value style</li>
                <li>tick style</li>
            </ul>
            <h3 id="beam">Beam</h3>
            <p>This section allows you to change the appearance of a beam overlay (color, type, and line width) and adjust its position in the image viewer.</p>
            <h3>Conversion</h3>
            <p>
                This allows conversions of the spectral axis of a position-velocity image. For example, if the image header supports sufficient information, the axis labels can be displayed as offset v.s. velocity, offset v.s. frequency, or
                offset v.s. wavelength, etc..
            </p>
            <br />
            <h4>EXAMPLE</h4>
            <p>
                <ImageComponent light={imageOverlayDemo} dark={imageOverlayDemo_d} width="100%" />
            </p>
        </React.Fragment>
    ],
    [
        HelpType.LAYER_LIST,
        <React.Fragment>
            <p>
                <ImageComponent light={headLayerButton} dark={headLayerButton_d} width="90%" />
            </p>
            <p>
                The image list widget displays loaded images as a list, which includes the image name, rendering layers (R for raster and C for contours), layer visibility state, WCS matching state, color range matching state, channel
                index, and Stokes index. The channel index and Stokes index are synchronized with the animator.
            </p>
            <p>
                You may click <code>R</code> and/or <code>C</code> to hide/show a layer. For example, if you want to generate an image with contours only, you can hide raster layers by clicking <code>R</code>.
            </p>
            <p>
                Per image, you can click the <code>XY</code> button to enable/disable spatial matching and click the <code>Z</code> button to enable/disable spectral matching. To match color range to the reference image, click the{" "}
                <code>R</code> button.
            </p>
            <p>
                To change reference image, <code>right-click</code> on a row to bring up the menu.
            </p>
            <p>
                To close an image (or images), <code>right-click</code> on a row to bring up the menu.
            </p>
            <p>
                The list order reflects the order of the image slider in the animator. To change the order, <code>click</code> to select an entry and <code>drag-and-drop</code> it to the desired position.
            </p>
        </React.Fragment>
    ],
    [
        HelpType.LOG,
        <React.Fragment>
            <p>
                <ImageComponent light={headLogButton} dark={headLogButton_d} width="90%" />
            </p>
            <p>Log widget provides information for diagnostics when something went wrong. The log levels include:</p>
            <ul>
                <li>Debug</li>
                <li>Info (default)</li>
                <li>Warning</li>
                <li>Error</li>
                <li>Critical</li>
            </ul>
            <p>
                When you believe there is something wrong, please contact the <a href="mailto:carta_helpdesk@asiaa.sinica.edu.tw">helpdesk</a> or file an issue on <a href="https://github.com/CARTAvis/carta/issues">Github</a> (recommended).
            </p>
        </React.Fragment>
    ],
    [
        HelpType.PLACEHOLDER,
        <React.Fragment>
            <p>To be added.</p>
            <img src={underConstruction} style={{width: "20%", height: "auto"}} />
        </React.Fragment>
    ],
    [
        HelpType.PREFERENCES,
        <React.Fragment>
            <p>
                <ImageComponent light={headPreferenceButton} dark={headPreferenceButton_d} width="90%" />
            </p>
            <p>
                The preferences dialog provides a centralized place to customize the entire graphical user interface and performance control parameters. All settings are recorded and applied to new CARTA sessions. Some settings are
                effective immediately.
            </p>
            <h3 id="global">Global</h3>
            <p>This section provides usability customization.</p>
            <ul>
                <li>Theme: the color theme of the graphical user interface (effective immediately)</li>
                <li>Auto-launch file browser: launch file browser when CARTA is initialized</li>
                <li>Initial layout: the default layout for a new CARTA session</li>
                <li>Initial cursor position: fix cursor at the image center or have cursor free to move</li>
                <li>Initial zoom level: view full image or view image with one image pixel to one screen pixel ratio</li>
                <li>Zoom to: control the focus of zooming with scrolling wheel</li>
                <li>Enable drag-to-pan: when enabled, pan action is achieved by click-and-dragging. When disabled, pan action is achieved by a click where the clicked pixel will be centered in the image viewer.</li>
                <li>WCS matching on append: trigger WCS matching automatically for newly appended images</li>
                <li>Spectral matching: spectral convention to be used for spectral matching of image cubes</li>
                <li>Transparent image background: when this is enabled, the exported png image will have a transparent background. When it is disabled (default), a white or a black background is added depending on the GUI theme.</li>
                <li>Save last used directory: when this is enabled, the file browser will start in the same folder the next session.</li>
            </ul>
            <h3 id="render-configuration">Render configuration</h3>
            <p>This section provides customization of how a raster image is rendered by default.</p>
            <ul>
                <li>Default scaling: scaling function to be applied to a colormap</li>
                <li>Default colormap: colormap for rendering a raster image</li>
                <li>Default percentile ranks: clip level to be applied to the pixel value-to-color mapping</li>
                <li>NaN color: color to render a NaN (not a number) pixel</li>
                <li>Smoothed bias/contrast: when this is enabled (default), smooth bias and contrast functions are applied, resulting a smooth scaling function. When it is disabled, the final scaling function contains kinks.</li>
            </ul>
            <h3 id="contour-configuration">Contour configuration</h3>
            <p>This section provides customization of how a contour layer is calculated and rendered by default.</p>
            <ul>
                <li>Generator type: default level generator type</li>
                <li>Smoothing mode: smoothing method to be applied before calculating contour vertices</li>
                <li>Default smoothing factor: kernel size of the selected smoothing mode</li>
                <li>Default contour levels: number of contour levels to be generated</li>
                <li>Thickness: contour line thickness</li>
                <li>Default color mode: to render contours with constant color or to render color-mapped contours</li>
                <li>Default color map: colormap for rendering color-mapped contours</li>
                <li>Default color: color for rendering contours with constant color</li>
            </ul>
            <h3 id="overlay-configuration">Overlay configuration</h3>
            <p>This section provides customization of the image overlay in the image viewer.</p>
            <ul>
                <li>Color: the default color of the grid layers including the coordinate bound box</li>
                <li>WCS grid visible: grid line rendering</li>
                <li>Label visible: grid x and y labels rendering</li>
                <li>WCS format: show world coordinates in degrees or sexagesimal or auto-formatted</li>
                <li>Beam visible: beam rendering at the bottom-left corner of the image viewer</li>
                <li>Beam color: the color to render a beam element</li>
                <li>Beam type: render a beam as open shape or filled shape</li>
                <li>Beam width: line width to render an open-shape beam</li>
            </ul>
            <h3>Catalog</h3>
            <p>This section provides options to configure the catalog widget.</p>
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
                <li>Creation mode: the way how rectangle and ellipse regions are created with cursor</li>
            </ul>
            <h3 id="performance">Performance</h3>
            <p>
                Performance related control parameters are included here. We do not recommend you to change the settings here. If the bandwidth connecting to a CARTA server is limited, you may enable the <code>low bandwidth mode</code>{" "}
                which reduces displayed image resolution and cursor responsiveness.
            </p>
            <h3 id="log-events">Log events</h3>
            <p>This is for development and debugging purpose. General users should not enable anything here.</p>
        </React.Fragment>
    ],
    [
        HelpType.REGION_DIALOG,
        <React.Fragment>
            <p>The region configuration dialog allows you to change the appearance of a region, such as</p>
            <ul>
                <li>color</li>
                <li>linewidth</li>
                <li>line style (solid or dashed)</li>
            </ul>
            <p>and region properties, such as</p>
            <ul>
                <li>region name</li>
                <li>region location and shape properties in image or world coordinate</li>
            </ul>
            <p>
                Region properties can be defined in world coordinate. If the coordinate reference system is FK4, FK5, or ICRS, the coordinate format is sexagesimal. If the coordinate system is Galactic or Ecliptic, the coordinate format is
                decimal degree. Region size can be defined in arcsecond with <code>&quot;</code>, in arcminute with <code>&apos;</code>, or in degree with <code>deg</code>.
            </p>
            <br />
            <h4 id="note">NOTE</h4>
            <ul>
                <li>The displayed image coordinates refer to the spatial reference image as indicated in the title of the dialog.</li>
                <li>The appearance of a region on a spatially matched image may be distorted due to projection effects.</li>
            </ul>
            <h4 id="tip">TIP</h4>
            <p>
                <code>Double-Click</code> on a region in the image viewer or on an entry in the region list widget will bring up this region configuration dialog.
            </p>
        </React.Fragment>
    ],
    [
        HelpType.REGION_LIST,
        <React.Fragment>
            <p>
                <ImageComponent light={headRegionButton} dark={headRegionButton_d} width="90%" />
            </p>
            <p>
                The region list widget provides you a list of regions created via the graphical user interface and/or via region import (<strong>File</strong> -&gt; <strong>Import regions</strong>). The basic information of a region is
                shown as an entry in the list. The current active region is highlighted in the list and region control points are shown in the image viewer. To unselect a region, press the <code>Esc</code> key.
            </p>
            <p>
                <code>double-click</code> on a list entry or on a region in the image viewer to bring up the region configuration dialog, where you can adjust region appearance and region properties.
            </p>
            <p>
                The <code>lock</code> button for each region entry is to prevent editing a region accidentally. Locked regions will appear slightly dimmer in the image viewer. The <code>center</code> button is to center a region in the
                current field of view of the image viewer.
            </p>
            <p>
                To delete an active (selected) region, press <code>delete</code> key.
            </p>
        </React.Fragment>
    ],
    [
        HelpType.RENDER_CONFIG,
        <React.Fragment>
            <p>
                <ImageComponent light={headRenderconfigButton} dark={headRenderconfigButton_d} width="90%" />
            </p>
            <p>
                The render configuration widget controls how a raster image is rendered in color space. The widget contains a set of clip levels as buttons on the top. The clip boundaries are displayed in the <code>Clip Min</code> and{" "}
                <code>Clip Max</code> fields. These fields can be manually edited and the clip level will switch to <code>Custom</code>. The clip boundaries are visualized as two vertical lines (draggable) in red in the histogram.
            </p>
            <p>
                By default, a per-channel histogram is shown, and optionally a per-cube histogram can be displayed via the <code>Histogram</code> dropdown.
            </p>
            <p>
                Different scaling functions and colormaps can be chosen via the <code>Scaling</code> and <code>Color map</code> dropdowns, respectively. A color map might be inverted via the <code>Invert color map</code> toggle.
            </p>
            <p>
                Bias and contrast can be adjusted jointly via the 2D box (x as bias and y as contrast). The effective scaling function is visualized as a grey curve between the two red vertical lines. By default, smooth bias and contrast
                functions are applied so that the resulting scaling function is a smooth curve. You may disable this feature with the <code>Render configuration</code> tab of the preferences dialog.
            </p>
            <p>The appearance of the histogram plot can be configured through the render configuration settings dialog, including:</p>
            <ul>
                <li>color of the plot</li>
                <li>plot styles including steps (default), lines, and dots</li>
                <li>line width for steps or lines</li>
                <li>point size for dots</li>
                <li>display y in logarithmic scale (default)</li>
                <li>display mean and RMS</li>
                <li>display clip labels</li>
            </ul>
            <h3 id="interactivity-zoom-and-pan">Interactivity: zoom and pan</h3>
            <p>The x and y ranges of the histogram plot can be modified by</p>
            <ul>
                <li>
                    <code>scrolling wheel</code> (up to zoom in and down to zoom out with respect to the cursor position)
                </li>
                <li>
                    <code>click-and-drag</code> horizontally to zoom in x
                </li>
                <li>
                    <code>click-and-drag</code> vertically to zoom in y
                </li>
                <li>
                    <code>click-and-drag</code> diagonally to zoom in both x and y
                </li>
                <li>
                    <code>double-click</code> to reset x and y ranges
                </li>
                <li>
                    <code>shift + drag-and-drop</code> to pan in x
                </li>
            </ul>
            <p>In addition, the x and y ranges can be explicitly set in the render configuration settings dialog.</p>
        </React.Fragment>
    ],
    [
        HelpType.RENDER_CONFIG_SETTINGS,
        <React.Fragment>
            <p>The appearance of the histogram plot in the render configuration widget can be customized through this settings dialog, including:</p>
            <ul>
                <li>color of the plot</li>
                <li>plot styles including steps (default), lines, and dots</li>
                <li>line width for steps or lines</li>
                <li>point size for dots</li>
                <li>display y in logarithmic scale (default)</li>
                <li>display mean and RMS</li>
                <li>display clip labels</li>
            </ul>
        </React.Fragment>
    ],
    [
        HelpType.SAVE_LAYOUT,
        <React.Fragment>
            <p>With this dialog, the current layout can be saved and re-used in the future. The widgets in a layout can be either docked or undocked.</p>
            <h3 id="layout-management">Layout management</h3>
            <p>
                Load a preset layout or a custom layout: <strong>View</strong> -&gt; <strong>Layouts</strong> -&gt; <strong>Existing layouts</strong>
            </p>
            <p>
                Set a layout as the default layout: <strong>File</strong> -&gt; <strong>Preferences</strong> -&gt; <strong>Global</strong> tab -&gt; <strong>Initial layout</strong>.
            </p>
            <p>
                Delete a custom layout: <strong>View</strong> -&gt; <strong>Layouts</strong> -&gt; <strong>Delete layout</strong>.
            </p>
        </React.Fragment>
    ],
    [
        HelpType.SPATIAL_PROFILER,
        <React.Fragment>
            <p>
                <ImageComponent light={headSpatialButton} dark={headSpatialButton_d} width="90%" />
            </p>
            <p>
                Spatial profiler widget allows you to view a profile from a horizontal cut or a vertical cut at the cursor position in the image viewer. The cursor position may be fixed in the image viewer by pressing <code>F</code> key.
                Pressing again will unfreeze the cursor.
            </p>
            <p>The cursor position in the image viewer is displayed as a red vertical line in the spatial profile plot.</p>
            <p>
                When cursor is in the image viewer, the cursor position and pointed pixel value in image and world coordinates are reported at the bottom-left corner of the spatial profiler widget. When cursor moves into the spatial profile
                plot, numerical values of the profile at the cursor position (displayed as a grey vertical line) will be reported instead.
            </p>
            <h3 id="profile-mean-and-rms">Profile mean and RMS</h3>
            <p>
                As an option in the <code>Styling</code> tab of the spatial profiler settings dialog, mean and RMS values of the profile can be visualized as a green dashed line and a shaded area in the profile plot. Numerical values are
                displayed at the bottom-left corner. Note that CARTA includes all data in the current zoom level of the profile plot to perform the calculations. If zoom level changes, mean and RMS values will be updated too.
            </p>
            <h3 id="profile-smoothing">Profile smoothing</h3>
            <p>
                The displayed profile can be smoothed via the <code>Smoothing</code> tab of the spatial profiler settings dialog (the cog icon).
            </p>
            <h3 id="interactivity-zoom-and-pan">Interactivity: zoom and pan</h3>
            <p>The x and y ranges of the spatial profile plot can be modified by</p>
            <ul>
                <li>
                    <code>scrolling wheel</code> (up to zoom in and down to zoom out with respect to the cursor position)
                </li>
                <li>
                    <code>click-and-drag</code> horizontally to zoom in x
                </li>
                <li>
                    <code>click-and-drag</code> vertically to zoom in y
                </li>
                <li>
                    <code>click-and-drag</code> diagonally to zoom in both x and y
                </li>
                <li>
                    <code>double-click</code> to reset x and y ranges
                </li>
                <li>
                    <code>shift + drag-and-drop</code> to pan in x
                </li>
            </ul>
            <p>In addition, the x and y ranges can be explicitly set in the spatial profiler settings dialog.</p>
            <h3 id="exports">Profile plot export</h3>
            <p>The spatial profile plot can be exported as a png file or a text file in tsv format via the buttons at the bottom-right corner (shown when hovering over the plot).</p>
            <h3 id="plot-cosmetics">Plot cosmetics</h3>
            <p>
                The appearance of the spatial profile plot is customizable via the <code>Styling</code> tab of the spatial profiler settings dialog (the cog icon). Supported options are:
            </p>
            <ul>
                <li>color of the plot</li>
                <li>plot styles including steps (default), lines, and dots</li>
                <li>line width for steps or lines</li>
                <li>point size for dots</li>
                <li>display alternative horizontal axis in world coordinate</li>
            </ul>
            <br />
            <h4 id="note">NOTE</h4>
            <p>
                For performance reasons, a profile is min-max decimated before rendering if the number of points of the profile is greater than the screen resolution of the spatial profiler widget. The kernel size of profile decimation is
                dynamically adjusted so that profile features are mostly preserved. When decimation is applied, the line style of the profile plot is switched to &quot;line&quot;, regardless the setting in the spatial profiler settings
                dialog. When no decimation is applied (e.g., at higher profile zoom level, or profile has fewer points than the screen resolution), the line style becomes &quot;step&quot; (as default in the <code>Styling</code> tab of the
                settings dialog).
            </p>
        </React.Fragment>
    ],
    [
        HelpType.SPATIAL_PROFILER_SETTINGS_SMOOTHING,
        <React.Fragment>
            <h3>Smoothing</h3>
            <p>Smoothing may be applied to profiles to enhance signal-to-noise ratio. CARTA provides the following smoothing methods:</p>
            <ul>
                <li>
                    <b>Boxcar</b>: convolution with a boxcar function
                </li>
                <li>
                    <b>Gaussian</b>: convolution with a Gaussian function
                </li>
                <li>
                    <b>Hanning</b>: convolution with a Hanning function
                </li>
                <li>
                    <b>Binning</b>: averaging channels with a given width
                </li>
                <li>
                    <b>Savitzky-Golay</b>: fitting successive sub-sets of adjacent data points with a low-degree polynomial by the method of linear least squares
                </li>
                <li>
                    <b>Decimation</b>: min-max decimation with a given width
                </li>
            </ul>
            <p>Optionally, the original profile can be overplotted with the smoothed profile. The appearance of the smoothed profile, including color, style, width, and size, can be customized.</p>
            <p>The data of the smoothed profile is appended in the exported tsv file if smoothing is applied.</p>
            <h3>Examples</h3>
            <p>Boxcar: Kernel = 2</p>
            <p>
                <ImageComponent light={smoothingBoxcar} dark={smoothingBoxcar_d} width="90%" />
            </p>
            <p>Gaussian: Sigma = 1</p>
            <p>
                <ImageComponent light={smoothingGaussian} dark={smoothingGaussian_d} width="90%" />
            </p>
            <p>Hanning: Kernel = 5</p>
            <p>
                <ImageComponent light={smoothingHanning} dark={smoothingHanning_d} width="90%" />
            </p>
            <p>Binning: Binning width = 3</p>
            <p>
                <ImageComponent light={smoothingBinning} dark={smoothingBinning_d} width="90%" />
            </p>
            <p>Savitzky-Golay: Kernel = 5, Degree of fitting = 0</p>
            <p>
                <ImageComponent light={smoothingSG} dark={smoothingSG_d} width="90%" />
            </p>
            <p>Decimation: Decimation width = 3</p>
            <p>
                <ImageComponent light={smoothingDecimation} dark={smoothingDecimation_d} width="90%" />
            </p>
        </React.Fragment>
    ],
    [
        HelpType.SPATIAL_PROFILER_SETTINGS_STYLING,
        <React.Fragment>
            <h3>Styling</h3>
            <p>
                The Styling tab allows you to adjust the appearance of the profile plot, and set x and y ranges of the plot explicitly. In addition, users can select which cut (horizontal or vertical) at cursor to use to generate a spatial
                profile. You may also enable visualization of mean and RMS values of the current profile in the plot.
            </p>
            <p>Supported options for plot appearance are:</p>
            <ul>
                <li>color of the plot</li>
                <li>plot styles including steps (default), lines, and dots</li>
                <li>line width for steps or lines</li>
                <li>point size for dots</li>
                <li>display alternative horizontal axis in world coordinate</li>
            </ul>
        </React.Fragment>
    ],
    [
        HelpType.SPECTRAL_LINE_QUERY,
        <React.Fragment>
            <p>
                <ImageComponent light={headLineQueryButton} dark={headLineQueryButton_d} width="90%" />
            </p>
            <h3>Spectral line query</h3>
            <p>
                CARTA supports an initial implementation of spectral line ID overlay on a spectral profiler widget with line data from the Splatalogue service (https://splatalogue.online). The query is made using a spectral range defined by
                defining in frequency or wavelength (rest frame) and optionally a lower limit of CDMS/JPL line intensity (log). The spectral range can be defined as from-to or center-width.
            </p>
            <h4>QUERY LIMITATION</h4>
            <ul>
                <li>The allowed maximum query range, equivalent in frequency, is 20 GHz.</li>
                <li>The actual query is made with a frequency range in MHz rounded to integer.</li>
                <li>When an intensity limit is applied, only the lines from CDMS and JPL catalogues will be returned.</li>
                <li>Up to 100000 lines are displayed.</li>
            </ul>
            <h4>NOTE</h4>
            <p>
                Currently, the Splatalogue query service is under active development. Unexpected query results might happen. If you believe there is something wrong, please contact the{" "}
                <a href="mailto:carta_helpdesk@asiaa.sinica.edu.tw">helpdesk</a> or file an issue on <a href="https://github.com/CARTAvis/carta/issues">Github</a> (recommended).
            </p>
            <h3>Spectral line filtering</h3>
            <p>
                Once a query is successfully made, the line catalogue will be displayed in the tables. The upper table shows the column information in the catalogue with options to show or hide a specific column. The actual line catalogue
                is displayed in the lower table.
            </p>
            <p>The spectral line catalogue table accepts sub-filters such as partial string match or value range. For numeric columns, supported operators are:</p>
            <ul>
                <li>
                    <code>&gt;</code> greater than
                </li>
                <li>
                    <code>&gt;=</code> greater than or equal to
                </li>
                <li>
                    <code>&lt;</code> less than
                </li>
                <li>
                    <code>&lt;=</code> less than or equal to
                </li>
                <li>
                    <code>==</code> equal to
                </li>
                <li>
                    <code>!=</code> not equal to
                </li>
                <li>
                    <code>..</code> between (exclusive)
                </li>
                <li>
                    <code>...</code> between (inclusive)
                </li>
            </ul>
            <p>Examples:</p>
            <ul>
                <li>
                    <code>&lt; 10</code> (everything less than 10)
                </li>
                <li>
                    <code>== 1.23</code> (entries equal to 1.23)
                </li>
                <li>
                    <code>10..50</code> (everything between 10 and 50, exclusive)
                </li>
                <li>
                    <code>10...50</code> (everything between 10 and 50, inclusive)
                </li>
            </ul>
            <p>
                For string columns, partial match is adopted. For example, <code>CH3</code> (no quotation) will return entries containing the &quot;CH3&quot; string.
            </p>
            <p>
                Once a set of filters is set, you can click the <code>Filter</code> button to apply it to the line table.
            </p>
            <h3>Spectral line ID visualization</h3>
            <p>The &quot;Shifted Frequency&quot; column is computed based on the user input of a velocity or a redshift. This &quot;Shifted Frequency&quot; is adopted for line ID overlay on a spectral profiler widget.</p>
            <p>You can use the checkbox to select a set of lines to be overplotted in a spectral profiler widget. The maximum number of line ID overlays is 1000.</p>
            <p>
                The text labels of the line ID overlay are shown dynamically based on the zoom level of a profile. Different line ID overlays (with different velocity shifts) can be created on different spectral profilers widgets via the{" "}
                <code>Spectral Profiler</code> dropdown. By clicking the <code>Clear</code> button, the line ID overlay on the selected &quot;Spectral Profiler&quot; will be removed.
            </p>
            <br />
            <h4>NOTE</h4>
            <p>The sorting functions in the line table will be available in a future release.</p>
        </React.Fragment>
    ],
    [
        HelpType.SPECTRAL_PROFILER,
        <React.Fragment>
            <p>
                <ImageComponent light={headSpectralButton} dark={headSpectralButton_d} width="90%" />
            </p>
            <p>
                The spectral profiler widget provides two different modes of viewing spectral profiles, depending on the states of the <code>Image</code> checkbox, the <code>Region</code> checkbox, the <code>Statistic</code> checkbox, and
                the <code>Stokes</code> checkbox.{" "}
            </p>
            <p>
                When none of the checkboxes are selected, the spectral profiler widget displays one spectrum at a time only. You can view a region spectral profile (via the <code>Region</code> dropdown) of an image cube (via the{" "}
                <code>Image</code> dropdown) with a specific statistic (via the <code>Statistic</code> dropdown; default as mean). If Stokes axis exists, you may view a specific Stokes via the <code>Stokes</code> dropdown. You may have
                multiple widgets to view spectra side by side.
            </p>
            <p>
                When one of the checkboxes (Image/Region/Statistic/Stokes) is selected, the spectral profiler widget can display multiple spectra in one plot, depending on the selection in the dropdown menu of the selected checkbox. You can
                compare different spectra with same x and y ranges directly.
            </p>
            <p>The spectral profiler widget supports four modes of multi-profile plot:</p>
            <ul>
                <li>
                    When the <code>Image</code> checkbox is selected: spectra from <em>different spatially and spectrally matched images</em>, from the selected region with the selected statistic, and the selected Stokes (if applicable),
                    are displayed.
                </li>
                <li>
                    When the <code>Region</code> checkbox is selected: spectra from <em>different regions</em> of the selected image (and the selected Stokes if applicable) are displayed. The region spectra are computed with the selected
                    statistic.
                </li>
                <li>
                    When the <code>Statistic</code> checkbox is selected: spectra with <em>different statistic quantities</em> from the selected region of the selected image (and the selected Stokes if applicable) are displayed.
                </li>
                <li>
                    When the <code>Stokes</code> checkbox is selected: spectra with <em>different Stokes parameters</em> from the selected image, the selected region and the selected statistic are displayed.
                </li>
            </ul>
            <p>In short, if multiple spectra are plotted, only one property (Image, Region, Statistic or Stokes) can be varied at a time. All other properties are fixed to a single value.</p>
            <p>The cursor information of each profile is displayed at the bottom-left corner. The cursor information box is resizible when necessary.</p>
            <h4>LIMITATION</h4>
            <p>
                If the intensity units of different matched cubes are different (e.g., Jy/beam vs Kelvin), <em>no</em> unit conversion is applied in the multi-profile plot. Intensity unit conversion will be available in a future release.
            </p>
            <h3 id="images">Image dropdown menu</h3>
            <p>The image dropdown menu defaults to &quot;Active&quot; image which means the current image in the image viewer. You may use the animator widget or the image list widget to change the active image.</p>
            <p>
                When the image checkbox is selected and if there are spatially and spectrally matched images (apply matching via the image list widget), the dropdown menu will display an image list with information about the matching state.
                You can select one of the images to view its spectral profile. If the selected image is matched to other images, spectra from those images will be displayed in the spectral profiler widget too, allowing a direct comparison
                of spectra from different image cubes.
            </p>
            <h3 id="regions">Region dropdown menu</h3>
            <p>
                The region dropdown menu defaults to &quot;Active&quot; region which means the selected region in the image viewer. You can select an active region by clicking one on the image viewer, or by clicking a region entry in the
                region list widget. The spectral profile plot of the selected active region will be updated accordingly. If no region is selected, the region defaults to cursor.
            </p>
            <p>When the region checkbox is selected, the dropdown menu allows multiple selection. You can select different regions for profile calculations. </p>
            <h3>Statistic dropdown menu</h3>
            <p>
                The statistic dropdown menu defaults to &quot;Mean&quot;. When the statistic checkbox is selected, the dropdown menu allows multiple selection. You can select different statistic quantities for region spectral profile
                calculations.
            </p>
            <h3>Stokes dropdown menu</h3>
            <p>
                When the image in the view contains multiple Stokes parameters, you can use this dropdown menu to view profiles from different Stokes. The dropdown menu defaults to &quot;Current&quot;, meaning the selected Stokes via the
                animator.
            </p>
            <p>When the Stokes checkbox is selected, the dropdown menu allows multiple selection. You can select different Stokes parameters for region spectral profile calculations.</p>
            <h3 id="spectral-conventions-and-reference-frame">Spectral conventions and reference frame</h3>
            <p>
                With the <code>Conversion</code> tab of the spectral profiler settings dialog, you can change the spectral convention, including:
            </p>
            <ul>
                <li>Radio velocity (km/s, m/s)</li>
                <li>Optical velocity (km/s, m/s)</li>
                <li>Frequency (GHz, MHz, kHz, Hz)</li>
                <li>Wavelength (m, mm, um, Angstrom)</li>
                <li>Air wavelength (m, mm, um, Angstrom)</li>
                <li>Channel</li>
            </ul>
            <p>and spectral reference frame, including:</p>
            <ul>
                <li>LSRK: the rest-frame of the kinematical local standard of rest</li>
                <li>LSRD: the rest-frame of the dynamical local standard of rest</li>
                <li>BARY: barycentric, the rest-frame of the solar-system barycenter</li>
                <li>TOPO: topocentric, the observer's rest-frame on Earth</li>
            </ul>
            <p>Note that depending on the integrity of image headers, some conversions may not be possible.</p>
            <h3 id="profile-smoothing">Profile smoothing</h3>
            <p>
                The displayed profile can be smoothed via the <code>Smoothing</code> tab of the spectral profiler settings dialog (the cog icon). A shortcut button of the <code>Smoothing</code> tab can be found at the top-right corner of
                the widget.
            </p>
            <h3 id="moment-image-generator">Moment image generator</h3>
            <p>
                Moment images can be generated via the <code>Moments</code> tab of the spectral profiler settings dialog (the cog icon). A shortcut button of the <code>Moments</code> tab can be found at the top-right corner of the widget.
            </p>
            <h3>Profile fitting</h3>
            <p>
                You can fit a profile to a spectrum in the view via the <code>Fitting</code> tab of the spectral profiler settings dialog (the cog icon). You can find a shortcut button to the <code>Fitting</code> tab at the top-right corner
                of the widget. Note that profile fitting is not allowed when there are multiple profiles in the plot.
            </p>
            <h3 id="responsive-and-progressive-profile-update">Responsive and progressive profile update</h3>
            <p>
                When a region spectral profile is requested, depending on the performance of the server, you may see profiles are updated piece by piece with a regular interval. This feature provides a visual progress update for better user
                experience. In addition, if you move a region while its spectral profile is being updated, the old calculations will be terminated immediately and calculations of the new region spectral profile will start. You will see a
                partial profile in seconds.
            </p>
            <h3 id="profile-mean-and-rms">Profile mean and RMS</h3>
            <p>
                As an option in the <code>Styling</code> tab of the spectral profiler settings dialog, mean and RMS values of the profile can be visualized as a green dashed line and a shaded area in the profile plot. Numerical values are
                displayed at the bottom-left corner. Note that CARTA includes all data in the current zoom level of the profile plot to perform the calculations. If the zoom level changes, mean and RMS values will be updated too.
            </p>
            <h3 id="interactivity-zoom-pan-changing-channel">Interactivity: zoom, pan, changing channel</h3>
            <p>The x and y ranges of the spectral profile plot can be modified by</p>
            <ul>
                <li>
                    <code>scrolling wheel</code> (up to zoom in and down to zoom out with respect to the cursor position)
                </li>
                <li>
                    <code>click-and-drag</code> horizontally to zoom in x
                </li>
                <li>
                    <code>click-and-drag</code> vertically to zoom in y
                </li>
                <li>
                    <code>click-and-drag</code> diagonally to zoom in both x and y
                </li>
                <li>
                    <code>double-click</code> to reset x and y ranges
                </li>
                <li>
                    <code>shift + click-and-drag</code> to pan in x
                </li>
            </ul>
            <p>
                In addition, the x and y ranges can be explicitly set in the <code>Styling</code> tab of the spectral profile settings dialog.
            </p>
            <p>
                You may click on the spectral profile plot to switch to a channel (as indicated by a red vertical line) and view the image in the image viewer. The red line is draggable and acts equivalently like the channel slider in the
                animator widget.
            </p>
            <h3 id="exports">Profile export</h3>
            <p>The spectral profile plot can be exported as a png file or a text file in tsv format via the buttons at the bottom-right corner (shown when hovering over the plot).</p>
            <h3 id="plot-cosmetics">Plot cosmetics</h3>
            <p>
                The appearance of the spectral profile plot is customizable via the <code>Styling</code> tab of the spectral profile settings dialog (the cog icon). Supported options are:
            </p>
            <ul>
                <li>color of the plot</li>
                <li>plot styles including steps (default), lines, and dots</li>
                <li>line width for steps or lines</li>
                <li>point size for dots</li>
            </ul>
            <br />
            <h4 id="note">NOTE</h4>
            <p>
                For performance concerns, a profile is decimated before rendering if the number of points of the profile is greater than the screen resolution of the spectral profiler widget. The kernel size of profile decimation is
                dynamically adjusted so that profile features are mostly preserved. When decimation is applied, the line style of the profile plot is switched to &quot;line&quot;, regardless the setting in the spectral profiler settings
                dialog. When no decimation is applied (e.g., at higher profile zoom level, or profile has fewer points than the screen resolution), the line style becomes &quot;step&quot; (as default in the <code>Styling</code> tab of the
                settings dialog).
            </p>
        </React.Fragment>
    ],
    [
        HelpType.SPECTRAL_PROFILER_SETTINGS_CONVERSION,
        <React.Fragment>
            <h3>Conversion</h3>
            <p>
                With the <code>Conversion</code> tab, you can change the spectral convention, including:
            </p>
            <ul>
                <li>Radio velocity (km/s, m/s)</li>
                <li>Optical velocity (km/s, m/s)</li>
                <li>Frequency (GHz, MHz, kHz, Hz)</li>
                <li>Wavelength (m, mm, um, Angstrom)</li>
                <li>Air wavelength (m, mm, um, Angstrom)</li>
                <li>Channel</li>
            </ul>
            <p>and spectral reference frame, including:</p>
            <ul>
                <li>LSRK: the rest-frame of the kinematical local standard of rest</li>
                <li>LSRD: the rest-frame of the dynamical local standard of rest</li>
                <li>BARY: barycentric, the rest-frame of the solar-system barycenter</li>
                <li>TOPO: topocentric, the observer's rest-frame on Earth</li>
            </ul>
            <p>Note that depending on the integrity of image headers, some conversions may not be possible.</p>
        </React.Fragment>
    ],
    [
        HelpType.SPECTRAL_PROFILER_SETTINGS_FITTING,
        <React.Fragment>
            <h3>Profile Fitting</h3>
            <p>
                With the fitting tab, you can fit the observed spectrum with a model profile. Please ensure that there is only one spectral profile in the plot. Fitting multiple observed spectra is not supported. The supported profile
                functions are:
            </p>
            <ul>
                <li>Gaussian</li>
                <li>Lorentzian</li>
            </ul>
            <p>In addition, an optional continuum profile can be added in the fit, including a constant profile and a linear profile.</p>
            <h3>Set up initial solution for the fitter</h3>
            <p>
                In order to work correctly, the profiler fitting engine must be supplied with a good set of initial solutions of the free parameters. CARTA includes an <em>experimental</em> algorithm which analyzes the input profile and
                makes an educated guess of the initial solution. To use it, click the <code>auto detect</code> button. If there is a prominent continuum emission, please enable the <code>w/cont.</code> toggle before clicking the{" "}
                <code>auto detect</code> button.
            </p>
            <p>
                The auto-detect function will report how many components are found in the spectrum and visualize them as green boxes in the plot. Their numerical values are provided too. To see the initial values of different components,
                please use the slider for navigation. New components may be added via the component spinbox. A component may be removed with the <code>delete</code> button.
            </p>
            <p>
                You may use the GUI to define the initial solution <em>manually</em> by entering the values with the text fields, or by using the mouse to draw a <em>box</em> on the plot. The height, width, and center position of the box
                represent the amplitude, FWHM, and center of a model profile, respectively. The lock button can be used to lock a parameter so that the parameter is fixed during the fitting process. You can define the initial solution of a
                continuum manually by entering the values with the text fields, or by using mouse to draw a <em>line</em> on the plot (recommended).
            </p>
            <h4>NOTE</h4>
            <p>
                If the auto-detect function does not return a sensible solution (e.g., unexpected number of components), you can still edit it manually before clicking the <code>Fit</code> button. Please note that the initial solution does
                not need to be set precisely with respect to the true solution. The profile fitting engine can tolerate errors to some extent.
            </p>
            <h3>Trigger the fitting engine and view fitting results</h3>
            <p>
                Once you have set up a good set of initial solution, you can trigger the fitting process by clicking the <code>Fit</code> button. If you would like to trigger the fitter right after set of initial solutions are found by the
                auto-detect function, please enable the <code>auto fit</code> toggle. The fitting engine will include all the data in the current profile view. If you would like to exclude a certain feature in the fit, please try to zoom or
                pan the profile so that only the feature in interest is in the view.
            </p>
            <p>
                The fitting results are summarized in the <code>Fitting result</code> box. The best-fit model is visualized in the plot including the residual profle. The full log can be viewed with the <code>View log</code> button.
            </p>
        </React.Fragment>
    ],
    [
        HelpType.SPECTRAL_PROFILER_SETTINGS_MOMENTS,
        <React.Fragment>
            <h3>Moments</h3>
            <p>
                Moment images can be generated and viewed with CARTA. The <code>Moments</code> tab provides several control parameters to define how moment images are calculated, including:
            </p>
            <ul>
                <li>
                    <b>Image</b>: the image file for moment calculations. &quot;Active&quot; refers to the image displayed in the image viewer.
                </li>
                <li>
                    <b>Region</b>: a region can be selected so that moment calculations are limited inside the region. &quot;Active&quot; refers to the selected region in the image viewer. If no region is selected, full image is included in
                    the moment calculations.
                </li>
                <li>
                    <b>Coordinate, System, and Range</b>: the spectral range (e.g., velocity range) used for moment calculations is defined with these options. The range can be defined either via the text input fields, or via the cursor by
                    dragging horizontally in the spectral profiler widget.
                </li>
                <li>
                    <b>Mask and Range</b>: these options define a pixel value range used for moment calculations. If mask is &quot;None&quot;, all pixels are included. If mask is &quot;Include&quot; or &quot;Exclude&quot;, the pixel value
                    range defined in the text input fields is included or excluded, respectively. Alternatively, the pixel value range can be defined via the cursor by dragging vertically in the spectral profiler widget.
                </li>
                <li>
                    <b>Moments</b>: which moment images to be calculated are defined here. Supported options are:
                    <ul>
                        <li>-1: Mean value of the spectrum</li>
                        <li>0: Integrated value of the spectrum</li>
                        <li>1: Intensity weighted coordinate</li>
                        <li>2: Intensity weighted dispersion of the coordinate</li>
                        <li>3: Median value of the spectrum</li>
                        <li>4: Median coordinate</li>
                        <li>5: Standard deviation about the mean of the spectrum</li>
                        <li>6: Root mean square of the spectrum</li>
                        <li>7: Absolute mean deviation of the spectrum</li>
                        <li>8: Maximum value of the spectrum</li>
                        <li>9: Coordinate of the maximum value of the spectrum</li>
                        <li>10: Minimum value of the spectrum</li>
                        <li>11: Coordinate of the minimum value of the spectrum</li>
                    </ul>
                </li>
            </ul>
            <p>
                When all the parameters are defined, by clicking the <code>Generate</code> button moment calculations will begin. Depending on the file size, moment calculations may take a while. If that happens, you may consider to cancel
                the calculations and re-define a proper region and/or spectral range.
            </p>
            <p>
                Once moment images are generated, they will be loaded and displayed in the image viewer. They are named as $image_filename.moment.$keyword. For example, if moment 0, 1 and 2 images are generated from the image M51.fits, they
                will be named as M51.fits.moment.integrated, M51.fits.moment.weighted_coord, and M51.fits.moment.weighted_dispersion_coord, respectively. These images are kept in RAM per session and if there is a new request of moment
                calculations, these images will be deleted first. Optionally, calculated moment images can be exported in CASA or FITS format via &quot;File&quot; -&gt; &quot;Save image&quot;.
            </p>
            <h4>NOTE</h4>
            <p>Due to a CASA issue, image of &quot;Median coordinate&quot; cannot be generated. The request of &quot;Median coordinate&quot; is ignored automatically.</p>
        </React.Fragment>
    ],
    [
        HelpType.SPECTRAL_PROFILER_SETTINGS_SMOOTHING,
        <React.Fragment>
            <h3>Smoothing</h3>
            <p>Smoothing may be applied to profiles to enhance signal-to-noise ratio. CARTA provides the following smoothing methods:</p>
            <ul>
                <li>
                    <b>Boxcar</b>: convolution with a boxcar function
                </li>
                <li>
                    <b>Gaussian</b>: convolution with a Gaussian function
                </li>
                <li>
                    <b>Hanning</b>: convolution with a Hanning function
                </li>
                <li>
                    <b>Binning</b>: averaging channels with a given width
                </li>
                <li>
                    <b>Savitzky-Golay</b>: fitting successive sub-sets of adjacent data points with a low-degree polynomial by the method of linear least squares
                </li>
                <li>
                    <b>Decimation</b>: min-max decimation with a given width
                </li>
            </ul>
            <p>Optionally, the original profile can be overplotted with the smoothed profile. The appearance of the smoothed profile, including color, style, width, and size, can be customized.</p>
            <p>The data of the smoothed profile is appended in the exported tsv file if smoothing is applied.</p>
            <h3>Examples</h3>
            <p>Boxcar: Kernel = 2</p>
            <p>
                <ImageComponent light={smoothingBoxcar} dark={smoothingBoxcar_d} width="90%" />
            </p>
            <p>Gaussian: Sigma = 1</p>
            <p>
                <ImageComponent light={smoothingGaussian} dark={smoothingGaussian_d} width="90%" />
            </p>
            <p>Hanning: Kernel = 5</p>
            <p>
                <ImageComponent light={smoothingHanning} dark={smoothingHanning_d} width="90%" />
            </p>
            <p>Binning: Binning width = 3</p>
            <p>
                <ImageComponent light={smoothingBinning} dark={smoothingBinning_d} width="90%" />
            </p>
            <p>Savitzky-Golay: Kernel = 5, Degree of fitting = 0</p>
            <p>
                <ImageComponent light={smoothingSG} dark={smoothingSG_d} width="90%" />
            </p>
            <p>Decimation: Decimation width = 3</p>
            <p>
                <ImageComponent light={smoothingDecimation} dark={smoothingDecimation_d} width="90%" />
            </p>
        </React.Fragment>
    ],
    [
        HelpType.SPECTRAL_PROFILER_SETTINGS_STYLING,
        <React.Fragment>
            <h3>Styling</h3>
            <p>
                The appearance of a spectral profile plot is customizable via the <code>Styling</code> tab. Supported options are:
            </p>
            <ul>
                <li>color of the plot</li>
                <li>plot styles including steps (default), lines, and dots</li>
                <li>line width for steps or lines</li>
                <li>point size for dots</li>
            </ul>
            <h4>Profile mean and RMS</h4>
            <p>
                As an option in the spectral profiler settings dialog, mean and RMS values of the profile can be visualized as a green dashed line and a shaded area in the profile plot. Numerical values are displayed at the bottom-left
                corner. Note that CARTA includes all data in the current zoom level of the profile plot to perform the calculations. If zoom level changes, mean and RMS values will be updated too.
            </p>
        </React.Fragment>
    ],
    [
        HelpType.STATS,
        <React.Fragment>
            <p>
                <ImageComponent light={headStatisticsButton} dark={headStatisticsButton_d} width="90%" />
            </p>
            <p>Statistics widget allows you to view statistical quantities over a 2D region. When no region is created or selected, it displays statistical quantities of the full image in the image viewer.</p>
            <h3 id="images">Images</h3>
            <p>The image dropdown defaults to &quot;Active&quot; image which means the current image in the image viewer.</p>
            <h3 id="regions">Regions</h3>
            <p>
                The region dropdown defaults to &quot;Active&quot; region which means a selected region in the image viewer. You can select a region by clicking one on the image viewer, or by clicking a region entry on the region list
                widget. Statistics of the selected region will be updated accordingly.
            </p>
            <h3 id="statistic">Statistic</h3>
            <p>CARTA provides the following statistical quantities:</p>
            <ul>
                <li>NumPixels: number of pixels in a region</li>
                <li>Sum: summation of pixel values in a region</li>
                <li>FluxDensity: total flux density in a region</li>
                <li>Mean: average of pixel values in a region</li>
                <li>StdDev: standard deviation of pixel values in a region</li>
                <li>Min: minimum pixel value in a region</li>
                <li>Max: maximum pixel value in a region</li>
                <li>Extrema: the maximum or minimum value in a region, depending on which absolute value is greater</li>
                <li>RMS: root mean square of pixel values in a region</li>
                <li>SumSq: summation of squared pixel values in a region</li>
            </ul>
            <h3>Text export</h3>
            <p>
                The statistics table can be exported as a text file. The <code>Export</code> button shows up at the bottom-right corner of the widget when you hover over the table.
            </p>
            <br />
            <h4 id="tip">TIP</h4>
            <p>Multiple statistics widgets can be created to show statistics for different images and different regions.</p>
        </React.Fragment>
    ],
    [
        HelpType.STOKES_ANALYSIS,
        <React.Fragment>
            <p>
                <ImageComponent light={headStokesButton} dark={headStokesButton_d} width="90%" />
            </p>
            <p>
                The Stokes analysis widget is specifically made for efficient visualization of a cube with <em>multiple channels and multiple Stokes parameters (at least QU)</em>. If you have Stokes images as individual files, please use
                the file browser to select them (multiple selection) in the file list first and click the <code>Load as hypercube</code> button to form a Stokes hypercube.
            </p>
            <p>The widget includes plots, such as:</p>
            <ul>
                <li>Region spectral profiles for Stokes Q and Stokes U, as absolute or fractional values (if Stokes I is present)</li>
                <li>Polarized intensity spectral profile, as absolute or fractional values (if Stokes I is present)</li>
                <li>Linearly polarized angle spectral profile</li>
                <li>Stokes Q vs Stokes U scatter plot</li>
            </ul>
            <p>All these plots are inter-linked so that when zooming profiles, data in the visible range will be highlighted in the scatter plot, and vice versa.</p>
            <h3 id="images">Image dropdown menu</h3>
            <p>The image dropdown defaults to &quot;Active&quot; image which means the current image in the image viewer.</p>
            <h3 id="regions">Region dropdown menu</h3>
            <p>
                The region dropdown defaults to &quot;Active&quot; region which means a selected region in the image viewer. You can select a region by clicking one on the image viewer, or by clicking a region entry on the region list
                widget. Stokes profile plot of the selected region will be updated accordingly. If no region is selected, &quot;Active&quot; region defaults to cursor.
            </p>
            <h3 id="spectral-conventions-and-reference-frame">Spectral conventions and reference frame</h3>
            <p>
                With the <code>Conversion</code> tab of the Stokes analysis settings dialog, you can change the spectral convention, including:
            </p>
            <ul>
                <li>Radio velocity (km/s, m/s)</li>
                <li>Optical velocity (km/s, m/s)</li>
                <li>Frequency (GHz, MHz, kHz, Hz)</li>
                <li>Wavelength (m, mm, um, Angstrom)</li>
                <li>Air wavelength (m, mm, um, Angstrom)</li>
                <li>Channel</li>
            </ul>
            <p>and spectral reference frame, including:</p>
            <ul>
                <li>LSRK: the rest-frame of the kinematical local standard of rest</li>
                <li>LSRD: the rest-frame of the dynamical local standard of rest</li>
                <li>BARY: barycentric, the rest-frame of the solar-system barycenter</li>
                <li>TOPO: topocentric, the observer's rest-frame on Earth</li>
            </ul>
            <p>Note that depending on the integrity of image headers, some conversions may not be possible.</p>
            <h3 id="data-smoothing">Data smoothing</h3>
            <p>
                The displayed profiles and the scatter plot can be smoothed via the <code>Smoothing</code> tab of the Stokes analysis settings dialog (the cog icon). A shortcut button of the <code>Smoothing</code> tab can be found at the
                top-right corner of the widget.
            </p>
            <h3 id="responsive-and-progressive-profile-update">Responsive and progressive profile update</h3>
            <p>
                When region Stokes profiles are requested, depending on the performance of the server, you may see profiles are updated piece by piece in regular interval. This feature provides a visual progress update for better user
                experience. In addition, if you move a region while profiles are being updating, the old calculations will be terminated immediately and calculations of the new region Stokes profiles will start. You will see partial
                profiles in seconds.
            </p>
            <h3 id="interactivity-zoom-pan-changing-channel">Interactivity: zoom, pan, changing channel</h3>
            <p>The x and y ranges of the Stokes profile plot can be modified by</p>
            <ul>
                <li>
                    <code>scrolling wheel</code> (up to zoom in and down to zoom out with respect to the cursor position)
                </li>
                <li>
                    <code>click-and-drag</code> horizontally to zoom in x
                </li>
                <li>
                    <code>click-and-drag</code> vertically to zoom in y
                </li>
                <li>
                    <code>click-and-drag</code> diagonally to zoom in both x and y
                </li>
                <li>
                    <code>double-click</code> to reset x and y ranges
                </li>
                <li>
                    <code>shift + drag-and-drop</code> to pan in x
                </li>
            </ul>
            <p>
                You may click on the Stokes profile plot to switch to a channel (as indicated by a red vertical line) and view the image in the image viewer. The red line is draggable and acts equivalently like the channel slider in the
                animator widget.
            </p>
            <h3 id="exports">Profile plot and scatter plot export</h3>
            <p>The Stokes profile plots and the QU scatter plot can be exported as a png file or a text file in tsv format via the buttons at the bottom-right corner (shown when you hover over the plot).</p>
            <h3 id="plot-cosmetics">Plot cosmetics</h3>
            <p>
                The appearance of the Stokes profile plot is customizable via the <code>Line Plot Styling</code> tab of the Stokes analysis settings dialog (the cog icon). Supported options are:
            </p>
            <ul>
                <li>colors of Stokes Q and Stokes U profiles</li>
                <li>plot styles including steps (default), lines, and dots</li>
                <li>line width for steps or lines</li>
                <li>point size for dots</li>
            </ul>
            <p>
                In addition, the appearance of the scatter plot can be customized with the <code>Scatter Plot Styling</code> tab too, including:
            </p>
            <ul>
                <li>Colormap</li>
                <li>Symbol size</li>
                <li>Symbol transparency</li>
                <li>Q-to-U scale ratio as unity</li>
            </ul>
        </React.Fragment>
    ],
    [
        HelpType.STOKES_ANALYSIS_SETTINGS_CONVERSION,
        <React.Fragment>
            <h3>Conversion</h3>
            <p>
                With the <code>Conversion</code> tab, you can change the spectral convention, including:
            </p>
            <ul>
                <li>Radio velocity (km/s, m/s)</li>
                <li>Optical velocity (km/s, m/s)</li>
                <li>Frequency (GHz, MHz, kHz, Hz)</li>
                <li>Wavelength (m, mm, um, Angstrom)</li>
                <li>Air wavelength (m, mm, um, Angstrom)</li>
                <li>Channel</li>
            </ul>
            <p>and spectral reference frame, including:</p>
            <ul>
                <li>LSRK: the rest-frame of the kinematical local standard of rest</li>
                <li>LSRD: the rest-frame of the dynamical local standard of rest</li>
                <li>BARY: barycentric, the rest-frame of the solar-system barycenter</li>
                <li>TOPO: topocentric, the observer's rest-frame on Earth</li>
            </ul>
            <p>Note that depending on the integrity of image headers, some conversions may not be possible.</p>
        </React.Fragment>
    ],
    [
        HelpType.STOKES_ANALYSIS_SETTINGS_LINE_PLOT_STYLING,
        <React.Fragment>
            <h3>Line Plot Styling</h3>
            <p>
                The appearance of the spectral profile plot is customizable via the <code>Line Plot Styling</code> tab. Supported options are:
            </p>
            <ul>
                <li>color of the plot</li>
                <li>plot styles including steps (default), lines, and dots</li>
                <li>line width for steps or lines</li>
                <li>point size for dots</li>
            </ul>
        </React.Fragment>
    ],
    [
        HelpType.STOKES_ANALYSIS_SETTINGS_SCATTER_PLOT_STYLING,
        <React.Fragment>
            <h3>Scatter Plot Styling</h3>
            <p>
                The appearance of the scatter plot is customizable via the <code>Scatter Plot Styling</code> tab. Supported options are:
            </p>
            <ul>
                <li>Colormap</li>
                <li>Symbol size</li>
                <li>Symbol transparency</li>
                <li>Q-to-U scale ratio as unity</li>
            </ul>
        </React.Fragment>
    ],
    [
        HelpType.STOKES_ANALYSIS_SETTINGS_SMOOTHING,
        <React.Fragment>
            <h3>Smoothing</h3>
            <p>Smoothing may be applied to profiles and the scatter plot to enhance signal-to-noise ratio. CARTA provides the following smoothing methods:</p>
            <ul>
                <li>
                    <b>Boxcar</b>: convolution with a boxcar function
                </li>
                <li>
                    <b>Gaussian</b>: convolution with a Gaussian function
                </li>
                <li>
                    <b>Hanning</b>: convolution with a Hanning function
                </li>
                <li>
                    <b>Binning</b>: averaging channels with a given width
                </li>
                <li>
                    <b>Savitzky-Golay</b>: fitting successive sub-sets of adjacent data points with a low-degree polynomial by the method of linear least squares
                </li>
            </ul>
            <p>Optionally, the original profile can be overplotted with the smoothed profile. </p>
            <p>The data of the smoothed profile is appended in the exported tsv file if smoothing is applied. The tsv file of the scatter plot only contains the smoothed data if smoothing is applied.</p>
            <h3>Examples</h3>
            <p>Boxcar: Kernel = 2</p>
            <p>
                <ImageComponent light={smoothingBoxcar} dark={smoothingBoxcar_d} width="90%" />
            </p>
            <p>Gaussian: Sigma = 1</p>
            <p>
                <ImageComponent light={smoothingGaussian} dark={smoothingGaussian_d} width="90%" />
            </p>
            <p>Hanning: Kernel = 5</p>
            <p>
                <ImageComponent light={smoothingHanning} dark={smoothingHanning_d} width="90%" />
            </p>
            <p>Binning: Binning width = 3</p>
            <p>
                <ImageComponent light={smoothingBinning} dark={smoothingBinning_d} width="90%" />
            </p>
            <p>Savitzky-Golay: Kernel = 5, Degree of fitting = 0</p>
            <p>
                <ImageComponent light={smoothingSG} dark={smoothingSG_d} width="90%" />
            </p>
        </React.Fragment>
    ],
    [
        HelpType.STOKES,
        <React.Fragment>
            <h3>Form a Stokes hypercube</h3>
            <p>
                This dialog allows user to confirm the auto-identification of the Stokes parameters from the image list and make corrections when necessary. The auto-identification obtains information from the image headers. If Stokes
                information is not available in the headers, CARTA will make a guess from the file names. Otherwise, you need to assign the Stokes parameters manually.
            </p>
        </React.Fragment>
    ]
]);
