"""initial schema

Revision ID: 20260908_0001
Revises:
Create Date: 2026-09-08 00:01:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260908_0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _json_type() -> sa.types.TypeEngine:
    return sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    op.create_table(
        "matches",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("external_match_id", sa.String(length=120), nullable=True),
        sa.Column("played_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("map_name", sa.String(length=50), nullable=True),
        sa.Column("mode", sa.String(length=50), nullable=True),
        sa.Column("agent", sa.String(length=50), nullable=True),
        sa.Column("role", sa.String(length=50), nullable=True),
        sa.Column("result", sa.String(length=20), nullable=True),
        sa.Column("scoreline", sa.String(length=20), nullable=True),
        sa.Column("kills", sa.Integer(), nullable=True),
        sa.Column("deaths", sa.Integer(), nullable=True),
        sa.Column("assists", sa.Integer(), nullable=True),
        sa.Column("adr", sa.Float(), nullable=True),
        sa.Column("acs", sa.Integer(), nullable=True),
        sa.Column("hs_percent", sa.Float(), nullable=True),
        sa.Column("rr_change", sa.Integer(), nullable=True),
        sa.Column("rank_at_time", sa.String(length=50), nullable=True),
        sa.Column("session_id", sa.String(length=100), nullable=True),
        sa.Column("metadata_json", _json_type(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("external_match_id", name="uq_matches_external_match_id"),
    )
    op.create_index("ix_matches_external_match_id", "matches", ["external_match_id"])
    op.create_index("ix_matches_played_at_id", "matches", ["played_at", "id"])
    op.create_index("ix_matches_session_id", "matches", ["session_id"])

    op.create_table(
        "coaching_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("time_window_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("time_window_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("priority_issue", sa.Text(), nullable=True),
        sa.Column("stop_doing", sa.Text(), nullable=True),
        sa.Column("keep_doing", sa.Text(), nullable=True),
        sa.Column("improve_next", sa.Text(), nullable=True),
        sa.Column("next_session_focus", sa.Text(), nullable=True),
        sa.Column("weekly_plan", sa.Text(), nullable=True),
        sa.Column("supporting_data_json", _json_type(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_coaching_reports_generated_at_id", "coaching_reports", ["generated_at", "id"])

    op.create_table(
        "progress_snapshots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("snapshot_date", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("metric_window", sa.String(length=50), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("issue_trends_json", _json_type(), nullable=True),
        sa.Column("performance_change_json", _json_type(), nullable=True),
        sa.Column("recommendation_effectiveness_json", _json_type(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_progress_snapshots_snapshot_date_id", "progress_snapshots", ["snapshot_date", "id"])

    op.create_table(
        "user_profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("display_name", sa.String(length=100), nullable=False),
        sa.Column("target_rank", sa.String(length=50), nullable=True),
        sa.Column("preferred_agents", sa.Text(), nullable=True),
        sa.Column("preferred_roles", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "recommendations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("coaching_report_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=80), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("evidence_summary", sa.Text(), nullable=False),
        sa.Column("target_issue_category", sa.String(length=80), nullable=True),
        sa.Column("target_metric", sa.String(length=80), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("active_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("evaluation_summary_json", _json_type(), nullable=True),
        sa.CheckConstraint(
            "status in ('active', 'completed', 'effective', 'ineffective', 'inconclusive', 'superseded')",
            name="ck_recommendations_status",
        ),
        sa.ForeignKeyConstraint(["coaching_report_id"], ["coaching_reports.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_recommendations_report_id", "recommendations", ["coaching_report_id"])
    op.create_index("ix_recommendations_status_active_at", "recommendations", ["status", "active_at"])
    op.create_index("ix_recommendations_target_issue", "recommendations", ["target_issue_category"])
    op.create_index("ix_recommendations_target_metric", "recommendations", ["target_metric"])

    op.create_table(
        "review_notes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("match_id", sa.Integer(), nullable=True),
        sa.Column("note_type", sa.String(length=50), nullable=True),
        sa.Column("summary", sa.String(length=300), nullable=True),
        sa.Column("full_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["match_id"], ["matches.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_review_notes_match_id", "review_notes", ["match_id"])
    op.create_index("ix_review_notes_match_created", "review_notes", ["match_id", "created_at"])
    op.create_index("ix_review_notes_note_type", "review_notes", ["note_type"])

    op.create_table(
        "issue_tags",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("review_note_id", sa.Integer(), nullable=True),
        sa.Column("match_id", sa.Integer(), nullable=True),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=True),
        sa.Column("round_reference", sa.String(length=80), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["match_id"], ["matches.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["review_note_id"], ["review_notes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_issue_tags_match_id", "issue_tags", ["match_id"])
    op.create_index("ix_issue_tags_review_note_id", "issue_tags", ["review_note_id"])
    op.create_index("ix_issue_tags_category_created", "issue_tags", ["category", "created_at"])
    op.create_index("ix_issue_tags_match_category", "issue_tags", ["match_id", "category"])


def downgrade() -> None:
    op.drop_index("ix_issue_tags_match_category", table_name="issue_tags")
    op.drop_index("ix_issue_tags_category_created", table_name="issue_tags")
    op.drop_index("ix_issue_tags_review_note_id", table_name="issue_tags")
    op.drop_index("ix_issue_tags_match_id", table_name="issue_tags")
    op.drop_table("issue_tags")
    op.drop_index("ix_review_notes_note_type", table_name="review_notes")
    op.drop_index("ix_review_notes_match_created", table_name="review_notes")
    op.drop_index("ix_review_notes_match_id", table_name="review_notes")
    op.drop_table("review_notes")
    op.drop_index("ix_recommendations_target_metric", table_name="recommendations")
    op.drop_index("ix_recommendations_target_issue", table_name="recommendations")
    op.drop_index("ix_recommendations_status_active_at", table_name="recommendations")
    op.drop_index("ix_recommendations_report_id", table_name="recommendations")
    op.drop_table("recommendations")
    op.drop_table("user_profiles")
    op.drop_index("ix_progress_snapshots_snapshot_date_id", table_name="progress_snapshots")
    op.drop_table("progress_snapshots")
    op.drop_index("ix_coaching_reports_generated_at_id", table_name="coaching_reports")
    op.drop_table("coaching_reports")
    op.drop_index("ix_matches_session_id", table_name="matches")
    op.drop_index("ix_matches_played_at_id", table_name="matches")
    op.drop_index("ix_matches_external_match_id", table_name="matches")
    op.drop_table("matches")
