The web server should expose a health check endpoint /api/v1/health which can
inform e.g. Coolify whether the service is in a healthy state.

Here are some of the checks it should perform:

- Is there at least 1MB of free disk space (so uploads don't fail)?
- Is an Anthropic API key available?
