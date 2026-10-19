-- FR-PRIV-02 — อีเมลใน audit_log ต้องถูกปิดตัวตนเมื่อพ้น 2 ปีการศึกษาเหมือนข้อมูลส่วนอื่น (PRD §14.1)
--
-- FR-AUDIT-03 ห้าม "API ให้ลบหรือแก้" ไม่ได้ห้ามงานรักษาระยะเก็บ — ADR-004
-- trigger ยังปฏิเสธ DELETE ทุกกรณี และ UPDATE ทุกกรณียกเว้นอย่างเดียว:
--   transaction ที่ตั้ง `SET LOCAL paireval.privacy_job = 'on'` (มีแค่ app/privacy_job.py)
--   และเปลี่ยนเฉพาะอีเมลเป็น pseudonym ที่ลงท้าย @anonymized.invalid
--   — actor_email กับคีย์ "email" ใน before_state / after_state เท่านั้น คอลัมน์อื่นต้องเหมือนเดิมทุกตัว
-- จึงยังปลอมเหตุการณ์ แก้เวลา หรือแก้สิ่งที่ทำไม่ได้ แม้จะตั้งตัวแปรนั้นเอง

CREATE OR REPLACE FUNCTION audit_email_change_ok(old_email text, new_email text) RETURNS boolean AS $$
    SELECT new_email IS NOT DISTINCT FROM old_email OR new_email LIKE 'anon-%@anonymized.invalid'
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION audit_log_is_append_only() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE'
       AND current_setting('paireval.privacy_job', true) = 'on'
       AND NEW.id = OLD.id
       AND NEW.actor_user_id IS NOT DISTINCT FROM OLD.actor_user_id
       AND NEW.action = OLD.action
       AND NEW.resource_type = OLD.resource_type
       AND NEW.resource_id IS NOT DISTINCT FROM OLD.resource_id
       AND NEW.classroom_id IS NOT DISTINCT FROM OLD.classroom_id
       AND NEW.reason IS NOT DISTINCT FROM OLD.reason
       AND NEW.ip IS NOT DISTINCT FROM OLD.ip
       AND NEW.occurred_at = OLD.occurred_at
       AND audit_email_change_ok(OLD.actor_email, NEW.actor_email)
       AND (NEW.before_state - 'email') IS NOT DISTINCT FROM (OLD.before_state - 'email')
       AND (NEW.after_state - 'email') IS NOT DISTINCT FROM (OLD.after_state - 'email')
       AND audit_email_change_ok(OLD.before_state ->> 'email', NEW.before_state ->> 'email')
       AND audit_email_change_ok(OLD.after_state ->> 'email', NEW.after_state ->> 'email')
    THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'audit_log เป็น append-only — % ถูกปฏิเสธ', TG_OP
        USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;
