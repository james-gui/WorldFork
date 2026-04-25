"""
Identity salience update.

  identity_salience_next =
    identity_salience * (1 - activation_decay_rate)
  + threat_amplifier * identity_threat_signal
  + ingroup_event_signal
"""
from __future__ import annotations

from backend.app.schemas.actors import CohortState
from backend.app.schemas.sociology import SociologyParams


def _clip(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, float(x)))


def update_identity_salience(
    *,
    cohort: CohortState,
    identity_threat_signal: float,
    ingroup_event_signal: float,
    params: SociologyParams,
) -> float:
    """Compute the next-tick identity_salience scalar in [0, 1]."""
    p = params.identity_salience
    raw = (
        cohort.identity_salience * (1.0 - p.activation_decay_rate)
        + p.threat_amplifier * float(identity_threat_signal)
        + float(ingroup_event_signal)
    )
    return _clip(raw, 0.0, 1.0)


__all__ = ["update_identity_salience"]
