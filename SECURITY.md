# Security Policy

## Supported versions

Only the latest release receives security fixes.

## Reporting a vulnerability

Please report security issues privately via
[GitHub Security Advisories](https://github.com/alexff91/kubelube/security/advisories/new)
rather than opening a public issue. You should receive a response within a
week.

## Security model

- Kubelube reads the kubeconfig from the standard locations
  (`~/.kube/config`, `$KUBECONFIG`) and talks to clusters **only** through the
  official [`@kubernetes/client-node`](https://github.com/kubernetes-client/javascript)
  library, from the Electron main process.
- The renderer runs with context isolation enabled and Node integration
  disabled. It can only call the typed IPC surface exposed by the preload
  script.
- Credentials, tokens and Secret **values** never cross the IPC boundary —
  resource lists carry metadata only.
- The app makes no network requests other than to your configured clusters.
  There is no telemetry.
