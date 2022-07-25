export const CATALOG_SCATTER_PLOT_HELP_CONTENT = (
    <div>
        <p>
            The Catalog 2D scatter plot widget shows a 2D scatter plot of two numeric columns from a catalog file. The available numeric columns in the dropdown menus at the bottom of the widget are determined by the <code>Display</code>{" "}
            column of the upper table in the Catalog widget.
        </p>
        <p>
            The data used for rendering a 2D scatter plot is determined by the lower table in the Catalog widget. The table may not show all the entries because of the progressive loading feature. When you scroll down the catalog table, new
            catalog entries will be streamed for visualization. Thus, the 2D scatter plot may not include all entries (even after filtering) when the widget is initialized. The <code>Plot</code> button will request a full download of all
            entries and the 2D scatter plot will then include all data (after filtering).
        </p>
        <p>
            You may use the <code>Statistic Source</code> dropdown menu to select a numeric column from a catalog to show basic statistical quantities, including data count, mean, rms, standard deviation, min, and max.
        </p>
        <p>
            You can click on a point or use the selection tools (Box Select or Lasso Select) at the top-right corner of the plot to highlight selected sources in the source catalog table, in the histogram plot (if exists), and in the image
            viewer (if the catalog overlay is enabled). Points on the plot will be highlighted if sources are selected in the source catalog table, in the histogram plot (if it exists), or in the image viewer (if the catalog overlay is
            enabled). The <code>Selected only</code> toggle will update the source catalog table to show only the selected sources.
        </p>
        <p>
            The <code>Linear Fit</code> button allows you to fit a straight line (1st-order polynomial) to the data. Fitting results are summarized at the top-left corner of the scatter plot. You may use the selection tools (Box Select or
            Lasso Select) at the top-right corner of the scatter plot to select a subset of data to be fitted. If no data is selected, all data will be used in the linear fit.
        </p>
    </div>
);
