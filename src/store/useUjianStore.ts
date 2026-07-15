import { create } from "zustand"

interface UjianState {
  currentUjianId: string | null
  answers: Record<string, string>
  raguRagu: string[]
  currentNomor: number
  waktuTersisa: number
  isSubmitting: boolean
  setCurrentUjian: (id: string) => void
  setAnswer: (soalId: string, jawaban: string) => void
  toggleRaguRagu: (soalId: string) => void
  setCurrentNomor: (nomor: number) => void
  setWaktuTersisa: (waktu: number) => void
  setIsSubmitting: (val: boolean) => void
  reset: () => void
}

export const useUjianStore = create<UjianState>((set) => ({
  currentUjianId: null,
  answers: {},
  raguRagu: [],
  currentNomor: 1,
  waktuTersisa: 0,
  isSubmitting: false,
  setCurrentUjian: (id) => set({ currentUjianId: id }),
  setAnswer: (soalId, jawaban) =>
    set((state) => ({ answers: { ...state.answers, [soalId]: jawaban } })),
  toggleRaguRagu: (soalId) =>
    set((state) => ({
      raguRagu: state.raguRagu.includes(soalId)
        ? state.raguRagu.filter((id) => id !== soalId)
        : [...state.raguRagu, soalId],
    })),
  setCurrentNomor: (nomor) => set({ currentNomor: nomor }),
  setWaktuTersisa: (waktu) => set({ waktuTersisa: waktu }),
  setIsSubmitting: (val) => set({ isSubmitting: val }),
  reset: () =>
    set({
      currentUjianId: null,
      answers: {},
      raguRagu: [],
      currentNomor: 1,
      waktuTersisa: 0,
      isSubmitting: false,
    }),
}))
