import * as React from "react";
import {ImageComponent} from "./ImageComponent";
import headCatalogueButton from "static/help/head_catalogue_button.png";
import headCatalogueButton_d from "static/help/head_catalogue_button_d.png";
import demoCatalogueMarkerMapping from "static/help/demo_catalog_marker_mapping.png";
import demoCatalogueMarkerMapping_d from "static/help/demo_catalog_marker_mapping_d.png";

export class CatalogOverlayHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p>
                    <ImageComponent light={headCatalogueButton} dark={headCatalogueButton_d} width="90%" />
                </p>
                <p>
                    Source catalog files in VOTable or FITS format can be loaded in CARTA (via <code>File</code>-&gt; <code>Import catalog</code>) for
                    visualization as an image overlay, or a 2D scatter plot, or a histogram.
                </p>
                <p>
                    Once a source catalog file is loaded, the information of each column will be shown in the upper table, while the actual catalog entries are
                    displayed in the lower table. By default, only the first 10 columns are enabled and displayed. You may configure it to show or hide certain
                    columns to be displayed in the lower table.
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
                    For string columns, partial match is adopted. For example, <code>gal</code> (no quotation) will return entries containing the
                    &quot;gal&quot; string.
                </p>
                <p>
                    Once filters are set, when the <code>Update</code> button is clicked, the filters will be applied and a filtered source catalog will be
                    displayed up to a number of entries defined in the <code>Max Rows</code> text input field. When the <code>Reset</code> button is clicked,
                    all filters will be removed and the image overlay (if exists) will be removed too. For the histogram plot or the 2D scatter plot, the plot
                    will be reset so that only the first 50 entries are rendered.
                </p>
                <p>
                    To visualize a source catalog, use the dropdown menu at the bottom of the widget to select a rendering type. CARTA supports three catalog
                    rendering types including 1) image overlay, 2) 2D scatter plot, and 3) histogram plot. For image overlay, you need to identify two columns
                    as the coordinates. Two numeric columns are needed to render a 2D scatter plot, and one numeric column is required to compute a histogram.
                </p>
                <p>
                    CARTA supports marker-based image overlay. You may render the marker with variable size, color, or orientation by mapping data columns to
                    these rendering options. To set up the column mapping, please use the buttons at the top-right corner of the widget to launch the dialog.
                </p>
                <p>
                    <ImageComponent light={demoCatalogueMarkerMapping} dark={demoCatalogueMarkerMapping_d} width="100%" />
                </p>
                <p>
                    The source catalog table, the image overlay, the 2D scatter plot, and the histogram plot are inter-linked or cross-referenced. This means,
                    for example, selecting a source or a set of source in the catalog table will trigger source highlight in other places. Or, selecting a
                    source or a set of sources in the 2D scatter plot will trigger source highlight in other plots and in the catalog table.
                </p>
                <p>
                    Multiple catalog files can be loaded and you may use the <code>File</code> dropdown at the top of the widget to switch in between. Multiple
                    catalog widgets may be launched to display different catalog files. The <code>Close</code> button at the bottom of the widget will close the
                    selected catalog file in the <code>File</code> dropdown. If there are spatially matched images, catalog image overlays are shared between
                    matched images with proper coordinate transformations.
                </p>
            </div>
        );
    }
}
