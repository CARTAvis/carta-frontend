import * as React from "react";
import {ImageComponent} from "./ImageComponent";
import headLineQueryButton from "static/help/head_linequery_button.png";
import headLineQueryButton_d from "static/help/head_linequery_button_d.png";

export class SpectralLineQueryHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p><ImageComponent light={headLineQueryButton} dark={headLineQueryButton_d} width="90%"/></p>
                <h3>Spectral line query</h3>
                <p>CARTA supports an initial implementation of spectral line ID overlay on a spectral profiler widget with line data from the Splatalogue service (https://splatalogue.online). The query is made using a spectral range defined by defining in
                    frequency or wavelength (rest frame) and optionally a lower limit of CDMS/JPL line intensity (log). The spectral range can be defined as from-to or center-width.</p>
                <h4>QUERY LIMITATION</h4>
                <ul>
                    <li>The allowed maximum query range, equivalent in frequency, is 20 GHz.</li>
                    <li>The actual query is made with a frequency range in MHz rounded to integer.</li>
                    <li>When an intensity limit is applied, only the lines from CDMS and JPL catalogues will be returned.</li>
                    <li>Up to 100000 lines are displayed.</li>
                </ul>
                <h4>NOTE</h4>
                <p>Currently, the Splatalogue query service is under active development. Unexpected query results might happen. If you believe there is something wrong, please contact 
                    the <a href="mailto:carta_helpdesk@asiaa.sinica.edu.tw">helpdesk</a> or file an issue on <a href="https://github.com/CARTAvis/carta/issues">Github</a> (recommended).
                </p>
                <h3>Spectral line filtering</h3>
                <p>Once a query is successfully made, the line catalogue will be displayed in the tables. The upper table shows the column information in the catalogue with options to show or hide a specific column. The actual line
                    catalogue is displayed in the lower table.</p>
                <p>The spectral line catalogue table accepts sub-filters such as partial string match or value range. For numeric columns, supported operators are:</p>
                <ul>
                    <li><code>&gt;</code> greater than</li>
                    <li><code>&gt;=</code> greater than or equal to</li>
                    <li><code>&lt;</code> less than</li>
                    <li><code>&lt;=</code> less than or equal to</li>
                    <li><code>==</code> equal to</li>
                    <li><code>!=</code> not equal to</li>
                    <li><code>..</code> between (exclusive)</li>
                    <li><code>...</code> between (inclusive)</li>
                </ul>
                <p>Examples:</p>
                <ul>
                    <li><code>&lt; 10</code> (everything less than 10)</li>
                    <li><code>== 1.23</code> (entries equal to 1.23)</li>
                    <li><code>10..50</code> (everything between 10 and 50, exclusive)</li>
                    <li><code>10...50</code> (everything between 10 and 50, inclusive)</li>
                </ul>
                <p>For string columns, partial match is adopted. For example, <code>CH3</code> (no quotation) will return entries containing the &quot;CH3&quot; string.</p>
                <h3>Spectral line ID visualization</h3>
                <p>The &quot;Shifted Frequency&quot; column is computed based on the user input of a velocity or a redshift. This &quot;Shifted Frequency&quot; is adopted for line ID overlay on a spectral profiler widget.</p>
                <p>You can use the checkbox to select a set of lines to be overplotted in a spectral profiler widget. The maximum number of line ID overlays is 1000.</p>
                <p>The text labels of the line ID overlay are shown dynamically based on the zoom level of a profile. Different line ID overlays (with different velocity shifts) can be created on different spectral profilers widgets via
                    the <code>Spectral Profiler</code> dropdown. By clicking the <code>Clear</code> button, the line ID overlay on the selected &quot;Spectral Profiler&quot; will be removed.</p>
            
                <br/>
                <h4>NOTE</h4>
                <p>The sorting functions in the line table will be available in a future release.</p>
            
            
            </div>
        );
    }
}
