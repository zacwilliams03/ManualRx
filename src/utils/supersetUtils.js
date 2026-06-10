/**
 * Merges fetched prescription_exercise_groups and prescription_exercises rows
 * into a sorted sessionItems array for use in both SessionEdit and SessionWizard.
 *
 * Each item is one of:
 *   { type: 'exercise', orderIndex, createdAt, ex: prescriptionExerciseRow }
 *   { type: 'superset', orderIndex, createdAt, group: groupRow, exercises: prescriptionExerciseRow[] }
 *
 * Standalone exercises (group_id === null) use their own order_index.
 * Superset groups use the group row's order_index; member exercises are sorted
 * by position_in_group. Tiebreaker: createdAt ASC.
 */
export function buildSessionItems(groups, prescriptionExercises) {
  const items = []

  for (const group of groups) {
    const members = prescriptionExercises
      .filter(pe => pe.group_id === group.id)
      .sort((a, b) => (a.position_in_group ?? 0) - (b.position_in_group ?? 0))
    items.push({
      type: 'superset',
      orderIndex: group.order_index,
      createdAt: group.created_at,
      group,
      exercises: members,
    })
  }

  for (const pe of prescriptionExercises) {
    if (pe.group_id == null) {
      items.push({
        type: 'exercise',
        orderIndex: pe.order_index,
        createdAt: pe.created_at ?? null,
        ex: pe,
      })
    }
  }

  items.sort((a, b) => {
    const ao = a.orderIndex ?? Infinity
    const bo = b.orderIndex ?? Infinity
    if (ao !== bo) return ao - bo
    if (a.createdAt && b.createdAt) return new Date(a.createdAt) - new Date(b.createdAt)
    return 0
  })

  return items
}
