# Changelog

## v1.1.0

### New features:

- Add 3Dmol visualization.
  - Deploy `AlphaFold3DmolVisualizerStack` to use this feature.

### Bug fixes and improvements:

- Integrate CDK stacks into single stack.
  - `OmicsFrontendStack` and `OmicsBackendStack` -> `OmicsAnalysisAppStack`

- Rename DynamoDB tables.
  - `OmicsVisualizations` -> `OmicsWorkflowVisualizers`
  - `OmicsDashboards` -> `OmicsRunVisualizations`

## v1.0.0

### New features:

* Initial release.
