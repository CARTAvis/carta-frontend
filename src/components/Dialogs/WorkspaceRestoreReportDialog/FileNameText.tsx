import * as React from "react";

import {splitFileNames} from "./restoreReportGroups";

import "./FileNameText.scss";

/** Shows a file name or a path. A long path breaks after a slash where it can. */
export const FileName = ({text}: {text: string}) => (
    <span className="workspace-file-name">
        {text.split(/(?<=\/)/).map((piece, index) => (
            <React.Fragment key={index}>
                {index > 0 && <wbr />}
                {piece}
            </React.Fragment>
        ))}
    </span>
);

/**
 * Shows a line about a workspace item, with the file names and paths in a monospace font.
 *
 * @param subject - the name of the item. See {@link splitFileNames}.
 * @param label - how the report names the item. See {@link splitFileNames}.
 */
export const FileNameText = ({text, subject, label}: {text: string; subject: string; label?: string}) => (
    <span>{splitFileNames(text, subject, label).map((part, index) => (part.isFile ? <FileName key={index} text={part.text} /> : <React.Fragment key={index}>{part.text}</React.Fragment>))}</span>
);
