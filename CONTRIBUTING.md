# Contributing to Kubelube

Thanks for taking the time to contribute! 🎉

## Development setup

```bash
git clone https://github.com/alexff91/kubelube.git
cd kubelube
npm install
npm run dev
```

`npm run dev` starts the Electron app with hot module replacement for the
renderer and automatic restarts for the main process.

You need a kubeconfig with at least one reachable context to exercise the app.
[kind](https://kind.sigs.k8s.io/) or [minikube](https://minikube.sigs.k8s.io/)
are great for spinning up a local test cluster:

```bash
kind create cluster --name kubelube-dev
```

## Before you open a pull request

All of these must pass — CI enforces them:

```bash
npm run format:check   # Prettier
npm run lint           # ESLint
npm run typecheck      # tsc for both the node and web sides
npm run build          # electron-vite production build
```

Run `npm run format` to fix formatting automatically.

## Project layout

| Path           | What lives there                                             |
| -------------- | ------------------------------------------------------------ |
| `src/main`     | Electron main process, Kubernetes client code, IPC handlers  |
| `src/preload`  | The contextBridge exposing `window.kubelube` to the renderer |
| `src/renderer` | React UI (sandboxed — never import Node/Electron APIs here)  |
| `src/shared`   | Types and the API contract shared across the IPC boundary    |

### Ground rules

- **The renderer stays sandboxed.** All cluster access goes through the typed
  IPC contract in `src/shared/api.ts`. Never expose raw Electron or Node
  capabilities to the renderer.
- **Secret values never cross the bridge.** Lists show secret metadata only.
- **Everything that crosses IPC is a plain serializable shape** defined in
  `src/shared/types.ts`, wrapped in `ApiResult` so errors render as UI state.

## Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):
`feat:`, `fix:`, `docs:`, `ci:`, `chore:`, `refactor:`…

## Reporting bugs & requesting features

Please use the issue templates. For bugs, include your OS, app version and the
Kubernetes distribution/version you are connecting to.

## License

By contributing you agree that your contributions are licensed under the
[MIT License](LICENSE).
