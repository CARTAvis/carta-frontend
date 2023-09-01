export const CATALOG_HISTOGRAM_PLOT_HELP_CONTENT = (
    <div>
        <p>The Catalog Histogram Plot Widget shows a histogram of a selected numeric column from a catalog file. The available numeric columns for plotting are shown in the "Display" column of the upper table in the Catalog Widget.</p>
        <p>
            The data used to plot the histogram is determined by the lower table in the Catalog Widget. The catalog table may not immediately display the full list of entries, which are loaded progressively as needed. The histogram plot may
            thus not include all entries when the widget is initialized. The <b>Plot</b> button in the Catalog Histogram Plot Widget allows you to request a full download of all the entries, which ensures that all data (after filtering) is
            included in the histogram plot. You can select a catalog file (<b>File</b> dropdown) and a column within the file (<b>X</b> dropdown), configure the number of bins (<b>Bins</b> input field), and select the y-axis scale (linear
            or logarithmic; <b>Log scale</b> toggle).
        </p>
        <p>
            You can use the <b>Statistic source</b> dropdown menu to select a numeric column from a catalog and show basic statistical quantities for that column. This includes data count, mean, root mean square (rms), standard deviation,
            minimum, and maximum values.
        </p>
        <p>
            The plot is interactive. When you select a specific histogram bin, the corresponding source entries will be highlighted in multiple linked components: the source catalog table, the 2D scatter plot (if applicable), and the Image
            Viewer (when the catalog overlay feature is enabled). Conversely, if source entries are selected in the source catalog table, 2D scatter plot, or Image Viewer (with the catalog overlay enabled), the corresponding histogram bin
            will be highlighted. The <b>Selected only</b> toggle simplifies the source catalog table by showing only the selected sources.
        </p>
    </div>
);
