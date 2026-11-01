import {useState} from "react";
import {AnchorButton, Button, Callout, Classes, Collapse, FormGroup, HTMLSelect, Icon, type IconName, InputGroup, Intent, Label, MenuItem, Overlay2, Position, Spinner, Tag, Tooltip} from "@blueprintjs/core";
import {type ItemRenderer, MultiSelect, Select} from "@blueprintjs/select";
import {Cell, Column, ColumnHeaderCell, Regions, RenderMode, SelectionModes, Table} from "@blueprintjs/table";
import {CARTA} from "carta-protobuf";
import classNames from "classnames";
import {observer} from "mobx-react";

import {SafeNumericInput, ScrollShadow} from "components/Shared";
import {SIA_BAND_GROUPS, SIA_BANDS, SIA_TIME_RANGES, SiaDataProductType} from "enums";
import {CustomIcon, type CustomIconName} from "icons/CustomIcons";
import {STANDARD_POLARIZATIONS} from "models";
import {type SiaColumn, SiaQueryStore, type SiaService} from "stores";
import {RegionStore} from "stores/Frame";

import "./SiaQueryComponent.scss";

function menuItemRenderer<T>(text: (item: T) => string): ItemRenderer<T> {
    return (item, {handleClick, handleFocus, modifiers}) => {
        if (!modifiers.matchesPredicate) {
            return null;
        }
        return <MenuItem active={modifiers.active} key={text(item)} onClick={handleClick} onFocus={handleFocus} roleStructure="listoption" text={text(item)} />;
    };
}

const RenderServiceOption = menuItemRenderer<SiaService>(service => service.name);
const RenderPolOption = menuItemRenderer<string>(pol => pol);
const RenderCalibOption = menuItemRenderer<number>(level => String(level));

/** The icon of the region the search circle would be taken from, so its shape identifies it. */
const RegionIcon = observer(() => {
    const region = SiaQueryStore.Instance.activeRegion;
    const icon = RegionStore.regionIconString(region?.regionType ?? CARTA.RegionType.POLYGON);
    return RegionStore.isRegionCustomIcon(region?.regionType ?? CARTA.RegionType.POLYGON) ? <CustomIcon icon={icon as CustomIconName} /> : <Icon icon={icon as IconName} />;
});

const ResultsTable = observer(() => {
    const store = SiaQueryStore.Instance;
    const records = store.displayedRecords;
    const columns = store.columns;

    const renderColumnHeader = (column: SiaColumn) => {
        const isSortColumn = store.sortColumn === column.key;
        const nameRenderer = () => (
            <div className="sort-label" onClick={() => store.setSorting(column.key)}>
                <Label className={classNames(Classes.INLINE, "label")}>
                    <Icon className={classNames("sort-icon", {inactive: !isSortColumn})} icon={isSortColumn ? (store.isSortAscending ? "sort-asc" : "sort-desc") : "sort"} />
                    {column.name}
                </Label>
            </div>
        );
        return <ColumnHeaderCell className="column-name" nameRenderer={nameRenderer} />;
    };

    const renderCell = (column: SiaColumn) => (rowIndex: number) => {
        const record: CARTA.SiaRecord.$Properties | undefined = records[rowIndex];
        const value = SiaQueryStore.formatValue(record, column.key);
        return (
            <Cell tooltip={value}>
                <div className="cell-content" onClick={() => store.setSelectedRecord(record)} onDoubleClick={() => record && store.loadRecord(record)}>
                    {column.key === "accessFormat" && value ? <Tag minimal={true}>{value}</Tag> : value}
                </div>
            </Cell>
        );
    };

    return (
        <Table
            className="sia-results-table"
            numRows={records.length}
            renderMode={RenderMode.NONE}
            enableRowReordering={false}
            enableRowHeader={false}
            enableGhostCells={false}
            selectionModes={SelectionModes.NONE}
            enableMultipleSelection={false}
            enableRowResizing={false}
            enableColumnResizing={true}
            selectedRegions={store.selectedRow >= 0 ? [Regions.row(store.selectedRow)] : []}
            columnWidths={columns.map(column => column.width)}
            cellRendererDependencies={[records, store.sortColumn, store.isSortAscending]}
        >
            {columns.map(column => (
                <Column key={column.key} name={column.name} columnHeaderCellRenderer={() => renderColumnHeader(column)} cellRenderer={renderCell(column)} />
            ))}
        </Table>
    );
});

