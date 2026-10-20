"""สร้างห้องเรียน mock ครบวงจรบน dev stack ในเครื่อง — 30 คน 5 กลุ่ม 2 งาน ทุกคนตอบครบจนประกาศผล

ต่างจาก seed_figma_demo.py ตรงที่ **ไม่ล้างข้อมูลเดิม** (seed reset=false) — เพิ่มห้องใหม่หนึ่งห้องเท่านั้น
รันซ้ำได้ ทุกครั้งจะได้ห้องใหม่อีกห้อง (ชื่อห้องมีเวลาต่อท้าย)

    docker compose up -d
    python scripts/demo/seed_full_mock.py

ตัวแปร: PAIREVAL_API (ค่าเริ่มต้น http://localhost:8000), PAIREVAL_DB_CONTAINER (paireval-db),
MOCK_INSTRUCTOR / MOCK_INSTRUCTOR_NAME (ค่าเริ่มต้น mock.teacher@kmitl.ac.th), MOCK_STUDENTS (อีเมลจริงคั่นด้วย ,),
MOCK_PENDING (อีเมลที่ยังไม่ตอบ — งานจะยังเปิดรับ ไม่ประกาศผล)
นักศึกษาที่ไม่ได้ระบุเป็น mock01@ … mockNN@kmitl.ac.th จนครบ 30 คน — ทุกบัญชีเข้าผ่าน /api/test/session
"""
import json
import os
import random
import subprocess
import urllib.request
import uuid
from datetime import UTC, datetime, timedelta
from urllib.parse import urlparse

API = os.environ.get("PAIREVAL_API", "http://localhost:8000")
DB_CONTAINER = os.environ.get("PAIREVAL_DB_CONTAINER", "paireval-db")
if urlparse(API).hostname not in ("localhost", "127.0.0.1"):
    raise SystemExit(f"ปฏิเสธ: สคริปต์นี้ใช้ test endpoint และแก้ DB ตรง ใช้ได้กับ API ในเครื่องเท่านั้น ({API})")

rng = random.Random(2569)  # seed คงที่ — รันซ้ำได้คำตอบชุดเดิม ผลอันดับเทียบกันได้
# MOCK_INSTRUCTOR — อีเมลอาจารย์เจ้าของห้อง · MOCK_STUDENTS — อีเมลนักศึกษาจริงคั่นด้วย , (ที่เหลือจนครบ 30 เป็น mock)
INSTRUCTOR = os.environ.get("MOCK_INSTRUCTOR", "mock.teacher@kmitl.ac.th").strip().lower()
REAL_STUDENTS = [e.strip().lower() for e in os.environ.get("MOCK_STUDENTS", "").split(",") if e.strip()]
# MOCK_PENDING — อีเมลที่ยังไม่ตอบ · ถ้ามี งานจะยังเปิดรับอยู่ (ไม่ปิด ไม่ประกาศผล) ให้คนนั้นเข้าไปประเมินเองได้
PENDING = {e.strip().lower() for e in os.environ.get("MOCK_PENDING", "").split(",") if e.strip()}
GROUPS = ["กลุ่มอรุณ", "กลุ่มนที", "กลุ่มพฤกษา", "กลุ่มดารา", "กลุ่มวายุ"]
FIRST = ["กมล", "ขวัญ", "จิรา", "ชนา", "ณัฐ", "ดวงใจ", "ตะวัน", "ทิพย์", "ธีร", "นภา",
         "บุญมี", "ปกรณ์", "ผกา", "พิม", "ภูมิ", "มานพ", "ยุพา", "รัชนี", "ลลิตา", "วรวุฒิ",
         "ศิริ", "สมพร", "หทัย", "อนันต์", "อารีย์", "เอกชัย", "ไอลดา", "กิตติ", "ชุติมา", "ปวีณา"]
LAST = ["ใจดี", "มั่นคง", "รักเรียน", "แสงทอง", "สุขสันต์", "ทองดี", "ศรีสุข", "พากเพียร", "บุญยืน", "เจริญผล"]
_emails = REAL_STUDENTS + [f"mock{i + 1:02d}@kmitl.ac.th" for i in range(30 - len(REAL_STUDENTS))]
# นักศึกษาจริงใช้รหัสเป็นชื่อแสดง (ไม่รู้ชื่อจริง) · กระจายไปคนละกลุ่มด้วยการวนกลุ่ม ไม่กองอยู่กลุ่มแรก
STUDENTS = [(e, f"นักศึกษา {e.split('@')[0]}" if e in REAL_STUDENTS else f"{FIRST[i]} {LAST[i % len(LAST)]}",
             GROUPS[i % len(GROUPS)]) for i, e in enumerate(_emails)]

