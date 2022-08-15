import * as React from "react";
import classNames from "classnames";
import {observer} from "mobx-react";
import {action, computed, makeObservable, observable, reaction} from "mobx";
import {AnchorButton, Button, DialogProps, Intent, PopoverPosition} from "@blueprintjs/core";
import {Cell, Column, SelectionModes, Table2} from "@blueprintjs/table";
import {MenuItem2} from "@blueprintjs/popover2";
import {Select2, IItemRendererProps} from "@blueprintjs/select";
import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore, BrowserMode, HelpType} from "stores";
import {POLARIZATION_LABELS, STANDARD_POLARIZATIONS} from "models/PolarizationDefinition";
import {getHeaderNumericValue} from "utilities/wcs";
import {CARTA} from "carta-protobuf";
import "./StokesDialogComponent.scss";

@observer
export class StokesDialogComponent extends React.Component {
    @observable stokes: Map<string, CARTA.IStokesFile>;
    @observable stokesHeader: Map<string, CARTA.IFileInfoExtended>;

    @action updateStokesType = (fileName: string, type: CARTA.PolarizationType) => {
        let currentStoke = this.stokes.get(fileName);
        if (currentStoke.polarizationType !== type) {
            this.stokes.forEach((stokeFile, stokeFileName) => {
                if (stokeFileName !== fileName && stokeFile.polarizationType === type) {
                    this.stokes.get(stokeFileName).polarizationType = CARTA.PolarizationType.POLARIZATION_TYPE_NONE;
                }
            });
            const stoke: CARTA.IStokesFile = {
                directory: currentStoke.directory,
                file: currentStoke.file,
                hdu: currentStoke.hdu,
                polarizationType: type
            };
            this.stokes.set(fileName, stoke);
        }
    };

    @action setStokes = (fileName: string, stoke: CARTA.IStokesFile) => {
        this.stokes.set(fileName, stoke);
    };

    @action setStokesHeader = (fileName: string, fileInfoExtended: CARTA.IFileInfoExtended) => {
        this.stokesHeader.set(fileName, fileInfoExtended);
    };

    @computed get fileNames(): string[] {
        let files = [];
        this.stokes.forEach((type, file) => {
            files.push(file);
        });
        return files;
    }

    @computed get stokesDialogVisible(): boolean {
        return AppStore.Instance.dialogStore.stokesDialogVisible;
    }

    @computed get noneType(): boolean {
        let load = true;
        this.stokes.forEach(file => {
            if (file.polarizationType === CARTA.PolarizationType.POLARIZATION_TYPE_NONE) {
                load = false;
            }
        });
        return load;
    }

    constructor(props) {
        super(props);
        makeObservable(this);
        this.stokes = new Map();
        this.stokesHeader = new Map();

        reaction(
            () => this.stokesDialogVisible,
            stokesDialogVisible => {
                if (stokesDialogVisible) {
                    const fileBrowserStore = AppStore.Instance.fileBrowserStore;
                    this.stokes = new Map();
                    fileBrowserStore.selectedFiles.forEach(file => {
                        AppStore.Instance.fileBrowserStore
                            .getConcatFilesHeader(AppStore.Instance.fileBrowserStore.fileList.directory, file.fileInfo.name, file.hdu)
                            .then(response => {
                                // In fileInfoExtended: { [k: string]: CARTA.IFileInfoExtended }, sometimes k is " "
                                const k = Object.keys(response.info)[0];
                                const stoke: CARTA.IStokesFile = {
                                    directory: fileBrowserStore.fileList.directory,
                                    file: file.fileInfo.name,
                                    hdu: file.hdu,
                                    polarizationType: this.getStokeType(response.info[k], response.file)
                                };
                                this.setStokes(file.fileInfo.name, stoke);
                            })
                            .catch(err => {
                                console.log(err);
                            });
                    });
                }
            }
        );
    }

