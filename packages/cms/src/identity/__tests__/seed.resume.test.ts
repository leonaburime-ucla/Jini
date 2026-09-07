import assert from "node:assert/strict";
import { test } from "vitest";

import { Argon2PasswordHasher } from "../hasher.js";
import {
  InMemoryPolicyPermissionRepo,
  InMemoryPolicyRepo,
  InMemoryPrincipalPolicyRepo,
  InMemoryPrincipalRepo,
  InMemoryPrincipalRoleRepo,
  InMemoryRolePolicyRepo,
  InMemoryRoleRepo,
  InMemorySessionRepo,
  InMemoryUserRepo,
} from "../repo.memory.js";
import { seedIdentity, type SeedIdentityDeps } from "../seed.js";
import type { IdentityRepos } from "../ports.js";
import type { PolicyRecord, RoleRecord } from "../types.js";

/**
 * @file `seedIdentity` must be RESUMABLE, not merely re-entrant.
 *
 * The defect these tests pin: `seedIdentity`'s only idempotency guard is "does the owner user
 * exist". That guard is correct for a seed that ran to completion and wrong for one that did not.
 * A host kicks the seed off without awaiting it (Tovu's `features/identity/wiring.ts` hands the
 * promise back as `identityReady`), so any process that exits before the seed's argon2-gated final
 * step — a fast-failing CLI command, a Ctrl-C, a crash — leaves roles/policies written and no owner
 * user. The next boot's guard sees no owner user, replays the seed from the top, and re-inserts a
 * role that is already there.
 *
 * Verified against the real product path before this file was written (Tovu @ content.db, SQLite):
 *   boot 1  `tovu init <dir>`                       -> roles: 0 rows (init does not seed identity)
 *   boot 2  `tovu export <dir> --out <non-empty>`   -> exits 3 mid-seed; leaves roles: 1 row
 *                                                      ('owner'), policies: 0, identity_users: 0
 *   boot 3  `tovu export <dir> --out <dir> --clean` -> SqliteError: UNIQUE constraint failed:
 *                                                      roles.workspace_id, roles.name
 * Nothing is special about "three": boot 2 is the first boot that CREATES the partial state and
 * boot 3 is the first that trips over it.
 *
 * Why two flavours of repo below. The stock in-memory repos key `save` on `(workspaceId, id)`, and
 * the seed mints a fresh random id per call, so against them a replay does not throw — it silently
 * appends a SECOND role named "owner". The real stores carry `UNIQUE(workspace_id, name)` on both
 * `roles` and `policies` (read out of a live db: `idx_roles_workspace_name`,
 * `idx_policies_workspace_name`), so there the same replay throws. Both outcomes are wrong and this
 * file asserts against both, because a fix that only stops the throw would leave the duplicate-row
 * half of the bug in place on the in-memory adapter.
 */

const WORKSPACE = "workspace-1";
const SEED_OWNER_PASSWORD = "seed-owner-pw";
const BUILTIN_ROLE_NAMES = ["owner", "admin", "editor", "viewer"] as const;

const fixedClock = { nowIso: () => "2026-07-10T00:00:00.000Z" };

/** Distinct per instance so a replay cannot accidentally re-mint the ids the aborted run used. */
function uniqueIdGen(prefix: string) {
  let n = 0;
  return { newId: () => `${prefix}-${++n}` };
}

/** Mirrors the real `idx_roles_workspace_name` UNIQUE index that the stock in-memory repo lacks. */
class UniqueNameRoleRepo extends InMemoryRoleRepo {
  override async save(record: RoleRecord): Promise<void> {
    const clash = await this.findByName({ workspaceId: record.workspaceId, name: record.name });
    if (clash && clash.id !== record.id) {
      throw new Error(`UNIQUE constraint failed: roles.workspace_id, roles.name`);
    }
    await super.save(record);
  }
}

/** Mirrors the real `idx_policies_workspace_name` UNIQUE index. */
class UniqueNamePolicyRepo extends InMemoryPolicyRepo {
  override async save(record: PolicyRecord): Promise<void> {
    const clash = await this.findByName({ workspaceId: record.workspaceId, name: record.name });
    if (clash && clash.id !== record.id) {
      throw new Error(`UNIQUE constraint failed: policies.workspace_id, policies.name`);
    }
    await super.save(record);
  }
}

function buildRepos(required: { enforceUniqueNames: boolean }): IdentityRepos {
  return {
    principals: new InMemoryPrincipalRepo(),
    users: new InMemoryUserRepo(),
    sessions: new InMemorySessionRepo(),
    roles: required.enforceUniqueNames ? new UniqueNameRoleRepo() : new InMemoryRoleRepo(),
    policies: required.enforceUniqueNames ? new UniqueNamePolicyRepo() : new InMemoryPolicyRepo(),
    policyPermissions: new InMemoryPolicyPermissionRepo(),
    rolePolicies: new InMemoryRolePolicyRepo(),
    principalRoles: new InMemoryPrincipalRoleRepo(),
    principalPolicies: new InMemoryPrincipalPolicyRepo(),
  };
}