# คุณภาพแฝงของแต่ละกลุ่ม/คน — คำตอบสุ่มรอบค่านี้ ผลคะแนนจึงมีอันดับชัดแต่ไม่ตรงเป๊ะ
GROUP_SKILL = {g: s for g, s in zip(GROUPS, [1.2, 0.6, 0.0, -0.5, -1.1])}
STUDENT_SKILL = {name: rng.gauss(0, 1) for _, name, _ in STUDENTS}


def call(method, path, token=None, data=None, raw=None, ctype=None, headers=None):
    h = dict(headers or {})
    body = None
    if token:
        h["authorization"] = f"Bearer {token}"
    if data is not None:
        body = json.dumps(data).encode()
        h["content-type"] = "application/json"
    if raw is not None:
        body = raw
        h["content-type"] = ctype
    req = urllib.request.Request(API + path, data=body, method=method, headers=h)
    try:
        with urllib.request.urlopen(req) as r:
            text = r.read().decode()
            return r.status, (json.loads(text) if text else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def must(result, what):
    s, b = result
    if s >= 300:
        raise SystemExit(f"{what} ล้มเหลว {s}: {str(b)[:400]}")
    return b


_tokens = {}


def token(email):
    if email not in _tokens:
        _tokens[email] = must(call("POST", "/api/test/session", data={"email": email}), f"session {email}")["accessToken"]
    return _tokens[email]


def iso(dt):
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def sql(statement):
    """dev เท่านั้น: ย้ายกำหนดส่งไปอดีตหลังทุกคนตอบแล้ว เพื่อให้ปิดรับและประกาศผลได้"""
    out = subprocess.run(["docker", "exec", DB_CONTAINER, "psql", "-U", "paireval", "-d", "paireval", "-c", statement],
                         capture_output=True, text=True)
    if out.returncode:
        raise SystemExit(f"sql ล้มเหลว: {out.stderr.strip()}")
    print("  sql", out.stdout.strip())


def choose(left, right):
    """1 = ซ้ายดีกว่ามาก … 6 = ขวาดีกว่ามาก (ตาม validate_choice)"""
    d = left - right + rng.gauss(0, 0.7)
    for cut, c in ((1.0, 1), (0.4, 2), (0.0, 3), (-0.4, 4), (-1.0, 5)):
        if d > cut:
            return c
    return 6


# ---------------------------------------------------------------- users + room
users = [{"email": INSTRUCTOR, "displayName": os.environ.get("MOCK_INSTRUCTOR_NAME", "อ.ทดสอบ ระบบ")}] + [{"email": e, "displayName": n} for e, n, _ in STUDENTS]
print("seed", must(call("POST", "/api/test/seed", data={"users": users, "reset": False, "privacyAcknowledged": True}), "seed"))
ins = token(INSTRUCTOR)

now = datetime.now(UTC)
room_name = f"[MOCK] วิศวกรรมซอฟต์แวร์ ห้องทดสอบ {now.astimezone().strftime('%d/%m %H:%M')}"
room = must(call("POST", "/api/classrooms", ins, {"name": room_name, "timezone": "Asia/Bangkok",
                                                  "courseCode": "MOCK-101", "semester": "1/2569"}), "classroom")
cid = room["id"]
print("classroom", cid, room_name)

csv = "email,group_name\n" + "\n".join(f"{e},{g}" for e, _, g in STUDENTS)
boundary = uuid.uuid4().hex
raw = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"roster.csv\"\r\n"
       f"Content-Type: text/csv\r\n\r\n{csv}\r\n--{boundary}--\r\n").encode()
print("roster", str(must(call("POST", f"/api/classrooms/{cid}/roster:import", ins, raw=raw,
                              ctype=f"multipart/form-data; boundary={boundary}"), "roster"))[:160])

ASSIGNMENTS = [
    {
        "name": "[MOCK] งานกลุ่มครั้งที่ 1 – ต้นแบบ UI", "ended_days_ago": 10, "groupMax": 20, "indMax": 10,
        "criteria": [
            ("GROUP", "ความสวยงามและใช้งานง่าย", 40, "ผลงานของกลุ่มไหนใช้งานง่ายและน่าใช้กว่า?"),
            ("GROUP", "ความครบถ้วนของฟีเจอร์", 35, "กลุ่มไหนทำฟีเจอร์ได้ครบตามโจทย์มากกว่า?"),
            ("GROUP", "การนำเสนอ", 25, "กลุ่มไหนนำเสนอได้ชัดเจนกว่า?"),
            ("INDIVIDUAL", "การมีส่วนร่วม", 50, "เพื่อนคนไหนมีส่วนร่วมกับงานมากกว่า?"),
            ("INDIVIDUAL", "ความรับผิดชอบ", 30, "เพื่อนคนไหนรับผิดชอบงานที่ได้รับมอบหมายดีกว่า?"),
            ("INDIVIDUAL", "การสื่อสาร", 20, "เพื่อนคนไหนสื่อสารกับทีมได้ดีกว่า?"),
        ],
    },
    {
        "name": "[MOCK] งานกลุ่มครั้งที่ 2 – ระบบต้นแบบใช้งานได้", "ended_days_ago": 1, "groupMax": 30, "indMax": 10,
        "criteria": [
            ("GROUP", "ความถูกต้องของระบบ", 60, "ระบบของกลุ่มไหนทำงานได้ถูกต้องกว่า?"),
            ("GROUP", "คุณภาพโค้ดและเอกสาร", 40, "กลุ่มไหนมีโค้ดและเอกสารที่ดูแลต่อได้ง่ายกว่า?"),
            ("INDIVIDUAL", "การมีส่วนร่วม", 60, "เพื่อนคนไหนมีส่วนร่วมกับงานมากกว่า?"),
            ("INDIVIDUAL", "การสื่อสาร", 40, "เพื่อนคนไหนสื่อสารกับทีมได้ดีกว่า?"),
        ],
    },
]


