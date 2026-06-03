import { pdf } from '@react-pdf/renderer'
import { AllSessionsPDF } from './AllSessionsPDF'

const BASE_PROPS = {
  clinicName: 'Test Clinic',
  clientName: 'Jane Doe',
  weightUnit: 'kg',
  prescriptions: [
    {
      name: 'Session 1',
      frequencyLabel: 'Daily',
      exercises: [
        { name: 'Squat', sets: 3, reps: 10, weight: 50, therapist_notes: 'Keep back straight', measurement_type: 'reps', bilateral: false },
      ],
    },
  ],
}

describe('AllSessionsPDF', () => {
  test('renders to a non-empty PDF blob', async () => {
    const blob = await pdf(<AllSessionsPDF {...BASE_PROPS} />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('handles empty exercises list without crashing', async () => {
    const props = {
      ...BASE_PROPS,
      prescriptions: [{ name: 'Empty Session', frequencyLabel: 'Weekly', exercises: [] }],
    }
    const blob = await pdf(<AllSessionsPDF {...props} />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
  })

  test('renders multiple prescriptions with a divider between them', async () => {
    const props = {
      ...BASE_PROPS,
      prescriptions: [
        { name: 'Session A', frequencyLabel: 'Daily', exercises: [{ name: 'Squat', sets: 3, reps: 10, weight: 40, therapist_notes: null, measurement_type: 'reps', bilateral: false }] },
        { name: 'Session B', frequencyLabel: 'Weekly', exercises: [{ name: 'Lunge', sets: 2, reps: 12, weight: null, therapist_notes: null, measurement_type: 'reps', bilateral: false }] },
      ],
    }
    const blob = await pdf(<AllSessionsPDF {...props} />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('renders timed exercise without crashing', async () => {
    const props = {
      ...BASE_PROPS,
      prescriptions: [
        {
          name: 'Isometric Session',
          frequencyLabel: 'Daily',
          exercises: [
            { name: 'Wall Sit', sets: 3, reps: 30, weight: null, therapist_notes: null, measurement_type: 'seconds', bilateral: false },
          ],
        },
      ],
    }
    const blob = await pdf(<AllSessionsPDF {...props} />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('renders bilateral exercise without crashing', async () => {
    const props = {
      ...BASE_PROPS,
      prescriptions: [
        {
          name: 'Hip Session',
          frequencyLabel: 'Weekly',
          exercises: [
            { name: 'Hip Hinge', sets: 3, reps: 12, weight: null, therapist_notes: null, measurement_type: 'reps', bilateral: true },
          ],
        },
      ],
    }
    const blob = await pdf(<AllSessionsPDF {...props} />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })
})
