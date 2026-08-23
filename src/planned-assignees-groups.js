// Raggruppa visivamente gli assegnatari del Planning senza modificare gli handler React.
// MutationObserver rende il comportamento stabile anche quando il form viene aperto/chiuso.
const enhanceAssignees = () => {
  document.querySelectorAll('.assignee-choices:not([data-role-groups])').forEach((list) => {
    const buttons = [...list.querySelectorAll(':scope > button')]
    if (!buttons.length) return

    const maintainers = buttons.filter((button) => button.querySelector('small')?.textContent?.trim() === 'manutentore')
    const externals = buttons.filter((button) => button.querySelector('small')?.textContent?.trim() === 'Tecnico esterno')
    if (!maintainers.length && !externals.length) return

    list.dataset.roleGroups = 'true'
    list.classList.add('assignee-role-groups')

    const addGroup = (label, className, entries) => {
      if (!entries.length) return
      const section = document.createElement('section')
      section.className = `assignee-role-group ${className}`
      const heading = document.createElement('div')
      heading.className = 'assignee-role-heading'
      heading.textContent = label
      const grid = document.createElement('div')
      grid.className = 'assignee-role-list'
      entries.forEach((button) => grid.appendChild(button))
      section.append(heading, grid)
      list.appendChild(section)
    }

    addGroup('Manutentori', 'assignee-maintainers', maintainers)
    addGroup('Tecnici esterni', 'assignee-externals', externals)
  })
}

export function initPlannedAssigneeGroups() {
  enhanceAssignees()
  const observer = new MutationObserver(() => enhanceAssignees())
  observer.observe(document.body, { childList: true, subtree: true })
}
