import * as React from "react";
import {observer} from "mobx-react";
import {RootMenuComponent, SplashScreenComponent, HelpDrawerComponent} from "components";
import {
    AboutDialogComponent,
    FileBrowserDialogComponent,
    PreferenceDialogComponent,
    RegionDialogComponent,
    SaveLayoutDialogComponent,
    FileInfoDialogComponent,
    ContourDialogComponent,
    DebugExecutionDialogComponent,
    ExternalPageDialogComponent,
    StokesDialogComponent
} from "components/Dialogs";

@observer
export class UIControllerComponent extends React.Component {
    render() {
        return (
            <React.Fragment>
                <SplashScreenComponent/>
                <RootMenuComponent/>
                <FileBrowserDialogComponent/>
                <AboutDialogComponent/>
                <RegionDialogComponent/>
                <PreferenceDialogComponent/>
                <SaveLayoutDialogComponent/>
                <ContourDialogComponent/>
                <FileInfoDialogComponent/>
                <DebugExecutionDialogComponent/>
                <ExternalPageDialogComponent/>
                <HelpDrawerComponent/>
                <StokesDialogComponent/>
            </React.Fragment>
        );
    }
}