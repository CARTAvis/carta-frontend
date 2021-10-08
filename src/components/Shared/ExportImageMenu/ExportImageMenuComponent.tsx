import * as React from "react";
import {observer} from "mobx-react";
import {MenuDivider, MenuItem} from "@blueprintjs/core";
import {AppStore} from "stores";

@observer
export class ExportImageMenuComponent extends React.Component {
    render() {
        return (
            <React.Fragment>
                <MenuDivider title="Resolution" />
                <MenuItem text="Normal (100%)" onClick={() => AppStore.Instance.exportImage(1)} />
                <MenuItem text="High (200%)" onClick={() => AppStore.Instance.exportImage(2)} />
                <MenuItem text="Highest (400%)" onClick={() => AppStore.Instance.exportImage(4)} />
            </React.Fragment>
        );
    }
}
