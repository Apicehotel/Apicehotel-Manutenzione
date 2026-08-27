// Compatibility barrel: operational views now live in focused modules.
export { default as InterventionsView } from './operations/InterventionsView.jsx'
export { default as UrgentView } from './operations/UrgentView.jsx'
export { default as MyWorkView } from './operations/MyWorkView.jsx'
export {
  TemperatureView,
  HousekeepingView,
  TechnicianDirectoryView,
  FeedbackView,
  PinView,
  ProfileDetailsView,
  ManualView,
} from './operations/UtilityViews.jsx'

// Legacy exports kept for older imports; active Planning uses PlanningHub.
export { PlanningWork as PlanningWorkView, PlanningSale as PlanningSaleView } from '../planning.jsx'
