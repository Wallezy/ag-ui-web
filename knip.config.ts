import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  vite: { config: ['vite.config.ts'] },
  ignoreIssues: {
    'src/components/assistant-ui/**': ['exports', 'types'],
    'src/components/ui/**': ['exports', 'types'],
  },
}

export default config
