// NIM is digits only, so pre-test and post-test scores can be matched reliably (lib/report.ts compareScores).
export const NIM_MIN = 1
export const NIM_MAX = 20
export const NIM_PATTERN = `[0-9]{${NIM_MIN},${NIM_MAX}}`
export const isValidNim = (nim: string) => new RegExp(`^${NIM_PATTERN}$`).test(nim)
