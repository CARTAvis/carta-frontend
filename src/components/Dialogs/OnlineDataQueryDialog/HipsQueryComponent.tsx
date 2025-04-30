import {useState} from "react";
import {AnchorButton, Classes, FormGroup, HTMLSelect, InputGroup, Intent, MenuItem, Overlay2, Radio, RadioGroup, Spinner, Tooltip} from "@blueprintjs/core";
import {ItemPredicate, ItemRenderer, Suggest} from "@blueprintjs/select";
import classNames from "classnames";
import {observer} from "mobx-react";

import {SafeNumericInput, ScrollShadow} from "components/Shared";
import {AngularSize, AngularSizeUnit} from "models";
import {HipsCoord, HipsProjection, HipsQueryStore, HipsSurvey} from "stores";

import "./HipsQueryComponent.scss";

const filterSurvey: ItemPredicate<HipsSurvey> = (query, survey, _index, exactMatch) => {
    const normalizedTitle = `${survey.name} ${survey.type}`.toLowerCase();
    const normalizedQuery = query.toLowerCase();

    if (exactMatch) {
        return normalizedTitle === normalizedQuery;
    } else {
        return normalizedTitle.indexOf(normalizedQuery) >= 0;
    }
};

const renderSurveyOption: ItemRenderer<HipsSurvey> = (survey, {handleClick, handleFocus, modifiers, query}) => {
    if (!modifiers.matchesPredicate) {
        return null;
    }
    return <MenuItem active={modifiers.active} disabled={modifiers.disabled} key={survey.name} onClick={handleClick} onFocus={handleFocus} roleStructure="listoption" text={survey.name} label={survey.type} />;
};

const renderPixelSize = () => {
    const hipsQueryStore = HipsQueryStore.Instance;
    const pixelSize = AngularSize.convertFromArcsec(hipsQueryStore.pixelSize * 3600, true);
    if (pixelSize.unit === AngularSizeUnit.MILLIARCSEC && pixelSize.value < 0.001) {
        return <FormGroup className="info-string" inline={true} label={`Pixel size: < 0.001 ${pixelSize.unit}`} disabled={hipsQueryStore.isLoading} />;
    }
    return <FormGroup className="info-string" inline={true} label={`Pixel size: ~ ${pixelSize.value.toFixed(3)} ${pixelSize.unit}`} disabled={hipsQueryStore.isLoading} />;
};

