/// <reference types="vite/client" />

interface JupiterPluginInit {
  formProps?: Record<string, unknown>;
  displayMode?: 'modal' | 'integrated' | 'widget';
  integratedTargetId?: string;
  [key: string]: unknown;
}

interface JupiterPluginApi {
  init: (props: JupiterPluginInit) => void;
  close: () => void;
  resume?: () => void;
}

interface Window {
  Jupiter?: JupiterPluginApi;
}
