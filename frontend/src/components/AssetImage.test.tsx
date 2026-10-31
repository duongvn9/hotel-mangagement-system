import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AssetImage, RoomGallery } from './AssetImage'
import { assetUrl } from '@/lib/asset-url'

describe('AssetImage', () => {
  it('shows initials without requesting an absent image', () => {
    const { container } = render(<AssetImage name="Grand Emily" />)
    expect(screen.getByRole('img', { name: 'Grand Emily' })).toHaveTextContent('GE')
    expect(container.querySelector('img')).toBeNull()
  })

  it('removes a broken image and can load a different path', () => {
    const { container, rerender } = render(<AssetImage path="/images/broken.jpg" name="Emily" />)
    fireEvent.error(screen.getByRole('img'))
    expect(container.querySelector('img')).toBeNull()
    rerender(<AssetImage path="/images/new.jpg" name="Emily" />)
    expect(container.querySelector('img')?.getAttribute('src')).toContain('/images/new.jpg')
  })

  it('preserves gallery order', () => {
    const images = ['/images/03.jpg', '/images/01.jpg', '/images/02.jpg']
    const { container } = render(<RoomGallery images={images} name="Suite" />)
    expect(
      Array.from(container.querySelectorAll('details img')).map((img) => img.getAttribute('src')),
    ).toEqual(images.map(assetUrl))
  })
})
