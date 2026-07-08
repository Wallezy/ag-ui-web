import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  ignoreIssues: {
    'src/components/assistant-ui/**': ['exports', 'types'],
    'src/components/ui/**': ['exports', 'types'],
  },
};

export default config;
