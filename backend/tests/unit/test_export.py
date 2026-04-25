"""Unit tests for backend.app.storage.export."""
from __future__ import annotations

import json
import os
import zipfile
from pathlib import Path

import pytest

from backend.app.storage.export import ExportError, export_run_to_zip, import_run_from_zip
from backend.app.storage.ledger import Ledger


# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------

BIG_BANG_ID = "BB_export_test_001"
SCENARIO = "Export test scenario"
CONFIG_SNAPSHOT = {"provider": "openrouter", "model": "openai/gpt-4o"}


def _make_ledger(tmp_path: Path, big_bang_id: str = BIG_BANG_ID) -> Ledger:
    """Create a minimal ledger with one universe and one sealed tick."""
    ledger = Ledger.begin_run(
        run_root=tmp_path,
        big_bang_id=big_bang_id,
        scenario_text=SCENARIO,
        sot_snapshot_sha="a" * 64,
        config_snapshot=CONFIG_SNAPSHOT,
    )
    ledger.begin_universe("U000", parent=None, branch_from_tick=None, branch_delta=None)
    ledger.begin_tick("U000", 0)
    ledger.write_artifact(
        "universes/U000/ticks/tick_000/universe_state_before.json",
        {"tick": 0, "state": "before"},
        immutable=False,
    )
    ledger.write_artifact(
        "universes/U000/ticks/tick_000/universe_state_after.json",
        {"tick": 0, "state": "after"},
        immutable=False,
    )
    ledger.seal_tick("U000", 0)
    return ledger


# ---------------------------------------------------------------------------
# Test: export → import roundtrip
# ---------------------------------------------------------------------------


class TestRoundtrip:
    def test_roundtrip_preserves_files(self, tmp_path: Path) -> None:
        """Files written to the ledger survive export → import intact."""
        src_root = tmp_path / "src"
        src_root.mkdir()
        ledger = _make_ledger(src_root)
        run_folder = ledger.run_folder

        zip_dest = tmp_path / "export.zip"
        export_run_to_zip(run_folder=run_folder, dest=zip_dest, verify=False)

        dst_root = tmp_path / "dst"
        dst_root.mkdir()
        extracted = import_run_from_zip(zip_path=zip_dest, dest_root=dst_root, verify=True)

        assert extracted.is_dir()

        # manifest.json should be present
        assert (extracted / "manifest.json").exists()

        # The sealed tick files should survive
        before_json = extracted / "universes" / "U000" / "ticks" / "tick_000" / "universe_state_before.json"
        assert before_json.exists()
        data = json.loads(before_json.read_bytes())
        assert data["state"] == "before"

    def test_roundtrip_merkle_root_matches(self, tmp_path: Path) -> None:
        """Tick Merkle roots match after roundtrip import."""
        src_root = tmp_path / "src"
        src_root.mkdir()
        ledger = _make_ledger(src_root)
        run_folder = ledger.run_folder

        # Read original Merkle root from the tick manifest
        tick_mf_path = (
            run_folder / "universes" / "U000" / "ticks" / "tick_000" / "manifest.json"
        )
        original_root = json.loads(tick_mf_path.read_bytes())["merkle_root"]

        zip_dest = tmp_path / "rt.zip"
        export_run_to_zip(run_folder=run_folder, dest=zip_dest, verify=False)

        dst_root = tmp_path / "dst"
        dst_root.mkdir()
        extracted = import_run_from_zip(zip_path=zip_dest, dest_root=dst_root, verify=True)

        imported_tick_mf = (
            extracted / "universes" / "U000" / "ticks" / "tick_000" / "manifest.json"
        )
        imported_root = json.loads(imported_tick_mf.read_bytes())["merkle_root"]
        assert imported_root == original_root

    def test_export_manifest_present_in_zip(self, tmp_path: Path) -> None:
        """EXPORT_MANIFEST.json is written at the root of the zip."""
        src_root = tmp_path / "src"
        src_root.mkdir()
        ledger = _make_ledger(src_root)

        zip_dest = tmp_path / "em.zip"
        export_run_to_zip(run_folder=ledger.run_folder, dest=zip_dest, verify=False)

        with zipfile.ZipFile(zip_dest, "r") as zf:
            names = zf.namelist()
            assert "EXPORT_MANIFEST.json" in names
            em = json.loads(zf.read("EXPORT_MANIFEST.json"))
            assert "exported_at" in em
            assert "file_count" in em
            assert "total_bytes" in em
            assert "run_manifest_sha256" in em
            assert "exporter_version" in em
            assert em["file_count"] > 0


# ---------------------------------------------------------------------------
# Test: tampered file detected by import verify
# ---------------------------------------------------------------------------


class TestTamperDetection:
    def test_tampered_file_raises_export_error(self, tmp_path: Path) -> None:
        """Tampering a file inside the zip causes import verify to raise ExportError."""
        src_root = tmp_path / "src"
        src_root.mkdir()
        ledger = _make_ledger(src_root)
        run_folder = ledger.run_folder

        zip_dest = tmp_path / "tamper.zip"
        export_run_to_zip(run_folder=run_folder, dest=zip_dest, verify=False)

        # Tamper: rewrite the tick state file inside the zip
        tampered_zip = tmp_path / "tampered.zip"
        with zipfile.ZipFile(zip_dest, "r") as zf_in, zipfile.ZipFile(
            tampered_zip, "w", compression=zipfile.ZIP_DEFLATED
        ) as zf_out:
            for item in zf_in.infolist():
                data = zf_in.read(item.filename)
                if "universe_state_before.json" in item.filename:
                    # Overwrite with tampered content
                    data = b'{"tick": 0, "state": "TAMPERED"}'
                zf_out.writestr(item, data)

        dst_root = tmp_path / "dst"
        dst_root.mkdir()
        with pytest.raises(ExportError, match="mismatch|verification"):
            import_run_from_zip(zip_path=tampered_zip, dest_root=dst_root, verify=True)


# ---------------------------------------------------------------------------
# Test: export missing run folder raises ExportError
# ---------------------------------------------------------------------------


class TestMissingFolder:
    def test_export_missing_folder_raises(self, tmp_path: Path) -> None:
        """Exporting a non-existent run folder raises ExportError."""
        missing = tmp_path / "does_not_exist"
        zip_dest = tmp_path / "out.zip"
        with pytest.raises(ExportError, match="does not exist"):
            export_run_to_zip(run_folder=missing, dest=zip_dest, verify=False)