export const HipsQueryComponent = observer(() => {
    const hipsQueryStore = HipsQueryStore.Instance;
    const [queryByObject, setQueryByObject] = useState<boolean>(true);

    return (
        <div className="hips-query-panel">
            <div className="hips-query-config">
                <ScrollShadow>
                    <FormGroup inline={true} label="HiPS survey" disabled={hipsQueryStore.isLoading}>
                        <Suggest
                            className="survey-input"
                            inputValueRenderer={() => hipsQueryStore.hipsSurvey}
                            items={hipsQueryStore.surveyList}
                            itemPredicate={filterSurvey}
                            itemRenderer={renderSurveyOption}
                            onItemSelect={item => hipsQueryStore.setHipsSurvey(item.name)}
                            onQueryChange={hipsQueryStore.setHipsSurvey}
                            popoverProps={{popoverClassName: "survey-list-select", minimal: true}}
                            disabled={hipsQueryStore.isLoading}
                            query={hipsQueryStore.hipsSurvey}
                        />
                    </FormGroup>
                    <FormGroup inline={true} label=" " disabled={hipsQueryStore.isLoading}>
                        <RadioGroup inline={true} selectedValue={queryByObject ? "object" : "center"} onChange={ev => setQueryByObject(ev.currentTarget.value === "object")} disabled={hipsQueryStore.isLoading}>
                            <Radio label="Query by object" value="object" />
                            <Radio label="Query by center" value="center" />
                        </RadioGroup>
                    </FormGroup>
                    {queryByObject && (
                        <FormGroup inline={true} label="Object" disabled={hipsQueryStore.isLoading}>
                            <InputGroup value={hipsQueryStore.object} onChange={ev => hipsQueryStore.setObject(ev.target.value)} disabled={hipsQueryStore.isLoading} />
                        </FormGroup>
                    )}
                    {!queryByObject && (
                        <FormGroup inline={true} label="ICRS Center" labelInfo="(deg)" disabled={hipsQueryStore.isLoading}>
                            <SafeNumericInput
                                buttonPosition="none"
                                placeholder="X WCS coordinate"
                                value={isNaN(hipsQueryStore.center.x) ? "" : hipsQueryStore.center.x}
                                onValueChange={hipsQueryStore.setCenterX}
                                disabled={hipsQueryStore.isLoading}
                            />
                            <SafeNumericInput
                                buttonPosition="none"
                                placeholder="Y WCS coordinate"
                                value={isNaN(hipsQueryStore.center.y) ? "" : hipsQueryStore.center.y}
                                onValueChange={hipsQueryStore.setCenterY}
                                disabled={hipsQueryStore.isLoading}
                            />
                        </FormGroup>
                    )}
                    <FormGroup inline={true} label="Dimension" labelInfo="(px)" disabled={hipsQueryStore.isLoading}>
                        <Tooltip
                            position="auto-end"
                            content={
                                <small>
                                    {">="} 5 pixels and (width x height) {"<="} 50 million pixels
                                </small>
                            }
                        >
                            <SafeNumericInput
                                placeholder="Width"
                                min={0}
                                majorStepSize={100}
                                stepSize={100}
                                value={isNaN(hipsQueryStore.size.x) ? "" : hipsQueryStore.size.x}
                                onValueChange={hipsQueryStore.setWidth}
                                disabled={hipsQueryStore.isLoading}
                                intent={
                                    (hipsQueryStore.size.x >= hipsQueryStore.HipsConstraint.MinDimension && (hipsQueryStore.size.x * hipsQueryStore.size.y <= hipsQueryStore.HipsConstraint.MaxDimension || isNaN(hipsQueryStore.size.y))) ||
                                    isNaN(hipsQueryStore.size.x)
                                        ? "none"
                                        : "danger"
                                }
                            />
                        </Tooltip>
                        <Tooltip
                            position="auto-end"
                            content={
                                <small>
                                    {">="} 5 pixels and (width x height) {"<="} 50 million pixels
                                </small>
                            }
                        >
                            <SafeNumericInput
                                placeholder="Height"
                                min={0}
                                majorStepSize={100}
                                stepSize={100}
                                value={isNaN(hipsQueryStore.size.y) ? "" : hipsQueryStore.size.y}
                                onValueChange={hipsQueryStore.setHeight}
                                disabled={hipsQueryStore.isLoading}
                                intent={
                                    (hipsQueryStore.size.y >= hipsQueryStore.HipsConstraint.MinDimension && (hipsQueryStore.size.x * hipsQueryStore.size.y <= hipsQueryStore.HipsConstraint.MaxDimension || isNaN(hipsQueryStore.size.x))) ||
                                    isNaN(hipsQueryStore.size.y)
                                        ? "none"
                                        : "danger"
                                }
                            />
                        </Tooltip>
                    </FormGroup>
                    <FormGroup inline={true} label="Field of view" labelInfo="(deg)" disabled={hipsQueryStore.isLoading}>
                        <Tooltip position="auto-end" content={<small>0 to 360</small>}>
                            <SafeNumericInput
                                buttonPosition="none"
                                value={isNaN(hipsQueryStore.fov) ? "" : hipsQueryStore.fov}
                                onValueChange={hipsQueryStore.setFov}
                                disabled={hipsQueryStore.isLoading}
                                intent={hipsQueryStore.isFovValid || isNaN(hipsQueryStore.fov) ? "none" : "danger"}
                            />
                        </Tooltip>
                        {isNaN(hipsQueryStore.pixelSize) ? "" : renderPixelSize()}
                    </FormGroup>
                    <FormGroup inline={true} label="Output system" disabled={hipsQueryStore.isLoading}>
                        <RadioGroup inline={true} onChange={ev => hipsQueryStore.setCoordsys(ev.currentTarget.value as HipsCoord)} selectedValue={hipsQueryStore.coordsys} disabled={hipsQueryStore.isLoading}>
                            <Radio label="ICRS" value={HipsCoord.Icrs} />
                            <Radio label="Galactic" value={HipsCoord.Galactic} />
                        </RadioGroup>
                    </FormGroup>
                    <FormGroup inline={true} label="Projection" disabled={hipsQueryStore.isLoading}>
                        <HTMLSelect
                            options={Object.values(HipsProjection).map(val => ({label: `${val} - ${HipsQueryStore.ProjectionOptionMap.get(val)}`, value: val}))}
                            value={hipsQueryStore.projection}
                            onChange={ev => hipsQueryStore.setProjection(ev.currentTarget.value as HipsProjection)}
                            disabled={hipsQueryStore.isLoading}
                        />
                    </FormGroup>
                    <FormGroup inline={true} label="Rotation angle" labelInfo="(deg)" disabled={hipsQueryStore.isLoading}>
                        <Tooltip position="auto-end" content={<small>0 to 360</small>}>
                            <SafeNumericInput
                                buttonPosition="none"
                                value={hipsQueryStore.rotationAngle}
                                onValueChange={hipsQueryStore.setRotationAngle}
                                disabled={hipsQueryStore.isLoading}
                                intent={hipsQueryStore.isRotAngleValid ? "none" : "danger"}
                            />
                        </Tooltip>
                    </FormGroup>
                </ScrollShadow>
            </div>
            <Overlay2 autoFocus={true} canEscapeKeyClose={false} canOutsideClickClose={false} isOpen={hipsQueryStore.isLoading} usePortal={false}>
                <div className="query-loading-overlay">
                    <Spinner intent={Intent.PRIMARY} size={30} value={null} />
                </div>
            </Overlay2>
            <div className={classNames(Classes.DIALOG_FOOTER_ACTIONS, "query-footer")}>
                <AnchorButton disabled={hipsQueryStore.isLoading} onClick={hipsQueryStore.clear} text="Clear" />
                <AnchorButton
                    intent={Intent.SUCCESS}
                    disabled={(queryByObject ? !hipsQueryStore.object : !isFinite(hipsQueryStore.center.x) || !isFinite(hipsQueryStore.center.y)) || !hipsQueryStore.isValid}
                    onClick={queryByObject ? hipsQueryStore.queryByObject : hipsQueryStore.queryByCenter}
                    text="Query"
                />
            </div>
        </div>
    );
});
