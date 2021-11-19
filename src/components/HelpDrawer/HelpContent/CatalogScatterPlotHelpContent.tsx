export const CATALOG_SCATTER_PLOT_HELP_CONTENT = (
    <div>
        <p>
            The Catalog 2D scatter plot widget shows a 2D scatter plot of two numeric columns of a catalog file. The available numeric columns in the dropdown menus at the bottom of the widget are determined by the <code>Display</code>{" "}
            column of the upper table in the Catalog widget.
        </p>
        <p>
            The data used for rendering a 2D scatter plot is determined by the lower table in the Catalog widget. The table may not show all entries because of the dynamic loading feature. Thus, the 2D scatter plot may not include all
            entries (after filtering). The <code>Plot</code> button will request a full download of all entries and the 2D scatter plot will then include all entries (after filtering).
        </p>
        <p>
            Click on a point or use the selection tools from the top-right corner of the plot to highlight selected sources in the source catalog table, in the histogram plot (if exists), and in the image viewer (if the catalog overlay is
            enabled). Points on the plot will be highlighted if sources are selected in the source catalog table, in the histogram plot (if it exists), and in the image viewer (if the catalog overlay is enabled). The{" "}
            <code>Selected only</code> toggle will update the source catalog table to show only the selected sources.
        </p>
    </div>
);
