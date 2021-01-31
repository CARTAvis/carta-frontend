import * as React from "react";
import {observer} from "mobx-react";
import {Classes, Intent, Overlay, Spinner} from "@blueprintjs/core";
import {AppStore} from "stores";
import "./SpectralLineQuerySplashScreenComponent.scss";

@observer
export class SpectralLineQuerySplashScreenComponent extends React.Component<{isOpen: boolean}> {
    public render() {
        const appStore = AppStore.Instance;

        let className = "spectral-line-query-splash-screen";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        return (
            <Overlay className={Classes.OVERLAY_SCROLL_CONTAINER} autoFocus={true} canEscapeKeyClose={false} canOutsideClickClose={false} isOpen={this.props.isOpen} usePortal={false}>
                <div className={className}>
                    <Spinner intent={Intent.PRIMARY} size={30} value={null}/>
                    <div className={"loadingInfo-div"}>
                        <p>Checking whether Splatalogue is alive...</p>
                    </div>
                </div>
            </Overlay>
        );
    }
}
