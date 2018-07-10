import * as React from "react";
import "./LogComponent.css";
import {LogState} from "../../states/LogState";
import {observer} from "mobx-react";
import {Tooltip} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import ScrollToBottom from "react-scroll-to-bottom";

@observer
export class LogComponent extends React.Component<{ logState: LogState }> {

    onClearClicked = () => {
        this.props.logState.clearLog();
    };

    onTagClicked = (tag: string) => {
        this.props.logState.toggleTag(tag);
    };

    onLogLevelChanged = (event: React.FormEvent<HTMLSelectElement>) => {
        this.props.logState.setLevel(parseInt(event.currentTarget.value));
    };

    private getTagClass = (tag: string) => {
        if (this.props.logState.hiddenTags.indexOf(tag) === -1) {
            return "pt-tag pt-interactive pt-intent-primary";
        }
        return "pt-tag pt-interactive pt-minimal";
    };

    render() {
        const logState = this.props.logState;
        const entries = logState.logEntries;
        const hiddenTags = logState.hiddenTags;

        let tagList = [];
        let entryElements = [];
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];

            if (entry.level < logState.logLevel) {
                continue;
            }

            let entryTagSpans = [];
            let visibleTags = entry.tags.filter(v => hiddenTags.indexOf(v) === -1);
            for (let j = 0; j < entry.tags.length; j++) {
                const tag = entry.tags[j];
                entryTagSpans.push(<span className="pt-tag" key={j}>{entry.tags[j]}</span>);
                if (tagList.indexOf(tag) === -1) {
                    tagList.push(tag);
                }
            }
            if (visibleTags.length) {
                entryElements.push(
                    <div key={i}>
                        {entryTagSpans}
                        <code>{entry.message}</code>
                    </div>
                );
            }
        }

        if (!entries.length) {
            return (
                <div className="pt-non-ideal-state">
                    <div className="pt-non-ideal-state-visual pt-non-ideal-state-icon">
                        <span className="pt-icon pt-icon-application"/>
                    </div>
                    <h4 className="pt-non-ideal-state-title">No log entries</h4>
                </div>
            );
        }

        const allTagSpans = tagList.map((tag, index) => <span className={this.getTagClass(tag)} key={index} onClick={() => this.onTagClicked(tag)}>{tag}</span>);

        return (
            <div className="log">
                <ScrollToBottom className="log-entry-list" followButtonClassName="log-entry-follow">
                    {entryElements}
                </ScrollToBottom>

                <div className="log-footer">
                    <div className="tag-list">
                        {allTagSpans.length > 0 &&
                        allTagSpans
                        }
                    </div>
                    <div className="log-footer-right">
                        <label className="pt-label pt-inline">
                            Log level
                            <div className="pt-select">
                                <select value={logState.logLevel} onChange={this.onLogLevelChanged}>
                                    <option value={CARTA.ErrorSeverity.INFO}>Info</option>
                                    <option value={CARTA.ErrorSeverity.WARNING}>Warning</option>
                                    <option value={CARTA.ErrorSeverity.ERROR}>Error</option>
                                    <option value={CARTA.ErrorSeverity.CRITICAL}>Critical</option>
                                </select>
                            </div>
                        </label>
                        <Tooltip content="Clear log entries">
                            <button type="button" className="pt-button pt-minimal pt-intent-warning pt-icon-delete" onClick={this.onClearClicked}>Clear</button>
                        </Tooltip>
                    </div>
                </div>
            </div>);
    }
}