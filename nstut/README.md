# NsTut TFG fork

This branch is the source of truth for NsTut changes layered on top of the released TerraFirmaGreg Modern pack.

## Branch model

- upstream points to TerraFirmaGreg-Team/Modpack-Modern.
- nstut/0.13.10 is based exactly on upstream tag 0.13.10.
- nstut/release.json records the upstream base and the immutable NsTut release tag used by generated patch artifacts.
- Future upstream releases should be merged or rebased into a new nstut/<upstream-version> branch. Git conflicts are resolved here before a Modpack Manager overlay is published.

## What lives natively in the fork

Pack-owned changes are ordinary tracked files and Pakku metadata. This currently includes the CE Horse Power dependency/config, custom managed mods, the GTCEu weather/terrain explosion setting, and server-export FTB chunk limits.

GitHub projects with multiple loader assets are pinned to the reviewed Forge 1.20.1 asset and use update_strategy NONE; version changes are explicit fork commits rather than implicit Pakku updates.

## Deployment metadata

nstut/managed-mods.json contains exact downloadable artifacts and cleanup rules.

nstut/runtime-overlays.json describes semantic overlays for mutable config/runtime files. YAML/TOML entries are emitted into nstut/modpack-manager.patch.json. Existing-world FTB SNBT is intentionally not replaced wholesale; nstut/tools/patch-existing-server.py updates only the managed keys.

nstut/tools/generate-modpack-manager-manifest.py also inspects the fork diff against baseRef. Any future ordinary changed file not classified as mutable or metadata is emitted as an exact file replacement, sourced from the immutable sourceRef tag.

## Validation

Run these commands from the repository root:

    python nstut/tools/generate-modpack-manager-manifest.py
    python nstut/tools/validate.py

The validator checks the upstream ancestry, Forge/Minecraft target, exact managed JAR filenames/hashes, client-only boundaries, native config policy, server FTB defaults, and generated manifest freshness.
