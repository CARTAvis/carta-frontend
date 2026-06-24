import * as React from "react";
import {FormGroup, H5, HTMLSelect, InputGroup, NumericInput, Switch, TextArea} from "@blueprintjs/core";
import {type ThemeProps, withTheme} from "@rjsf/core";
import type {BaseInputTemplateProps, FieldTemplateProps, ObjectFieldTemplateProps, WidgetProps} from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";

import {PlotField} from "./PlotField";

export const ajv8Validator = validator;

function BaseInputTemplate(props: BaseInputTemplateProps) {
    const {id, value, onChange, onBlur, onFocus, schema, disabled, readonly, placeholder} = props;
    const isNumber = schema.type === "number" || schema.type === "integer";
    if (isNumber) {
        return <NumericInput id={id} fill={true} value={value ?? ""} disabled={disabled || readonly} placeholder={placeholder} onValueChange={(num, str) => onChange(str === "" ? undefined : num)} />;
    }
    return (
        <InputGroup
            id={id}
            fill={true}
            value={value ?? ""}
            disabled={disabled || readonly}
            placeholder={placeholder}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value === "" ? undefined : e.target.value)}
            onBlur={(e: React.FocusEvent<HTMLInputElement>) => onBlur(id, e.target.value)}
            onFocus={(e: React.FocusEvent<HTMLInputElement>) => onFocus(id, e.target.value)}
        />
    );
}

function CheckboxWidget(props: WidgetProps) {
    const {id, value, onChange, disabled, readonly, label} = props;
    return <Switch id={id} checked={!!value} disabled={disabled || readonly} label={label} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.currentTarget.checked)} />;
}

function SelectWidget(props: WidgetProps) {
    const {id, value, onChange, options, disabled, readonly, placeholder} = props;
    const enumOptions = (options.enumOptions ?? []) as {value: any; label: string}[];
    return (
        <HTMLSelect id={id} fill={true} value={value ?? ""} disabled={disabled || readonly} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.currentTarget.value === "" ? undefined : e.currentTarget.value)}>
            {placeholder && <option value="">{placeholder}</option>}
            {enumOptions.map(opt => (
                <option key={String(opt.value)} value={opt.value}>
                    {opt.label}
                </option>
            ))}
        </HTMLSelect>
    );
}

function TextareaWidget(props: WidgetProps) {
    const {id, value, onChange, disabled, readonly, placeholder} = props;
    return (
        <TextArea id={id} fill={true} value={value ?? ""} disabled={disabled || readonly} placeholder={placeholder} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value === "" ? undefined : e.target.value)} />
    );
}

function FieldTemplate(props: FieldTemplateProps) {
    const {id, label, required, children, displayLabel, description, errors, help} = props;
    return (
        <FormGroup label={displayLabel ? label : undefined} labelFor={id} labelInfo={required ? "(required)" : undefined} helperText={typeof description === "string" ? description : undefined}>
            {children}
            {errors}
            {help}
        </FormGroup>
    );
}

function ObjectFieldTemplate(props: ObjectFieldTemplateProps) {
    return (
        <div className="custom-ui-object">
            {props.title ? <H5>{props.title}</H5> : null}
            {props.description}
            {props.properties.map(element => (
                <div key={element.name} className="custom-ui-object-field">
                    {element.content}
                </div>
            ))}
        </div>
    );
}

const blueprintTheme: ThemeProps = {
    widgets: {CheckboxWidget, SelectWidget, TextareaWidget},
    fields: {plot: PlotField},
    templates: {BaseInputTemplate, FieldTemplate, ObjectFieldTemplate}
};

export const BlueprintForm = withTheme(blueprintTheme);
