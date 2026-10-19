# Notification dropdown and banner alignment · 2026-10-19

The AppNav bell opens a 410px responsive dropdown using the existing notifications
API. Rows link directly to the associated assignment and mark the event read;
icons/actions distinguish published, due, regenerated, assigned, score and appeal
events. The dropdown handles loading, empty and failed requests, retries, polling,
outside dismissal and the shared keyboard menu behavior. No synthetic events are
inserted into the running user's database.

Live browser checks: open dropdown without navigating; empty state; Escape closes
and returns focus to the bell. Populated states are implemented but were not
exercised with this account, which has zero notifications.

The create-first-assignment banner uses the optional centered Banner alignment.
DOM measurement in the running classroom: icon, text and button centers all
553.69px vertically. Other banners retain their default top alignment.

Frontend typecheck, build and 29 unit tests passed; lint has existing warnings
and no warning in NotificationBell. Evidence: `evidence/notification-dropdown/`.
