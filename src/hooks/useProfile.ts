import { DEFAULT_PROFILE_NAME } from '../lib/constants'
import { useSetting } from './useSetting'

export function useProfile() {
  const storedName = useSetting<string>('profileName', DEFAULT_PROFILE_NAME)
  const storedPhoto = useSetting<string>('profilePhoto', '')

  const name =
    typeof storedName === 'string' && storedName.trim()
      ? storedName.trim()
      : DEFAULT_PROFILE_NAME
  const photo = typeof storedPhoto === 'string' ? storedPhoto.trim() : ''

  return { name, photo }
}
