<div align="center">

# ⎈ Kubelube

**A fancy, modern, open-source Kubernetes IDE.**

Connect to your cluster contexts in one click and explore workloads with style —
on Windows, macOS and Linux.

[![CI](https://github.com/alexff91/kubelube/actions/workflows/ci.yml/badge.svg)](https://github.com/alexff91/kubelube/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-38bdf8.svg)](LICENSE)
[![Made with Electron](https://img.shields.io/badge/Electron-React%20%2B%20TypeScript-a78bfa)](https://www.electronjs.org/)

</div>

---

Kubelube is a desktop UI for Kubernetes in the spirit of Lens / kubelens, rebuilt
with a modern toolchain and a deep-space dark theme. It reads the same kubeconfig
your `kubectl` uses, so there is nothing to configure: pick a context and go.

## ✨ Features

- **One-click context switching** — every context from your kubeconfig
  (`~/.kube/config` or `$KUBECONFIG`), with live connection status and one-click
  reload after you edit the file.
- **Cluster overview** — node readiness, pod phases, deployment health and the
  latest warning events at a glance.
- **15 resource views** — Pods, Deployments, StatefulSets, DaemonSets,
  ReplicaSets, Jobs, CronJobs, Services, Ingresses, ConfigMaps, Secrets,
  PersistentVolumeClaims, Nodes, Namespaces and Events.
- **Live tables** — auto-refresh, namespace filter, instant name search and
  health-colored status badges (CrashLoopBackOff never hides again).
- **Detail drawer** — pod containers and restarts, clean YAML (managed fields
  stripped) with copy, and per-container log tailing including previous runs.
- **Safe operations** — scale Deployments/StatefulSets and delete resources,
  always behind a confirmation.
- **Secure by design** — the renderer is fully sandboxed (context isolation, no
  Node integration); cluster credentials and secret values never leave the main
  process.

## 📦 Install

Grab the installer for your platform from the
[latest release](https://github.com/alexff91/kubelube/releases/latest):

| Platform | Artifact                       |
| -------- | ------------------------------ |
| Windows  | `Kubelube-*-setup.exe`         |
| macOS    | `Kubelube-*.dmg`               |
| Linux    | `Kubelube-*.AppImage` / `.deb` |

> macOS builds are currently unsigned: right-click → Open on first launch.

## 🚀 Run from source

Requirements: Node.js ≥ 20 and a kubeconfig with at least one context.

```bash
git clone https://github.com/alexff91/kubelube.git
cd kubelube
npm install
npm run dev        # hot-reloading development app
```

Build distributables for your current platform:

```bash
npm run dist
```

## 🏗 Architecture

```
src/
├── main/        Electron main process — owns kubeconfig & talks to the
│   └── kube/    Kubernetes API via @kubernetes/client-node
├── preload/     contextBridge: exposes a typed, serializable API surface
├── renderer/    React UI — sandboxed, no Node access
└── shared/      Types shared across the IPC boundary
```

The renderer never touches the network or the filesystem. Every interaction
goes through a typed IPC contract (`src/shared/api.ts`) and returns a
serializable `ApiResult`, so connectivity problems render as UI state instead
of crashing the view.

## 🤝 Contributing

Issues and pull requests are very welcome! Please read
[CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community expectations.

## 📄 License

[MIT](LICENSE) © kubelube contributors
