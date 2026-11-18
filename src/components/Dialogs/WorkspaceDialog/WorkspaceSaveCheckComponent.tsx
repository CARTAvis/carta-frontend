import {Callout, Classes, Icon, Intent} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";
import type {WorkspaceIssue} from "models";

import {ScrollShadow} from "../../Shared";

import "./WorkspaceSaveCheckComponent.scss";

/**
 * Shows what a save of the session would leave out, before the user saves. When the session cannot
 * be saved now, it shows only the reason. Then the list would not be complete.
 */
export const WorkspaceSaveCheckComponent = observer((props: {issues: WorkspaceIssue[]; blocker?: string}) => {
    const {issues, blocker} = props;
    if (blocker) {
        return (
            <Callout className="workspace-save-check" intent={Intent.WARNING} icon="time" data-testid="workspace-save-blocker">
                {blocker}
            </Callout>
        );
    }
    if (!issues.length) {
        return null;
    }
    return (
        <div className="workspace-save-check save-check-issues" data-testid="workspace-save-check">
            <div className="save-check-title">
                <Icon icon="warning-sign" intent={Intent.WARNING} />
                <span>Will not be saved ({issues.length})</span>
            </div>
            <ScrollShadow>
                <div className="save-check-list">
                    {issues.map((issue, index) => (
                        <div key={index} className="save-check-item" data-testid="workspace-save-issue">
                            <span>{issue.message}</span>
                            {issue.hint && <span className={classNames("save-check-hint", Classes.TEXT_MUTED)}>{issue.hint}</span>}
                        </div>
                    ))}
                </div>
            </ScrollShadow>
        </div>
    );
});
