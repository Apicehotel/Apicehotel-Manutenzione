# CHANGE LOG: 013-operational-chaos-hardening-v1

## Changes
- 2026-09-25: failure mode reale trovato durante audit: IssueDetail chiudeva prima dell'esito async; Reminder/Supply ingoiavano failure. Introdotto guard condiviso e chaos gate CI.
