"""SHA-256 helpers and Merkle root computation."""
from __future__ import annotations

import hashlib
from pathlib import Path


def sha256_bytes(b: bytes) -> str:
    """Return the hex SHA-256 digest of *b*."""
    return hashlib.sha256(b).hexdigest()


def sha256_file(path: Path) -> str:
    """Return the hex SHA-256 digest of the file at *path*."""
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def merkle_root(hashes: list[str]) -> str:
    """Return the Merkle root of *hashes* using pairwise SHA-256 chaining.

    * Empty list  → ``"0" * 64``
    * Single item → that hash unchanged
    * Odd count   → last hash duplicated before pairing

    The computation is performed on the raw hex strings (encoded as UTF-8
    bytes), not on the decoded binary digests, to keep the logic simple and
    language-agnostic.
    """
    if not hashes:
        return "0" * 64

    layer = list(hashes)
    while len(layer) > 1:
        if len(layer) % 2 == 1:
            layer.append(layer[-1])
        next_layer: list[str] = []
        for i in range(0, len(layer), 2):
            combined = (layer[i] + layer[i + 1]).encode("utf-8")
            next_layer.append(hashlib.sha256(combined).hexdigest())
        layer = next_layer
    return layer[0]
