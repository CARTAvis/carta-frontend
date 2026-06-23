import * as React from "react";

import {LogStore} from "stores/LogStore/LogStore";

interface CustomUIErrorBoundaryProps {
    label?: string;
    children: React.ReactNode;
}

interface CustomUIErrorBoundaryState {
    error: Error | null;
}

export class CustomUIErrorBoundary extends React.Component<CustomUIErrorBoundaryProps, CustomUIErrorBoundaryState> {
    state: CustomUIErrorBoundaryState = {error: null};

    static getDerivedStateFromError(error: Error): CustomUIErrorBoundaryState {
        return {error};
    }

    componentDidCatch(error: Error) {
        const message = `Custom UI "${this.props.label ?? "?"}" failed to render: ${error.message}`;
        console.error(message, error);
        LogStore.Instance.addError(message, ["customUI"]);
    }

    render() {
        if (this.state.error) {
            return <div className="custom-ui-error">Custom UI "{this.props.label ?? "?"}" failed to render.</div>;
        }
        return this.props.children;
    }
}
