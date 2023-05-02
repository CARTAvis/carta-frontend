import * as React from "react";
import {useCallback, useEffect, useState} from "react";
import {Callout, NonIdealState, Spinner} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {useMap} from "usehooks-ts";

import {Workspace, WorkspaceFile, WorkspaceListItem} from "models";
import {AppStore} from "stores";

import "./WorkspaceInfoComponent.scss";

export const WorkspaceInfoComponent = (props: {workspaceListItem?: WorkspaceListItem}) => {
    const {workspaceListItem} = props;

    const [isFetchingWorkspace, setIsFetchingWorkspace] = useState(false);
    const [workspace, setWorkspace] = useState<Workspace>();
    const [errorMessage, setErrorMessage] = useState("");
    const [workspaceFileInfoMap, workspaceFileInfoMapActions] = useMap<WorkspaceFile, CARTA.IFileInfoResponse>();

    const fetchFileInfo = useCallback(
        async (workspace: Workspace) => {
            if (!workspace?.files?.length) {
                return;
            }

            const appStore = AppStore.Instance;
            for (const file of workspace.files) {
                try {
                    const info = await appStore.backendService.getFileInfo(file.directory, file.filename, file.hdu);
                    workspaceFileInfoMapActions.set(file, info);
                } catch (err) {
                    workspaceFileInfoMapActions.set(file, {success: false, message: err});
                }
            }
        },
        [workspaceFileInfoMapActions]
    );

    const fetchWorkspace = useCallback(
        async (name: string) => {
            setIsFetchingWorkspace(true);
            setWorkspace(undefined);
            workspaceFileInfoMapActions.reset();
            try {
                const res = await AppStore.Instance.apiService.getWorkspace(name);
                if (res) {
                    setWorkspace(res);
                    await fetchFileInfo(res);
                }
            } catch (err) {
                console.log(err);
                setErrorMessage(err);
            }
            setIsFetchingWorkspace(false);
        },
        [fetchFileInfo, workspaceFileInfoMapActions]
    );

    useEffect(() => {
        if (workspaceListItem) {
            fetchWorkspace(workspaceListItem.name);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceListItem]);

    if (!workspaceListItem) {
        return <NonIdealState className="workspace-info" icon="folder-open" title="No workspace selected" />;
    } else if (isFetchingWorkspace) {
        return <NonIdealState className="workspace-info" icon={<Spinner />} title="Fetching workspace" />;
    } else if (!workspace) {
        return <NonIdealState className="workspace-info" icon="error" title={errorMessage || "Error fetching workspace"} />;
    } else if (!workspace.files?.length) {
        return <NonIdealState className="workspace-info" icon="error" title="Empty workspace" />;
    }

    let totalRegions = 0;
    for (const file of workspace.files) {
        if (!file.references?.spatial || file.id === workspace.references?.spatial) {
            totalRegions += file.regionsSet?.regions?.length ?? 0;
        }
    }

    const spatialReference = workspace.files?.find(f => f.id === workspace.references?.spatial);
    const spectralReference = workspace.files?.find(f => f.id === workspace.references?.spectral);
    const rasterReference = workspace.files?.find(f => f.id === workspace.references?.raster);

    return (
        <div className="workspace-info">
            <Callout className="workspace-thumbnail">{workspace.thumbnail ? <img src={workspace.thumbnail} /> : <NonIdealState icon="media" title="No thumbnail" />}</Callout>
            <Callout className="workspace-properties">
                <table className="info-table">
                    <tbody>
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
                        {spectralReference ? (
                            <tr className="entry">
                                <td className="entry-title">Spectral reference</td>
                                <td className="entry-value">{spectralReference.filename}</td>
                            </tr>
                        ) : null}
                        {rasterReference ? (
                            <tr className="entry">
                                <td className="entry-title">Raster scaling reference</td>
                                <td className="entry-value">{rasterReference.filename}</td>
                            </tr>
                        ) : null}
                        <tr className="entry">
                            <td className="entry-title">Files</td>
                            <td className="entry-value">
                                <ul>
                                    {workspace.files.map(f => (
                                        <li key={f.id}>
                                            {f.filename} ({workspaceFileInfoMap.get(f)?.success ? "valid" : "failed"})
                                        </li>
                                    ))}
                                </ul>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </Callout>
        </div>
    );
};
