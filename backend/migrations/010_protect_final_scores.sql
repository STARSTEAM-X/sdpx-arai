-- DR-03 — final score เป็น immutable แม้มี code path ใหม่ยิง SQL ตรงในอนาคต
CREATE OR REPLACE FUNCTION protect_final_computed_score() RETURNS trigger AS $$
BEGIN
    IF OLD.is_final THEN
        RAISE EXCEPTION 'computed_score final เป็น immutable — % ถูกปฏิเสธ', TG_OP
            USING ERRCODE = 'check_violation';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS computed_score_final_no_change ON computed_score;
CREATE TRIGGER computed_score_final_no_change
    BEFORE UPDATE OR DELETE ON computed_score
    FOR EACH ROW EXECUTE FUNCTION protect_final_computed_score();
