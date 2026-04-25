"""Multiverse lineage cache + DAG builder.

Backed by Redis with a graceful TTL.  The on-disk source-of-truth is the
``universes`` + ``branch_nodes`` tables, but every read of the full tree
would otherwise require a recursive CTE; the cache lets the explorer UI
poll cheaply while the simulator happily writes through.

JSON shape returned by :func:`build_tree` (and stored in Redis):

```jsonc
{
  "big_bang_id": "BB_xxx",
  "nodes": [{universe_id, parent_universe_id, depth, branch_tick, status,
              metrics_summary, descendant_count, lineage_path}],
  "edges": [{source, target}],
  "depth_index": {"0": [universe_ids], "1": [...], ...},
  "ticks": [0, 3, 5, ...],   // sorted unique branch_ticks
  "root_id": "<universe_id>" | null,
}
```
"""
from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Any

import networkx as nx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

if TYPE_CHECKING:
    from redis.asyncio import Redis

_log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------


class LineageCache:
    """Async Redis cache for multiverse trees keyed by big_bang_id."""

    KEY_PREFIX = "wf:lineage:"

    def __init__(self, redis: Redis[bytes]) -> None:
        self._redis = redis

    @classmethod
    def _key(cls, big_bang_id: str) -> str:
        return f"{cls.KEY_PREFIX}{big_bang_id}"

    async def get_tree(self, big_bang_id: str) -> dict[str, Any] | None:
        raw = await self._redis.get(self._key(big_bang_id))
        if raw is None:
            return None
        decoded: str = raw.decode("utf-8") if isinstance(raw, bytes) else raw
        try:
            return json.loads(decoded)  # type: ignore[no-any-return]
        except (TypeError, ValueError):
            _log.warning(
                "Corrupt lineage cache entry for %s — discarding", big_bang_id
            )
            await self.invalidate(big_bang_id)
            return None

    async def set_tree(
        self,
        big_bang_id: str,
        tree: dict[str, Any],
        ttl: int = 300,
    ) -> None:
        await self._redis.set(
            self._key(big_bang_id),
            json.dumps(tree, separators=(",", ":")),
            ex=ttl,
        )

    async def invalidate(self, big_bang_id: str) -> None:
        await self._redis.delete(self._key(big_bang_id))


# ---------------------------------------------------------------------------
# Tree builder
# ---------------------------------------------------------------------------


async def build_tree(session: AsyncSession, big_bang_id: str) -> dict[str, Any]:
    """Build a serialisable multiverse tree for ``big_bang_id``.

    Loads every :class:`UniverseModel` and its matching
    :class:`BranchNodeModel` (1-to-1), constructs a NetworkX DiGraph, and
    returns the JSON shape documented at module level.
    """
    from backend.app.models.branches import BranchNodeModel
    from backend.app.models.universes import UniverseModel

    u_rows = (
        await session.execute(
            select(UniverseModel).where(UniverseModel.big_bang_id == big_bang_id)
        )
    ).scalars().all()

    bn_rows = (
        await session.execute(
            select(BranchNodeModel).where(
                BranchNodeModel.universe_id.in_(
                    [u.universe_id for u in u_rows]
                )
            )
        )
    ).scalars().all() if u_rows else []
    bn_by_uid: dict[str, Any] = {bn.universe_id: bn for bn in bn_rows}

    graph: nx.DiGraph = nx.DiGraph()
    nodes_out: list[dict[str, Any]] = []
    edges_out: list[dict[str, Any]] = []
    depth_index: dict[str, list[str]] = {}
    tick_set: set[int] = set()
    root_id: str | None = None

    for u in u_rows:
        bn = bn_by_uid.get(u.universe_id)
        node_payload = {
            "universe_id": u.universe_id,
            "parent_universe_id": u.parent_universe_id,
            "depth": u.branch_depth,
            "branch_tick": u.branch_from_tick if u.branch_from_tick is not None else 0,
            "status": u.status,
            "lineage_path": list(u.lineage_path or []),
            "metrics_summary": dict(u.latest_metrics or {}),
            "descendant_count": (bn.descendant_count if bn else 0),
            "branch_reason": u.branch_reason or "",
            "current_tick": u.current_tick,
        }
        graph.add_node(u.universe_id, **node_payload)
        nodes_out.append(node_payload)
        depth_index.setdefault(str(u.branch_depth), []).append(u.universe_id)
        if u.branch_from_tick is not None:
            tick_set.add(u.branch_from_tick)
        if u.parent_universe_id is None:
            root_id = u.universe_id

    for u in u_rows:
        if u.parent_universe_id is not None:
            graph.add_edge(u.parent_universe_id, u.universe_id)
            edges_out.append({
                "source": u.parent_universe_id,
                "target": u.universe_id,
            })

    return {
        "big_bang_id": big_bang_id,
        "root_id": root_id,
        "nodes": nodes_out,
        "edges": edges_out,
        "depth_index": depth_index,
        "ticks": sorted(tick_set),
        "node_count": graph.number_of_nodes(),
        "edge_count": graph.number_of_edges(),
    }


# ---------------------------------------------------------------------------
# Direct queries (do not go through the cache)
# ---------------------------------------------------------------------------


async def get_descendants(
    session: AsyncSession,
    universe_id: str,
) -> list[str]:
    """Return ``universe_id`` and every transitive descendant.

    Walks ``parent_universe_id`` edges in-memory after one bulk fetch of
    the run's universes; cheaper than a recursive CTE for typical run sizes.
    """
    from backend.app.models.universes import UniverseModel

    seed = await session.get(UniverseModel, universe_id)
    if seed is None:
        return []

    siblings = (
        await session.execute(
            select(
                UniverseModel.universe_id,
                UniverseModel.parent_universe_id,
            ).where(UniverseModel.big_bang_id == seed.big_bang_id)
        )
    ).all()

    children_by_parent: dict[str, list[str]] = {}
    for uid, pid in siblings:
        if pid is not None:
            children_by_parent.setdefault(pid, []).append(uid)

    out: list[str] = [universe_id]
    queue = [universe_id]
    while queue:
        cur = queue.pop()
        for child in children_by_parent.get(cur, []):
            out.append(child)
            queue.append(child)
    return out


async def get_lineage(
    session: AsyncSession,
    universe_id: str,
) -> list[str]:
    """Return the lineage_path stored on the :class:`UniverseModel` row."""
    from backend.app.models.universes import UniverseModel

    row = await session.get(UniverseModel, universe_id)
    if row is None:
        return []
    return list(row.lineage_path or [])
