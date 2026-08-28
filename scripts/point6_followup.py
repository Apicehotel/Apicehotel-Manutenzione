from pathlib import Path

p=Path('src/randapp/Issues.jsx')
s=p.read_text()
anchor="""  useEffect(() => {
    const timer = window.setTimeout(() => saveDraft('issue', hotel.id, draftOwner, { mode, draft }), 250)
    return () => window.clearTimeout(timer)
  }, [hotel.id, draftOwner, mode, draft])
"""
replacement="""  useEffect(() => {
    const saved = loadDraft('issue', hotel.id, draftOwner)
    setMode(saved?.mode || 'camera')
    setDraft({ location: '', title: '', urgency: 'media', category: 'Varie', photoName: '', photoData: null, roomStatus: null, ...(saved?.draft || {}) })
    setSaveError('')
  }, [hotel.id, draftOwner])
  useEffect(() => {
    const timer = window.setTimeout(() => saveDraft('issue', hotel.id, draftOwner, { mode, draft }), 250)
    return () => window.clearTimeout(timer)
  }, [hotel.id, draftOwner, mode, draft])
"""
if anchor not in s: raise SystemExit('issue autosave anchor missing')
s=s.replace(anchor,replacement,1)
p.write_text(s)

p=Path('src/randapp/PlannedCreateSheet.jsx')
s=p.read_text()
anchor="""  useEffect(() => {
    if (!open || !hotel?.id) return undefined
    const timer = window.setTimeout(() => saveDraft('planned-work', hotel.id, draftOwner, { mode, location, category, notes, scheduledAt, scheduledUntil, assignees, selectedFloorIds }), 250)
    return () => window.clearTimeout(timer)
  }, [open, hotel?.id, draftOwner, mode, location, category, notes, scheduledAt, scheduledUntil, assignees, selectedFloorIds])
"""
replacement="""  useEffect(() => {
    if (!open || !hotel?.id) return
    const saved = loadDraft('planned-work', hotel.id, draftOwner)
    setMode(saved?.mode || 'camera')
    setLocation(saved?.location || '')
    setCategory(saved?.category || 'Varie')
    setNotes(saved?.notes || '')
    setScheduledAt(saved?.scheduledAt || '')
    setScheduledUntil(saved?.scheduledUntil || '')
    setAssignees(saved?.assignees || [])
    setSelectedFloorIds(saved?.selectedFloorIds || [])
    setError('')
  }, [open, hotel?.id, draftOwner])
  useEffect(() => {
    if (!open || !hotel?.id) return undefined
    const timer = window.setTimeout(() => saveDraft('planned-work', hotel.id, draftOwner, { mode, location, category, notes, scheduledAt, scheduledUntil, assignees, selectedFloorIds }), 250)
    return () => window.clearTimeout(timer)
  }, [open, hotel?.id, draftOwner, mode, location, category, notes, scheduledAt, scheduledUntil, assignees, selectedFloorIds])
"""
if anchor not in s: raise SystemExit('planned autosave anchor missing')
s=s.replace(anchor,replacement,1)
p.write_text(s)

p=Path('test/point6-resilience.test.js')
s=p.read_text()
s=s.replace("    assert.match(code, /operationFailed\\(/)\n", "    assert.match(code, /operationFailed\\(/)\n    assert.match(code, /draftOwner/)\n")
s=s.replace("  assert.match(issues, /issue-save-error/)\n", "  assert.match(issues, /issue-save-error/)\n  assert.match(issues, /setDraft\\(\\{ location: '', title: ''/)\n  assert.match(planned, /setLocation\\(saved\\?\\.location/)\n")
p.write_text(s)