function depsOver(repos: IdentityRepos, idPrefix: string): SeedIdentityDeps {
  return {
    repos,
    // Real argon2id at test-only cost params, matching `seed.test.ts`'s own convention.
    hasher: new Argon2PasswordHasher({ memoryCost: 8, timeCost: 1, parallelism: 1 }),
    clock: fixedClock,
    idGen: uniqueIdGen(idPrefix),
  };
}

const seedInput = { workspaceId: WORKSPACE, ownerPassword: SEED_OWNER_PASSWORD };

/**
 * Drive the REAL seed until it dies partway, exactly as an interrupted first boot does, rather
 * than hand-writing the partial rows.
 *
 * `at` picks WHICH write the abort lands on, because the two partial shapes that matter are
 * reached at different points: dying on a `policies.save` leaves a role with no policy, dying on a
 * `policyPermissions.save` leaves a policy with no permissions. `{ repo: "policies", after: 0 }`
 * reproduces the state observed live on Tovu — the 'owner' role row written, nothing after it.
 */
async function seedThenAbort(
  repos: IdentityRepos,
  at: { repo: "policies" | "policyPermissions"; after: number }
): Promise<void> {
  const target = repos[at.repo];
  const realSave = target.save.bind(target);
  let saves = 0;
  // One seam standing in for two different record shapes, hence the widened parameter.
  target.save = async (record: never) => {
    if (saves++ >= at.after) throw new Error("simulated process exit mid-seed");
    await realSave(record);
  };
  await assert.rejects(
    seedIdentity({ deps: depsOver(repos, "aborted"), input: seedInput }),
    /simulated process exit mid-seed/,
    "the fixture itself must abort the first seed — otherwise there is no partial state to resume"
  );
  target.save = realSave;
}

test("an interrupted first seed leaves a partial state the next boot can still finish (real-store UNIQUE names)", async () => {
  const repos = buildRepos({ enforceUniqueNames: true });
  await seedThenAbort(repos, { repo: "policies", after: 0 });

  // Precondition: this is the exact shape observed live — one role, no policies, no owner user.
  assert.deepEqual(
    (await repos.roles.list({ workspaceId: WORKSPACE })).map((r) => r.name),
    ["owner"],
    "fixture precondition: the aborted run wrote exactly the 'owner' role"
  );
  assert.equal((await repos.users.findByUsername({ workspaceId: WORKSPACE, username: "admin" })), null);

  // The next boot. Today this throws `UNIQUE constraint failed: roles.workspace_id, roles.name`.
  await seedIdentity({ deps: depsOver(repos, "resumed"), input: seedInput });

  const roles = await repos.roles.list({ workspaceId: WORKSPACE });
  assert.deepEqual(
    [...roles.map((r) => r.name)].sort(),
    [...BUILTIN_ROLE_NAMES].sort(),
    "the resumed boot must end with exactly the four built-in roles"
  );
  const owner = await repos.users.findByUsername({ workspaceId: WORKSPACE, username: "admin" });
  assert.ok(owner, "the resumed boot must finish the job it is replaying: the owner user now exists");

  // The owner's ENTIRE authority is the wildcard on its built-in policy, and the aborted run died
  // before writing it. A resume that recreated the role but not this grant would leave a site whose
  // owner can do nothing — quiet, and worse than the crash it replaced.
  const ownerRole = await repos.roles.findByName({ workspaceId: WORKSPACE, name: "owner" });
  const ownerLinks = await repos.rolePolicies.listByRoleId({ workspaceId: WORKSPACE, roleId: ownerRole!.id });
  assert.equal(ownerLinks.length, 1, "the owner role must be bound to exactly one policy");
  const ownerPerms = await repos.policyPermissions.listByPolicyId({
    workspaceId: WORKSPACE,
    policyId: ownerLinks[0]!.policyId,
  });
  assert.deepEqual(
    ownerPerms.map((p) => p.permission),
    ["*"],
    "the owner policy must hold the wildcard, exactly once, after a resume"
  );

  // And the owner user must actually be bound to that role, not merely exist alongside it.
  const ownerGrants = await repos.principalRoles.listByPrincipalId({
    workspaceId: WORKSPACE,
    principalId: owner!.principalId,
  });
  assert.deepEqual(
    ownerGrants.map((g) => g.roleId),
    [ownerRole!.id],
    "the resumed owner user must hold the owner role exactly once"
  );
});

