-- Sprint 2 — audit log ที่ลบและแก้ไม่ได้ (US-14)
--
-- PRD §19 จัด FR-AUDIT-01 ไว้กลุ่ม "ห้ามตัด" ร่วมกับ FR-ANON-01 และ FR-AUTHZ-01/02
-- ด้วยเหตุผลเดียวกัน: เหตุการณ์ที่ผ่านไปโดยไม่มี log ย้อนกลับไปเก็บไม่ได้

CREATE TABLE IF NOT EXISTS audit_log (
    id            uuid PRIMARY KEY,
    -- ใครทำ — เก็บทั้ง id และอีเมล ณ ตอนนั้น
    -- เพราะถ้าผู้ใช้ถูกลบหรือเปลี่ยนอีเมลภายหลัง log ต้องยังอ่านออกว่าใครทำ
    actor_user_id uuid REFERENCES app_user (id),
    actor_email   text        NOT NULL,
    action        text        NOT NULL,
    resource_type text        NOT NULL,
    resource_id   text,
    classroom_id  uuid REFERENCES classroom (id) ON DELETE SET NULL,
    -- ค่าก่อนและหลัง เก็บเป็น jsonb เพราะแต่ละ action มีรูปร่างข้อมูลต่างกัน
    -- และเราต้องการอ่านย้อนหลังได้โดยไม่ต้องมีตารางแยกต่อ action
    before_state  jsonb,
    after_state   jsonb,
    reason        text,
    ip            text,
    occurred_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_classroom ON audit_log (classroom_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log (resource_type, resource_id);

-- ---------- append-only ----------
--
-- AC ข้อ 3 ของ US-14 บังคับว่าต้องลบและแก้ไม่ได้ "ทั้งชั้น API และสิทธิ์ระดับ database"
--
-- ชั้น API ทำได้ด้วยการไม่มี endpoint ให้ลบ แต่นั่นกันได้แค่ทางที่เรานึกออก
-- trigger นี้กันทุกทาง รวมถึง SQL ที่คนรันเองจาก psql และ code ที่ยังไม่มีใครเขียน
--
-- เลือก trigger แทน GRANT เพราะ project ใช้ database user เดียวทั้ง migration
-- และ runtime — การ REVOKE จะทำให้ migration ตัวถัดไปแก้ตารางนี้ไม่ได้ด้วย
CREATE OR REPLACE FUNCTION audit_log_is_append_only() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_log เป็น append-only — % ถูกปฏิเสธ', TG_OP
        USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log;
CREATE TRIGGER audit_log_no_update
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION audit_log_is_append_only();
