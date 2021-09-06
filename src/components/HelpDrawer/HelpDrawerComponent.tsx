import * as React from "react";
import classNames from "classnames";
import {observer} from "mobx-react";
import {Classes, Drawer, IDrawerProps} from "@blueprintjs/core";
import {HELP_CONTENT_MAP} from "./HelpContent";
import {AppStore, HelpStore} from "stores";

@observer
export class HelpDrawerComponent extends React.Component {
    render() {
        const helpStore = HelpStore.Instance;
        const className = classNames("help-drawer", {"bp3-dark": AppStore.Instance.darkTheme});

        const drawerProps: IDrawerProps = {
            icon: "help",
            className: className,
            lazy: true,
            isOpen: helpStore.helpVisible,
            onClose: helpStore.hideHelpDrawer,
            title: helpStore.type ?? "",
            position: helpStore.position,
            size: "33%",
            hasBackdrop: false
        };

        return (
            <Drawer {...drawerProps}>
                <div className={Classes.DRAWER_BODY}>
                    <div className={Classes.DIALOG_BODY}>{HELP_CONTENT_MAP.get(helpStore.type) ?? ""}</div>
                </div>
            </Drawer>
        );
    }
}
