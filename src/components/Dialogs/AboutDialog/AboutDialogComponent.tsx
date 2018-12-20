import {observer} from "mobx-react";
import * as React from "react";
import {AnchorButton, Classes, IDialogProps, Intent} from "@blueprintjs/core";
import "./AboutDialogComponent.css";
import {DraggableDialogComponent} from "../DraggableDialog/DraggableDialogComponent";
import {AppStore} from "../../../stores/AppStore";
import * as logoPng from "../../../static/carta_logo.png";

@observer
export class AboutDialogComponent extends React.Component<{ appStore: AppStore }> {

    public render() {
        const appStore = this.props.appStore;

        const dialogProps: IDialogProps = {
            icon: "info-sign",
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: true,
            lazy: true,
            isOpen: appStore.aboutDialogVisible,
            onClose: appStore.hideAboutDialog,
            className: "about-dialog",
            canEscapeKeyClose: true,
            title: "About CARTA",
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} defaultWidth={600} defaultHeight={660} enableResizing={false}>
                <div className={Classes.DIALOG_BODY}>
                    <div className={"image-div"}>
                        <img src={logoPng} width={150}/>
                        <h2>CARTA Viewer Version 1.0 (20181221)</h2>
                    </div>

                    <h2>Development team:</h2>
                    <p>The development of the CARTA project is a joint effort from:</p>
                    <ul>
                        <li><a href="https://www.asiaa.sinica.edu.tw/" target="_blank">Academia Sinica, Institute of Astronomy and Astrophysics (ASIAA)</a></li>
                        <li><a href="https://idia.ac.za/" target="_blank">Inter-university Institute for Data Intensive Astronomy (IDIA)</a></li>
                        <li><a href="https://science.nrao.edu/" target="_blank">National Radio Astronomy Observatory (NRAO)</a></li>
                        <li><a href="https://www.ualberta.ca/physics" target="_blank">Department of Physics, University of Alberta</a></li>
                    </ul>
                    <h2>Useful links:</h2>
                    <ul>
                        <li>Source code for CARTA is available on <a href="https://github.com/cartavis" target="_blank">GitHub</a></li>
                        <li>Please report bugs or suggestions to <a href="mailto:carta_helpdesk@asiaa.sinica.edu.tw" target="_blank">carta_helpdesk@asiaa.sinica.edu.tw</a></li>
                        <li>Documentation is available <a href="https://cartavis.github.io/manual/index.html" target="_blank">online</a></li>
                    </ul>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <AnchorButton intent={Intent.NONE} onClick={appStore.hideAboutDialog} text="Close"/>
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}