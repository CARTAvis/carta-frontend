import * as React from "react";
import {MenuDivider, MenuItem} from "@blueprintjs/core";
import {observer} from "mobx-react";

import {AppStore} from "stores";

@observer
export class ExportImageMenuComponent extends React.Component {
    render() {
        const appStore = AppStore.Instance;
        return (
            <React.Fragment>
                <MenuDivider title="PNG" />
                <MenuItem text="Normal (100%)" label={`${appStore.modifierString}E`} onClick={() => appStore.exportImage(1)} />
                <MenuItem text="High (200%)" onClick={() => appStore.exportImage(2)} />
                <MenuItem text="Highest (400%)" onClick={() => appStore.exportImage(4)} />
                <MenuDivider title="SVG" />
                <MenuItem text="Export as SVG" onClick={() => appStore.exportSvgImage()} />
            </React.Fragment>
        );
    }
}
