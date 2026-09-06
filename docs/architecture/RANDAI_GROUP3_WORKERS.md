# Group 3 worker boundary

Existing cheap/event-driven schedules are not migrated merely to use the new runtime. Urgency remains trigger-driven, weather/sensors/reminders retain their governed schedules until a measured durability problem exists. RandDurableRuntime is for multi-step/long-running/resumable work such as Repo Radar scans, RandCore deep checks, procedure ingestion/approval and future invoice analysis. Migration is workload-by-workload with idempotency and rollback, never a big-bang scheduler replacement.
