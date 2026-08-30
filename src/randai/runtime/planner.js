import { validatePlan } from './contracts.js'

export class RandAIPlanner {
  constructor({ buildPlan } = {}) { this.buildPlan = buildPlan }
  async plan({ objective, context = {}, proposedPlan } = {}) {
    if (!objective?.trim()) throw new TypeError('objective is required')
    const plan = proposedPlan || await this.buildPlan?.({ objective: objective.trim(), context })
    if (!plan) throw new Error('Planner did not produce a plan')
    validatePlan(plan)
    return {
      id: plan.id || `plan-${Date.now()}`,
      objective: objective.trim(),
      successCriteria: [...(plan.successCriteria || [])],
      steps: plan.steps.map((step) => ({
        ...step,
        dependsOn: [...(step.dependsOn || [])],
        strategies: [...(step.strategies || (step.action ? [step.action] : []))],
      })),
    }
  }
}
