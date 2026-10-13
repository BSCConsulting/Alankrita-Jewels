export const PRIORITY_STATES = ['Andhra Pradesh', 'Telangana'] as const

export const OTHER_STATES = [
  'Andaman and Nicobar Islands', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
  'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
] as const

/** Telangana pincodes start with 50, Andhra Pradesh with 51–53. */
export function stateFromPincode(pincode: string): string | null {
  if (!/^\d{6}$/.test(pincode)) return null
  if (pincode.startsWith('50')) return 'Telangana'
  if (/^5[123]/.test(pincode)) return 'Andhra Pradesh'
  return null
}
