import * as React from "react";
import type {IChangeEvent} from "@rjsf/core";
import {observer} from "mobx-react";

import {CustomUIStore} from "stores/CustomUI/CustomUIStore";

import {CustomUIErrorBoundary} from "../Shared/ErrorBoundary/CustomUIErrorBoundary";

import {ajv8Validator, BlueprintForm} from "./BlueprintTheme";

interface CustomUIContentProps {
    id: string;
}

@observer
export class CustomUIContent extends React.Component<CustomUIContentProps> {
    private readonly containerRef = React.createRef<HTMLDivElement>();
    private mountedDef: object | null = null;
    private localCleanup: (() => void) | undefined;

    componentDidMount() {
        this.mountImperative();
    }

    componentDidUpdate() {
        this.mountImperative();
    }

    componentWillUnmount() {
        this.runLocalCleanup();
    }

    private mountImperative() {
        const def = CustomUIStore.Instance.definitions.get(this.props.id);
        if (!def?.render || !this.containerRef.current) {
            return;
        }
        // Only (re)mount when the definition object identity changes.
        if (this.mountedDef === def) {
            return;
        }
        this.runLocalCleanup();
        try {
            const cleanup = def.render(this.containerRef.current);
            this.localCleanup = typeof cleanup === "function" ? cleanup : undefined;
            if (this.localCleanup) {
                CustomUIStore.Instance.setCleanup(this.props.id, this.localCleanup);
            }
            this.mountedDef = def;
        } catch (err) {
            console.error(`[customUI] imperative render for "${this.props.id}" threw`, err);
        }
    }

    private runLocalCleanup() {
        if (this.localCleanup) {
            try {
                this.localCleanup();
            } catch (err) {
                console.error(`[customUI] cleanup for "${this.props.id}" threw`, err);
            }
            this.localCleanup = undefined;
        }
        this.mountedDef = null;
    }

    render() {
        const {id} = this.props;
        const def = CustomUIStore.Instance.definitions.get(id);
        if (!def) {
            return <div className="custom-ui-empty">No definition for "{id}".</div>;
        }
        if (def.schema) {
            return (
                <CustomUIErrorBoundary label={def.title ?? id}>
                    <BlueprintForm
                        schema={def.schema}
                        uiSchema={def.uiSchema}
                        formData={def.formData}
                        validator={ajv8Validator}
                        onChange={(e: IChangeEvent) => {
                            CustomUIStore.Instance.update(id, e.formData);
                            def.onChange?.(e.formData);
                        }}
                        onSubmit={(e: IChangeEvent) => def.onSubmit?.(e.formData)}
                    />
                </CustomUIErrorBoundary>
            );
        }
        return (
            <CustomUIErrorBoundary label={def.title ?? id}>
                <div className="custom-ui-imperative" ref={this.containerRef} />
            </CustomUIErrorBoundary>
        );
    }
}
