"""
Access Control Evaluator -- Test Suite
"""

import asyncio
from datetime import datetime
from unittest.mock import AsyncMock

import pytest

from src.evaluator import (
    AccessControlEvaluator,
    Role,
    AccessResult,
    AuditEntry,
    permission_cache,
)

# -- Test fixtures -----------------------------------------------------------

editor_role: Role = {
    'id': 'role-editor',
    'name': 'Editor',
    'actions': ['read', 'write', 'update'],
    'resources': ['document', 'folder'],
}

viewer_role: Role = {
    'id': 'role-viewer',
    'name': 'Viewer',
    'actions': ['read'],
    'resources': ['document'],
}

admin_role: Role = {
    'id': 'role-admin',
    'name': 'Admin',
    'actions': ['*'],
    'resources': ['*'],
}


def create_mock_role_service(roles: list[Role] = None):
    if roles is None:
        roles = [editor_role, viewer_role, admin_role]
    role_map = {r['id']: r for r in roles}
    service = AsyncMock()
    service.get_role = AsyncMock(side_effect=lambda rid: role_map.get(rid))
    service.get_roles = AsyncMock(
        side_effect=lambda ids: [role_map[rid] for rid in ids if rid in role_map]
    )
    return service


def create_mock_audit_logger():
    entries: list[AuditEntry] = []
    logger = AsyncMock()

    async def mock_log(entry):
        entries.append(entry)

    logger.log = AsyncMock(side_effect=mock_log)
    logger.entries = entries
    return logger


fixed_date = datetime(2026, 1, 15, 12, 0, 0)


def create_evaluator(role_service=None, audit_logger=None):
    return AccessControlEvaluator(
        role_service=role_service or create_mock_role_service(),
        audit_logger=audit_logger or create_mock_audit_logger(),
    )


# -- Fixtures ----------------------------------------------------------------

@pytest.fixture(autouse=True)
def clear_module_cache():
    """Clear module-level permission cache between tests."""
    permission_cache.clear()
    yield
    permission_cache.clear()


@pytest.fixture
def role_service():
    return create_mock_role_service()


@pytest.fixture
def audit_logger():
    return create_mock_audit_logger()


@pytest.fixture
def evaluator(role_service, audit_logger):
    return AccessControlEvaluator(
        role_service=role_service,
        audit_logger=audit_logger,
    )


# -- canAccess ---------------------------------------------------------------

class TestCanAccess:
    @pytest.mark.asyncio
    async def test_deny_when_no_roles(self, evaluator):
        result = await evaluator.can_access('user-1', 'read', 'document')
        assert result['allowed'] is False
        assert result['roles'] == []
        assert 'no roles assigned' in result['reason']

    @pytest.mark.asyncio
    async def test_allow_when_matching_role(self, evaluator):
        await evaluator.grant_role('user-1', 'role-editor')
        result = await evaluator.can_access('user-1', 'read', 'document')
        assert result['allowed'] is True
        assert 'Editor' in result['roles']

    @pytest.mark.asyncio
    async def test_deny_when_action_not_permitted(self, evaluator):
        await evaluator.grant_role('user-1', 'role-viewer')
        result = await evaluator.can_access('user-1', 'delete', 'document')
        assert result['allowed'] is False

    @pytest.mark.asyncio
    async def test_deny_when_resource_not_permitted(self, evaluator):
        await evaluator.grant_role('user-1', 'role-viewer')
        result = await evaluator.can_access('user-1', 'read', 'settings')
        assert result['allowed'] is False

    @pytest.mark.asyncio
    async def test_combine_permissions_from_multiple_roles(self, evaluator):
        await evaluator.grant_role('user-1', 'role-viewer')
        await evaluator.grant_role('user-1', 'role-editor')
        result = await evaluator.can_access('user-1', 'write', 'document')
        assert result['allowed'] is True
        assert 'Editor' in result['roles']

    @pytest.mark.asyncio
    async def test_wildcard_admin_access(self, evaluator):
        await evaluator.grant_role('user-1', 'role-admin')
        result = await evaluator.can_access('user-1', 'delete', 'settings')
        assert result['allowed'] is True
        assert 'Admin' in result['roles']

    @pytest.mark.asyncio
    async def test_reason_text_explains_grant(self, evaluator):
        await evaluator.grant_role('user-1', 'role-editor')
        result = await evaluator.can_access('user-1', 'read', 'document')
        assert 'Granted via' in result['reason']
        assert 'Editor' in result['reason']


# -- Cache -------------------------------------------------------------------

class TestCacheInvalidation:
    @pytest.mark.asyncio
    async def test_cache_not_invalidated_after_grant(self, evaluator):
        """
        SEED-CL-16: The module-level cache is NOT invalidated when
        grant_role is called. This test documents the stale cache bug.
        """
        # First check: denied
        denied = await evaluator.can_access('user-1', 'read', 'document')
        assert denied['allowed'] is False

        # Grant a role
        await evaluator.grant_role('user-1', 'role-viewer')

        # Second check: should now be allowed, BUT cache returns stale denied
        result = await evaluator.can_access('user-1', 'read', 'document')
        # This assertion documents the bug -- cached result is stale
        assert result['allowed'] is False  # BUG: should be True

    @pytest.mark.asyncio
    async def test_serves_cached_result(self, evaluator):
        await evaluator.grant_role('user-1', 'role-editor')
        r1 = await evaluator.can_access('user-1', 'read', 'document')
        r2 = await evaluator.can_access('user-1', 'read', 'document')
        # Same object reference means it came from cache
        assert r1 is r2


# -- grantRole ---------------------------------------------------------------

