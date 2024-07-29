import React from 'react';

class ProfileEntry extends React.Component {
    render() {
        const parentDuration = this.props.parentEnd - this.props.parentStart;
        const startOffset = this.props.value.start_timestamp_ms - this.props.parentStart;

        const duration = parentDuration * this.props.value.percent;

        return (
            <div className='timeline-group__entry' style={{ left: `${startOffset / parentDuration}%`, width: `${this.props.value.percent * 100}%` }}>
                <div>{JSON.stringify(this.props.value.label)}</div>

                {this.props.value.children
                    ? this.props.value.children.map((child, index) => {
                        return (
                            <ProfileEntry
                                value={child}
                                parentStart={this.props.value.start_timestamp_ms}
                                parentEnd={this.props.value.start_timestamp_ms + duration}
                                key={index}
                            />
                        );
                    })
                    : null}
            </div>
        );
    }
}

export default class Timeline extends React.Component {
    constructor(props) {
        super(props);

        this.state = {};
        this._ref = React.createRef(null);
    }

    render() {
        // let scrollPercentage = this._ref.current
        //     ? this._ref.current.scrollLeft / this._ref.current.clientWidth
        //     : 0;

        // console.log('scroll: ', scrollPercentage);

        return (
            <div ref={this._ref} className='timeline'>
                {this.props.groups.map((group, index) => {
                    return (
                        <div className='timeline-group' key={index}>
                            <div className='timeline-group__header'>{group.name}</div>

                            <div className='timeline-group__elements'>
                                {group.values.map((value, index) => {
                                    return (
                                        <ProfileEntry
                                            value={value}
                                            parentStart={this.props.startTimestampMs}
                                            parentEnd={this.props.endTimestampMs}
                                            key={index}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }
}