import * as React from "react";
import {Alert, Classes, Intent} from "@blueprintjs/core";
import classNames from "classnames";
import {Layout} from "flexlayout-react";
import {observer} from "mobx-react";

import {FloatingWidgetManagerComponent, UIControllerComponent} from "components";
import {TaskProgressDialogComponent} from "components/Dialogs";
import {AlertType} from "enums";
import {ApiService} from "services";
import {type AlertStore, AppStore, LayoutStore} from "stores";

import {HotkeyService, HotkeysRegistrar} from "./HotkeyWrapper";

import "flexlayout-react/style/light.css";
import "./layout-flexlayout.scss";
import "./App.scss";

@observer
export class App extends React.Component {
    private layoutRef = React.createRef<Layout>();

    componentDidMount() {
        LayoutStore.Instance.layoutRef = this.layoutRef;
    }

    private renderAlertComponent = (alertStore: AlertStore, darkTheme: boolean) => {
        const baseAlertProps = {
            icon: alertStore.alertIcon,
            className: classNames({[Classes.DARK]: darkTheme}),
            isOpen: alertStore.alertVisible
        };

        switch (alertStore.alertType) {
            case AlertType.Info:
                return (
                    <Alert {...baseAlertProps} onClose={alertStore.dismissAlert} canEscapeKeyCancel={true}>
                        <p>{alertStore.alertText}</p>
                    </Alert>
                );
            case AlertType.Interactive:
                return (
                    <Alert {...baseAlertProps} confirmButtonText="OK" cancelButtonText="Cancel" intent={Intent.DANGER} onClose={alertStore.handleInteractiveAlertClosed}>
                        <p>{alertStore.interactiveAlertText}</p>
                    </Alert>
                );
            case AlertType.Retry:
                const cancelProps =
                    alertStore.showDashboardLink && ApiService.RuntimeConfig?.dashboardAddress
                        ? {
                              cancelButtonText: "Open CARTA Dashboard",
                              onCancel: () => window.open(ApiService.RuntimeConfig.dashboardAddress, "_blank")
                          }
                        : {};

                return (
                    <Alert {...baseAlertProps} confirmButtonText="Retry" {...cancelProps} intent={Intent.DANGER} onClose={alertStore.handleInteractiveAlertClosed} canEscapeKeyCancel={false}>
                        <p>{alertStore.interactiveAlertText}</p>
                    </Alert>
                );
            default:
                return null;
        }
    };

    public render() {
        const appStore = AppStore.Instance;
        const layoutStore = appStore.layoutStore;
        const widgetsStore = appStore.widgetsStore;
        const className = classNames("App", {[Classes.DARK]: appStore.darkTheme});
        const layoutClassName = classNames("layout-container", {"dark-theme": appStore.darkTheme});

        const alertComponent = this.renderAlertComponent(appStore.alertStore, appStore.darkTheme);

        return (
            <div className={className}>
                <UIControllerComponent />
                {alertComponent}
                <TaskProgressDialogComponent
                    progress={0}
                    timeRemaining={0}
                    isOpen={appStore.resumingSession || appStore.loadingWorkspace}
                    cancellable={false}
                    text={appStore.resumingSession ? "Resuming session..." : "Loading workspace..."}
                />
                <div className={layoutClassName}>
                    {layoutStore.layoutModel && (
                        <Layout
                            ref={this.layoutRef}
                            model={layoutStore.layoutModel}
                            factory={widgetsStore.renderWidgetFactory}
                            onRenderTab={widgetsStore.onRenderTab}
                            onRenderTabSet={widgetsStore.onRenderTabSet}
                            onModelChange={widgetsStore.onModelChange}
                            onAction={widgetsStore.onAction}
                            supportsPopout={true}
                        />
                    )}
                </div>
                <HotkeysRegistrar />
                <HotkeyService />
                <FloatingWidgetManagerComponent />
            </div>
        );
    }
}
