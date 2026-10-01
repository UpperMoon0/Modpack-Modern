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

## Candidate overlay 0.13.10-nstut.26

The custom Forge 1.20.1 artifacts were checked against published stable GitHub releases on 2026-10-02. Economy is pinned to 0.0.14, OpenUI MC to 0.0.12, Create Horse Power CE to 1.2.7, Perfomant Boom to 1.1.3, and Celestial Nail to 0.1.2. The remaining custom projects already use their latest compatible published versions. Celestial Nail 0.1.2 requires Perfomant Boom 1.1.3 or newer within 1.x. Every selected JAR was downloaded and its SHA-256 verified against GitHub's release asset digest before updating Pakku and managed metadata.

Server exports and existing-server overlays set `online-mode=false`. Only that property is managed; existing world names, ports, MOTDs, and other properties remain intact. Simply Speakers uploads are limited to 100 MiB (`maxUploadSize=104857600`) on clients, singleplayer, and servers. The server keeps its existing 512-block speaker range.

This candidate adds the `patchProperties` operation. Release the corresponding Modpack Manager update (PR #23) before promoting this overlay. Merge the pack changes through the release-construction branch, tag its final reviewed commit as `nstut-0.13.10.26`, and promote it through the existing stable gate. No production pointer or immutable tag is changed by the feature PR.
