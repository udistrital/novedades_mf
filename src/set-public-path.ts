declare let __webpack_public_path__: string;

type SingleSpaWindow = Window & {
  __INJECTED_PUBLIC_PATH_BY_SINGLE_SPA__?: string;
};

const injectedPath = (window as SingleSpaWindow).__INJECTED_PUBLIC_PATH_BY_SINGLE_SPA__;

if (injectedPath) {
  __webpack_public_path__ = injectedPath.endsWith('/') ? injectedPath : `${injectedPath}/`;
} else {
  const currentScript = document.currentScript as HTMLScriptElement | null;
  const scriptUrl = currentScript?.src;

  if (scriptUrl) {
    __webpack_public_path__ = scriptUrl.slice(0, scriptUrl.lastIndexOf('/') + 1);
  }
}
