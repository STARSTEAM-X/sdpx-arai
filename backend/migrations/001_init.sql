-- Migration 001 — ตารางตั้งต้นสำหรับ M1
--
-- ครอบเฉพาะที่ US-01, US-02, US-03 ต้องใช้
-- ตารางของ assignment / pairing / scoring จะมาใน migration ถัดไป
--
-- อ้าง PRD §11.1 · ตัด column ที่ M1 ยังไม่ใช้ออกเพื่อไม่ให้มี field ที่ไม่มีใครเขียน

CREATE TABLE IF NOT EXISTS app_user (
    id               uuid PRIMARY KEY,
    -- email ที่ normalize แล้ว เป็น key สำหรับจับคู่กับ roster (FR-AUTH-03)
    email_normalized text        NOT NULL UNIQUE,
    email_raw        text        NOT NULL,
    display_name     text,
    -- subject จาก Google OIDC — ว่างจนกว่าจะ login ครั้งแรก
    google_sub       text UNIQUE,
    status           text        NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING', 'ACTIVE', 'DISABLED')),
    created_at       timestamptz NOT NULL DEFAULT now(),
    last_login_at    timestamptz
);

CREATE TABLE IF NOT EXISTS classroom (
    id                    uuid PRIMARY KEY,
    name                  text        NOT NULL,
    slug                  text        NOT NULL UNIQUE,
    timezone              text        NOT NULL,
    allowed_email_domains text[]      NOT NULL DEFAULT '{}',
    status                text        NOT NULL DEFAULT 'ACTIVE'
                          CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    created_by            uuid        NOT NULL REFERENCES app_user (id),
    created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS classroom_member (
    id           uuid PRIMARY KEY,
    classroom_id uuid        NOT NULL REFERENCES classroom (id) ON DELETE CASCADE,
    user_id      uuid        NOT NULL REFERENCES app_user (id),
    role         text        NOT NULL
                 CHECK (role IN ('OWNER', 'CO_TEACHER', 'TA', 'STUDENT')),
    group_name   text,
    joined_at    timestamptz NOT NULL DEFAULT now(),
    -- 1 คนมีได้ role เดียวต่อ 1 classroom
    UNIQUE (classroom_id, user_id)
);

-- ใช้ตอนแสดงรายการห้องเรียนของผู้ใช้คนหนึ่ง ซึ่งเป็น query ที่เรียกทุกครั้งที่เปิดหน้าแรก
CREATE INDEX IF NOT EXISTS idx_member_user ON classroom_member (user_id);
