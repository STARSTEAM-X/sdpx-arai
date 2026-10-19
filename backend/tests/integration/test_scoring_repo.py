"""ข้อรับประกันระดับ database ของ FR-SCORE-09 และ DR-03."""

import uuid
from datetime import UTC, datetime, timedelta

import psycopg
import pytest
from psycopg import Connection

from app.repositories.pg_scoring_repo import PgScoringRepository

pytestmark = pytest.mark.integration


def seed_score(db: Connection) -> tuple[str, str, str]:
    user_id, room_id, assignment_id, criterion_id, item_id = [str(uuid.uuid4()) for _ in range(5)]
    email = f"score-{uuid.uuid4().hex[:8]}@kmitl.ac.th"
    with db.cursor() as cur:
        cur.execute(
            "INSERT INTO app_user (id,email_normalized,email_raw,status) VALUES (%s,%s,%s,'ACTIVE')",
            (user_id, email, email),
        )
        cur.execute(
            "INSERT INTO classroom (id,name,slug,timezone,created_by) VALUES (%s,'ห้อง',%s,'Asia/Bangkok',%s)",
            (room_id, uuid.uuid4().hex, user_id),
        )
        cur.execute(
            """INSERT INTO assignment
               (id,classroom_id,name,group_max_score,individual_max_score,group_deadline_utc,status,created_by)
               VALUES (%s,%s,'งาน',10,0,now(),'FINALIZED',%s)""",
            (assignment_id, room_id, user_id),
        )
        cur.execute(
            "INSERT INTO criterion (id,assignment_id,side,name,weight_pct) VALUES (%s,%s,'GROUP','UX',100)",
            (criterion_id, assignment_id),
        )
        cur.execute(
            """INSERT INTO computed_score
               (id,assignment_id,criterion_id,side,item_id,weighted_score,is_final,computed_at)
               VALUES (%s,%s,%s,'GROUP',%s,8,true,%s)""",
            (str(uuid.uuid4()), assignment_id, criterion_id, item_id, datetime.now(UTC)),
        )
    return assignment_id, criterion_id, item_id


def test_DR03_final_score_update_ถูกปฏิเสธที่_database(db: Connection):
    assignment_id, _, _ = seed_score(db)
    with pytest.raises(psycopg.errors.CheckViolation), db.cursor() as cur:
        cur.execute(
            "UPDATE computed_score SET weighted_score = 99 WHERE assignment_id = %s AND is_final",
            (assignment_id,),
        )


def test_FR_SCORE09_snapshot_แต่ละครั้งเพิ่มประวัติใหม่(db: Connection):
    assignment_id, criterion_id, item_id = seed_score(db)
    first = datetime.now(UTC) + timedelta(seconds=1)
    second = first + timedelta(seconds=1)
    with db.cursor() as cur:
        for at, score in ((first, 7), (second, 9)):
            cur.execute(
                """INSERT INTO computed_score
                   (id,assignment_id,criterion_id,side,item_id,weighted_score,is_final,computed_at)
                   VALUES (%s,%s,%s,'GROUP',%s,%s,true,%s)""",
                (str(uuid.uuid4()), assignment_id, criterion_id, item_id, score, at),
            )
            PgScoringRepository(db).create_final_snapshot(assignment_id, computed_at=at)

        cur.execute(
            "SELECT input_json, output_json FROM score_snapshot WHERE assignment_id=%s ORDER BY created_at",
            (assignment_id,),
        )
        rows = cur.fetchall()

    assert len(rows) == 2
    assert rows[0]["input_json"]["assignment"]["groupMaxScore"] == 10
    assert rows[0]["output_json"]["computedScores"][0]["weighted_score"] == 7
    assert rows[1]["output_json"]["computedScores"][0]["weighted_score"] == 9