    render() {
        const appStore = AppStore.Instance;
        const fileBrowserStore = appStore.fileBrowserStore;
        const className = classNames("stokes-dialog", {"bp4-dark": appStore.darkTheme});
        const stokesItems = Object.values(CARTA.PolarizationType) as CARTA.PolarizationType[];
        const files = this.fileNames;

        const fileName = (
            <Column
                key={"FileName"}
                name={"File name"}
                cellRenderer={(rowIndex, columnIndex) => (
                    <Cell className="header-table-cell" key={`cell_${columnIndex}_${rowIndex}`} interactive={true}>
                        {this.fileNames[rowIndex]}
                    </Cell>
                )}
            />
        );

        const stokesDropDown = (
            <Column
                key={"Stokes"}
                name={"Polarization"}
                cellRenderer={rowIndex => {
                    const file = files[rowIndex];
                    return (
                        <Cell className="cell-dropdown-menu" key={`cell_drop_down_${rowIndex}`} interactive={true}>
                            <Select2
                                filterable={false}
                                items={stokesItems}
                                activeItem={this.stokes.get(file).polarizationType}
                                onItemSelect={type => this.updateStokesType(file, type)}
                                itemRenderer={this.renderPopOver}
                                popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                            >
                                <Button className="bp4-minimal catalog-represent-as-select-button" text={this.getLabelFromValue(this.stokes.get(file).polarizationType)} rightIcon="double-caret-vertical" />
                            </Select2>
                        </Cell>
                    );
                }}
            />
        );

        const dialogProps: DialogProps = {
            icon: "git-merge",
            className: className,
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.stokesDialogVisible,
            onClose: appStore.dialogStore.hideStokesDialog,
            title: "Merging polarization hypercube"
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} helpType={HelpType.STOKES} minWidth={300} minHeight={250} defaultWidth={602} defaultHeight={300} enableResizing={true}>
                <div className="bp4-dialog-body">
                    <Table2
                        className={"file-table"}
                        numRows={this.stokes.size}
                        enableRowHeader={false}
                        enableRowReordering={false}
                        selectionModes={SelectionModes.NONE}
                        defaultRowHeight={30}
                        minRowHeight={20}
                        minColumnWidth={30}
                        columnWidths={[440, 120]}
                        enableRowResizing={false}
                    >
                        {[fileName, stokesDropDown]}
                    </Table2>
                </div>
                <div className="bp4-dialog-footer">
                    <div className="bp4-dialog-footer-actions">
                        <AnchorButton
                            intent={Intent.NONE}
                            disabled={appStore.fileLoading || !fileBrowserStore.selectedFile || !fileBrowserStore.fileInfoResp || fileBrowserStore.loadingInfo}
                            onClick={AppStore.Instance.dialogStore?.hideStokesDialog}
                            text={"Cancel"}
                        />
                        <AnchorButton
                            intent={Intent.PRIMARY}
                            disabled={appStore.fileLoading || !fileBrowserStore.selectedFile || !fileBrowserStore.fileInfoResp || fileBrowserStore.loadingInfo || !this.noneType}
                            onClick={this.loadSelectedFiles}
                            text={"Load"}
                        />
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }

    private loadSelectedFiles = async () => {
        let stokeFiles = [];
        this.stokes.forEach(file => {
            stokeFiles.push(file);
        });
        await this.loadFile(stokeFiles)
            .then(() => AppStore.Instance.activeFrame?.setStokesFiles(stokeFiles))
            .catch(() => {
                AppStore.Instance.activeFrame?.setStokesFiles([]);
            });
    };

    private loadFile = async (files: CARTA.StokesFile[]) => {
        const appStore = AppStore.Instance;
        const fileBrowserStore = appStore.fileBrowserStore;

        // Ignore load if in export mode
        if (fileBrowserStore.browserMode === BrowserMode.RegionExport) {
            return;
        }

        if (fileBrowserStore.browserMode === BrowserMode.File) {
            const frames = appStore.frames;
            if (!fileBrowserStore.appendingFrame || !frames.length) {
                await appStore.openConcatFile(files, fileBrowserStore.fileList.directory, files[0].hdu);
            } else {
                await appStore.appendConcatFile(files, fileBrowserStore.fileList.directory, files[0].hdu);
            }
        }

        fileBrowserStore.saveStartingDirectory();
    };

    private getLabelFromValue = (value: CARTA.PolarizationType) => {
        if (value === CARTA.PolarizationType.POLARIZATION_TYPE_NONE) {
            return "None";
        }
        return POLARIZATION_LABELS.get(CARTA.PolarizationType[value]) ?? String(value);
    };

    private renderPopOver = (stokesType: CARTA.PolarizationType, itemProps: IItemRendererProps) => {
        const label = this.getLabelFromValue(stokesType);
        return <MenuItem2 key={`${stokesType}: ${label}`} text={label} onClick={itemProps.handleClick} active={itemProps.modifiers.active} />;
    };

    private getStokeType = (fileInfoExtended: CARTA.IFileInfoExtended, file: string): CARTA.PolarizationType => {
        let type = this.getTypeFromHeader(fileInfoExtended?.headerEntries);
        if (type === CARTA.PolarizationType.POLARIZATION_TYPE_NONE) {
            type = this.getTypeFromName(file);
        }
        return type;
    };

    private getTypeFromHeader(headers: CARTA.IHeaderEntry[]): CARTA.PolarizationType {
        let type = CARTA.PolarizationType.POLARIZATION_TYPE_NONE;

        const ctype = headers?.find(obj => obj.value.toUpperCase() === "STOKES");
        if (ctype && ctype.name.indexOf("CTYPE") !== -1) {
            const index = ctype.name.substring(5);
            const crpixHeader = headers.find(entry => entry.name.indexOf(`CRPIX${index}`) !== -1);
            const crvalHeader = headers.find(entry => entry.name.indexOf(`CRVAL${index}`) !== -1);
            const cdeltHeader = headers.find(entry => entry.name.indexOf(`CDELT${index}`) !== -1);
            const polarizationIndex = getHeaderNumericValue(crvalHeader) + (1 - getHeaderNumericValue(crpixHeader)) * getHeaderNumericValue(cdeltHeader);
            if (polarizationIndex) {
                const polarizationString = STANDARD_POLARIZATIONS.get(polarizationIndex);
                if (polarizationString) {
                    type = CARTA.PolarizationType[polarizationString] ?? CARTA.PolarizationType.POLARIZATION_TYPE_NONE;
                }
            }
        }

        return type;
    }

    private getTypeFromName(fileName: string): CARTA.PolarizationType {
        let type = CARTA.PolarizationType.POLARIZATION_TYPE_NONE;
        const separators = [".", "_"];
        separators.forEach(separator => {
            const words = fileName.split(separator);
            words.forEach(word => {
                const matchedType = CARTA.PolarizationType[word];
                if (matchedType) {
                    type = matchedType;
                }
            });
        });
        return type;
    }
}
