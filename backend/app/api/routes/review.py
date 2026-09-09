from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import case, delete, func, select
from sqlalchemy.orm import Session

from app.api.dependencies import require_writable_demo
from app.core.database import get_db
from app.models import IssueTag, Match, ReviewNote
from app.schemas.review import (
    IssueTagCreate,
    IssueTagRead,
    RecurringIssuesResponse,
    ReviewNoteCreate,
    ReviewNoteListResponse,
    ReviewNoteRead,
    ReviewNoteUpdate,
)


router = APIRouter()


def _to_issue_tag_read(tag: IssueTag) -> IssueTagRead:
    return IssueTagRead.model_validate(tag)


def _to_note_read(note: ReviewNote, tags: list[IssueTag]) -> ReviewNoteRead:
    return ReviewNoteRead(
        id=note.id,
        match_id=note.match_id,
        note_type=note.note_type,
        summary=note.summary or "",
        full_note=note.full_note,
        created_at=note.created_at,
        updated_at=note.updated_at,
        issue_tags=[_to_issue_tag_read(tag) for tag in tags],
    )


def _tags_by_note_id(db: Session, note_ids: list[int]) -> dict[int, list[IssueTag]]:
    if not note_ids:
        return {}
    tags = db.scalars(select(IssueTag).where(IssueTag.review_note_id.in_(note_ids))).all()
    grouped: dict[int, list[IssueTag]] = defaultdict(list)
    for tag in tags:
        if tag.review_note_id is not None:
            grouped[tag.review_note_id].append(tag)
    return grouped


def _upsert_issue_tags(
    db: Session, note_id: int, match_id: int | None, issue_tags: list[IssueTagCreate]
) -> None:
    db.execute(delete(IssueTag).where(IssueTag.review_note_id == note_id))
    for tag in issue_tags:
        db.add(
            IssueTag(
                review_note_id=note_id,
                match_id=match_id,
                category=tag.category.strip().lower(),
                severity=tag.severity.strip().lower() if tag.severity else None,
                round_reference=tag.round_reference,
                description=tag.description,
            )
        )


