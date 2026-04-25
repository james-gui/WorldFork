"""
Sociology schemas: SociologyParams, SplitProposal, ChildSplitSpec, MergeProposal.
Import-free of backend.app.models.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, model_validator

# ---------------------------------------------------------------------------
# Nested parameter models (mirrors sociology_parameters.json shape from B1-A)
# ---------------------------------------------------------------------------

class BeliefDriftParams(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    eta: float = Field(default=0.05, ge=0.0, le=1.0)
    # Accept both `bounded_kernel_width` (legacy) and `kernel_bandwidth` (SoT JSON).
    bounded_kernel_width: float = Field(
        default=0.5, ge=0.0, le=2.0, alias="kernel_bandwidth"
    )
    stubbornness_weight: float = Field(
        default=0.3, ge=0.0, le=1.0, alias="stubbornness_anchor_weight"
    )
    event_shock_scale: float = Field(
        default=0.2, ge=0.0, le=1.0, alias="event_shock_weight"
    )
    max_step_per_tick: float = Field(default=0.20, ge=0.0, le=1.0)

    @property
    def kernel_bandwidth(self) -> float:
        return self.bounded_kernel_width


class AttentionParams(BaseModel):
    model_config = ConfigDict(extra="ignore")

    default_decay_rate: float = Field(default=0.15, ge=0.0, le=1.0)
    max_attention: float = Field(default=1.0, ge=0.0, le=1.0)
    event_salience_weight: float = Field(default=0.4, ge=0.0)
    feed_salience_weight: float = Field(default=0.3, ge=0.0)
    personal_impact_weight: float = Field(default=0.2, ge=0.0)
    identity_threat_weight: float = Field(default=0.1, ge=0.0)


class ExpressionParams(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    anger_weight: float = Field(default=0.25, ge=0.0, le=1.0)
    urgency_weight: float = Field(default=0.20, ge=0.0, le=1.0)
    # Accept both `perceived_efficacy_weight` (legacy) and `efficacy_weight` (SoT JSON).
    perceived_efficacy_weight: float = Field(
        default=0.15, ge=0.0, le=1.0, alias="efficacy_weight"
    )
    # Accept both `fear_of_isolation_weight` (legacy) and `fear_isolation_weight` (SoT JSON).
    fear_of_isolation_weight: float = Field(
        default=0.25, ge=0.0, le=1.0, alias="fear_isolation_weight"
    )
    fatigue_weight: float = Field(default=0.10, ge=0.0, le=1.0)
    base_expression_weight: float = Field(default=1.0, ge=0.0, le=2.0)
    clamp: tuple[float, float] = Field(default=(0.0, 1.0))

    @property
    def efficacy_weight(self) -> float:
        return self.perceived_efficacy_weight

    @property
    def fear_isolation_weight(self) -> float:
        return self.fear_of_isolation_weight


class SpiralOfSilenceParams(BaseModel):
    model_config = ConfigDict(extra="ignore")

    isolation_threshold: float = Field(default=0.6, ge=0.0, le=1.0)
    minority_penalty: float = Field(default=0.3, ge=0.0, le=1.0)
    institutional_risk_weight: float = Field(default=0.2, ge=0.0, le=1.0)
    fear_isolation_weight: float = Field(default=1.0, ge=0.0, le=2.0)
    perceived_minority_weight: float = Field(default=1.0, ge=0.0, le=2.0)
    expressive_courage_weight: float = Field(default=1.0, ge=0.0, le=2.0)


class MobilizationParams(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    default_threshold: float = Field(default=0.55, ge=0.0, le=1.0)
    grievance_weight: float = Field(default=0.3, ge=0.0, le=2.0)
    anger_weight: float = Field(default=0.25, ge=0.0, le=2.0)
    peer_participation_weight: float = Field(default=0.25, ge=0.0, le=2.0)
    efficacy_weight: float = Field(default=0.20, ge=0.0, le=2.0)
    cost_fear_weight: float = Field(default=0.30, ge=0.0, le=2.0)
    # Accept both `k_threshold_complex_contagion` (legacy) and `complex_contagion_k`.
    k_threshold_complex_contagion: int = Field(
        default=3, ge=1, alias="complex_contagion_k"
    )

    @property
    def complex_contagion_k(self) -> int:
        return self.k_threshold_complex_contagion


class HomophilyParams(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    rewire_probability: float = Field(
        default=0.05, ge=0.0, le=1.0, alias="rewiring_rate"
    )
    similarity_threshold: float = Field(default=0.7, ge=0.0, le=1.0)
    max_rewires_per_tick: int = Field(default=5, ge=0)
    tie_decay_rate: float = Field(default=0.02, ge=0.0, le=1.0)
    ingroup_bias: float = Field(default=0.6, ge=0.0, le=1.0)

    @property
    def rewiring_rate(self) -> float:
        return self.rewire_probability


class TrustParams(BaseModel):
    model_config = ConfigDict(extra="ignore")

    trust_update_rate: float = Field(default=0.10, ge=0.0, le=1.0)
    betrayal_decay_factor: float = Field(default=0.5, ge=0.0, le=1.0)
    minimum_trust: float = Field(default=-1.0)
    maximum_trust: float = Field(default=1.0)


class IdentitySalienceParams(BaseModel):
    model_config = ConfigDict(extra="ignore")

    activation_decay_rate: float = Field(default=0.15, ge=0.0, le=1.0)
    threat_amplifier: float = Field(default=1.5, ge=0.0)


class SplitMergeParams(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    split_distance_threshold: float = Field(default=0.35, ge=0.0, le=1.0)
    merge_distance_threshold: float = Field(default=0.15, ge=0.0, le=1.0)
    min_split_share: float = Field(default=0.10, ge=0.0, le=1.0)
    min_split_population: int = Field(default=50, ge=1)
    low_divergence_ticks_for_merge: int = Field(
        default=3, ge=1, alias="merge_low_divergence_ticks"
    )
    merge_similarity_threshold: float = Field(default=0.85, ge=0.0, le=1.0)
    max_child_cohorts: int = Field(default=4, ge=2)


class BranchingDefaultsParams(BaseModel):
    model_config = ConfigDict(extra="ignore")

    max_active_universes: int = Field(default=50, ge=1)
    max_total_branches: int = Field(default=500, ge=1)
    max_depth: int = Field(default=8, ge=1)
    max_branches_per_tick: int = Field(default=5, ge=1)
    branch_cooldown_ticks: int = Field(default=3, ge=0)
    min_divergence_score: float = Field(default=0.35, ge=0.0, le=1.0)
    auto_prune_low_value: bool = True


class SociologyParams(BaseModel):
    """
    Full sociology parameters — mirrors sociology_parameters.json shape from B1-A.
    Uses extra="ignore" for forward compatibility when new parameters are added.
    """

    model_config = ConfigDict(extra="ignore")

    belief_drift: BeliefDriftParams = Field(default_factory=BeliefDriftParams)
    attention: AttentionParams = Field(default_factory=AttentionParams)
    expression: ExpressionParams = Field(default_factory=ExpressionParams)
    spiral_of_silence: SpiralOfSilenceParams = Field(
        default_factory=SpiralOfSilenceParams
    )
    mobilization: MobilizationParams = Field(default_factory=MobilizationParams)
    homophily: HomophilyParams = Field(default_factory=HomophilyParams)
    trust: TrustParams = Field(default_factory=TrustParams)
    identity_salience: IdentitySalienceParams = Field(
        default_factory=IdentitySalienceParams
    )
    split_merge: SplitMergeParams = Field(default_factory=SplitMergeParams)
    branching_defaults: BranchingDefaultsParams = Field(
        default_factory=BranchingDefaultsParams
    )


# ---------------------------------------------------------------------------
# ChildSplitSpec
# ---------------------------------------------------------------------------

class ChildSplitSpec(BaseModel):
    """Specification for one child cohort produced by a split."""

    model_config = ConfigDict(extra="forbid")

    archetype_id: str
    represented_population: int = Field(..., ge=0)
    issue_stance: dict[str, float] = Field(default_factory=dict)
    expression_level: float = Field(..., ge=0.0, le=1.0)
    mobilization_mode: str
    speech_mode: str
    seed_emotions: dict[str, float] = Field(default_factory=dict)
    interpretation_note: str = ""


# ---------------------------------------------------------------------------
# SplitProposal
# ---------------------------------------------------------------------------

class SplitProposal(BaseModel):
    """
    LLM-proposed cohort split.

    Validation rules:
    - 2 <= len(children) <= max_child_cohorts (inferred from archetype at commit time;
      schema enforces >= 2 and a soft upper bound of 20 here).
    - sum(children.represented_population) > 0 OR
      population conservation is enforced when committed against actual parent
      population in the engine.
    - split_distance > 0.
    """

    model_config = ConfigDict(extra="forbid")

    parent_cohort_id: str
    children: list[ChildSplitSpec] = Field(..., min_length=2)
    split_distance: float = Field(..., ge=0.0, le=1.0)
    rationale: str

    @model_validator(mode="after")
    def _validate_children(self) -> SplitProposal:
        if len(self.children) < 2:
            raise ValueError("SplitProposal requires at least 2 children")
        # Warn-only if more than 20 children — archetype.max_child_cohorts is the
        # authoritative limit enforced at commit time.
        if len(self.children) > 20:
            raise ValueError(
                f"SplitProposal has {len(self.children)} children; "
                "schema limit is 20 (archetype.max_child_cohorts is the hard limit "
                "enforced at commit time)"
            )
        # If any child has represented_population, the sum must be > 0
        sum(c.represented_population for c in self.children)
        # total_pop == 0 is allowed; engine validates at commit time
        return self


# ---------------------------------------------------------------------------
# MergeProposal
# ---------------------------------------------------------------------------

class MergeProposal(BaseModel):
    """
    LLM-proposed cohort merge.
    Cohorts must share an archetype — enforced at the engine layer.
    """

    model_config = ConfigDict(extra="forbid")

    cohort_ids: list[str] = Field(..., min_length=2)
    archetype_id: str
    rationale: str

    @model_validator(mode="after")
    def _validate_min_cohorts(self) -> MergeProposal:
        if len(self.cohort_ids) < 2:
            raise ValueError("MergeProposal requires at least 2 cohort_ids")
        return self
