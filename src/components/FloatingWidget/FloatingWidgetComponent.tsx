import * as React from "react";
import "./FloatingWidgetComponent.css";

class FloatingWidgetComponentProps {
    title: string;
    width: number;
    height: number;
    children?: any;
}

class FloatingWidgetComponentState {
    dragStartX: number;
    dragStartY: number;
    isDragging: boolean;
    offsetX: number;
    offsetY: number;
    initialX: number;
    initialY: number;
}

export class FloatingWidgetComponent extends React.Component<FloatingWidgetComponentProps, FloatingWidgetComponentState> {
    constructor(props: FloatingWidgetComponentProps) {
        super(props);
        this.state = {initialX: 100, initialY: 100, dragStartX: 0, dragStartY: 0, isDragging: false, offsetX: 0, offsetY: 0};
    }

    handleMouseDown = (ev: React.MouseEvent<HTMLDivElement>) => {
        this.setState({dragStartX: ev.nativeEvent.offsetX, dragStartY: ev.nativeEvent.offsetY});
        ev.preventDefault();
    };

    handleMouseUp = (ev: React.MouseEvent<HTMLDivElement>) => {
        console.log(ev);
        this.setState({initialX: this.state.initialX + this.state.offsetX, initialY: this.state.initialY + this.state.offsetY, offsetX: 0, offsetY: 0});
    };

    handleMouseMove = (ev: React.MouseEvent<HTMLDivElement>) => {
        if (ev.buttons === 1) {
            const offsetX = ev.nativeEvent.offsetX - this.state.dragStartX;
            const offsetY = ev.nativeEvent.offsetY - this.state.dragStartY;
            this.setState({offsetX, offsetY});
            ev.preventDefault();
        }
    };

    public render() {
        const headerHeight = 25;
        return (
            <div className="floating-widget"
                 style={{width: `${this.props.width}px`, height: `${this.props.height + headerHeight}px`, top: `${this.state.offsetY + this.state.initialX}px`, left: `${this.state.offsetX + this.state.initialY}px`}}>
                <div className="floating-title" onMouseDown={this.handleMouseDown} onMouseMove={this.handleMouseMove} onMouseUp={this.handleMouseUp}>
                    {this.props.title}
                </div>
                <div className="floating-content">
                    {this.props.children}
                </div>
            </div>
        );
    }
}