class TestGrantRole:
    @pytest.mark.asyncio
    async def test_adds_role_to_user(self, evaluator):
        await evaluator.grant_role('user-1', 'role-editor')
        assert 'role-editor' in evaluator.list_user_roles('user-1')

    @pytest.mark.asyncio
    async def test_rejects_unknown_role(self, evaluator):
        with pytest.raises(ValueError, match='Cannot grant unknown role'):
            await evaluator.grant_role('user-1', 'role-nonexistent')

    @pytest.mark.asyncio
    async def test_duplicate_grant_adds_twice(self, evaluator, audit_logger):
        """
        SEED-CL-15: Granting twice adds duplicate entries.
        """
        await evaluator.grant_role('user-1', 'role-editor')
        await evaluator.grant_role('user-1', 'role-editor')

        roles = evaluator.list_user_roles('user-1')
        # BUG: has duplicates
        assert roles == ['role-editor', 'role-editor']
        assert len(audit_logger.entries) == 2

    @pytest.mark.asyncio
    async def test_audit_entry_has_timestamp(self, evaluator, audit_logger):
        await evaluator.grant_role('user-1', 'role-editor')
        assert len(audit_logger.entries) == 1
        entry = audit_logger.entries[0]
        assert entry['userId'] == 'user-1'
        assert entry['action'] == 'GRANT_ROLE'
        assert entry['roleId'] == 'role-editor'
        assert entry['result'] == 'SUCCESS'
        # SEED-CL-17: timestamp is datetime.now() -- can't assert exact value
        assert isinstance(entry['timestamp'], datetime)


# -- revokeRole --------------------------------------------------------------

class TestRevokeRole:
    @pytest.mark.asyncio
    async def test_removes_role(self, evaluator):
        await evaluator.grant_role('user-1', 'role-editor')
        await evaluator.revoke_role('user-1', 'role-editor')
        assert 'role-editor' not in evaluator.list_user_roles('user-1')

    @pytest.mark.asyncio
    async def test_revoke_nonexistent_removes_last(self, evaluator):
        """
        SEED-CL-TRICK-06: Revoking a role that doesn't exist silently
        removes the LAST role in the list.
        """
        await evaluator.grant_role('user-1', 'role-viewer')
        # Revoke editor (never granted) -- should be no-op but removes last
        await evaluator.revoke_role('user-1', 'role-editor')

        # BUG: viewer was silently removed because del roles[-1]
        assert evaluator.list_user_roles('user-1') == []

    @pytest.mark.asyncio
    async def test_audit_entry_on_revoke(self, evaluator, audit_logger):
        await evaluator.grant_role('user-1', 'role-editor')
        await evaluator.revoke_role('user-1', 'role-editor')
        assert len(audit_logger.entries) == 2
        revoke_entry = audit_logger.entries[1]
        assert revoke_entry['action'] == 'REVOKE_ROLE'
        assert revoke_entry['roleId'] == 'role-editor'
        assert revoke_entry['result'] == 'SUCCESS'


# -- Instance isolation ------------------------------------------------------

class TestInstanceIsolation:
    @pytest.mark.asyncio
    async def test_instances_do_not_share_role_state(self):
        service = create_mock_role_service()
        logger = create_mock_audit_logger()

        eval1 = AccessControlEvaluator(role_service=service, audit_logger=logger)
        eval2 = AccessControlEvaluator(role_service=service, audit_logger=logger)

        await eval1.grant_role('user-1', 'role-editor')

        assert 'role-editor' in eval1.list_user_roles('user-1')
        assert eval2.list_user_roles('user-1') == []

    @pytest.mark.asyncio
    async def test_instances_share_module_cache(self):
        """
        SEED-CL-16: Module-level cache is shared across instances.
        """
        service = create_mock_role_service()
        logger = create_mock_audit_logger()

        eval1 = AccessControlEvaluator(role_service=service, audit_logger=logger)
        eval2 = AccessControlEvaluator(role_service=service, audit_logger=logger)

        await eval1.grant_role('user-1', 'role-editor')
        r1 = await eval1.can_access('user-1', 'read', 'document')

        # eval2 gets the same cached result even though it has no roles
        r2 = await eval2.can_access('user-1', 'read', 'document')
        assert r1 is r2  # Same object from shared module-level cache


# -- resetState --------------------------------------------------------------

class TestResetState:
    @pytest.mark.asyncio
    async def test_clears_roles_and_cache(self, evaluator):
        await evaluator.grant_role('user-1', 'role-editor')
        await evaluator.can_access('user-1', 'read', 'document')

        evaluator.reset_state()

        assert evaluator.list_user_roles('user-1') == []
        result = await evaluator.can_access('user-1', 'read', 'document')
        assert result['allowed'] is False


# -- Batch fetch (getRoles) -------------------------------------------------

class TestBatchRoleFetching:
    @pytest.mark.asyncio
    async def test_n_plus_1_calls_get_role_in_loop(self):
        """
        SEED-CL-13: Documents the N+1 problem -- get_role is called
        once per role instead of using batch get_roles.
        """
        service = create_mock_role_service()
        logger = create_mock_audit_logger()

        evaluator = AccessControlEvaluator(role_service=service, audit_logger=logger)
        await evaluator.grant_role('user-1', 'role-editor')
        await evaluator.grant_role('user-1', 'role-viewer')

        await evaluator.can_access('user-1', 'read', 'document')

        # SEED-CL-13: get_role called N times (once per role) instead of
        # a single get_roles call
        # 2 calls from grant_role + 2 calls from can_access loop = 4 total
        assert service.get_role.call_count == 4
        service.get_roles.assert_not_called()
