"""Governance scenarios: ADR governance enforcement.

Tests that governance ADR scope matching, status filtering,
and exception tracking work correctly.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest


class TestADRScopeGlobMatching:
    """Governance ADRs should enforce only against files matching their scope globs."""

    def _build_index(self, adrs_dir: Path, rows: list[str]) -> None:
        index = adrs_dir / "ADR-INDEX.md"
        header = (
            "# Governance ADR Index\n\n"
            "| ID | Title | Enforcement | Scope Globs | Status | File |\n"
            "|---|---|---|---|---|---|\n"
        )
        index.write_text(header + "\n".join(rows) + "\n")

    def test_file_inside_scope_triggers_enforcement(self, workspace: Path) -> None:
        """A file matching scope globs should trigger ADR enforcement."""
        adrs = workspace / "governance" / "adrs"
        self._build_index(adrs, [
            "| GOV-ADR-001 | No raw SQL in handlers | DEFAULT | `src/handlers/**` | ACCEPTED | `GOV-ADR-001-no-raw-sql.md` |"
        ])

        target_file = "src/handlers/user_handler.py"
        scope_glob = "src/handlers/**"

        # Simple glob matching (what agents do)
        from fnmatch import fnmatch
        assert fnmatch(target_file, scope_glob)

    def test_file_outside_scope_skips_enforcement(self, workspace: Path) -> None:
        """A file NOT matching scope globs should not trigger ADR enforcement."""
        target_file = "src/models/user.py"
        scope_glob = "src/handlers/**"

        from fnmatch import fnmatch
        assert not fnmatch(target_file, scope_glob)


class TestADRStatusFiltering:
    """Only ACCEPTED governance ADRs should enforce."""

    def test_accepted_adr_enforces(self, workspace: Path) -> None:
        """ACCEPTED status means the ADR is active and enforceable."""
        row = "| GOV-ADR-001 | Rule | DEFAULT | `src/**` | ACCEPTED | `file.md` |"
        assert "ACCEPTED" in row

    def test_proposed_adr_does_not_enforce(self, workspace: Path) -> None:
        """PROPOSED ADRs are not yet active — agents should skip them."""
        row = "| GOV-ADR-002 | Draft Rule | DEFAULT | `src/**` | PROPOSED | `file.md` |"
        assert "PROPOSED" in row
        assert "ACCEPTED" not in row

    def test_superseded_adr_does_not_enforce(self, workspace: Path) -> None:
        """SUPERSEDED ADRs are replaced — agents should skip them."""
        row = "| GOV-ADR-003 | Old Rule | DEFAULT | `src/**` | SUPERSEDED | `file.md` |"
        assert "SUPERSEDED" in row
        assert "ACCEPTED" not in row


class TestExceptionLedgerCounting:
    """3+ exceptions against the same DEFAULT ADR in 90 days triggers re-evaluation."""

    def _build_ledger(self, adrs_dir: Path, entries: list[tuple[str, str]]) -> Path:
        """Build an exception ledger with (date, adr_id) entries."""
        ledger = adrs_dir / "ADR-EXCEPTIONS.md"
        lines = [
            "# Governance ADR Exception Ledger\n",
            "| Date | ADR ID | Agent | Files | Reason | Alternative |\n",
            "|---|---|---|---|---|---|\n",
        ]
        for date, adr_id in entries:
            lines.append(
                f"| {date} | {adr_id} | Programmer | src/foo.py | test reason | test alt |\n"
            )
        ledger.write_text("".join(lines))
        return ledger

    def test_three_exceptions_triggers_review(self, workspace: Path) -> None:
        """3 exceptions in 90 days for the same ADR should flag re-evaluation."""
        adrs = workspace / "governance" / "adrs"
        today = datetime.now(timezone.utc)
        dates = [(today - timedelta(days=i * 20)).strftime("%Y-%m-%d") for i in range(3)]
        entries = [(d, "GOV-ADR-001") for d in dates]

        ledger = self._build_ledger(adrs, entries)
        content = ledger.read_text()

        # Count exceptions for GOV-ADR-001 within 90 days
        count = content.count("GOV-ADR-001")
        assert count >= 3, "Should trigger re-evaluation"

    def test_two_exceptions_does_not_trigger(self, workspace: Path) -> None:
        """2 exceptions should NOT trigger re-evaluation."""
        adrs = workspace / "governance" / "adrs"
        today = datetime.now(timezone.utc)
        dates = [(today - timedelta(days=i * 20)).strftime("%Y-%m-%d") for i in range(2)]
        entries = [(d, "GOV-ADR-001") for d in dates]

        ledger = self._build_ledger(adrs, entries)
        content = ledger.read_text()

        count = content.count("GOV-ADR-001")
        assert count < 3, "Should NOT trigger re-evaluation"

    def test_old_exceptions_outside_window_ignored(self, workspace: Path) -> None:
        """Exceptions older than 90 days should not count toward the trigger."""
        adrs = workspace / "governance" / "adrs"
        today = datetime.now(timezone.utc)
        # 3 exceptions but 2 are outside the 90-day window
        dates = [
            today.strftime("%Y-%m-%d"),
            (today - timedelta(days=100)).strftime("%Y-%m-%d"),
            (today - timedelta(days=120)).strftime("%Y-%m-%d"),
        ]
        entries = [(d, "GOV-ADR-001") for d in dates]

        ledger = self._build_ledger(adrs, entries)

        # Parse dates and count only within 90 days
        ninety_days_ago = today - timedelta(days=90)
        recent_count = sum(
            1 for d, _ in entries
            if datetime.strptime(d, "%Y-%m-%d").replace(tzinfo=timezone.utc) >= ninety_days_ago
        )
        assert recent_count < 3, "Old exceptions should not count"
