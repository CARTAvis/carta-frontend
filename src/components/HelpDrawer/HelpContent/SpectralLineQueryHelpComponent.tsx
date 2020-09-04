import * as React from "react";
import {ImageComponent} from "./ImageComponent";
import * as headLineQueryButton from "static/help/head_linequery_button.png";
import * as headLineQueryButton_d from "static/help/head_linequery_button_d.png";

export class SpectralLineQueryHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p><ImageComponent light={headLineQueryButton} dark={headLineQueryButton_d} width="90%"/></p>
                <p>CARTA supports spectral line ID overlay on a spectral 
                    profiler widget with a query to the Splatalogue service 
                    (https://splatalogue.online). The query is made by 
                    defining a spectral range in frequency or wavelength and 
                    optionally a lower limit of CDMS/JPL line intensity (log). 
                    The spectral range can be defined as from-to or a center 
                    with a width. The allowed maximum query range, equivalent 
                    in frequency, is 20 GHz.</p>                
                <h4>IMPORTANT NOTE</h4>
                <p>Currently, the Splatalogue query service is under active 
                    development. Unexpected query results might happen. Please report 
                    issues to https://github.com/CARTAvis/carta/issues or send an email 
                    to carta_helpdesk@asiaa.sinica.edu.tw.</p>
                <p>Once a query is successfully made, the line catalogue will be 
                    displayed in the tables. The upper table shows the column 
                    information in the catalogue with options to show or hide a 
                    specific column. The actually line catalogue is displayed in 
                    the lower table.</p>
                <p>The &quot;Shifted Frequency&quot; column is computed based 
                    on the user input of a velocity or a redshift. 
                    This &quot;Shifted Frequency&quot; is adopted for line 
                    ID overlay on a spectral profiler widget.</p>
                <p>The line catalogue table accepts sub-filters such as partial 
                    string match or value range. This would allow users to select 
                    potential target lines quickly. Users can use the checkbox to 
                    select a set of lines to be overplotted on a spectral profiler 
                    widget. The maximum number of line ID overlay is 1000.</p>
                <p>The text labels of the line ID overlay are shown dynamically 
                    based on the zoom level of a profile. Different line ID overlays 
                    (with different velocity shifts) can be created on different 
                    spectral profilers widgets via the &quot;Spectral Profiler&quot; 
                    dropdown. By clicking the &quot;Clear&quot; button, the line 
                    ID overlay on the selected &quot;Spectral Profiler&quot; will 
                    be removed.</p>                    
            </div>
        );
    }
}
