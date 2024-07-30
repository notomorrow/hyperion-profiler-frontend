# hyperion-profiler-frontend

The purpose of this tool is to capture data sent via Hyperion Engine's profiler backend and display it using a HTML canvas element.

To set up this tool run `npm install` in the root directory of the project. Ensure that typescript is installed as well: `npm install -g typescript`.
To build it: `npm run build`
Finally, start it with: `npm run start`.

This will start a server listening on port 8000, which Hyperion is set up to send profiler requests to by default. Ensure profiling is enabled in Hyperion by checking if `HYP_ENABLE_PROFILE` is defined in `core/Defines.hpp>`.
When you run Hyperion Engine with `HYP_ENABLE_PROFILE` defined, it will automatically send HTTP requests to the server.
