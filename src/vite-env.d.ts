/// <reference types="vite/client" />

/** Jupiter Plugin global (https://plugin.jup.ag/plugin-v1.js) */
interface JupiterPluginInit {
  formProps?: Record<string, unknown>;
  displayMode?: 'modal' | 'integrated' | 'widget';
  integratedTargetId?: string;
  widgetStyle?: Record<string, unknown>;
  containerClassName?: string;
  containerStyles?: Record<string, unknown>;
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
