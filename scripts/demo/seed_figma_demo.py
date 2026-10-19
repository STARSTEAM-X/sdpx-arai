"""สร้างข้อมูลเดโมให้ตรงกับเฟรม Figma (ห้องเรียน สมาชิก งาน 4 สถานะ คะแนน อุทธรณ์ สัญญาณคุณภาพ)

ใช้กับ dev stack ในเครื่องเท่านั้น — ล้างข้อมูลทั้งหมดก่อน (seed reset) และแก้กำหนดส่งตรงใน DB ผ่าน docker exec

    docker compose up -d
    python scripts/demo/seed_figma_demo.py

ตัวแปร: PAIREVAL_API (ค่าเริ่มต้น http://localhost:8000), PAIREVAL_DB_CONTAINER (paireval-db)
บัญชีทั้งหมดเข้าผ่าน /api/test/session — อาจารย์ somchai@, นักศึกษา nok@ ton@ prae@ ฯลฯ, co-teacher priya@, TA nont.ta@
"""
import json
import os
import subprocess
import urllib.request
import uuid
from datetime import UTC, datetime, timedelta
from urllib.parse import urlparse

API = os.environ.get("PAIREVAL_API", "http://localhost:8000")
DB_CONTAINER = os.environ.get("PAIREVAL_DB_CONTAINER", "paireval-db")
if urlparse(API).hostname not in ("localhost", "127.0.0.1"):
    raise SystemExit(f"ปฏิเสธ: สคริปต์นี้ล้างข้อมูลทั้งหมด ใช้ได้กับ API ในเครื่องเท่านั้น ({API})")
INSTRUCTOR = "somchai@kmitl.ac.th"
STUDENTS = [
    ("nok@kmitl.ac.th", "นก ใจกล้า", "Aurora"),
    ("ton@kmitl.ac.th", "ต้น มีสุข", "Aurora"),
    ("prae@kmitl.ac.th", "แพร พากเพียร", "Aurora"),
    ("mod@kmitl.ac.th", "มด ขยันดี", "Lyra"),
    ("phu@kmitl.ac.th", "ภู ตั้งตรง", "Lyra"),
    ("fah@kmitl.ac.th", "ฟ้า ใสใจ", "Lyra"),
    ("bee@kmitl.ac.th", "บี รักดี", "Araija"),
    ("jay@kmitl.ac.th", "เจ ตั้งใจ", "Araija"),
    ("kai@kmitl.ac.th", "ไก่ สู้งาน", "Araija"),
]
EMPTY_STUDENT = "67015063@kmitl.ac.th"
EMPTY_TEACHER = "newteacher@kmitl.ac.th"
COTEACHER = "priya@kmitl.ac.th"
TA = "nont.ta@kmitl.ac.th"


