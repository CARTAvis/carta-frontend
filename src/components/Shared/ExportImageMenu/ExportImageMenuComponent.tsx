import * as React from "react";
import {observer} from "mobx-react";
import {MenuDivider} from "@blueprintjs/core";
import {MenuItem2} from "@blueprintjs/popover2";
import {AppStore} from "stores";

@observer
export class ExportImageMenuComponent extends React.Component {
    render() {
        const appStore = AppStore.Instance;
        return (
            <React.Fragment>
                <MenuDivider title="Resolution" />
                <MenuItem2 text="Normal (100%)" label={`${appStore.modifierString}E`} onClick={() => appStore.exportImage(1)} />
                <MenuItem2 text="High (200%)" onClick={() => appStore.exportImage(2)} />
                <MenuItem2 text="Highest (400%)" onClick={() => appStore.exportImage(4)} />
            </React.Fragment>
        );
    }
}
