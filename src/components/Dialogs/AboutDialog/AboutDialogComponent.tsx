import * as React from "react";
import {Button, Classes, Collapse, type DialogProps, H4, H5, H6} from "@blueprintjs/core";
import classNames from "classnames";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {DialogId} from "enums";
import {CARTA_INFO} from "models";
import {AppStore, DialogStore} from "stores";

import "./AboutDialogComponent.scss";

@observer
export class AboutDialogComponent extends React.Component {
    private static readonly DefaultWidth = 525;
    private static readonly DefaultHeight = 615;
    private static readonly MinWidth = 525;
    private static readonly MinHeight = 615;

    @observable isExtendUsefulLinks: boolean = false;
    @observable isExtendExternalServices: boolean = false;

    @action toggleExtendUsefulLinks = () => {
        this.isExtendUsefulLinks = !this.isExtendUsefulLinks;
    };

    @action toggleExtendExternalServices = () => {
        this.isExtendExternalServices = !this.isExtendExternalServices;
    };

    constructor(props) {
        super(props);
        makeObservable(this);
    }

    public render() {
        const dialogStore = DialogStore.Instance;
        const className = classNames("about-dialog", {[Classes.DARK]: AppStore.Instance.isDarkTheme});

        const dialogProps: DialogProps = {
            icon: "info-sign",
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: true,
            lazy: true,
            isOpen: dialogStore.dialogVisible.get(DialogId.About) ?? false,
            className: className,
            canEscapeKeyClose: true,
            title: "About CARTA"
        };

        return (
            <DraggableDialogComponent
                dialogProps={dialogProps}
                defaultWidth={AboutDialogComponent.DefaultWidth}
                defaultHeight={AboutDialogComponent.DefaultHeight}
                minWidth={AboutDialogComponent.MinWidth}
                minHeight={AboutDialogComponent.MinHeight}
                isEnableResizing={false}
                dialogId={DialogId.About}
            >
                <div className={Classes.DIALOG_BODY}>
                    <div className={"image-div"}>
                        <img src="carta_logo.png" width={80} />
                        <H5>
                            {CARTA_INFO.acronym} {CARTA_INFO.version} ({CARTA_INFO.date})
                        </H5>
                        <p>{CARTA_INFO.fullName}</p>
                    </div>
                    <H5>Development team</H5>
                    <p>The development of the CARTA project is a joint effort from:</p>
                    <ul>
                        <li>
                            <a href="https://www.asiaa.sinica.edu.tw/" rel="noopener noreferrer" target="_blank">
                                Academia Sinica, Institute of Astronomy and Astrophysics (ASIAA)
                            </a>
                        </li>
                        <li>
                            <a href="https://idia.ac.za/" rel="noopener noreferrer" target="_blank">
                                Inter-University Institute for Data Intensive Astronomy (IDIA)
                            </a>
                        </li>
                        <li>
                            <a href="https://science.nrao.edu/" rel="noopener noreferrer" target="_blank">
                                National Radio Astronomy Observatory (NRAO)
                            </a>
                        </li>
                        <li>
                            <a href="https://www.ualberta.ca/physics" rel="noopener noreferrer" target="_blank">
                                Department of Physics, University of Alberta
                            </a>
                        </li>
                    </ul>
                    <Button minimal={true} icon="link" rightIcon={this.isExtendUsefulLinks ? "double-chevron-up" : "double-chevron-down"} alignText={"right"} small={true} onClick={this.toggleExtendUsefulLinks}>
                        <H6 className="extend-button-title">Useful links</H6>
                    </Button>
                    <Collapse isOpen={this.isExtendUsefulLinks}>
                        <ul>
                            <li>
                                Source code for CARTA is available on{" "}
                                <a href="https://github.com/cartavis" rel="noopener noreferrer" target="_blank">
                                    GitHub
                                </a>
                            </li>
                            {/* tslint:disable-next-line:max-line-length */}
                            <li>
                                Please report bugs or suggestions to the{" "}
                                <a href="mailto:support@carta.freshdesk.com" rel="noopener noreferrer" target="_blank">
                                    CARTA helpdesk
                                </a>{" "}
                                or file a{" "}
                                <a href="https://github.com/CARTAvis/carta/issues" rel="noopener noreferrer" target="_blank">
                                    GitHub issue
                                </a>
                            </li>
                            <li>
                                Documentation is available{" "}
                                <a href={`https://carta.readthedocs.io/en/${CARTA_INFO.docsVersion}`} rel="noopener noreferrer" target="_blank">
                                    online
                                </a>
                            </li>
                            <li>
                                User data collection policy is available{" "}
                                <a href="https://cartavis.org/telemetry" rel="noopener noreferrer" target="_blank">
                                    here
                                </a>
                            </li>
                        </ul>
                    </Collapse>
                    <Button minimal={true} icon="database" rightIcon={this.isExtendExternalServices ? "double-chevron-up" : "double-chevron-down"} alignText={"right"} small={true} onClick={this.toggleExtendExternalServices}>
                        <H6 className="extend-button-title">External services</H6>
                    </Button>
                    <Collapse isOpen={this.isExtendExternalServices}>
                        <p className="external-services-content">This software has made use of:</p>
                        <ul>
                            <li>
                                The SIMBAD database, operated at CDS, Strasbourg, France (
                                <a href="https://ui.adsabs.harvard.edu/abs/2000A%26AS..143....9W" rel="noopener noreferrer" target="_blank">
                                    2000,A&AS,143,9
                                </a>
                                , "The SIMBAD astronomical database", Wenger et al.)
                            </li>
                            <li>
                                The VizieR catalogue access tool, operated at CDS, Strasbourg Astronomical Observatory, France (
                                <a href="https://ui.adsabs.harvard.edu/abs/2000A%26AS..143...23O%2F" rel="noopener noreferrer" target="_blank">
                                    2000, A&AS, 143, 23
                                </a>
                                , "The VizieR database of astronomical catalogues.", Ochsenbein et al.)
                            </li>
                            <li>
                                <a href="https://alasky.cds.unistra.fr/hips-image-services/hips2fits" rel="noopener noreferrer" target="_blank">
                                    hips2fits
                                </a>
                                , a service provided by CDS
                            </li>
                            <li>
                                {" "}
                                <a href="https://splatalogue.online/" rel="noopener noreferrer" target="_blank">
                                    Splatalogue
                                </a>
                                , a service provided by NRAO. See the{" "}
                                <a href="https://splatalogue.online//#/faq" rel="noopener noreferrer" target="_blank">
                                    FAQ page
                                </a>{" "}
                                for the full set of catalog collection
                            </li>
                        </ul>
                    </Collapse>
                    <H4>License</H4>
                    <p className={Classes.TEXT_SMALL}>
                        Copyright (C) 2018-{CARTA_INFO.year} ASIAA, IDIA, NRAO, and Department of Physics, University of Alberta. This program is free software; you can redistribute it and/or modify it under the terms of the&#160;
                        <a href="http://www.gnu.org/copyleft/gpl.html" rel="noopener noreferrer" target="_blank">
                            GNU General Public License version 3
                        </a>
                        &#160; as published by the Free Software Foundation.
                    </p>
                </div>
            </DraggableDialogComponent>
        );
    }
}
