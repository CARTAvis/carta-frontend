import * as React from "react";
import "./LogComponent.css";
import {LogStore} from "../../stores/LogStore";
import {observer} from "mobx-react";
import {Button, Code, Colors, FormGroup, HTMLSelect, NonIdealState, Tag} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import ScrollToBottom from "react-scroll-to-bottom";
import {Intent} from "@blueprintjs/core/lib/esm/common/intent";

@observer
export class LogComponent extends React.Component<{ logStore: LogStore }> {

    onClearClicked = () => {
        this.props.logStore.clearLog();
    };

    onTagClicked = (tag: string) => {
        this.props.logStore.toggleTag(tag);
    };

    onLogLevelChanged = (event: React.FormEvent<HTMLSelectElement>) => {
        this.props.logStore.setLevel(parseInt(event.currentTarget.value));
    };

    private isTagHidden = (tag: string) => {
        return (this.props.logStore.hiddenTags.indexOf(tag) !== -1);
    };

    private colorFromSeverity(severity: CARTA.ErrorSeverity): string {
        switch (severity) {
            case CARTA.ErrorSeverity.WARNING:
                return Colors.ORANGE3;
            case CARTA.ErrorSeverity.ERROR:
            case CARTA.ErrorSeverity.CRITICAL:
                return Colors.RED3;
            default:
                return Colors.GRAY1;
        }
    }

    private intentFromSeverity(severity: CARTA.ErrorSeverity): Intent {
        switch (severity) {
            case CARTA.ErrorSeverity.WARNING:
                return "warning";
            case CARTA.ErrorSeverity.ERROR:
            case CARTA.ErrorSeverity.CRITICAL:
                return "danger";
            default:
                return "none";
        }
    }

    render() {
        const logStore = this.props.logStore;
        const entries = logStore.logEntries;
        const hiddenTags = logStore.hiddenTags;

        let tagList = [];
        let entryElements = [];
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];

            if (entry.level < logStore.logLevel) {
                continue;
            }

            let entryTagSpans = [];
            let visibleTags = entry.tags.filter(v => hiddenTags.indexOf(v) === -1);
            for (let j = 0; j < entry.tags.length; j++) {
                const tag = entry.tags[j];

                entryTagSpans.push(<Tag key={j} intent={this.intentFromSeverity(entry.level)}>{entry.tags[j]}</Tag>);
                if (tagList.indexOf(tag) === -1) {
                    tagList.push(tag);
                }
            }
            if (visibleTags.length) {
                entryElements.push(
                    <div key={i}>
                        {entryTagSpans}
                        <Code style={{color: this.colorFromSeverity(entry.level)}}>{entry.message}</Code>
                    </div>
                );
            }
        }

        const allTagSpans = tagList.map((tag, index) => {
            return (
                <Tag
                    interactive={true}
                    minimal={this.isTagHidden(tag)}
                    intent={this.isTagHidden(tag) ? "none" : "primary"}
                    className={this.isTagHidden(tag) ? "tag-hidden" : ""}
                    key={index}
                    onClick={() => this.onTagClicked(tag)}
                >
                    {tag}
                </Tag>
            );
        });

        return (
            <div className="log">
                {entryElements.length ? (
                    <ScrollToBottom className="log-entry-list" followButtonClassName="log-entry-follow">
                        {entryElements}
                    </ScrollToBottom>
                ) : <NonIdealState className="log-entry-list" icon="application" title="No log entries"/>}

                <div className="log-footer">
                    <FormGroup inline={true} label="Log level:" className="log-level">
                        <HTMLSelect value={logStore.logLevel} onChange={this.onLogLevelChanged} style={{color: this.colorFromSeverity(logStore.logLevel)}}>
                            <option value={-1} style={{color: this.colorFromSeverity(-1)}}>Debug</option>
                            <option value={CARTA.ErrorSeverity.INFO} style={{color: this.colorFromSeverity(CARTA.ErrorSeverity.INFO)}}>Info</option>
                            <option value={CARTA.ErrorSeverity.WARNING} style={{color: this.colorFromSeverity(CARTA.ErrorSeverity.WARNING)}}>Warning</option>
                            <option value={CARTA.ErrorSeverity.ERROR} style={{color: this.colorFromSeverity(CARTA.ErrorSeverity.ERROR)}}>Error</option>
                            <option value={CARTA.ErrorSeverity.CRITICAL} style={{color: this.colorFromSeverity(CARTA.ErrorSeverity.CRITICAL)}}>Critical</option>
                        </HTMLSelect>
                    </FormGroup>
                    <FormGroup inline={true} label="Visible tags:" className="tag-list">
                        <div>
                            {allTagSpans.length > 0 ? allTagSpans : "None"}
                        </div>
                    </FormGroup>
                    <div className="log-footer-right">
                        <Button minimal={true} intent={"warning"} icon="trash" onClick={this.onClearClicked}/>
                    </div>
                </div>
            </div>);
    }
}