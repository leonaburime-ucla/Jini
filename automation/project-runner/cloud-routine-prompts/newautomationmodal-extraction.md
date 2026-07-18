# Cloud prompt — `NewAutomationModal.tsx` schedule-picker + mention-autocomplete (Claude Code)

Replaces the earlier "just lift one hook" 3:50 AM slot with something more substantial: two real,
independently-reusable generic primitives from one file, matching the byok/McpClientSection
precedent (small-slice, not full-file).

```text
You are working in the Jini repository. Your task is to extract TWO
generic primitives from Open Design's NewAutomationModal.tsx into @jini/ui:
a recurring-schedule editor and a mention/capability-autocomplete widget.
Work only on this task's branch and finish with a draft PR; never push
directly to main.

Before editing any file, complete and print this exact Reference Preflight:

1. Read docs/jini-port/god-components-extraction-plan.md's "Consolidation
   map" section and quote the exact row(s) covering NewAutomationModal.tsx
   -- filed under Section B, targets features/schedule-picker/
   (RecurringSchedulePicker) and features/mention-autocomplete/
   (MentionAutocomplete). Also note the "5 more overlaps spotted" list in
   that same section -- it flags a possible 3-way overlap between
   QuickSwitcher.tsx, THIS file's mention/capability-picker, and
   composer/*'s Lexical @mention system. Check whether
   packages/ui/src/features/mention-autocomplete/ or an equivalent already
   exists in this repo before designing this piece from scratch; if it
   doesn't exist yet, ship it here but explicitly flag in source-map.md
   that QuickSwitcher.tsx and the composer/* Lexical mention system should
   be checked against this shape before either is extracted, so a future
   dispatch doesn't ship a second competing "type a trigger, filter a
   list, pick an item" primitive.
2. Jini branch and SHA. This environment has ONE repo source -- the
   vendored snapshot at
   integrations/open-design/reference/components-original/NewAutomationModal.tsx
   is the source of truth.
3. Confirm you read NewAutomationModal.tsx (1,171 lines) in full. Per r6
   section 1.19, roughly a third of the file is reusable pattern wrapped
   in OD data:
   a. RECURRING-SCHEDULE EDITOR (SchedulePopover: kind-tabs + weekday-grid
      + time/timezone-select) -- a generic "cron-lite schedule builder."
      Only the RoutineSchedule type is OD-specific -- design a generic
      schedule-value shape (kind/weekdays/time/timezone) as the type
      parameter/return value instead.
   b. @MENTION/CAPABILITY-PICKER (inline @-token detection, tabbed
      multi-category filtered results, removable chips) -- "a reusable
      mention autocomplete over pluggable capability categories widget,"
      directly analogous to the QuickSwitcher.tsx precedent (see preflight
      step 1). OD-specific only via the capability data types
      (SkillSummary/InstalledPluginRecord/McpServerConfig/ConnectorDetail)
      -- accept a generic {id,label,category,icon?}-shaped item type
      instead, with categories as host-supplied config.
   c. Popover chrome primitives (PillButton, PopoverMenu, PopoverItem) --
      generic, no OD types -- ship as small flat components (or fold into
      whichever of the two features above actually uses them, if they're
      not independently reusable outside this file).
   d. Timezone utilities (detectLocalTimezone, listSupportedTimezones) --
      pure Intl wrappers -- ship as utils.
4. Confirm you read docs/jini-port/recon/r6-god-component-internals.md
   section 1.19 (the full analysis this task is derived from).
5. Name what stays OD-specific: FormState/schedule-building tied to
   Routine contracts, the template-picker content (OD's automation-template
   catalog), the project-target picker, and the form-submit/REST-endpoint
   wiring.
6. Read packages/ui/src/features/connectors/ and
   packages/ui/src/features/progress-card/ as structural examples of the
   ports+dependencies+components+barrel shape and the i18n/Phase-8.5/purity
   discipline expected here -- NOTE: both still use the OLD flat layout;
   this task should use the NEW layout instead (see rule below).
7. Record the exact green-baseline commands you'll re-run at the end.

Read these Jini references before designing the slices:
- AGENTS.md
- docs/jini-port/START-HERE.md
- docs/jini-port/god-components-extraction-plan.md (especially the
  Consolidation map and the i18n/React-layout policy sections near the top)
- docs/jini-port/recon/r6-god-component-internals.md section 1.19
- packages/ui/README.md and packages/ui/source-map.md
- integrations/open-design/reference/dev-skills-original/fixing-open-design-web/SKILL.md

Implementation rules:
- Ship RecurringSchedulePicker and MentionAutocomplete as two separate
  features/<domain>/ slices (schedule-picker/, mention-autocomplete/) --
  they are unrelated interaction patterns that happen to share a source
  file, do not force them into one feature. Use the NEW layout (decided
  2026-07-17, see packages/ui/README.md) for both: types.ts/constants.ts/
  rules.ts/ports.ts (if needed)/index.ts stay at the top level; hooks/ and
  components/ move under a react/ subfolder.
- The popover chrome primitives (PillButton/PopoverMenu/PopoverItem) and
  timezone utils are small enough to ship as flat packages/ui/src/
  components/ and packages/ui/src/utils/ entries if truly standalone, or
  colocated inside whichever feature needs them if they're not
  independently useful outside this file -- use judgment.
- Keep public @jini surfaces product-neutral. Do not add Open Design
  names, imports, or string identities to packages/@jini -- including in
  comments that cite the vendored reference path literally.
- Follow the i18n policy in god-components-extraction-plan.md: every
  user-facing string wired through useT() with the English string as the
  key, verified with a real test mounting under I18nProvider with a
  translated dictionary -- not just that it compiles.
- Apply the Phase 8.5 audit from the fixing-open-design-web SKILL.md on
  every new file.
- Multiple prior extractions in this repo shipped with real, undisclosed
  gaps because source-map.md's "what was dropped" section wasn't checked
  against the recon doc's full description. Before finishing, explicitly
  cross-check every piece you extract against its full description in r6
  section 1.19 -- if you drop or simplify something r6 called generic,
  say so explicitly in source-map.md, do not let it become a silent gap.
- Run the package typecheck/tests, pnpm guard, and a purity grep for
  product-identity strings. Report concrete outputs, not just command
  names.

Finish with a concise summary: the full Reference Preflight output
(including the mention-autocomplete overlap check), files/features shipped
(both primitives + any flat pieces), OD behavior left behind, validation
results, all test/typecheck/guard/purity results, and the draft PR URL (or,
if gh isn't available/authenticated in this environment, the branch name
and a comparison URL for a human to open the PR manually).
```
