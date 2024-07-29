const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const strftime = require('strftime');
const app = express();

const db = new sqlite3.Database(`traces_${strftime('%Y-%m-%d-%H-%M-%S')}.db`);

db.serialize(() => {
    db.run('CREATE TABLE IF NOT EXISTS tracegroups(name TEXT PRIMARY KEY)');
    db.run('CREATE TABLE IF NOT EXISTS traces(id INTEGER PRIMARY KEY, tracegroup TEXT, parent_id INTEGER, start_timestamp_ms INTEGER, measured_time_us INTEGER, label TEXT, location TEXT, FOREIGN KEY(tracegroup) REFERENCES tracegroups(name))');
});

app.get('/', (req, res) => {
  res.send('Hello World');
});

function addTraces(tracegroup, traces, parentId = null) {
    for (const trace of traces) {
        db.run('INSERT INTO traces(tracegroup, parent_id, start_timestamp_ms, measured_time_us, label, location) VALUES(?, ?, ?, ?, ?, ?)', tracegroup, parentId, trace.start_timestamp_ms, trace.measured_time_us, trace.label, trace.location, function (err) {
            if ('children' in trace) {
                addTraces(tracegroup, trace.children, this.lastID);
            }
        });
    }
}
function getTraces(startTimestampMs, endTimestampMs, callback) {
    function getTracesWithParentId(parentId) {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM traces WHERE parent_id = ? AND start_timestamp_ms >= ? AND end_timestamp_ms < ?', parentId, startTimestampMs, endTimestampMs, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    let promises = [];

                    for (const row of rows) {
                        promises.push(getTracesWithParentId(row.id));
                    }

                    Promise.all(promises).then((children) => {
                        for (const [index, child] of children.entries()) {
                            rows[index].children = child;
                        }

                        resolve(rows);
                    });
                }
            });
        });
    }

    db.all('SELECT * FROM traces WHERE parent_id IS NULL AND start_timestamp_ms >= ? AND start_timestamp_ms < ?', startTimestampMs, endTimestampMs, async (err, rows) => {
        if (err) {
            callback(err, null);
        } else {
            let promises = [];

            for (const row of rows) {
                promises.push(getTracesWithParentId(row.id));
            }

            const children = await Promise.all(promises);

            for (const [index, child] of children.entries()) {
                rows[index].children = child;
            }

            callback(null, rows);
        }
    });
}

app.get('/traces', (req, res) => {
    const startTimestampMs = req.query.startTimestampMs || 0;
    const endTimestampMs = req.query.endTimestampMs || Date.now();

    getTraces(startTimestampMs, endTimestampMs, (err, traces) => {
        if (err) {
            res.sendStatus(500);
        } else {
            res.json(traces);
        }
    });
});

// function getTraces(startTimestampMs, callback) {
//     db.all('SELECT * FROM traces WHERE start_timestamp_ms >= ?', startTimestampMs, (err, rows) => {
//         if (err) {
//             callback(err, null);
//         } else {
//             const traces = groupTracesByParentId(rows);
//             callback(null, traces);
//         }
//     });

//     function groupTracesByParentId(traces) {
//         const traceMap = new Map();
//         const rootTraces = [];

//         for (const trace of traces) {
//             const parentId = trace.parent_id;
//             if (parentId === null) {
//                 rootTraces.push(trace);
//             } else {
//                 const parentTrace = traceMap.get(parentId);
//                 if (parentTrace) {
//                     if (!parentTrace.children) {
//                         parentTrace.children = [];
//                     }
//                     parentTrace.children.push(trace);
//                 } else {
//                     traceMap.set(parentId, trace);
//                 }
//             }
//         }

//         return rootTraces;
//     }
// }

app.post('/trace', express.json({ limit: 52428800 }), (req, res) => {
    if (req.body.groups) {
        for (const { name, values } of req.body.groups) {
            db.run('INSERT OR IGNORE INTO tracegroups(name) VALUES(?)', name);

            addTraces(name, values);
        }
    }

    res.sendStatus(200);
});

// handle errors:
app.use((err, req, res, next) => {
    // print original request text
    console.error('Invalid JSON: ', req.body);
    console.error('Invalid request: ', err);
    res.status(500).send('Invalid request');
});

app.listen(8000, (err) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log('server started');
});