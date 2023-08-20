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
            CARTA facilitates the loading of source catalog files available in either VOTable or FITS format (via <b>File -&gt; Import Catalog</b>). The loaded catalog files can subsequently be configured for diverse visualization purposes,
            including image overlays, 2D scatter plots, and histograms.
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
            Upon loading a source catalog file, descriptions of each column become visible within the upper table, while the specific catalog entries themselves are shown in the lower table. By default, the initial display encompasses the
            first 10 columns, which are both enabled and visible. However, customization is possible: you have the option to toggle the visibility of specific columns, thereby determining their presence within the lower table. Notably, the
            presentation of catalog entries in the lower table follows a progressive loading mechanism. As you scroll down the table, an ongoing stream of additional entries materializes, dynamically expanding the displayed content.
        </p>
        <p>
            The source catalog table is equipped with sub-filters that facilitate refined search capabilities, including partial string matching and value range specification. When dealing with numeric columns, CARTA supports a variety of
            operators, each serving a specific filtering function:
        </p>
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
                <code>&lt; 10</code> (signifying values lesser than 10)
            </li>
            <li>
                <code>== 1.23</code> (targeting entries equal to 1.23)
            </li>
            <li>
                <code>10..50</code> (encompassing values between 10 and 50, with both endpoints excluded)
            </li>
            <li>
                <code>10...50</code> (including values within the range of 10 and 50, with both endpoints included)
            </li>
        </ul>
        <p>
            In the case of string columns, a partial matching approach is implemented. To illustrate, entering <code>gal</code> (without quotation marks) will yield entries that encompass the substring &quot;gal&quot;.
        </p>
        <p>
            Upon configuring the desired filters, clicking the <b>Apply filter</b> button or hitting the <code>return</code> key triggers the application of these filters. Consequently, a refined source catalog will emerge, displaying
            entries in accordance with the set criteria. The displayed entries are limited to the value specified within the <b>Max rows</b> input field.
        </p>
        <p>
            Should the need arise to restore the original state, the <b>Reset filter</b> button offers a solution. When activated, all filters are promptly cleared, and any existing image overlay is simultaneously removed. This action
            extends to both histogram and 2D scatter plots. Following a reset, these plots are restored to their initial state, rendering solely the first 50 entries.
        </p>
        <p>To effectively visualize a source catalog, utilize the dropdown menu positioned at the widget's lower section. Here, you can select from three distinct rendering options that CARTA supports:</p>
        <ul>
            <li>
                <b>Image overlay</b>: This choice enables the superimposition of catalog data onto an image. To achieve this, two columns need to be designated as coordinates.
            </li>
            <li>
                <b>2D scatter</b>: For this rendering, two numeric columns are essential to construct a two-dimensional scatter plot.
            </li>
            <li>
                <b>Histogram</b>: To generate a histogram plot, one numeric column must be identified for computation and visualization.
            </li>
        </ul>
        <p>
            Notably, CARTA offers the capability of rendering marker-based image overlays. The capability extends to customizing marker attributes such as <b>Size</b>, <b>Color</b>, and <b>Orientation</b>. This is achieved through the
            mapping of data columns onto these rendering attributes. To configure this mapping, utilize the buttons at the widget's top-right corner, which will prompt the corresponding configuration dialog.
        </p>
        <p>
            <ImageComponent light={demoCatalogMarkerMapping} dark={demoCatalogMarkerMapping_d} width="100%" />
        </p>
        <p>
            An inherent connectivity exists among the source catalog table, the image overlay, the 2D scatter plot, and the histogram plot. This mutual linkage translates into interactive behavior. For instance, selecting a specific source
            or a collection of sources within the catalog table initiates corresponding source highlights across various visualization panels. This ripple effect extends to the 2D scatter plot, where selecting sources leads to synchronized
            highlights across other plots and within the catalog table.
        </p>
        <p>
            CARTA supports the loading of multiple catalog files. The <b>File</b> dropdown, positioned atop the widget, facilitates switching between loaded catalog files. It's also possible to concurrently launch multiple catalog widgets,
            each dedicated to displaying different catalog files. The <b>System</b> dropdown menu displays the coordinate system inherent to the catalog file. The <b>Close catalog</b> button located at the widget's bottom permits the
            closure of the selected catalog file from the <b>File</b>File dropdown. Additionally, in scenarios involving spatially matched images, the sharing of catalog image overlays is executed among these matched images, all while
            adhering to appropriate coordinate transformations.
        </p>
    </div>
);
