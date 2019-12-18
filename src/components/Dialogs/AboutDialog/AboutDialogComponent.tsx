import * as React from "react";
import {observer} from "mobx-react";
import {AnchorButton, Classes, IDialogProps, Intent} from "@blueprintjs/core";
import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore} from "stores";
import {CARTA_INFO} from "models";
import "./AboutDialogComponent.css";
import * as logoPng from "static/carta_logo.png";

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
            <DraggableDialogComponent dialogProps={dialogProps} defaultWidth={620} defaultHeight={700} enableResizing={false}>
                <div className={Classes.DIALOG_BODY}>
                    <div className={"image-div"}>
                        <img src={logoPng} width={100}/>
                        <h3>{CARTA_INFO.acronym} {CARTA_INFO.version} ({CARTA_INFO.date})</h3>
                        <p>{CARTA_INFO.fullName}</p>
                    </div>

                    <h3>Development team:</h3>
                    <p>The development of the CARTA project is a joint effort from:</p>
                    <ul>
                        <li><a href="https://www.asiaa.sinica.edu.tw/" target="_blank">Academia Sinica, Institute of Astronomy and Astrophysics (ASIAA)</a></li>
                        <li><a href="https://idia.ac.za/" target="_blank">Inter-University Institute for Data Intensive Astronomy (IDIA)</a></li>
                        <li><a href="https://science.nrao.edu/" target="_blank">National Radio Astronomy Observatory (NRAO)</a></li>
                        <li><a href="https://www.ualberta.ca/physics" target="_blank">Department of Physics, University of Alberta</a></li>
                    </ul>
                    <h3>Useful links:</h3>
                    <ul>
                        <li>Source code for CARTA is available on <a href="https://github.com/cartavis" target="_blank">GitHub</a></li>
                        <li>Please report bugs or suggestions to <a href="mailto:carta_helpdesk@asiaa.sinica.edu.tw" target="_blank">carta_helpdesk@asiaa.sinica.edu.tw</a></li>
                        <li>Documentation is available <a href="https://carta.readthedocs.io/en/latest" target="_blank">online</a></li>
                    </ul>
                    <h3>License</h3>
                    <p>
                        Copyright (C) 2018-2019 ASIAA, IDIA, NRAO, and Department of Physics, University of Alberta. This program is free software; you can redistribute it and/or modify it under the terms of the&#160;
                        <a href="http://www.gnu.org/copyleft/gpl.html" target="_blank">GNU General Public License version 3</a>&#160;
                        as published by the Free Software Foundation.
                    </p>
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
