# NsTut TFG fork

This branch is the source of truth for NsTut changes layered on top of the released TerraFirmaGreg Modern pack.

## Branch model

The fork uses three deliberately different branch roles:

- `dev` is the integration/development branch. Upstream TFG development and NsTut feature work land here first. It is never a deployment pointer.
- `nstut/<base>` is a release-construction branch, for example `nstut/0.13.10`. It starts from the currently promoted release history, receives only the reviewed pack changes intended for that release, regenerates deployment metadata, and is fully validated before promotion.
- `nstut/stable` is a production promotion pointer. Modpack Manager follows only this branch. Do not develop on it and do not merge `dev` into it directly.

`nstut/release.json` records the upstream base, release-construction branch, overlay version, and immutable deployment tag.

### Promotion procedure

1. Integrate and test changes on `dev`.
2. Bring the reviewed release content into the matching `nstut/<base>` construction branch.
3. Bump `overlayVersion` and `sourceRef` in `nstut/release.json`.
4. Regenerate `nstut/modpack-manager.patch.json` and run the NsTut validators.
5. Commit the complete release state.
6. Create the immutable `sourceRef` tag on that exact release commit and push it.
7. Open a PR from the declared `nstut/<base>` branch to `nstut/stable`.
8. Merge only after both `validate` and `promotion-gate` pass.

The promotion gate rejects a PR into `nstut/stable` when its source is not the declared release-construction branch, when the immutable tag is missing, when the tag does not point to the exact PR head, or when the release branch does not descend from the current stable release.

On `nstut/stable`, validation additionally requires the complete repository tree to match the immutable deployment tag. This catches accidental direct `dev -> stable` merges even if `release.json` itself was not modified.

## What lives natively in the fork

Pack-owned changes are ordinary tracked files and Pakku metadata. This currently includes the CE Horse Power dependency/config, custom managed mods, the GTCEu weather/terrain explosion setting, and server-export FTB chunk limits.

GitHub projects with multiple loader assets are pinned to the reviewed Forge 1.20.1 asset and use update_strategy NONE; version changes are explicit fork commits rather than implicit Pakku updates.

## Deployment metadata

nstut/managed-mods.json contains exact downloadable artifacts and cleanup rules.

nstut/runtime-overlays.json describes semantic overlays for mutable config/runtime files. YAML, TOML, and SNBT entries are emitted into nstut/modpack-manager.patch.json. Existing-world FTB SNBT is patched semantically through patchSnbt; nstut/tools/patch-existing-server.py remains a standalone fallback that updates the same managed keys.

nstut/tools/generate-modpack-manager-manifest.py also inspects the fork diff against baseRef. Any future ordinary changed file not classified as mutable or metadata is emitted as an exact file replacement, sourced from the immutable sourceRef tag.

## Validation

Run these commands from the repository root:

    python nstut/tools/generate-modpack-manager-manifest.py
    python nstut/tools/validate.py

The validator checks the upstream ancestry, Forge/Minecraft target, exact managed JAR filenames/hashes, client-only boundaries, native config policy, server FTB defaults, and generated manifest freshness.

`nstut/stable` is therefore intentionally boring: it exists to identify the latest approved immutable release, not to accumulate development commits. Pakku server-overrides and client-overrides are generated to their real installation path and target, never copied under `.pakku`.
