import React from 'react';
import ReactDOM from 'react-dom';

import Timeline from './Timeline';
import CanvasTimeline from './CanvasTimeline';

class App extends React.Component  {
    constructor(props) {
        super(props);

        this.state = {
            groups: [],
            startTimestampMs: 0,
            endTimestampMs: 0
        };
    }

    componentDidMount() {
        this.fetchData(0, -1);
    }

    async fetchData(startTimestampMs, endTimestampMs) {
        const resp = await fetch(`/traces?startTimestampMs=${startTimestampMs}&endTimestampMs=${endTimestampMs}`, {
            method: 'GET'
        });

        const json = await resp.json();

        if (!json.groups) {
            console.error('No groups in response');
            return;
        }

        this.setState({
            startTimestampMs: json.startTimestampMs,
            endTimestampMs: json.endTimestampMs,
            groups: json.groups
        });
    }

    render() {
        return (
            <div>
                {/* <Timeline
                    groups={this.state.groups}
                    startTimestampMs={this.state.startTimestampMs}
                    endTimestampMs={this.state.endTimestampMs}
                /> */}

                <CanvasTimeline
                    groups={this.state.groups}
                    startTimestampMs={this.state.startTimestampMs}
                    endTimestampMs={this.state.endTimestampMs}
                />
            </div>
        );
    }
}


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

export default App;