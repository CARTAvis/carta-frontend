import * as React from "react";
import {ImageComponent} from "./ImageComponent";
import headLineQueryButton from "static/help/head_linequery_button.png";
import headLineQueryButton_d from "static/help/head_linequery_button_d.png";

export class SpectralLineQueryHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p><ImageComponent light={headLineQueryButton} dark={headLineQueryButton_d} width="90%"/></p>
                <p>CARTA supports an initial implementation of spectral line ID overlay on a spectral profiler widget with a query to the Splatalogue service (https://splatalogue.online). The query is made by defining a spectral range in
                    frequency or wavelength and optionally a lower limit of CDMS/JPL line intensity (log). The spectral range can be defined as from-to or a center with a width.</p>
                <h4>QUERY LIMITATION</h4>
                <ul>
                    <li>The allowed maximum query range, equivalent in frequency, is 20 GHz.</li>
                    <li>The actual query is made with a frequency range in MHz rounded to integer.</li>
                    <li>When an intensity limit is applied, only the lines from CDMS and JPL catalogues will be returned.</li>
                    <li>Up to 100000 lines are displayed.</li>
                </ul>
                <h4>IMPORTANT NOTE</h4>
                <p>Currently, the Splatalogue query service is under active development. Unexpected query results might happen. When users believe there is something wrong, please contact 
                    the <a href="mailto:carta_helpdesk@asiaa.sinica.edu.tw">helpdesk</a> or file an issue on <a href="https://github.com/CARTAvis/carta/issues">Github</a> (recommended).
                </p>
                <br/>
                <p>Once a query is successfully made, the line catalogue will be displayed in the tables. The upper table shows the column information in the catalogue with options to show or hide a specific column. The actual line
                    catalogue is displayed in the lower table.</p>
                <p>The &quot;Shifted Frequency&quot; column is computed based on the user input of a velocity or a redshift. This &quot;Shifted Frequency&quot; is adopted for line ID overlay on a spectral profiler widget.</p>
                <p>Users can use the checkbox to select a set of lines to be overplotted on a spectral profiler widget. The maximum number of line ID overlay is 1000.</p>
                <p>The sorting and filtering functions in the line table will be available in a future release.</p>
                <p>The text labels of the line ID overlay are shown dynamically based on the zoom level of a profile. Different line ID overlays (with different velocity shifts) can be created on different spectral profilers widgets via
                    the &quot;Spectral Profiler&quot; dropdown. By clicking the &quot;Clear&quot; button, the line ID overlay on the selected &quot;Spectral Profiler&quot; will be removed.</p>
            </div>
        );
    }
}
