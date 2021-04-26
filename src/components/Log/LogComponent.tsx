import * as React from "react";
import {observer} from "mobx-react";
import {Button, Code, Colors, FormGroup, HTMLSelect, NonIdealState, Tag, Intent} from "@blueprintjs/core";
import ScrollToBottom from "react-scroll-to-bottom";
import {CARTA} from "carta-protobuf";
import {DefaultWidgetConfig, WidgetProps, HelpType, LogStore} from "stores";
import "./LogComponent.scss";

@observer
export class LogComponent extends React.Component<WidgetProps> {
    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "log",
            type: "log",
            minWidth: 300,
            minHeight: 150,
            defaultWidth: 425,
            defaultHeight: 200,
            title: "Log",
            isCloseable: true,
            helpType: HelpType.LOG
        };
    }

    onClearClicked = () => {
        LogStore.Instance.clearLog();
    };

    onTagClicked = (tag: string) => {
        LogStore.Instance.toggleTag(tag);
    };

    onLogLevelChanged = (event: React.FormEvent<HTMLSelectElement>) => {
        LogStore.Instance.setLevel(parseInt(event.currentTarget.value));
    };

    private isTagHidden = (tag: string) => {
        return (LogStore.Instance.hiddenTags.indexOf(tag) !== -1);
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
        const logStore = LogStore.Instance;
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
                    <ScrollToBottom initialScrollBehavior="auto" debug={false} className="log-entry-list" followButtonClassName="log-entry-follow">
                        {entryElements}
                    </ScrollToBottom>
                ) : <NonIdealState className="log-entry-list" icon="application" title="No log entries"/>}

                <div className="log-footer">
                    <FormGroup inline={true} label="Log level:" className="log-level">
                        <HTMLSelect value={logStore.logLevel} onChange={this.onLogLevelChanged} style={{color: this.colorFromSeverity(logStore.logLevel)}}>
                            <option value={CARTA.ErrorSeverity.DEBUG} style={{color: this.colorFromSeverity(CARTA.ErrorSeverity.DEBUG)}}>Debug</option>
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