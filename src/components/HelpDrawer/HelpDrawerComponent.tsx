import * as React from "react";
import {observer} from "mobx-react";
import {Drawer, IDrawerProps, Position, Classes} from "@blueprintjs/core";
import {AppStore} from "stores";
import "./HelpDrawerComponent.css";

@observer
export class HelpDrawerComponent extends React.Component<{ appStore: AppStore }> {

    render() {
        let className = "help-drawer";
        if (this.props.appStore.darkTheme) {
            className += " bp3-dark";
        }

        const appStore = this.props.appStore;
        const helpStore = appStore.helpStore;

        const drawerProps: IDrawerProps = {
            icon: "help",
            className: className,
            backdropClassName: "minimal-drawer-backdrop",
            lazy: true,
            isOpen: helpStore.helpVisible,
            onClose: helpStore.hideHelpDrawer,
            title: helpStore.helpTitle,
            position: Position.RIGHT,
            size: "33%",
            hasBackdrop: true
        };

        return (
            <Drawer {...drawerProps} >
                <div className={Classes.DRAWER_BODY}>
                    <div className={Classes.DIALOG_BODY} dangerouslySetInnerHTML={{__html: helpStore.helpContext}}/>
                </div>
                <div className={Classes.DRAWER_FOOTER}>Footer</div>
            </Drawer>
        );
    }
}
