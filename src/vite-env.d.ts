/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
  readonly VITE_TG_API_ID: string
  readonly VITE_TG_API_HASH: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Cloud Phone specific APIs (see developer.cloudfone.com docs)
interface VolumeManager {
  requestShow(): void
  requestUp(): void
  requestDown(): void
}

interface Navigator {
  volumeManager?: VolumeManager
  hasFeature?(name: string): Promise<boolean>
}