def call(method, path, token=None, data=None, raw=None, ctype=None):
    headers = {}
    body = None
    if token:
        headers["authorization"] = f"Bearer {token}"
    if data is not None:
        body = json.dumps(data).encode()
        headers["content-type"] = "application/json"
    if raw is not None:
        body = raw
        headers["content-type"] = ctype
    req = urllib.request.Request(API + path, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as r:
            text = r.read().decode()
            return r.status, (json.loads(text) if text else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def token(email):
    s, b = call("POST", "/api/test/session", data={"email": email})
    assert s == 200, (s, b)
    return b["accessToken"]


def iso(dt):
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


users = [{"email": INSTRUCTOR, "displayName": "อ.สมชาย"}, {"email": EMPTY_STUDENT, "displayName": "สมใจ นาคดี"},
         {"email": EMPTY_TEACHER, "displayName": "อ.วิชัย"}, {"email": COTEACHER, "displayName": "อ.ปรียา"}, {"email": TA, "displayName": "นนท์ ช่วยสอน"}]
users += [{"email": e, "displayName": n} for e, n, _ in STUDENTS]
print("seed", call("POST", "/api/test/seed", data={"users": users, "reset": True, "privacyAcknowledged": False}))
ins = token(INSTRUCTOR)

rooms = {}
for name, code in [("วิศวกรรมซอฟต์แวร์ 1/2569", "CE-SDPX"), ("การออกแบบส่วนต่อประสาน", "CE-HCI"), ("วิศวกรรมซอฟต์แวร์ 2/2568", "CE-SDPX")]:
    sem = "2/2568" if "2568" in name else "1/2569"
    s, b = call("POST", "/api/classrooms", ins, {"name": name, "timezone": "Asia/Bangkok", "courseCode": code, "semester": sem})
    print("classroom", s, name)
    rooms[name] = b["id"]

for cid in list(rooms.values())[:2]:
    csv = "email,group_name\n" + "\n".join(f"{e},{g}" for e, _, g in STUDENTS)
    boundary = uuid.uuid4().hex
    raw = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"roster.csv\"\r\n"
        f"Content-Type: text/csv\r\n\r\n{csv}\r\n--{boundary}--\r\n"
    ).encode()
    s, b = call("POST", f"/api/classrooms/{cid}/roster:import", ins, raw=raw,
                ctype=f"multipart/form-data; boundary={boundary}")
    print("roster", s, str(b)[:120])

print("coteacher", call("POST", f"/api/classrooms/{rooms['การออกแบบส่วนต่อประสาน']}/members", ins, {"email": COTEACHER, "role": "CO_TEACHER"})[0])
print("ta", call("POST", f"/api/classrooms/{rooms['วิศวกรรมซอฟต์แวร์ 1/2569']}/members", ins, {"email": TA, "role": "TA"})[0])
print("archive", call("POST", f"/api/classrooms/{rooms['วิศวกรรมซอฟต์แวร์ 2/2568']}:archive", ins)[0])
now = datetime.now(UTC)
main = rooms["วิศวกรรมซอฟต์แวร์ 1/2569"]


def assignment(name, deadline, finalize=False, rich=False, k_min=None):
    criteria = [{"side": "GROUP", "name": "ประสบการณ์การใช้งาน", "weightPct": 100}]
    extra = {}
    if rich:
        criteria = [
            {"side": "GROUP", "name": "ประสบการณ์การใช้งาน", "weightPct": 40, "question": "ผลงานของกลุ่มไหนใช้งานได้ดีกว่า?"},
            {"side": "GROUP", "name": "ความครบถ้วนของงาน", "weightPct": 35, "question": "กลุ่มไหนส่งผลงานครบตามข้อกำหนดมากกว่า?"},
            {"side": "GROUP", "name": "ความคิดสร้างสรรค์", "weightPct": 25, "question": "ผลงานของกลุ่มไหนมีแนวคิดสร้างสรรค์มากกว่า?"},
            {"side": "INDIVIDUAL", "name": "การมีส่วนร่วม", "weightPct": 100, "question": "เพื่อนคนไหนมีส่วนร่วมกับงานมากกว่า?"},
        ]
        extra = {"individualMaxScore": 5, "individualDeadlineUtc": iso(deadline)}
    s, b = call("POST", "/api/assignments", ins, {
        "classroomId": main, "name": name, "groupMaxScore": 15, "individualMaxScore": 0,
        "groupDeadlineUtc": iso(deadline), "targetCoverage": 2,
        "criteria": criteria, **extra, **({"minComparisons": k_min} if k_min else {}),
        "groupArtifactUrls": {g: f"https://www.figma.com/proto/demo-{g.lower()}" for g in ("Aurora", "Lyra", "Araija")},
    })
    print("assignment", s, name, "" if s == 201 else b)
    aid = b["id"]
    s, b = call("POST", f"/api/assignments/{aid}:publish", ins)
    print("  publish", s, "" if s == 200 else str(b)[:200])
    if finalize:
        s, b = call("POST", f"/api/assignments/{aid}:finalize", ins, {"confirmLowConfidence": True})
        print("  finalize", s, "" if s == 200 else str(b)[:200])
    return aid



def sql(statement):
    """dev เท่านั้น: ย้ายกำหนดส่งไปอดีตหลังนักศึกษาตอบแล้ว เพื่อให้ประกาศผลด้วยข้อมูลจริงได้"""
    out = subprocess.run(["docker", "exec", DB_CONTAINER, "psql", "-U", "paireval", "-d", "paireval", "-c", statement],
                         capture_output=True, text=True)
    print("  sql", out.stdout.strip() or out.stderr.strip())


def answer(aid, email, *, all_pairs=True, submit=True, style="normal"):
    """ให้นักศึกษาตอบ — style 'rushed' ตอบค่าเดิมเร็วผิดปกติ (สร้างสัญญาณ QS-02/QS-05 ให้รายงานคุณภาพ)"""
    t = token(email)
    for side in ("GROUP", "INDIVIDUAL"):
        s, b = call("GET", f"/api/assignments/{aid}/my-evaluations?side={side}", t)
        pairs = b["items"] if s == 200 else []
        if not all_pairs:
            pairs = pairs[:1]
        for k, p in enumerate(pairs):
            if style == "rushed":
                choice, ms = 2, 900
            elif side == "GROUP" and p["criterionName"] != "ความคิดสร้างสรรค์":
                # Figma J28c: เกณฑ์ UX / ความครบถ้วน ผู้ประเมินเห็นตรงกัน (Aurora > Lyra > Araija)
                rank = {"Aurora": 0, "Lyra": 1, "Araija": 2}
                left_better = rank.get(p["leftLabel"], 9) < rank.get(p["rightLabel"], 9)
                choice = (2 if left_better else 5) if (k + len(email)) % 5 else (3 if left_better else 4)
                ms = 9000 + 1500 * k
            elif side == "GROUP":
                # ความคิดสร้างสรรค์: เพื่อนกลุ่มเดียวกันเลือกคนละฝั่งของคู่เดียวกัน → QS-07 "ผู้ประเมินเห็นไม่ตรงกัน"
                choice = 5 if email.split("@")[0] in {"prae", "fah", "jay"} else 2
                ms = 9000 + 1500 * k
            else:
                choice = [2, 5, 3, 4, 1, 6, 2, 5][(k + len(email)) % 8]
                ms = 9000 + 1500 * k
            call("PUT", f"/api/comparisons/{p['pairAssignmentId']}", t, {"choice": choice, "timeOnTaskMs": ms})
        if submit and pairs:
            req = urllib.request.Request(API + f"/api/assignments/{aid}/submissions", method="POST",
                                         data=json.dumps({"side": side}).encode(),
                                         headers={"authorization": f"Bearer {t}", "content-type": "application/json",
                                                  "Idempotency-Key": f"seed-{aid}-{email}-{side}"})
            try:
                urllib.request.urlopen(req)
            except urllib.error.HTTPError:
                pass


def finished(name, ago_days, k_min=None):
    """งานที่ประกาศผลแล้วพร้อมคะแนนจริง: สร้างแบบกำหนดส่งอนาคต → ทุกคนตอบ → ย้ายกำหนดส่งไปอดีต → คำนวณ → ประกาศ"""
    aid = assignment(name, now + timedelta(days=3), rich=True, k_min=k_min)
    for email, _, _ in STUDENTS:
        answer(aid, email)
    past = iso(now - timedelta(days=ago_days))
    sql(f"UPDATE assignment SET group_deadline_utc = '{past}', individual_deadline_utc = '{past}' WHERE id = '{aid}'")
    print("  recompute", call("POST", f"/api/assignments/{aid}:recompute", ins)[0])
    s, b = call("POST", f"/api/assignments/{aid}:finalize", ins, {"confirmLowConfidence": True})
    print("  finalize", s, "" if s == 200 else str(b)[:200])
    return aid


first = finished("งานฝึกประเมิน ครั้งที่ 1", 9)
# k_min 2 ให้กลุ่ม 3 คนเห็นคะแนนรายบุคคล (ST30) · ครั้งที่ 1 คงค่าเริ่มต้นไว้โชว์สถานะซ่อน (ST32)
second = finished("งานฝึกประเมิน ครั้งที่ 2", 2, k_min=2)
for email, msg in [
    ("nok@kmitl.ac.th", "คิดว่าคะแนนเกณฑ์ความครบถ้วนต่ำกว่าที่ควร กลุ่มเราส่งครบทุกข้อตามที่อาจารย์กำหนดไว้ในเอกสาร"),
    ("ton@kmitl.ac.th", "ตัวคูณการมีส่วนร่วมของผมน่าจะผิด เพราะประเมินครบทุกคู่และกดส่งก่อนกำหนดแล้วครับ"),
]:
    s, b = call("POST", f"/api/assignments/{second}/appeals", token(email), {"message": msg})
    print("appeal", s, email, "" if s == 201 else str(b)[:160])

expired = assignment("งานฝึกประเมิน ครั้งที่ 4", now + timedelta(days=3))
answer(expired, "mod@kmitl.ac.th", all_pairs=False, submit=False)
sql(f"UPDATE assignment SET group_deadline_utc = '{iso(now - timedelta(hours=2))}' WHERE id = '{expired}'")

open_one = assignment("งานกลุ่มครั้งที่ 1", now + timedelta(days=1, hours=10), rich=True)
answer(open_one, "nok@kmitl.ac.th", all_pairs=False, submit=False)
for email in ("ton@kmitl.ac.th", "prae@kmitl.ac.th", "mod@kmitl.ac.th", "fah@kmitl.ac.th", "phu@kmitl.ac.th",
              "jay@kmitl.ac.th", "kai@kmitl.ac.th"):
    answer(open_one, email)
answer(open_one, "bee@kmitl.ac.th", style="rushed")
# Figma J26/J28 "รวมอาจารย์" — อาจารย์ประเมินเองทุกคู่ฝั่งกลุ่ม ทำให้แต่ละเกณฑ์มีคู่ผู้ประเมินพอคำนวณ QS-07 (≥ 10)
s_q, quality = call("GET", f"/api/assignments/{open_one}/quality", ins)
rank = {"Aurora": 0, "Lyra": 1, "Araija": 2}
for pc in quality["pairCoverage"] if s_q == 200 else []:
    if pc["side"] != "GROUP":
        continue
    a_better = rank.get(pc["itemALabel"], 9) < rank.get(pc["itemBLabel"], 9)
    choice = (2 if a_better else 5) if pc["criterionName"] != "ความคิดสร้างสรรค์" else 5
    s_i, _ = call("POST", f"/api/assignments/{open_one}/instructor-comparisons", ins, {
        "criterionId": pc["criterionId"], "itemAId": pc["itemAId"], "itemBId": pc["itemBId"],
        "choice": choice, "timeOnTaskMs": 20000, "reason": "อาจารย์ประเมินเพิ่มเพื่อเทียบกับคำตอบนักศึกษา",
    })
    print("  instructor", s_i, pc["criterionName"], pc["itemALabel"], "–", pc["itemBLabel"])
print("  recompute", call("POST", f"/api/assignments/{open_one}:recompute", ins)[0])

print(json.dumps({"rooms": rooms, "student": STUDENTS[0][0], "empty": EMPTY_STUDENT}, ensure_ascii=False))
