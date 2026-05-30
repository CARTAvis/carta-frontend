import * as React from "react";
import {Button} from "@blueprintjs/core";

interface LogEntryListProps {
    children: React.ReactNode;
}

interface LogEntryListState {
    isFollowButtonVisible: boolean;
}

const FOLLOW_BUTTON_THRESHOLD_PX = 4;

export class LogEntryList extends React.PureComponent<LogEntryListProps, LogEntryListState> {
    public state: LogEntryListState = {isFollowButtonVisible: false};

    private containerRef = React.createRef<HTMLDivElement>();
    private shouldStickToBottom = true;

    componentDidMount() {
        this.scrollToBottom();
    }

    componentDidUpdate(prevProps: LogEntryListProps) {
        if (prevProps.children !== this.props.children && this.shouldStickToBottom) {
            this.scrollToBottom();
        }
    }

    private getDistanceFromBottom = (container: HTMLDivElement) => {
        return container.scrollHeight - container.scrollTop - container.clientHeight;
    };

    private updateScrollState = () => {
        const container = this.containerRef.current;
        if (!container) {
            return;
        }

        const isAtBottom = this.getDistanceFromBottom(container) <= FOLLOW_BUTTON_THRESHOLD_PX;
        this.shouldStickToBottom = isAtBottom;

        if (this.state.isFollowButtonVisible === isAtBottom) {
            this.setState({isFollowButtonVisible: !isAtBottom});
        }
    };

    private onScroll = () => {
        this.updateScrollState();
    };

    private onFollowClicked = () => {
        this.shouldStickToBottom = true;
        this.scrollToBottom();
    };

    private scrollToBottom = () => {
        const container = this.containerRef.current;
        if (!container) {
            return;
        }

        container.scrollTop = container.scrollHeight;

        if (this.state.isFollowButtonVisible) {
            this.setState({isFollowButtonVisible: false});
        }
    };

    render() {
        return (
            <div className="log-entry-scroll-container">
                <div className="log-entry-list" onScroll={this.onScroll} ref={this.containerRef}>
                    {this.props.children}
                </div>
                {this.state.isFollowButtonVisible && <Button aria-label="Scroll to latest log entries" className="log-entry-follow" icon="arrow-down" variant="minimal" onClick={this.onFollowClicked} />}
            </div>
        );
    }
}
