/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MEDIA_BASE_URL?: string;
  readonly VITE_BACKGROUND_IMAGE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