export const SiaQueryComponent = observer(() => {
    const store = SiaQueryStore.Instance;
    const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(false);
    const isBusy = store.isQuerying || store.isLoadingFile;

    const service = store.services.find(item => item.queryUrl === store.serviceUrl);

    return (
        <div className="sia-query-panel">
            <div className="sia-query-config">
                <ScrollShadow>
                    <FormGroup inline={true} label="Service" disabled={isBusy}>
                        <Select
                            className="service-input"
                            items={store.services}
                            itemRenderer={RenderServiceOption}
                            onItemSelect={item => store.setServiceUrl(item.queryUrl)}
                            popoverProps={{popoverClassName: "service-list-select", minimal: true, matchTargetWidth: true}}
                            filterable={false}
                            disabled={isBusy}
                        >
                            <Button fill={true} alignText="left" text={service?.name ?? store.serviceUrl} endIcon="double-caret-vertical" disabled={isBusy} />
                        </Select>
                        <div className={classNames(Classes.TEXT_MUTED, Classes.TEXT_OVERFLOW_ELLIPSIS, "service-url")} title={store.serviceUrl}>
                            {store.serviceUrl}
                        </div>
                    </FormGroup>
                    <FormGroup inline={true} label="Object" disabled={isBusy}>
                        <InputGroup value={store.object} onChange={ev => store.setObject(ev.target.value)} disabled={isBusy} placeholder="Resolved with SIMBAD" />
                        <AnchorButton text="Resolve" onClick={store.resolveObject} disabled={isBusy || !store.object || store.isResolvingObject} loading={store.isResolvingObject} />
                    </FormGroup>
                    <FormGroup inline={true} label="ICRS center" labelInfo="(deg)" disabled={isBusy}>
                        <SafeNumericInput buttonPosition="none" placeholder="RA" value={isNaN(store.center.x) ? "" : store.center.x} onValueChange={store.setCenterX} disabled={isBusy} />
                        <SafeNumericInput buttonPosition="none" placeholder="Dec" value={isNaN(store.center.y) ? "" : store.center.y} onValueChange={store.setCenterY} disabled={isBusy} />
                    </FormGroup>
                    <FormGroup inline={true} label="Search radius" labelInfo="(deg)" disabled={isBusy}>
                        <SafeNumericInput buttonPosition="none" value={isNaN(store.radius) ? "" : store.radius} onValueChange={store.setRadius} disabled={isBusy} intent={store.radius > 0 || isNaN(store.radius) ? "none" : "danger"} />
                        <Tooltip position={Position.BOTTOM} content={<small>{store.setFromViewTooltip}</small>}>
                            <AnchorButton icon="locate" onClick={store.setFromView} disabled={isBusy || !store.canSetFromView} />
                        </Tooltip>
                        <Tooltip position={Position.BOTTOM} content={<small>{store.setFromRegionTooltip}</small>}>
                            <AnchorButton icon={<RegionIcon />} onClick={store.setFromRegion} disabled={isBusy || !store.canSetFromRegion} />
                        </Tooltip>
                    </FormGroup>
                    <FormGroup inline={true} label="Max results" disabled={isBusy}>
                        <SafeNumericInput min={1} stepSize={50} majorStepSize={100} value={store.maxrec} onValueChange={store.setMaxrec} disabled={isBusy} />
                    </FormGroup>
                    <div className="filters-toggle">
                        <Button variant="minimal" icon={isFiltersOpen ? "caret-down" : "caret-right"} text="Filters" onClick={() => setIsFiltersOpen(!isFiltersOpen)} disabled={isBusy} />
                    </div>
                    <Collapse isOpen={isFiltersOpen} keepChildrenMounted={true}>
                        <FormGroup inline={true} label="Product type" disabled={isBusy}>
                            <HTMLSelect
                                options={[
                                    {label: "Any", value: SiaDataProductType.Any},
                                    {label: "Image", value: SiaDataProductType.Image},
                                    {label: "Cube", value: SiaDataProductType.Cube}
                                ]}
                                value={store.dpType}
                                onChange={ev => store.setDpType(ev.currentTarget.value as SiaDataProductType)}
                                disabled={isBusy}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Band" labelInfo="(m)" disabled={isBusy}>
                            <SafeNumericInput buttonPosition="none" placeholder="Min wavelength" value={isNaN(store.bandMin) ? "" : store.bandMin} onValueChange={store.setBandMin} disabled={isBusy} />
                            <SafeNumericInput buttonPosition="none" placeholder="Max wavelength" value={isNaN(store.bandMax) ? "" : store.bandMax} onValueChange={store.setBandMax} disabled={isBusy} />
                            <HTMLSelect className="range-select" value={store.selectedBand?.name ?? ""} onChange={ev => store.setBand(SIA_BANDS.find(band => band.name === ev.currentTarget.value))} disabled={isBusy}>
                                <option value="">Any band</option>
                                {SIA_BAND_GROUPS.map(group => (
                                    <optgroup key={group.name} label={group.name}>
                                        {group.bands.map(band => (
                                            <option key={band.name} value={band.name}>
                                                {band.name}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </HTMLSelect>
                        </FormGroup>
                        <FormGroup inline={true} label="Time" labelInfo="(MJD)" disabled={isBusy}>
                            <SafeNumericInput buttonPosition="none" placeholder="Start" value={isNaN(store.timeMin) ? "" : store.timeMin} onValueChange={store.setTimeMin} disabled={isBusy} />
                            <SafeNumericInput buttonPosition="none" placeholder="End" value={isNaN(store.timeMax) ? "" : store.timeMax} onValueChange={store.setTimeMax} disabled={isBusy} />
                            <HTMLSelect
                                className="range-select"
                                options={[{label: "Relative range", value: "", disabled: true}, {label: "None", value: "0"}, ...SIA_TIME_RANGES.map(range => ({label: range.name, value: String(range.days)}))]}
                                value=""
                                onChange={ev => store.setRelativeTimeRange(Number(ev.currentTarget.value))}
                                disabled={isBusy}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Polarization" disabled={isBusy}>
                            <MultiSelect
                                items={[...STANDARD_POLARIZATIONS.values()]}
                                selectedItems={store.pol}
                                itemRenderer={RenderPolOption}
                                onItemSelect={pol => store.setPol(store.pol.includes(pol) ? store.pol.filter(state => state !== pol) : [...store.pol, pol])}
                                tagRenderer={pol => pol}
                                tagInputProps={{onRemove: (_node, index) => store.setPol(store.pol.filter((_state, i) => i !== index))}}
                                popoverProps={{minimal: true}}
                                disabled={isBusy}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Calibration level" disabled={isBusy}>
                            <MultiSelect
                                items={[0, 1, 2, 3, 4]}
                                selectedItems={store.calibLevels}
                                itemRenderer={RenderCalibOption}
                                onItemSelect={level => store.setCalibLevels(store.calibLevels.includes(level) ? store.calibLevels.filter(l => l !== level) : [...store.calibLevels, level].sort())}
                                tagRenderer={level => String(level)}
                                tagInputProps={{onRemove: (_node, index) => store.setCalibLevels(store.calibLevels.filter((_level, i) => i !== index))}}
                                popoverProps={{minimal: true}}
                                disabled={isBusy}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label="Collection" disabled={isBusy}>
                            <InputGroup value={store.collection} onChange={ev => store.setCollection(ev.target.value)} disabled={isBusy} />
                        </FormGroup>
                        <FormGroup inline={true} label="Facility" disabled={isBusy}>
                            <InputGroup value={store.facility} onChange={ev => store.setFacility(ev.target.value)} disabled={isBusy} />
                        </FormGroup>
                        <FormGroup inline={true} label="Instrument" disabled={isBusy}>
                            <InputGroup value={store.instrument} onChange={ev => store.setInstrument(ev.target.value)} disabled={isBusy} />
                        </FormGroup>
                        <FormGroup inline={true} label="Target name" disabled={isBusy}>
                            <Tooltip position={Position.BOTTOM} content={<small>Matched by the service against its own target names</small>}>
                                <InputGroup value={store.target} onChange={ev => store.setTarget(ev.target.value)} disabled={isBusy} />
                            </Tooltip>
                        </FormGroup>
                    </Collapse>
                    {store.queryError && (
                        <Callout intent={Intent.WARNING} className="query-error">
                            {store.queryError}
                        </Callout>
                    )}
                </ScrollShadow>
            </div>
            {store.records.length > 0 && (
                <div className="sia-query-results">
                    <InputGroup
                        className="result-filter"
                        leftIcon="filter"
                        placeholder="Filter results by any column"
                        value={store.resultFilter}
                        onChange={ev => store.setResultFilter(ev.target.value)}
                        rightElement={store.resultFilter ? <Button icon="cross" variant="minimal" onClick={() => store.setResultFilter("")} /> : undefined}
                        disabled={isBusy}
                    />
                    <ResultsTable />
                </div>
            )}
            <Overlay2 autoFocus={true} canEscapeKeyClose={false} canOutsideClickClose={false} isOpen={store.isQuerying} usePortal={false}>
                <div className="query-loading-overlay">
                    <Spinner intent={Intent.PRIMARY} size={30} />
                </div>
            </Overlay2>
            <div className={classNames(Classes.DIALOG_FOOTER_ACTIONS, "query-footer")}>
                <span className={classNames(Classes.TEXT_MUTED, "result-info")}>{store.resultInfo}</span>
                <AnchorButton disabled={isBusy} onClick={store.clear} text="Clear" />
                <AnchorButton intent={Intent.PRIMARY} disabled={!store.isValid || isBusy} onClick={store.query} text="Query" />
                <AnchorButton intent={Intent.SUCCESS} disabled={!store.selectedRecord || isBusy} loading={store.isLoadingFile} onClick={() => store.selectedRecord && store.loadRecord(store.selectedRecord)} text="Load" />
            </div>
        </div>
    );
});
