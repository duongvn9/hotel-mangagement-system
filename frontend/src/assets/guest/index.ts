import bay from './bay.jpg'
import dining from './dining.jpg'
import hero from './hero.jpg'
import lobby from './lobby.jpg'
import deluxe from './room-deluxe.jpg'
import family from './room-family.jpg'
import standard from './room-standard.jpg'
import suite from './room-suite.jpg'
import spa from './spa.jpg'

export type GuestImageKey =
  'hero' | 'lobby' | 'standard' | 'deluxe' | 'family' | 'suite' | 'dining' | 'spa' | 'bay'

export const guestImages: Record<GuestImageKey, string> = {
  hero,
  lobby,
  standard,
  deluxe,
  family,
  suite,
  dining,
  spa,
  bay,
}
