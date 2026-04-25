"""End-to-end export → re-import round-trip (PRD §19, §27.3 #4).

* Initialize a run with a real ledger snapshot.
* Add a sealed tick with state artifacts.
* Export to zip via the public `export_run_to_zip`.
* Re-import to a fresh tmp dir via `import_run_from_zip(verify=True)`.
* Verify that `Ledger.open(...).verify()` returns no errors on either side.

The negative case lives in `test_smoke_full_run::test_export_tampered_zip_raises`.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from backend.app.simulation.initializer import initialize_big_bang
from backend.app.storage.export import export_run_to_zip, import_run_from_zip
from backend.app.storage.ledger import Ledger

from backend.tests.e2e.conftest import canned_initializer_payload

pytestmark = [pytest.mark.asyncio, pytest.mark.e2e]


async def test_export_reimport_round_trip_preserves_ledger(
    db_session,
    rate_limiter,
    routing,
    initializer_input,
    mock_provider_response,
    tmp_path: Path,
):
    """Initialize → seal 2 ticks → export → re-import → verify checksums."""
    mock_provider_response(
        {"initialize_big_bang": canned_initializer_payload()}
    )
    init_result = await initialize_big_bang(
        initializer_input,
        session=db_session,
        sot=None,
        provider_rate_limiter=rate_limiter,
        run_root=tmp_path,
        routing=routing,
    )
    big_bang_id = init_result.big_bang_run.big_bang_id
    uni_id = init_result.root_universe.universe_id

    # Seal two ticks (tick 0 and tick 1) with a couple of artifacts each.
    ledger = Ledger.open(tmp_path, big_bang_id)
    for tick in (0, 1):
        ledger.begin_tick(uni_id, tick)
        ledger.write_artifact(
            f"universes/{uni_id}/ticks/tick_{tick:03d}/state_after.json",
            {"tick": tick, "phase": "after"},
            immutable=False,
        )
        ledger.write_artifact(
            f"universes/{uni_id}/ticks/tick_{tick:03d}/metrics.json",
            {"tick": tick, "divergence": 0.0},
            immutable=False,
        )
        ledger.seal_tick(uni_id, tick)

    # Source-side verify must be clean before we export.
    src_errors = ledger.verify()
    assert src_errors == [], f"source ledger had errors: {src_errors[:3]}"

    # Export.
    zip_dest = tmp_path / "export.zip"
    export_run_to_zip(run_folder=init_result.run_folder, dest=zip_dest, verify=True)
    assert zip_dest.exists()

    # Re-import to a brand new root.
    dst_root = tmp_path / "reimport"
    dst_root.mkdir(exist_ok=True)
    extracted = import_run_from_zip(zip_path=zip_dest, dest_root=dst_root, verify=True)

    # Re-imported run-folder must contain the manifest and both tick directories.
    assert (extracted / "manifest.json").exists()
    for tick in (0, 1):
        assert (
            extracted / "universes" / uni_id / "ticks" / f"tick_{tick:03d}"
            / "manifest.json"
        ).exists()

    # The re-imported manifest should still parse and reference the same big_bang_id.
    mf = json.loads((extracted / "manifest.json").read_bytes())
    assert mf.get("big_bang_id") == big_bang_id

    # Re-opened ledger should also verify clean (Merkle roots intact).
    reopened = Ledger.open(dst_root, big_bang_id)
    dst_errors = reopened.verify()
    assert dst_errors == [], f"reimported ledger had errors: {dst_errors[:3]}"
