# HISABCHE REELS STUDIO — AUTONOMOUS PROJECT COMPLETION MASTER PROMPT

> Saved verbatim from the owner, 24 Oct 2026 («در مسیر فولدر ساخت ویدیو اینو حتما ذخیره بکن»).
> This is the owner's standing brief for finishing the studio. It adds to — and does not replace — `CLAUDE.md` (Hard Rules 13–16), `docs/EDITING-BLUEPRINT-SPEC.md` and `docs/100-VIDEO-PLAN.md`.
> Where it conflicts with something already decided, the conflict is listed in `CLAUDE.md` §19 and is the owner's to settle; nothing here is silently overridden.

## Mission

Continue the existing Hisabche Reels Studio project from its current repository state. Do not ask the project owner to manually locate files, explain the repository, identify reel numbers, map scenarios, or provide information that can be discovered from the project itself.

Your responsibility is to inspect the repository, discover the current architecture and project rules, plan the work, implement it, run verification, and report only the remaining blockers that genuinely require external human input.

The project currently has 94 reels in its registry, and Reel 94 corresponds to plan ID L1.05. The last reported state was `IMPLEMENTED_NOT_LIVE_VERIFIED`. Treat these as historical context, not as proof of the current repository state. Verify everything before acting.

## 1. Start by discovering the project

Before changing anything:

1. Inspect the current working directory, Git status, current branch, and recent commits.
2. Read `CLAUDE.md` and all relevant nested instruction files.
3. Read `PROMO_REEL_WORKFLOW.md`, `SCENARIOS.md`, `SAAS_MOTION_STANDARDS.md`, `docs/EDITING-BLUEPRINT-SPEC.md`, `docs/100-VIDEO-PLAN.md`, `fast-track-sdk.md`, and any related scenario, asset, licensing, engine, export, or QA documentation that actually exists.
4. Inspect the reel registry, reel index, ledger, shared components, scene implementations, timeline engine, exporter, preview server, asset manifests, and tests.
5. Search the repository for Reel 94, L1.05, `ProductCaptureScene`, `product-capture`, `PRODUCT_CAPTURE_MISSING`, `till-count.mp4`, and the five planned product routes.
6. Identify the actual latest reel number from the registry and verify that it does not collide with any existing reel, branch, or asset.
7. Locate the authoritative source for each scenario's plan ID, content, product route, language variants, runtime, and required assets.

Use repository searches and file-reading tools to discover these facts. Never ask the owner to paste files or explain information already present in the repository.
If a documented path does not exist, search for its actual equivalent before concluding that information is unavailable.

## 2. Establish the real current state

Do not trust previous progress summaries without verification.

Create a short internal checklist of:

- What is implemented.
- What is registered.
- What is tested.
- What is exported successfully.
- What has only been type-checked.
- What depends on external footage.
- What is incomplete or inconsistent.

Run the relevant existing tests before modifying code where practical. Preserve unrelated work and never overwrite user changes without inspecting them.
Do not claim a test passed unless you ran it and observed its result.

## 3. Hard runtime requirement: every finished reel must exceed 30 seconds

The owner requires every one of the 94 existing reels and every future reel to have a total runtime strictly greater than 30 seconds.
This is a project-wide requirement, not merely a requirement for Reel 94.

First audit the actual runtime of every registered reel, using the authoritative timeline or duration source. Do not infer duration from filenames or reel IDs.
Produce a runtime audit that identifies:

- Reel number and plan ID, where available.
- Actual calculated duration.
- Whether it passes the `> 30.0 seconds` requirement.
- The authoritative source of its duration.

Then implement the smallest reliable project-wide validation that prevents any reel of 30 seconds or less from being marked production-ready or successfully exported.
For Reel 94 / L1.05, expand the current 15-second draft into a complete, coherent reel longer than 30 seconds. Do not simply stretch every animation or hold a frame to inflate duration. Add useful storytelling, deliberate pacing, real product demonstration, and an appropriate ending. Preserve the approved concept unless project rules or product truth require a change.
For existing reels that fail the runtime rule, produce an explicit remediation plan. Fix them when it is safe and within the project's established conventions. Do not perform a destructive mass rewrite or invent new product features just to meet duration.
Recalculate duration from actual scene timelines and verify the final output duration. The minimum should be enforced consistently by tests, validation, and the production/export workflow.

