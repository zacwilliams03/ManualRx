import { pdf } from '@react-pdf/renderer'
import { PrescriptionPDF } from './PrescriptionPDF'

const BASE_PROPS = {
  clinicName: 'Test Clinic',
  clientName: 'Jane Doe',
  prescriptionName: 'Session A',
  weightUnit: 'kg',
  exercises: [
    {
      name: 'Squat', sets: 3, reps: 10, weight: 50,
      therapist_notes: 'Keep back straight',
      measurement_type: 'reps', bilateral: false,
      tempo_eccentric: null, tempo_bottom_pause: null, tempo_concentric: null, tempo_top_pause: null,
      prescription_exercise_sets: [],
    },
  ],
}

describe('PrescriptionPDF', () => {
  test('renders to a non-empty PDF blob', async () => {
    const blob = await pdf(<PrescriptionPDF {...BASE_PROPS} />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('renders with optional frequencyLabel', async () => {
    const blob = await pdf(<PrescriptionPDF {...BASE_PROPS} frequencyLabel="Daily" />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('renders seconds exercise without crashing', async () => {
    const props = {
      ...BASE_PROPS,
      exercises: [
        { name: 'Wall Sit', sets: 3, reps: 45, weight: null, therapist_notes: null,
          measurement_type: 'seconds', bilateral: false,
          tempo_eccentric: null, tempo_bottom_pause: null, tempo_concentric: null, tempo_top_pause: null,
          prescription_exercise_sets: [] },
      ],
    }
    const blob = await pdf(<PrescriptionPDF {...props} />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('renders tempo exercise without crashing', async () => {
    const props = {
      ...BASE_PROPS,
      exercises: [
        { name: 'Nordic Curl', sets: 4, reps: 6, weight: null, therapist_notes: null,
          measurement_type: 'reps', bilateral: false,
          tempo_eccentric: 3, tempo_bottom_pause: 1, tempo_concentric: 2, tempo_top_pause: 0,
          prescription_exercise_sets: [] },
      ],
    }
    const blob = await pdf(<PrescriptionPDF {...props} />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('renders per-set exercise without crashing', async () => {
    const props = {
      ...BASE_PROPS,
      exercises: [
        { name: 'Romanian Deadlift', sets: 3, reps: null, weight: null, therapist_notes: null,
          measurement_type: 'reps', bilateral: false,
          tempo_eccentric: null, tempo_bottom_pause: null, tempo_concentric: null, tempo_top_pause: null,
          prescription_exercise_sets: [
            { set_number: 1, reps: 10, weight: 40 },
            { set_number: 2, reps: 8,  weight: 55 },
            { set_number: 3, reps: 6,  weight: 70 },
          ] },
      ],
    }
    const blob = await pdf(<PrescriptionPDF {...props} />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('renders per-set exercise with tempo without crashing', async () => {
    const props = {
      ...BASE_PROPS,
      exercises: [
        { name: 'Romanian Deadlift', sets: 3, reps: null, weight: null, therapist_notes: 'Keep back flat.',
          measurement_type: 'reps', bilateral: false,
          tempo_eccentric: 3, tempo_bottom_pause: 1, tempo_concentric: 2, tempo_top_pause: 0,
          prescription_exercise_sets: [
            { set_number: 1, reps: 10, weight: 40 },
            { set_number: 2, reps: 8,  weight: 55 },
          ] },
      ],
    }
    const blob = await pdf(<PrescriptionPDF {...props} />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('renders bodyweight exercise without crashing', async () => {
    const props = {
      ...BASE_PROPS,
      exercises: [
        { name: 'Push-up', sets: 3, reps: 15, weight: null, therapist_notes: null,
          measurement_type: 'reps', bilateral: false,
          tempo_eccentric: null, tempo_bottom_pause: null, tempo_concentric: null, tempo_top_pause: null,
          prescription_exercise_sets: [] },
      ],
    }
    const blob = await pdf(<PrescriptionPDF {...props} />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('renders empty exercises array without crashing', async () => {
    const blob = await pdf(<PrescriptionPDF {...BASE_PROPS} exercises={[]} />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })
})
