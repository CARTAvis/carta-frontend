import * as React from "react";
import {observer} from "mobx-react";
import {MenuDivider, MenuItem} from "@blueprintjs/core";
import {AppStore} from "stores";

@observer
export class ExportImageMenuComponent extends React.Component {
    render() {
        const appStore = AppStore.Instance;
        return (
            <React.Fragment>
                <MenuDivider title="Resolution" />
                <MenuItem text="Normal (100%)" label={`${appStore.modifierString}E`} onClick={() => appStore.exportImage(1)} />
                <MenuItem text="High (200%)" onClick={() => appStore.exportImage(2)} />
                <MenuItem text="Highest (400%)" onClick={() => appStore.exportImage(4)} />
            </React.Fragment>
        );
    }
}