## 4. Build a reusable motion asset library

The owner wants the motion work from all 94 reels preserved so that individual motion elements can be reused in future reels.

Inspect the current engine before choosing the implementation. Build upon the existing architecture rather than creating a parallel system.

Create or improve a reusable motion asset library that can discover and catalogue existing motion work, including where available:

- Scene and animation components.
- Animation operators and primitives.
- Typography treatments.
- Transitions.
- Backgrounds and textures.
- Product demonstration layouts.
- Timelines and scene sequences.
- Sound cues and synchronization rules.
- Reusable compositions and their dependencies.

Every catalogued asset should have a stable ID, source path, asset type, supported parameters, dependencies, licensing or provenance information where applicable, and at least one example of usage.
Preserve the original source of reusable components. Do not flatten the library into screenshots or rendered videos alone. Preserve the editable source and timeline information needed to recombine animations.
Create a machine-readable registry and a human-readable catalogue. Add a way to search by visual style, animation type, duration, aspect ratio, scene type, dependency, and usage restrictions when the existing architecture supports those fields.
For each of the 94 reels, discover and catalogue its reusable components. If a reel is not actually implemented or its source cannot be found, report that fact instead of inventing its contents.
Do not store prohibited rendered videos, capture footage, or batches of frames inside the repository. Follow the repository's existing storage and licensing rules.

## 5. Real product capture must remain real

Review the implementation of `ProductCaptureScene` and its exporter integration.
The capture scene must use authentic external captures, never a drawn mockup as a substitute for the actual product.

Verify:

- File existence and readability.
- Supported formats and valid content.
- Safe path resolution and path traversal prevention.
- Correct video decoding and image handling.
- Trim, seek, frame timing, and final-frame behavior.
- Missing-asset errors occurring before frame rendering.
- Clear error messages that include the required asset ID, expected filename, product route, and timeline location.
- Reliable behavior in both preview and final export.
- Tests for missing, invalid, unsupported, and valid captures.

Automatically inspect all repository manifests and capture configuration to discover which external assets are needed. Produce a manifest of missing captures with exact filenames, target routes, minimum durations, and required screen states.
Use the configured capture directory and existing environment variables. Do not hardcode a developer-specific absolute Windows path.
Never attempt to bypass authentication, extract credentials, or fabricate product screenshots. If the actual dashboard requires the owner to log in and record a screen, that is a genuine external dependency. Complete all other work without waiting for it.
Do not ask the owner to send paths that you can derive from the repository's capture manifest or configuration.

## 6. Reel 94 / L1.05: complete the implementation

Inspect and complete the current Reel 94 rather than rebuilding it blindly.
Requirements:

- Runtime strictly greater than 30 seconds.
- The approved three-question educational concept.
- Natural, accurate Persian wording.
- No fabricated product features, financial claims, or misleading results.
- No duplicate spoken text or subtitle treatment where prohibited by project rules.
- At least one genuine product capture unless an explicit project-owner-approved exception exists.
- A deliberate opening, informative middle, authentic product moment, and clear CTA.
- A meaningful ending and loop only if the loop supports the concept.
- All required registry, index, ledger, prompt, scenario, and asset-manifest updates.
- Compliance with all existing typography, transition, audio, safe-area, licensing, and editorial rules.

Inspect the actual product to determine whether the three questions can be answered by the existing product. Do not assume the existence of features just because a URL or route name appears in a plan.
If a capture is missing, finish the code and tests anyway, then report the exact external capture still required. Do not claim a fully rendered or production-ready reel while that asset is absent.

## 7. Continue the remaining representative scenarios

Discover the five scenario definitions and their authoritative plan mappings from the repository. Do not ask the owner to supply mappings that already exist in project documents.
Continue in this order unless the project's actual dependencies establish a better order:

