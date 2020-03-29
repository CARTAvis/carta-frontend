import * as React from "react";
import {AppStore} from "stores";
import {ImageComponent} from "./ImageComponent";
import * as underConstruction from "static/help/under_construction.png";

export class RegionDialogHelpComponent extends React.Component<{ appStore: AppStore }> {
    public render() {
        return (
            <div>

                <p>The region configuration dialogue allows users to change the appearance of a region, such as</p>
                <ul>
                    <li>color</li>
                    <li>linewidth</li>
                    <li>line style (solid or dashed)</li>
                </ul>
                <p>and region properties, such as</p>
                <ul>
                    <li>region name</li>
                    <li>region location and shape properties</li>
                </ul>
                <br/>
                <h4 id="tip">TIP</h4>
                <p><code>Double-Click</code> on a region in the image viewer or on an entry in the region list widget will bring up this region configuration dialogue.</p>

            </div>
        );
    }
}
