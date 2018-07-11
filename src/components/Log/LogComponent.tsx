import * as React from "react";
import "./LogComponent.css";
import {LogState} from "../../states/LogState";
import {observer} from "mobx-react";
import {Button, Code, FormGroup, HTMLSelect, Label, NonIdealState, Tag, Tooltip} from "@blueprintjs/core";
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

    private isTagHidden = (tag: string) => {
        return (this.props.logState.hiddenTags.indexOf(tag) !== -1);
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
                entryTagSpans.push(<Tag key={j}>{entry.tags[j]}</Tag>);
                if (tagList.indexOf(tag) === -1) {
                    tagList.push(tag);
                }
            }
            if (visibleTags.length) {
                entryElements.push(
                    <div key={i}>
                        {entryTagSpans}
                        <Code>{entry.message}</Code>
                    </div>
                );
            }
        }

        if (!entries.length) {
            return <NonIdealState icon="application" title="No log entries"/>;
        }

        const allTagSpans = tagList.map((tag, index) => <Tag interactive={true} minimal={this.isTagHidden(tag)} intent={this.isTagHidden(tag) ? "none" : "primary"} key={index} onClick={() => this.onTagClicked(tag)}>{tag}</Tag>);

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
                        <FormGroup inline={true} label="Log level">
                            <HTMLSelect value={logState.logLevel} onChange={this.onLogLevelChanged}>
                                <option value={CARTA.ErrorSeverity.INFO}>Info</option>
                                <option value={CARTA.ErrorSeverity.WARNING}>Warning</option>
                                <option value={CARTA.ErrorSeverity.ERROR}>Error</option>
                                <option value={CARTA.ErrorSeverity.CRITICAL}>Critical</option>
                            </HTMLSelect>
                            <Button minimal={true} intent={"warning"} icon="delete" onClick={this.onClearClicked}>Clear</Button>
                        </FormGroup>
                    </div>
                </div>
            </div>);
    }
}