@router.get("/notes", response_model=ReviewNoteListResponse)
def list_notes(
    match_id: int | None = Query(default=None, ge=1),
    note_type: str | None = None,
    limit: int = Query(default=100, ge=1, le=300),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> ReviewNoteListResponse:
    filters = []
    if match_id:
        filters.append(ReviewNote.match_id == match_id)
    if note_type:
        filters.append(ReviewNote.note_type == note_type)

    total = db.scalar(select(func.count(ReviewNote.id)).where(*filters)) or 0
    notes = db.scalars(
        select(ReviewNote)
        .where(*filters)
        .order_by(ReviewNote.created_at.desc(), ReviewNote.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()

    grouped = _tags_by_note_id(db, [note.id for note in notes])
    return ReviewNoteListResponse(
        total=total,
        notes=[_to_note_read(note, grouped.get(note.id, [])) for note in notes],
    )


@router.get("/notes/{note_id}", response_model=ReviewNoteRead)
def get_note(note_id: int, db: Session = Depends(get_db)) -> ReviewNoteRead:
    note = db.scalar(select(ReviewNote).where(ReviewNote.id == note_id))
    if note is None:
        raise HTTPException(status_code=404, detail="Review note not found")

    grouped = _tags_by_note_id(db, [note.id])
    return _to_note_read(note, grouped.get(note.id, []))


@router.post(
    "/notes",
    response_model=ReviewNoteRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_writable_demo)],
)
def create_note(payload: ReviewNoteCreate, db: Session = Depends(get_db)) -> ReviewNoteRead:
    if payload.match_id is not None:
        match_exists = db.scalar(select(Match.id).where(Match.id == payload.match_id))
        if match_exists is None:
            raise HTTPException(status_code=400, detail="Invalid match_id")

    note = ReviewNote(
        match_id=payload.match_id,
        note_type=payload.note_type,
        summary=payload.summary,
        full_note=payload.full_note,
    )
    db.add(note)
    db.flush()

    _upsert_issue_tags(
        db=db,
        note_id=note.id,
        match_id=payload.match_id,
        issue_tags=payload.issue_tags,
    )
    db.commit()
    db.refresh(note)

    grouped = _tags_by_note_id(db, [note.id])
    return _to_note_read(note, grouped.get(note.id, []))


@router.put(
    "/notes/{note_id}",
    response_model=ReviewNoteRead,
    dependencies=[Depends(require_writable_demo)],
)
def update_note(note_id: int, payload: ReviewNoteUpdate, db: Session = Depends(get_db)) -> ReviewNoteRead:
    note = db.scalar(select(ReviewNote).where(ReviewNote.id == note_id))
    if note is None:
        raise HTTPException(status_code=404, detail="Review note not found")

    updates = payload.model_dump(exclude_unset=True)
    issue_tags = updates.pop("issue_tags", None)

    if "match_id" in updates and updates["match_id"] is not None:
        match_exists = db.scalar(select(Match.id).where(Match.id == updates["match_id"]))
        if match_exists is None:
            raise HTTPException(status_code=400, detail="Invalid match_id")

    for key, value in updates.items():
        setattr(note, key, value)

    if issue_tags is not None:
        parsed = [IssueTagCreate.model_validate(tag) for tag in issue_tags]
        _upsert_issue_tags(
            db=db,
            note_id=note.id,
            match_id=note.match_id,
            issue_tags=parsed,
        )

    db.add(note)
    db.commit()
    db.refresh(note)

    grouped = _tags_by_note_id(db, [note.id])
    return _to_note_read(note, grouped.get(note.id, []))


@router.delete(
    "/notes/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_writable_demo)],
)
def delete_note(note_id: int, db: Session = Depends(get_db)) -> Response:
    note = db.scalar(select(ReviewNote).where(ReviewNote.id == note_id))
    if note is None:
        raise HTTPException(status_code=404, detail="Review note not found")

    db.execute(delete(IssueTag).where(IssueTag.review_note_id == note_id))
    db.delete(note)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/notes/{note_id}/tags",
    response_model=IssueTagRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_writable_demo)],
)
def add_tag_to_note(note_id: int, payload: IssueTagCreate, db: Session = Depends(get_db)) -> IssueTagRead:
    note = db.scalar(select(ReviewNote).where(ReviewNote.id == note_id))
    if note is None:
        raise HTTPException(status_code=404, detail="Review note not found")

    tag = IssueTag(
        review_note_id=note_id,
        match_id=note.match_id,
        category=payload.category.strip().lower(),
        severity=payload.severity.strip().lower() if payload.severity else None,
        round_reference=payload.round_reference,
        description=payload.description,
    )
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return _to_issue_tag_read(tag)


@router.delete(
    "/tags/{tag_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_writable_demo)],
)
def delete_tag(tag_id: int, db: Session = Depends(get_db)) -> Response:
    tag = db.scalar(select(IssueTag).where(IssueTag.id == tag_id))
    if tag is None:
        raise HTTPException(status_code=404, detail="Issue tag not found")
    db.delete(tag)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/issues/recurring", response_model=RecurringIssuesResponse)
def recurring_issues(
    limit: int = Query(default=20, ge=1, le=100),
    match_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
) -> RecurringIssuesResponse:
    stmt = (
        select(
            IssueTag.category,
            func.count(IssueTag.id).label("occurrences"),
            func.sum(
                case((IssueTag.severity.in_(["high", "critical"]), 1), else_=0)
            ).label("high_severity_occurrences"),
            func.max(IssueTag.created_at).label("last_seen_at"),
        )
        .group_by(IssueTag.category)
        .order_by(func.count(IssueTag.id).desc(), IssueTag.category.asc())
        .limit(limit)
    )
    if match_id is not None:
        stmt = stmt.where(IssueTag.match_id == match_id)

    rows = db.execute(stmt).all()

    issues = [
        {
            "category": row.category,
            "occurrences": int(row.occurrences or 0),
            "high_severity_occurrences": int(row.high_severity_occurrences or 0),
            "last_seen_at": row.last_seen_at,
        }
        for row in rows
    ]
    return RecurringIssuesResponse(issues=issues)