1. L1.05 — three-question educational reel.
2. The single-workflow authentic product demonstration.
3. The illustrative financial mini-lesson.
4. The two-method comparison.
5. The human/documentary business-owner story.

For each scenario:

- Create a complete Editing Blueprint using the required 11-column timeline table and sections A–H from the editing specification.
- Keep the design language genuinely distinct from the other reels.
- Use the actual product interface wherever required.
- Clearly distinguish real footage from motion-graphics reconstruction.
- Preserve fa and af variants with their separate language conventions and numerals as specified by the project.
- Keep recording files external to Git and use a proper asset manifest.
- Meet the global runtime requirement of more than 30 seconds.
- Add tests and registry integration using the established architecture.

If footage is not available, complete the motion-only parts and mark the footage-dependent gate explicitly. Do not present motion graphics as real footage.

## 8. No invented information or unsupported success claims

Never fabricate:

- Product features.
- Product screens or data.
- Financial figures presented as real results.
- Customer testimonials.
- Performance claims.
- Licensing permissions.
- Source files or completed tests.

Clearly label illustrative financial values as illustrative. Inspect actual product code and available screens before writing feature-specific copy.
If a creative decision depends on information the repository cannot establish, make the safest reversible choice, document the assumption, and continue.

## 9. Test and verify the entire system

Run the project's actual commands for:

- Type checking.
- Linting.
- Unit and integration tests.
- Scene and timeline validation.
- Reel registry and ledger consistency.
- Licensing checks.
- Missing-asset gates.
- Runtime enforcement.
- Preview rendering.
- Export validation.

Use the repository's actual package manager and scripts. Do not invent test commands or claim to have run a background process that has not completed.
Export representative reels without missing dependencies. For reels that require external captures, verify the missing-asset gate and separately verify successful export once a valid capture is available.
Inspect rendered output when the preview/export environment permits it. Type checking alone is not visual verification.
Report the exact commands run, their observed results, and any remaining blockers.

## 10. Owner-input policy

Do not stop and ask the owner to choose between implementation steps when the repository and requirements already determine a safe order.
Do not ask the owner to:

- Find source files.
- Identify the next reel number.
- Explain existing architecture.
- Map scenarios already documented in the plan.
- Provide file paths already derivable from configuration.
- Approve routine, reversible engineering decisions.

Proceed autonomously on all repository-contained work.
Ask for owner input only when a genuinely unavailable external fact or action is necessary, such as:

- Recording an authenticated screen that requires the owner's login.
- Providing legally required footage or explicit licensing permission that cannot be established.
- Confirming a financial/product claim that cannot be verified from the code or approved documentation.
- Approving an explicitly owner-controlled policy change.

Group those requests into one concise, actionable list. Do not let one missing capture block independent coding, testing, documentation, catalogue work, or other reels.

## 11. Final deliverables

Create or update the project's existing documentation structure with:

1. A verified current-state report.
2. A runtime audit covering all 94 reels.
3. A reusable motion asset catalogue and machine-readable registry.
4. A missing-capture manifest.
5. Completed Reel 94 implementation and tests.
6. Completed scenario blueprints and accurate implementation statuses.
7. A project-wide validation report.
8. A concise list of only the external inputs still required.

Keep the existing architecture, repository conventions, and source files intact wherever possible. Do not create duplicate documentation if an equivalent authoritative document already exists; update the existing source of truth.

## Definition of done

The task is complete only when:

- Repository state has been discovered rather than guessed.
- All 94 reels have been audited for duration.
- The `> 30 seconds` requirement is enforced.
- Reel 94 has been expanded and verified, with external captures clearly gated.
- Reusable motion source and timeline components have been catalogued for all reels that actually contain them.
- The representative scenario work has advanced without repeatedly asking the owner for discoverable information.
- Automated tests and validation have been run and reported accurately.
- Any remaining human work is explicitly external, minimal, and documented.

Start by inspecting the repository and continue through implementation. Do not respond with a plan alone. Execute the work until a real external dependency or a meaningful safety constraint prevents further progress.
