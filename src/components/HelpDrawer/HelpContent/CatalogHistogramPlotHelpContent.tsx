export const CATALOG_HISTOGRAM_PLOT_HELP_CONTENT = (
    <div>
        <p>
            The catalog histogram plot widget shows a histogram of a selected numeric column from a catalog file. The available numeric columns for plotting are determined by the <code>Display</code> column of the upper table in the Catalog
            widget.
        </p>
        <p>
            The data used for plotting the histogram is determined by the lower table in the Catalog widget. The table may not show all the entries because of the progressive loading feature. When you scroll down the catalog table, new
            catalog entries will be streamed for visualization. Thus, the histogram plot may not include all entries (even after filtering) when the widget is initialized. The <code>Plot</code> button allows you to request a full download
            of all the entries and the histogram plot will then include all data (after filtering). The number of bins and the scale of the y-axis (linear or log) can be customized.
        </p>
        <p>
            You may use the <code>Statistic Source</code> dropdown menu to select a numeric column from a catalog to show basic statistical quantities, including data count, mean, rms, standard deviation, min, and max.
        </p>
        <p>
            When you click on a specific histogram bin, source entries of that bin will be highlighted in the source catalog table, in the 2D scatter plot (if it exists), and in the image viewer (if the catalog overlay is enabled). A
            certain histogram bin will be highlighted if source entries of that bin are selected in the source catalog table, in the 2D scatter plot (if exists), or in the image viewer (if the catalog overlay is enabled). The{" "}
            <code>Selected only</code> toggle can be used to update the source catalog table to show only the selected sources.
        </p>
    </div>
);
