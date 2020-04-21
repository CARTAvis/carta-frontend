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

@observer
export class UIControllerComponent extends React.Component {
 
    render() {
        return (
            <React.Fragment>
                <SplashScreenComponent/>
                <RootMenuComponent/>
                <OverlaySettingsDialogComponent/>
                <AuthDialogComponent/>
                <FileBrowserDialogComponent/>
                <AboutDialogComponent/>
                <RegionDialogComponent/>
                <PreferenceDialogComponent/>
                <SaveLayoutDialogComponent/>
                <FileInfoDialogComponent/>
                <ContourDialogComponent/>
                <HelpDrawerComponent/>
            </React.Fragment>
        );
    }
}