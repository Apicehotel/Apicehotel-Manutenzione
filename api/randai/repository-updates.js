import { checkImplementedRepositoryUpdates } from '../../src/randai/software/repository-updates.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method_not_allowed' })
  const repositories = await checkImplementedRepositoryUpdates()
  const checkedAt = new Date().toISOString()
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
  return res.status(200).json({ ok: true, checkedAt, repositories })
}
