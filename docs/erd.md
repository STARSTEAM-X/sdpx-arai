# ER Diagram — PairEval (M1)

> ตัดมาจาก PRD §11 เฉพาะตารางที่ **M1 Walking Skeleton** ต้องใช้
> ตารางที่เหลือ (`comparison_revision`, `score_override`, `audit_event`, `notification`, `appeal`)
> อยู่ในหัวข้อ "ยังไม่ทำใน M1" ด้านล่าง

```mermaid
erDiagram
    USER ||--o{ CLASSROOM_MEMBER : "เป็นสมาชิก"
    CLASSROOM ||--o{ CLASSROOM_MEMBER : "มีสมาชิก"
    CLASSROOM ||--o{ GROUP_ENTITY : "มีกลุ่ม"
    CLASSROOM ||--o{ ASSIGNMENT : "มีงาน"
    GROUP_ENTITY ||--o{ CLASSROOM_MEMBER : "จัดนักศึกษาเข้ากลุ่ม"
    ASSIGNMENT ||--o{ CRITERION : "กำหนดเกณฑ์"
    ASSIGNMENT ||--o{ PAIR_ASSIGNMENT : "สร้างคู่ประเมิน"
    CRITERION ||--o{ PAIR_ASSIGNMENT : "ระบุขอบเขตของคู่"
    PAIR_ASSIGNMENT ||--|| COMPARISON : "รับคำตอบได้ 1 ครั้ง"
    USER ||--o{ COMPARISON : "ส่งคำตอบ"
    ASSIGNMENT ||--o{ COMPUTED_SCORE : "ให้ผลคะแนน"

    USER {
        uuid id PK
        string email_normalized UK "lowercase, ตัด dot และ +tag"
        string email_raw
        string display_name
        string google_sub UK "nullable จนกว่าจะ login ครั้งแรก"
        enum status "PENDING|ACTIVE|DISABLED"
        timestamptz created_at
        timestamptz last_login_at
    }

    CLASSROOM {
        uuid id PK
        string name
        string slug UK
        string timezone
        string_array allowed_email_domains
        enum status "ACTIVE|ARCHIVED"
        uuid created_by FK
    }

    CLASSROOM_MEMBER {
        uuid id PK
        uuid classroom_id FK
        uuid user_id FK
        enum role "OWNER|CO_TEACHER|TA|STUDENT"
        uuid group_id FK "nullable — เฉพาะ STUDENT"
        timestamptz joined_at
    }

    GROUP_ENTITY {
        uuid id PK
        uuid classroom_id FK
        string name "UNIQUE ภายใน classroom"
    }

    ASSIGNMENT {
        uuid id PK
        uuid classroom_id FK
        string name
        string artifact_url
        numeric group_max_score
        numeric individual_max_score
        timestamptz group_deadline_utc
        timestamptz individual_deadline_utc
        int target_coverage "default 5"
        int max_workload "default 8"
        bigint pairing_seed "ทำให้ generate ซ้ำได้ผลเดิม"
        enum status "DRAFT|PUBLISHED|OPEN|CLOSED|FINALIZED"
    }

    CRITERION {
        uuid id PK
        uuid assignment_id FK
        enum side "GROUP|INDIVIDUAL"
        string name
        numeric weight_pct "ผลรวมต่อ side ต้อง = 100"
        int display_order
    }

    PAIR_ASSIGNMENT {
        uuid id PK
        uuid assignment_id FK
        uuid criterion_id FK
        enum side "GROUP|INDIVIDUAL"
        uuid item_a_id "group หรือ user ตาม side"
        uuid item_b_id
        uuid evaluator_user_id FK
        uuid display_left_item_id "สุ่มซ้ายขวากัน position bias"
        int generation
        enum source "AUTO|INSTRUCTOR_EXTRA"
    }

    COMPARISON {
        uuid id PK
        uuid pair_assignment_id FK UK
        uuid evaluator_user_id FK
        int choice "1-6 ไม่มีค่ากลาง"
        enum status "DRAFT|SUBMITTED|EXCLUDED"
        int time_on_task_ms
        timestamptz submitted_at
    }

    COMPUTED_SCORE {
        uuid id PK
        uuid assignment_id FK
        uuid criterion_id FK
        uuid item_id
        int comparison_count
        numeric quality_index
        numeric score_ratio
        numeric weighted_score
        bool is_final
    }
```

## Cardinality ที่ต้องอธิบายให้ได้

| ความสัมพันธ์ | แบบ | เหตุผล |
|---|---|---|
| `USER` ↔ `CLASSROOM` | **N:M** ผ่าน `CLASSROOM_MEMBER` | 1 คนเป็น instructor ใน classroom หนึ่งและเป็น student ในอีก classroom ได้ (FR-AUTHZ-03) |
| `PAIR_ASSIGNMENT` ↔ `COMPARISON` | **1:1** | 1 คู่ที่มอบให้ evaluator คนหนึ่ง มีคำตอบปัจจุบันได้แค่แถวเดียว (`pair_assignment_id` เป็น UNIQUE) ประวัติเก็บแยกใน `comparison_revision` |
| `ASSIGNMENT` ↔ `PAIR_ASSIGNMENT` | 1:N | pair ทั้งหมดถูกสร้างตอน publish และเก็บลง DB ไม่สุ่มตอน runtime (FR-PAIR-01) |
| `CLASSROOM_MEMBER` → `GROUP_ENTITY` | N:1 nullable | เฉพาะ STUDENT ที่อยู่ในกลุ่ม · instructor/TA ไม่มีกลุ่ม |

## กฎความถูกต้องที่จะกลายเป็น test ใน WS-03

| ID | Rule | test ที่ควรมี |
|---|---|---|
| DR-01 | เฉพาะ `comparison.status = SUBMITTED` ที่เข้าสู่การคำนวณ | ให้ DRAFT ปนเข้าไปแล้วคะแนนต้องไม่เปลี่ยน |
| DR-02 | ลบ `pair_assignment` ไม่ได้ถ้ามี comparison ที่ SUBMITTED | ลองลบแล้วต้องถูกปฏิเสธ |
| DR-03 | `computed_score` ที่ `is_final = true` เป็น immutable | แก้ตรง ๆ ต้องไม่ได้ ต้องผ่าน `score_override` |
| DR-04 | เก็บคะแนนเป็น `numeric` ไม่ใช่ `float` | ทดสอบการปัดเศษด้วยเลขที่ float พลาด เช่น 0.1 + 0.2 |
| DR-05 | timestamp ทั้งหมดเป็น UTC | ส่งเวลาต่าง timezone เข้าไปแล้วเก็บออกมาต้องตรงกัน |
| — | `item_a_id <> item_b_id` | สร้าง pair ที่เทียบกับตัวเองต้องไม่ได้ |
| — | `SUM(weight_pct)` ต่อ side = 100 | publish ด้วยน้ำหนักรวม 90 ต้องถูกปฏิเสธ |

## ยังไม่ทำใน M1

`comparison_revision` · `score_override` · `audit_event` · `notification` · `appeal`

ตัดออกเพราะไม่จำเป็นต่อการปิด loop `login → ประเมิน → เห็นคะแนน`
แต่ **`audit_event` ห้ามลืม** — PRD §19 ระบุว่า `FR-AUDIT-01` เป็นข้อที่ห้ามตัด
เพราะถ้าไม่เก็บตั้งแต่แรกจะย้อนไปสร้างข้อมูลเก่าไม่ได้ จะเพิ่มใน M3
