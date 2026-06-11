import type { KubelubeApi } from '../shared/api';

declare global {
  interface Window {
    kubelube: KubelubeApi;
  }
}

export {};
