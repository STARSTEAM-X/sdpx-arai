# Route Inventory

2026-10-19 · 5 concrete routes +1fallback. ทุกrouteเปิดจริงและมีผลที่ทุก6ขนาดจอ; runtime PASSหมายถึงเข้าหน้า/guard/role stateได้ ไม่ได้รับรองflowหรือFigmaทั้งหมด

| Route | Page | Layout | Login / role | Figma reference | Runtime | Audit status |
|---|---|---|---|---|---|---|
| / | HomePage | SiteNav / SiteFooter | Public | 175:3 | PASS | FAIL · UI-001 / A11Y-001/002 |
| /classrooms | ClassroomsPage | RequireSession / AppNav | Authenticated; membership list | 349:2388, 77:1086, 516:825 | PASS | FAIL · UI-002/009 |
| /classrooms/:classroomId | ClassroomDetailPage | RequireSession / AppNav | OWNER / CO_TEACHER / TA / STUDENT | 330:1914, 330:1057, 268:6135, 516:923 | PASS ทุก4roles | FAIL Owner/Student · UI-003/004; Co-teacher/TA full-frame visual Not Verified |
| /classrooms/:classroomId/assignments/:assignmentId/evaluate | EvaluatePage | RequireSession / AppNav | Member / assigned evaluator; API enforces mutation | 57:3, 516:996 | PASS | FAIL · EVAL-001/002, UI-005/006 |
| /classrooms/:classroomId/assignments/:assignmentId/score | ScorePage | RequireSession / AppNav | Own score; finalized/privacy rules | 60:437, 60:606, 516:1322 | PASS | FAIL · UI-007/008; final/privacy functional checks PASS |
| * | Navigate / | Redirect | Public | NOT APPLICABLE | PASS | NOT APPLICABLE |

Classroomใช้hashsections #overview/#members/#assignments/#scores ไม่ใช่4routesแยก มี5page modules,29component modules(23reachable/6unused),45icon-module exports(includingLogoMark). React19/ReactRouter7/Tailwind4/Vite8, localstate/useSyncExternalStore session, typedfetchAPI; fullversions/forms/API/state/token/sourceinventoryอยู่ [discovery.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/discovery.json>)

Coverageของroute statesและscreenshots: [runtime-summary.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/runtime-summary.json>); Figma bidirectional mapping191frames: [FIGMA_SCREEN_INVENTORY.md](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/FIGMA_SCREEN_INVENTORY.md>). Loading/empty/error/successหลายstatesมีassertionsใน130suiteและauditเพิ่มเติม แต่ไม่มีการรับรองทุกpermutationของทุกcomponent
