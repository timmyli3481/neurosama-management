import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  schema: "https://api.ftcscout.org/graphql",
  documents: ["src/graphql/**/*.graphql"],
  generates: {
    "src/gql/": {
      preset: "client",
      plugins: [],
      presetConfig: {
        fragmentMasking: { unmaskFunctionName: 'getFragmentData' },
      },
    }
  }
};

export default config;
