export const CATALOG_SCATTER_PLOT_HELP_CONTENT = (
    <div>
        <p>
            The Catalog 2D Scatter Plot Widget can be used to generate a scatter plot from two numeric columns selected from a catalog file. These columns can be configured with the dropdown menus at the bottom of the Catalog Widget. The
            "Display" column in the upper table of the Catalog Widget determines which columns are available for selection.
        </p>
        <p>
            The data used to render the 2D scatter plot is determined by the lower table in the Catalog Widget. The catalog table may not immediately display the full list of entries, which are loaded progressively as needed. The 2D scatter
            plot may thus not include all entries when the widget is initialized. The <b>Plot</b> button in the Catalog 2D Scatter Plot Widget allows you to request a full download of all the entries, which ensures that all data (after
            filtering) is included in the 2D scatter plot.
        </p>
        <p>
            You can use the <b>File</b> dropdown menu to select a target catalog (if multiple catalog files are loaded), and use the <b>X</b> and <b>Y</b> dropdown menus to select two numeric columns for the 2D scatter plot visualization.
        </p>
        <p>
            You can use the <b>Statistic source</b> dropdown menu to select a numeric column from a catalog and show basic statistical quantities for that column. This includes data count, mean, root mean square (rms), standard deviation,
            minimum, and maximum values.
        </p>
        <p>
            The plot is interactive. When you click on individual points or use the selection tools (<b>Box select</b> or <b>Lasso select</b>) in the top-right corner of the plot, the corresponding source entries will be highlighted in
            multiple linked components: the source catalog table, the histogram plot (if applicable), and the Image Viewer (when the catalog overlay feature is enabled). Conversely, if source entries are selected in the source catalog
            table, histogram plot, or Image Viewer (with the catalog overlay enabled), the corresponding points on the plot will be highlighted. The <b>Selected only</b> toggle simplifies the source catalog table by showing only the
            selected sources.
        </p>
        <p>
            The <b>Linear fit</b> button, allows you to perform a linear regression (1st-order polynomial fit) on the data. The results of the fit are summarized in the top-left corner of the scatter plot. You can use the selection tools
            (e.g., <b>Box select</b>) in the top-right corner of the scatter plot to select a specific subset of data for the linear fit. If no specific data subset is chosen, the entire dataset is used.
        </p>
    </div>
);