test("resuming an interrupted seed does not duplicate rows the aborted run already wrote", async () => {
  // Stock in-memory repos: no UNIQUE(workspace_id, name), so the replay does not throw here — it
  // silently appends duplicates. This is the half of the defect a throw-only fix would leave behind.
  const repos = buildRepos({ enforceUniqueNames: false });
  await seedThenAbort(repos, { repo: "policies", after: 2 }); // owner + admin written; editor's policy save dies

  await seedIdentity({ deps: depsOver(repos, "resumed"), input: seedInput });

  const roleNames = (await repos.roles.list({ workspaceId: WORKSPACE })).map((r) => r.name);
  assert.equal(roleNames.length, new Set(roleNames).size, `duplicate role rows after resume: ${roleNames}`);
  assert.deepEqual([...roleNames].sort(), [...BUILTIN_ROLE_NAMES].sort());

  const policyNames = (await repos.policies.list({ workspaceId: WORKSPACE })).map((p) => p.name);
  assert.equal(policyNames.length, new Set(policyNames).size, `duplicate policy rows after resume: ${policyNames}`);

  for (const role of await repos.roles.list({ workspaceId: WORKSPACE })) {
    const links = await repos.rolePolicies.listByRoleId({ workspaceId: WORKSPACE, roleId: role.id });
    assert.equal(links.length, 1, `role '${role.name}' must hold exactly one policy link, got ${links.length}`);

    const perms = await repos.policyPermissions.listByPolicyId({
      workspaceId: WORKSPACE,
      policyId: links[0]!.policyId,
    });
    const strings = perms.map((p) => p.permission);
    assert.equal(
      strings.length,
      new Set(strings).size,
      `duplicate policy_permissions on '${role.name}': ${strings.filter((s, i) => strings.indexOf(s) !== i)}`
    );
  }

  // `principals` has no unique name index either, so a replay can mint a second "system" principal
  // and leave `seedIdentity`'s own early-return branch picking between two of them arbitrarily.
  const system = (await repos.principals.list({ workspaceId: WORKSPACE })).filter(
    (p) => p.kind === "system" && p.id !== "user-local"
  );
  assert.equal(system.length, 1, "exactly one non-legacy system principal must exist after a resume");
});

test("a resumed seed still converges a built-in policy that is missing permissions", async () => {
  const repos = buildRepos({ enforceUniqueNames: true });
  // Abort on the 2nd permission write: the owner wildcard has landed and the admin policy ROW
  // exists, but the admin permission loop never got to run.
  await seedThenAbort(repos, { repo: "policyPermissions", after: 1 });

  const adminPolicy = await repos.policies.findByName({ workspaceId: WORKSPACE, name: "admin-builtin-policy" });
  assert.ok(adminPolicy, "fixture precondition: the aborted run created the admin policy row");
  assert.deepEqual(
    await repos.policyPermissions.listByPolicyId({ workspaceId: WORKSPACE, policyId: adminPolicy.id }),
    [],
    "fixture precondition: it died before writing that policy's permissions"
  );

  await seedIdentity({ deps: depsOver(repos, "resumed"), input: seedInput });

  const perms = await repos.policyPermissions.listByPolicyId({ workspaceId: WORKSPACE, policyId: adminPolicy.id });
  assert.ok(
    perms.some((p) => p.permission === "content.write"),
    "the resume must fill in the permissions the aborted run never wrote, not just skip the existing role"
  );
  assert.ok(perms.some((p) => p.permission === "settings.read"));
});

test("a resumed seed refuses to adopt a pre-existing NON-built-in role of the same name", async () => {
  // An idempotent seed must not paper over a genuine name collision: a role an operator created
  // themselves must never be silently promoted into the built-in set (it would inherit the
  // built-in policy's permissions, which is a privilege escalation, not a convergence).
  const repos = buildRepos({ enforceUniqueNames: true });
  await repos.roles.save({ id: "operator-made", workspaceId: WORKSPACE, name: "admin", isBuiltin: false });

  await assert.rejects(
    seedIdentity({ deps: depsOver(repos, "fresh"), input: seedInput }),
    /seedIdentity: a non-built-in role named 'admin' already exists/,
    "seeding must fail loudly on a non-built-in role squatting a built-in name"
  );

  const squatter = await repos.roles.findByName({ workspaceId: WORKSPACE, name: "admin" });
  assert.equal(squatter?.id, "operator-made", "the operator's own role must be left exactly as it was");
  assert.equal(squatter?.isBuiltin, false, "and must not have been flipped to built-in");
});

test("a resumed seed refuses to adopt a pre-existing NON-built-in policy of the same name", async () => {
  // The policy-side twin of the guard above. Reachable the same way: nothing stops an operator
  // naming a policy of their own 'editor-builtin-policy', and adopting it would bind the built-in
  // editor role to a permission set nobody vetted.
  const repos = buildRepos({ enforceUniqueNames: true });
  await repos.policies.save({
    id: "operator-made-policy",
    workspaceId: WORKSPACE,
    name: "editor-builtin-policy",
    isBuiltin: false,
    isFrozen: false,
  });

  await assert.rejects(
    seedIdentity({ deps: depsOver(repos, "fresh"), input: seedInput }),
    /seedIdentity: a non-built-in policy named 'editor-builtin-policy' already exists/,
    "seeding must fail loudly on a non-built-in policy squatting a built-in policy name"
  );

  const squatter = await repos.policies.findByName({ workspaceId: WORKSPACE, name: "editor-builtin-policy" });
  assert.equal(squatter?.id, "operator-made-policy", "the operator's own policy must be untouched");
  assert.equal(squatter?.isBuiltin, false, "and must not have been flipped to built-in");
  assert.deepEqual(
    await repos.policyPermissions.listByPolicyId({ workspaceId: WORKSPACE, policyId: "operator-made-policy" }),
    [],
    "and must not have been granted the built-in editor permission set"
  );
});
