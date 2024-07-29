import React from 'react';
import stringToColor from 'string-to-color';


export default class CanvasTimeline extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            zoom: 1,
            timeOffset: 0
        };

        this._ref = React.createRef(null);
    }

    componentDidMount() {
        this._paint();

        this.setState({
            timeOffset: this.props.startTimestampMs
        });
    }

    componentDidUpdate(prevProps) {
        this._paint();

        if (prevProps.startTimestampMs !== this.props.startTimestampMs) {
            this.setState({
                timeOffset: this.props.startTimestampMs
            });
        }
    }

    _handleScroll = (event) => {
        event.preventDefault();

        const deltaX = event.deltaX;
        const deltaY = event.deltaY;
        // const zoom = this.state.zoom + deltaY * 0.01;
        const timeOffset = this.state.timeOffset + deltaX * this.state.zoom;

        this.setState({
            timeOffset
        }, () => {
            console.log('timeOffset: ', this.state.timeOffset);

            this._paint();
        });
    };

    _paint() {
        const canvas = this._ref.current;
        const context = canvas.getContext('2d');

        context.fillStyle = 'black';
        context.fillRect(0, 0, canvas.width, canvas.height);

        this._renderAxis();
        this._renderTracks();
    }

    _renderAxis() {
        const canvas = this._ref.current;
        const context = canvas.getContext('2d');

        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, 20);

        context.fillStyle = 'black';
        context.font = '12px Arial';
        context.textAlign = 'center';

        const timeOffset = this.state.timeOffset;
        const zoom = this.state.zoom;

        for (let i = 0; i < 10; i++) {
            const time = timeOffset + i * zoom * 1000;
            const x = i * 100;
            context.fillText(time, x, 10);
        }       
    }

    _renderTracks() {
        const canvas = this._ref.current;
        const context = canvas.getContext('2d');

        const groups = this.props.groups;
        const trackHeight = 20;
        const trackSpacing = 5;
        const trackOffset = 30;

        let offsetY = 0;
        
        groups.forEach((group, index) => {
            const oldOffsetY = offsetY;
            offsetY += this._renderTrack(group, offsetY);

            context.fillStyle = 'white';
            context.font = '12px Arial';
            context.textAlign = 'left';

            context.fillText(group.name, 10, oldOffsetY);
        });
    }

    _renderTrack(group, offsetY) {
        const canvas = this._ref.current;
        const context = canvas.getContext('2d');

        let height = 0;

        const canvasWidth = canvas.width;

        for (const value of group.values) {
            height = Math.max(this._renderTrackEntry(value, 0, offsetY, this.props.startTimestampMs, this.props.endTimestampMs, canvasWidth), height);
        }

        return height;
    }

    _renderTrackEntry(entry, offsetX, offsetY, parentStart, parentEnd, parentWidth) {
        const canvas = this._ref.current;
        const context = canvas.getContext('2d');

        const parentDuration = parentEnd - parentStart;

        const start = entry.start_timestamp_ms;
        const duration = parentDuration * entry.percent;
        const end = start + duration;

        const timeOffset = this.state.timeOffset;
        const zoom = this.state.zoom;

        const x = (start - timeOffset) / zoom;
        const width = parentWidth * entry.percent;

        if (x + width < 0 || x > canvas.width) {
            return 0;
        }

        let height = 20;

        context.fillStyle = 'white';
        context.fillRect(x, offsetY, width, height);

        context.fillStyle = stringToColor(entry.label);
        context.fillRect(x + 1, offsetY + 1, width - 2, height - 2);

        context.fillStyle = 'black';
        context.font = '9px Arial';
        context.textAlign = 'left';

        let text = `${entry.measured_time_us}us - ${entry.label}`;

        // truncate label if it's too long
        if (context.measureText(text).width > width) {
            const truncatedLabel = text.substring(0, Math.floor(width / 9) - 3) + '...';
            context.fillText(truncatedLabel, x + 5, offsetY + (height / 2) + 3);
        } else {
            context.fillText(text, x + 5, offsetY + (height / 2) + 3);
        }

        if (entry.children) {
            for (const child of entry.children) {
                height += this._renderTrackEntry(child, offsetX + x, offsetY + 25, start, end, width);
            }
        }

        return height;
    }

    render() {
        return (
            <canvas
                ref={this._ref}
                className='timeline-canvas'
                width={600}
                height={500}
                onWheel={this._handleScroll}
            />
        );
    }
}