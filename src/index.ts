const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const strftime = require('strftime');
const path = require('path');
const app = express();

const fs = require('fs');

if (!fs.existsSync('traces')) {
    fs.mkdirSync('traces');
}

// find latest trace file
let latestTraceFile = null;

fs.readdirSync('traces').forEach(file => {
    if (file.endsWith('.db')) {
        if (!latestTraceFile || file > latestTraceFile) {
            latestTraceFile = file;
        }
    }
});

function getNewTraceFile() {
    return `traces/trace_${strftime('%Y-%m-%d-%H:%M:%S').replaceAll('/', ':')}.db`;
}

let db;

if (latestTraceFile != null) {
    latestTraceFile = path.join('traces', latestTraceFile);

}

db = new sqlite3.Database(latestTraceFile != null ? latestTraceFile : getNewTraceFile(), (err) => {
    if (err) {
        console.error(err);

        return;
    }

    console.log('Connected to the database');

    db.serialize(() => {
        db.run('CREATE TABLE IF NOT EXISTS tracegroups(name TEXT PRIMARY KEY)');
        db.run('CREATE TABLE IF NOT EXISTS traces(id INTEGER PRIMARY KEY, tracegroup TEXT, parent_id INTEGER, start_timestamp_ms INTEGER, measured_time_us INTEGER, label TEXT, location TEXT, FOREIGN KEY(tracegroup) REFERENCES tracegroups(name))');

        db.run('CREATE INDEX IF NOT EXISTS tracegroup_index ON traces(tracegroup)');
        db.run('CREATE INDEX IF NOT EXISTS parent_id_index ON traces(parent_id)');
        db.run('CREATE INDEX IF NOT EXISTS start_timestamp_ms_index ON traces(start_timestamp_ms)');
    });

    db.serialize(() => {
        db.all('SELECT * FROM tracegroups', (err, rows) => {
            if (err) {
                console.error(err);
            } else {
                console.log(rows);
            }
        });
    });
});

process.addListener('exit', () => {
    db.close();
});

app.get('/js/app.js', (req, res) => {
    res.sendFile(__dirname + '/public/js/app.js');
});

app.get('/css/styles.css', (req, res) => {
    res.sendFile(__dirname + '/public/css/styles.css');
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
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
function getTraces(startTimestampMs: number, endTimestampMs: number, callback) {
    function getTracesWithParentId(parentId: number) {
        return new Promise<any[]>((resolve, reject) => {
            db.serialize(() => {
                const query = `
                    SELECT 
                    child.*,
                    (CAST(child.measured_time_us AS DOUBLE) / CAST(parent.measured_time_us AS DOUBLE)) AS percent
                FROM 
                    traces child
                JOIN 
                    traces parent ON child.parent_id = parent.id
                WHERE 
                    child.parent_id = ? 
                    AND child.start_timestamp_ms >= ? 
                    AND child.start_timestamp_ms <= ?
                `;

                db.all(query, [parentId, startTimestampMs, endTimestampMs], (err, rows) => {
                    if (err) {
                        console.error(err);

                        reject(err);
                    } else {
                        let promises: Promise<any>[] = [];

                        for (const row of rows) {
                            promises.push(getTracesWithParentId(row.id));
                        }

                        Promise.all(promises)
                            .then((children) => {
                                for (const [index, child] of children.entries()) {
                                    rows[index].children = child;
                                }

                                resolve(rows);
                            })
                            .catch((err) => {
                                reject(err);
                            });
                    }
                });
            });
        });
    }

    const query = `
    WITH MaxValues AS (
        SELECT 
            MIN(start_timestamp_ms) AS min_start_timestamp_ms,
            MAX(start_timestamp_ms + measured_time_us / 1000) AS max_end_timestamp_ms
        FROM 
            traces
        WHERE 
            parent_id IS NULL
            AND start_timestamp_ms >= ? 
            AND start_timestamp_ms <= ?
    )
    SELECT 
        child.*,
        (CAST(child.measured_time_us AS DOUBLE) / CAST(MaxValues.max_end_timestamp_ms - MaxValues.min_start_timestamp_ms AS DOUBLE)) AS percent
    FROM 
        traces child,
        MaxValues
    WHERE 
        child.parent_id IS NULL
        AND child.start_timestamp_ms >= ? 
        AND child.start_timestamp_ms <= ?
    `;

    db.all(query, [startTimestampMs, endTimestampMs, startTimestampMs, endTimestampMs], async (err, rows) => {
        if (err) {
            console.error(err);

            callback(err, null);
        } else {
            let promises: Promise<any[]>[] = [];

            for (const row of rows) {
                promises.push(getTracesWithParentId(row.id));
            }

            try {
                const children = await Promise.all(promises);

                for (const [index, child] of children.entries()) {
                    rows[index].children = child;
                }

                callback(null, rows);
            } catch (err) {
                callback(err, null);
            }
        }
    });
}

app.get('/traces', (req, res) => {
    const startTimestampMs = parseInt(req.query.startTimestampMs, 10) || 0;

    let endTimestampMs = parseInt(req.query.endTimestampMs, 10);

    if (!endTimestampMs || endTimestampMs < 0) {
        endTimestampMs = Date.now();
    }

    getTraces(startTimestampMs, endTimestampMs, (err, traces) => {
        if (err) {
            console.error(err);

            res.sendStatus(500);
        } else {
            let newStartTimestampMs = Number.POSITIVE_INFINITY;
            let newEndTimestampMs = Number.NEGATIVE_INFINITY;

            const groups: { [key: string]: typeof traces } = {};

            for (const trace of traces) {
                if (trace.start_timestamp_ms < newStartTimestampMs) {
                    newStartTimestampMs = trace.start_timestamp_ms;
                }

                if (trace.start_timestamp_ms + trace.measured_time_us / 1000 > newEndTimestampMs) {
                    newEndTimestampMs = trace.start_timestamp_ms + trace.measured_time_us / 1000;
                }

                if (trace.start_timestamp_ms > newEndTimestampMs) {
                    newEndTimestampMs = trace.start_timestamp_ms;
                }

                if (!(trace.tracegroup in groups)) {
                    groups[trace.tracegroup] = [];
                }

                groups[trace.tracegroup].push(trace);
            }

            // convert groups object into an array
            let groupArray: { name: string, values: any[] }[] = [];

            for (const key in groups) {
                groupArray.push({
                    name: key,
                    values: groups[key]
                });
            }

            res.json({
                startTimestampMs: newStartTimestampMs,
                endTimestampMs: newEndTimestampMs,
                groups: groupArray
            });
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
    let promises: Promise<void>[] = [];

    if (req.body.groups) {
        for (const { name, values } of req.body.groups) {
            promises.push(new Promise<void>((resolve, reject) => {
                db.serialize(() => {
                    db.run('INSERT OR IGNORE INTO tracegroups(name) VALUES(?)', name, (err) => {
                        if (err) {
                            console.error(err);

                            reject(err);

                            return;
                        }

                        addTraces(name, values);

                        resolve();
                    });
                });
            }));
        }
    }

    Promise.all(promises)
        .then(() => {
            res.sendStatus(200);
        })
        .catch((err) => {
            console.error(err);
            res.sendStatus(500);
        });
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