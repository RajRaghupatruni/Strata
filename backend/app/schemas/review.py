from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class IssueTagBase(BaseModel):
    category: str = Field(min_length=1, max_length=80)
    severity: str | None = Field(default=None, max_length=20)
    round_reference: str | None = Field(default=None, max_length=80)
    description: str | None = None


class IssueTagCreate(IssueTagBase):
    pass


class IssueTagRead(IssueTagBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    review_note_id: int | None = None
    match_id: int | None = None
    created_at: datetime | None = None


class ReviewNoteBase(BaseModel):
    match_id: int | None = Field(default=None, ge=1)
    note_type: str | None = Field(default=None, max_length=50)
    summary: str = Field(min_length=1, max_length=300)
    full_note: str | None = None


class ReviewNoteCreate(ReviewNoteBase):
    issue_tags: list[IssueTagCreate] = Field(default_factory=list)


class ReviewNoteUpdate(BaseModel):
    match_id: int | None = Field(default=None, ge=1)
    note_type: str | None = Field(default=None, max_length=50)
    summary: str | None = Field(default=None, min_length=1, max_length=300)
    full_note: str | None = None
    issue_tags: list[IssueTagCreate] | None = None


class ReviewNoteRead(ReviewNoteBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None
    issue_tags: list[IssueTagRead] = Field(default_factory=list)


class ReviewNoteListResponse(BaseModel):
    total: int
    notes: list[ReviewNoteRead]


class RecurringIssueSummary(BaseModel):
    category: str
    occurrences: int
    high_severity_occurrences: int
    last_seen_at: datetime | None = None


class RecurringIssuesResponse(BaseModel):
    issues: list[RecurringIssueSummary] = Field(default_factory=list)
