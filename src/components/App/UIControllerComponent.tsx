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
    ExternalPageDialogComponent
} from "components/Dialogs";

@observer
export class UIControllerComponent extends React.Component {
    render() {
        return (
            <React.Fragment>
                <RootMenuComponent/>
                <RegionDialogComponent/>
                <ContourDialogComponent/>
                <FileInfoDialogComponent/>
                <FileBrowserDialogComponent/>
                <PreferenceDialogComponent/>
                <SaveLayoutDialogComponent/>
                <DebugExecutionDialogComponent/>
                <AboutDialogComponent/>
                <ExternalPageDialogComponent/>
                <HelpDrawerComponent/>
                <SplashScreenComponent/>
            </React.Fragment>
        );
    }
}