def answer_all(aid, email):
    t = token(email)
    done = 0
    for side in ("GROUP", "INDIVIDUAL"):
        s, b = call("GET", f"/api/assignments/{aid}/my-evaluations?side={side}", t)
        pairs = b["items"] if s == 200 else []
        for k, p in enumerate(pairs):
            skill = GROUP_SKILL if side == "GROUP" else STUDENT_SKILL
            choice = choose(skill.get(p["leftLabel"], 0), skill.get(p["rightLabel"], 0))
            must(call("PUT", f"/api/comparisons/{p['pairAssignmentId']}", t,
                      {"choice": choice, "timeOnTaskMs": rng.randint(8000, 40000)}), "comparison")
            done += 1
        if pairs:
            must(call("POST", f"/api/assignments/{aid}/submissions", t, {"side": side},
                      headers={"Idempotency-Key": f"mock-{aid}-{email}-{side}"}), f"submit {email} {side}")
    return done


results = []
for spec in ASSIGNMENTS:
    criteria = [{"side": side, "name": n, "weightPct": w, "question": q} for side, n, w, q in spec["criteria"]]
    deadline = now + timedelta(days=3)
    a = must(call("POST", "/api/assignments", ins, {
        "classroomId": cid, "name": spec["name"], "description": "ข้อมูลทดสอบ (mock) สร้างโดย seed_full_mock.py",
        "groupMaxScore": spec["groupMax"], "individualMaxScore": spec["indMax"],
        "groupDeadlineUtc": iso(deadline), "individualDeadlineUtc": iso(deadline),
        "criteria": criteria,
        "groupArtifactUrls": {g: f"https://www.figma.com/proto/mock-{i + 1}" for i, g in enumerate(GROUPS)},
    }), "create assignment")
    aid = a["id"]
    print("assignment", aid, spec["name"])
    print("  publish", str(must(call("POST", f"/api/assignments/{aid}:publish", ins), "publish"))[:160])

    total = sum(answer_all(aid, e) for e, _, _ in STUDENTS if e not in PENDING)
    print(f"  นักศึกษา {30 - len(PENDING)} คนตอบครบ {total} คู่ และส่งแล้ว · ยังไม่ตอบ: {sorted(PENDING) or '-'}")

    if PENDING:
        # งานยังเปิดอยู่: เผยแพร่ไปแล้ว 5 วัน · กำหนดส่งอีก 2 / 5 วัน (ตามลำดับงาน)
        opened = iso(now - timedelta(days=5))
        due = iso(now + timedelta(days=2 + 3 * len(results)))
        sql(f"UPDATE assignment SET created_at = '{opened}', published_at = '{opened}', "
            f"group_deadline_utc = '{due}', individual_deadline_utc = '{due}' WHERE id = '{aid}'")
        results.append(aid)
        continue

    past = iso(now - timedelta(days=spec["ended_days_ago"]))
    sql(f"UPDATE assignment SET group_deadline_utc = '{past}', individual_deadline_utc = '{past}' WHERE id = '{aid}'")
    print("  recompute", call("POST", f"/api/assignments/{aid}:recompute", ins)[0])
    print("  finalize", str(must(call("POST", f"/api/assignments/{aid}:finalize", ins, {"confirmLowConfidence": True}),
                                 "finalize"))[:160])
    # ให้ไทม์ไลน์สมจริง: เผยแพร่ 7 วันก่อนปิดรับ · ประกาศผล 1 วันหลังปิดรับ (ไม่เกินตอนนี้)
    opened = iso(now - timedelta(days=spec["ended_days_ago"] + 7))
    announced = iso(min(now, now - timedelta(days=spec["ended_days_ago"] - 1)))
    sql(f"UPDATE assignment SET created_at = '{opened}', published_at = '{opened}', finalized_at = '{announced}' "
        f"WHERE id = '{aid}'")
    results.append(aid)

print(json.dumps({"classroomId": cid, "assignments": results, "instructor": INSTRUCTOR,
                  "student": STUDENTS[0][0]}, ensure_ascii=False))
