import * as React from "react";
import {useCallback, useEffect, useState} from "react";
import {Callout, NonIdealState, Spinner} from "@blueprintjs/core";

import {Workspace, WorkspaceListItem} from "models";
import {AppStore} from "stores";

import "./WorkspaceInfoComponent.scss";

export const WorkspaceInfoComponent = (props: {workspaceListItem?: WorkspaceListItem}) => {
    const {workspaceListItem} = props;

    const [isFetchingWorkspace, setIsFetchingWorkspace] = useState(false);
    const [workspace, setWorkspace] = useState<Workspace>();
    const [errorMessage, setErrorMessage] = useState("");

    const fetchWorkspace = useCallback(async (name: string) => {
        setIsFetchingWorkspace(true);
        setWorkspace(undefined);
        try {
            const res = await AppStore.Instance.apiService.getWorkspace(name);
            if (res) {
                setWorkspace(res);
            }
        } catch (err) {
            console.log(err);
            setErrorMessage(err);
        }
        setIsFetchingWorkspace(false);
    }, []);

    useEffect(() => {
        if (workspaceListItem) {
            fetchWorkspace(workspaceListItem.name);
        }
    }, [workspaceListItem, fetchWorkspace]);

    if (!workspaceListItem) {
        return <NonIdealState className="workspace-info" icon="folder-open" title="No workspace selected" />;
    }
    if (isFetchingWorkspace) {
        return <NonIdealState className="workspace-info" icon={<Spinner />} title="Fetching workspace" />;
    }

    if (!workspace) {
        return <NonIdealState className="workspace-info" icon="error" title={errorMessage ?? "Unknown error"} />;
    }

    let totalRegions = 0;
    for (const file of workspace.files) {
        if (!file.spatialMatching || file.id === workspace.spatialReference) {
            totalRegions += file.regionsSet?.regions?.length ?? 0;
        }
    }

    const spatialReference = workspace.spatialReference ? workspace.files?.find(f => f.id === workspace.spectralReference) : null;

    return (
        <div className="workspace-info">
            <Callout className="workspace-thumbnail">{workspace.thumbnail ? <img src={workspace.thumbnail} /> : <NonIdealState icon="media" title="No thumbnail" />}</Callout>
            <Callout className="workspace-properties">
                <table className="info-table">
                    <tr className="entry">
                        <td className="entry-title">Name</td>
                        <td className="entry-value">{workspaceListItem.name}</td>
                    </tr>
                    <tr className="entry">
                        <td className="entry-title">Number of regions</td>
                        <td className="entry-value">{totalRegions}</td>
                    </tr>
                    {spatialReference ? (
                        <tr className="entry">
                            <td className="entry-title">Spatial reference</td>
                            <td className="entry-value">{spatialReference.filename}</td>
                        </tr>
                    ) : null}
                    <tr className="entry">
                        <td className="entry-title">Files</td>
                        <td className="entry-value">
                            <ul>
                                {workspace.files.map(f => (
                                    <li>{f.filename}</li>
                                ))}
                            </ul>
                        </td>
                    </tr>
                </table>
            </Callout>
        </div>
    );
};
