import demoCatalogMarkerMapping from "static/help/demo_catalog_marker_mapping.png";
import demoCatalogMarkerMapping_d from "static/help/demo_catalog_marker_mapping_d.png";
import dialogButtonCatalogQuery from "static/help/dialogButton_catalogQuery.png";
import dialogButtonCatalogQuery_d from "static/help/dialogButton_catalogQuery_d.png";
import widgetButtonCatalog from "static/help/widgetButton_catalog.png";
import widgetButtonCatalog_d from "static/help/widgetButton_catalog_d.png";

import {ImageComponent} from "../ImageComponent";

export const CATALOG_OVERLAY_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={widgetButtonCatalog} dark={widgetButtonCatalog_d} width="90%" />
        </p>
        <p>
            Source catalog files in VOTable or FITS format can be loaded in CARTA via <b>File -&gt; Import Catalog</b>. Once loaded, catalogs can be used for various visualization purposes, including image overlays, 2D scatter plots, and
            histograms.
        </p>
        <p>
            Alternatively, catalogs can be retrieved from{" "}
            <a href="http://simbad.u-strasbg.fr" target="_blank" rel="noreferrer">
                SIMBAD
            </a>{" "}
            or{" "}
            <a href="https://vizier.u-strasbg.fr/viz-bin/VizieR" target="_blank" rel="noreferrer">
                VizieR
            </a>{" "}
            with the Online Catalog Query Dialog.
        </p>
        <p>
            <ImageComponent light={dialogButtonCatalogQuery} dark={dialogButtonCatalogQuery_d} width="39%" />
        </p>
        <p>
            When a source catalog file is loaded, the column descriptions are shown in the upper table, while the catalog entries are displayed in the lower table. By default, only the first 10 columns are enabled and displayed - you can
            configure which columns to include and exclude. Catalog entries are displayed progressively: as you scroll down the table, more entries will be streamed and displayed.
        </p>
        <p>More refined filtering is possible with sub-filters, such as partial string matching or value ranges. For numeric columns, the following operators are supported:</p>
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
                <code>&lt; 10</code> (values less than 10)
            </li>
            <li>
                <code>== 1.23</code> (values equal to 1.23)
            </li>
            <li>
                <code>10..50</code> (values between 10 and 50, with both endpoints excluded)
            </li>
            <li>
                <code>10...50</code> (values between 10 and 50, with both endpoints included)
            </li>
        </ul>
        <p>
            For string columns, partial string matches are available. For example, entering <code>gal</code> (without quotation marks) will yield entries that include the substring &quot;gal&quot;.
        </p>
        <p>
            Click the <b>Apply filter</b> button or hit the <code>return</code> key to apply the configured filters. The entries in the catalog table will then be refined according to the set criteria. The number of displayed entries will
            be limited to the value set in the <b>Max rows</b> input field.
        </p>
        <p>
            To clear all filters from the catalog, click the <b>Reset filter</b> button. This also removes any existing image overlay. Both the histogram and the 2D scatter plots will be restored to their initial state, and will render only
            the first 50 entries.
        </p>
        <p>To configure the visualization of a source catalog, use the dropdown menu at the bottom of the widget to select one of the supported rendering options:</p>
        <ul>
            <li>
                <b>Image overlay</b>: Superimpose the catalog data onto an image. Two columns must be selected as coordinates.
            </li>
            <li>
                <b>2D scatter</b>: Select two numeric columns to construct a two-dimensional scatter plot.
            </li>
            <li>
                <b>Histogram</b>: Select one numeric column to generate a histogram.
            </li>
        </ul>
        <p>
            CARTA supports the rendering of marker-based image overlays. You can map data columns onto marker attributes such as <b>Size</b>, <b>Color</b>, and <b>Orientation</b>. To customize this mapping, use the buttons in the top-right
            corner of the widget to launch the configuration dialog.
        </p>
        <p>
            <ImageComponent light={demoCatalogMarkerMapping} dark={demoCatalogMarkerMapping_d} width="100%" />
        </p>
        <p>
            The source catalog table, image overlay, 2D scatter plot, and histogram plot are interlinked, and interact with one another. Whenever a source or a set of sources is selected in the catalog table, the corresponding sources will
            be highlighted in the other components, and vice versa.
        </p>
        <p>
            CARTA supports the loading of multiple catalog files. The <b>File</b> dropdown at the top of the widget can be used to switch between loaded files. It's also possible to launch multiple catalog widgets concurrently, each
            displaying different files. The <b>System</b> dropdown menu can be used to configure the coordinate system used by the currently selected file, and the <b>Close catalog</b> button at the bottom of the widget closes it. If there
            are spatially matched images, catalog image overlays are shared between them, with the appropriate coordinate transformations applied.
        </p>
    </div>
);
