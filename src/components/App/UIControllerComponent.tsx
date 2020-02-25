import * as React from "react";
import { observer } from "mobx-react";
import {RootMenuComponent, SplashScreenComponent, HelpDrawerComponent} from "components";
import {
    AboutDialogComponent,
    AuthDialogComponent,
    FileBrowserDialogComponent,
    OverlaySettingsDialogComponent,
    PreferenceDialogComponent,
    RegionDialogComponent,
    SaveLayoutDialogComponent,
    FileInfoDialogComponent,
    ContourDialogComponent
} from "components/Dialogs";
import { AppStore } from "stores";

@observer
export class UIControllerComponent extends React.Component<{appStore: AppStore}> {
 
    render() {
        const appStore = this.props.appStore;

        return (
            <React.Fragment>
                <SplashScreenComponent appStore={appStore}/>
                <RootMenuComponent appStore={appStore}/>
                <OverlaySettingsDialogComponent appStore={appStore}/>
                <AuthDialogComponent appStore={appStore}/>
                <FileBrowserDialogComponent appStore={appStore}/>
                <AboutDialogComponent appStore={appStore}/>
                <RegionDialogComponent appStore={appStore}/>
                <PreferenceDialogComponent appStore={appStore}/>
                <SaveLayoutDialogComponent appStore={appStore}/>
                <FileInfoDialogComponent appStore={appStore}/>
                <ContourDialogComponent appStore={appStore}/>
                <HelpDrawerComponent appStore={appStore}/>
            </React.Fragment>
        );
    }
}