import * as React from "react";
import {AnchorButton, Button, IDialogProps, Intent, MenuItem, PopoverPosition} from "@blueprintjs/core";
import {IItemRendererProps, Select} from "@blueprintjs/select";
import {Cell, Column, SelectionModes, Table} from "@blueprintjs/table";
import {CARTA} from "carta-protobuf";
import classNames from "classnames";
import {action, computed, makeObservable, observable, reaction} from "mobx";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {POLARIZATION_LABELS} from "models";
import {AppStore, BrowserMode, DialogId, HelpType} from "stores";

import "./StokesDialogComponent.scss";

@observer
export class StokesDialogComponent extends React.Component {
    private static readonly DefaultWidth = 610;
    private static readonly DefaultHeight = 300;
    private static readonly MinWidth = 300;
    private static readonly MinHeight = 250;

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
        return AppStore.Instance.dialogStore.dialogVisible.get(DialogId.Stokes);
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
                    fileBrowserStore.selectedFiles.forEach(async file => {
                        const stokes = await fileBrowserStore.getStokesFile(fileBrowserStore.fileList.directory, file.fileInfo.name, file.hdu);
                        if (stokes) {
                            this.setStokes(file.fileInfo.name, stokes);
                        }
                    });
                }
            }
        );
    }

    render() {
        const appStore = AppStore.Instance;
        const fileBrowserStore = appStore.fileBrowserStore;
        const className = classNames("stokes-dialog", {"bp3-dark": appStore.darkTheme});
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
                            <Select
                                filterable={false}
                                items={stokesItems}
                                activeItem={this.stokes.get(file).polarizationType}
                                onItemSelect={type => this.updateStokesType(file, type)}
                                itemRenderer={this.renderPopOver}
                                popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                            >
                                <Button className="bp3-minimal catalog-represent-as-select-button" text={this.getLabelFromValue(this.stokes.get(file).polarizationType)} rightIcon="double-caret-vertical" />
                            </Select>
                        </Cell>
                    );
                }}
            />
        );

        const dialogProps: IDialogProps = {
            icon: "git-merge",
            className: className,
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.dialogVisible.get(DialogId.Stokes),
            title: "Merging polarization hypercube"
        };

        return (
            <DraggableDialogComponent
                dialogProps={dialogProps}
                helpType={HelpType.STOKES}
                minWidth={StokesDialogComponent.MinWidth}
                minHeight={StokesDialogComponent.MinHeight}
                defaultWidth={StokesDialogComponent.DefaultWidth}
                defaultHeight={StokesDialogComponent.DefaultHeight}
                enableResizing={true}
                dialogId={DialogId.Stokes}
            >
                <div className="bp3-dialog-body">
                    <Table
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
                    </Table>
                </div>
                <div className="bp3-dialog-footer">
                    <div className="bp3-dialog-footer-actions">
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
            .then(() => {
                AppStore.Instance.activeFrame?.setStokesFiles(stokeFiles);
                AppStore.Instance.dialogStore?.hideDialog(DialogId.Stokes);
            })
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
        return <MenuItem key={`${stokesType}: ${label}`} text={label} onClick={itemProps.handleClick} active={itemProps.modifiers.active} />;
    };
}
