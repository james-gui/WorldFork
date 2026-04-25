"""Add run results aggregation table.

Revision ID: 0003_run_results
Revises: 0002_webhooks
Create Date: 2026-04-25
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003_run_results"
down_revision = "0002_webhooks"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "run_results",
        sa.Column("run_id", sa.String(64), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("provider", sa.String(64), nullable=True),
        sa.Column("model_used", sa.String(128), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("classifications", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("branch_clusters", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("universe_outcomes", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("timeline_highlights", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("metrics", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("artifact_path", sa.String(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("job_id", sa.String(64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["big_bang_runs.big_bang_id"],
            name="fk_run_results_run_id_big_bang_runs",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("run_id", name="pk_run_results"),
    )


def downgrade() -> None:
    op.drop_table("run_results")
