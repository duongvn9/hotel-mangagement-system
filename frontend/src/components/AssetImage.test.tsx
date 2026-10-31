import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssetImage, RoomGallery } from './AssetImage'
import { assetUrl } from '@/lib/asset-url'

describe('AssetImage', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    })
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    })
  })
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
    render(<RoomGallery images={images} name="Suite" />)
    fireEvent.click(screen.getByRole('button', { name: 'Xem ảnh Suite' }))
    const modal = screen.getByRole('dialog', { name: 'Suite' })
    images.forEach((path, index) => {
      fireEvent.click(within(modal).getByRole('button', { name: `Xem ảnh ${index + 1}` }))
      expect(within(modal).getByRole('img', { name: `Suite — ảnh ${index + 1}` })).toHaveAttribute(
        'src',
        assetUrl(path),
      )
    })
  })

  it('cycles images with arrows and keyboard, then restores focus when closed', () => {
    render(<RoomGallery images={['/images/first.jpg', '/images/last.jpg']} name="Deluxe" />)
    const trigger = screen.getByRole('button', { name: 'Xem ảnh Deluxe' })
    trigger.focus()
    fireEvent.click(trigger)
    const modal = screen.getByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Ảnh trước' }))
    expect(screen.getByRole('status')).toHaveTextContent('Ảnh 2 / 2')
    fireEvent.click(screen.getByRole('button', { name: 'Ảnh tiếp theo' }))
    expect(screen.getByRole('status')).toHaveTextContent('Ảnh 1 / 2')
    fireEvent.keyDown(modal, { key: 'ArrowRight' })
    expect(screen.getByRole('status')).toHaveTextContent('Ảnh 2 / 2')
    fireEvent.keyDown(modal, { key: 'ArrowLeft' })
    expect(screen.getByRole('status')).toHaveTextContent('Ảnh 1 / 2')
    fireEvent.click(screen.getByRole('button', { name: 'Đóng ảnh' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('supports one image and closes on Escape without changing scroll state', () => {
    render(<RoomGallery images={['/images/only.jpg']} name="Standard" />)
    fireEvent.click(screen.getByRole('button', { name: 'Xem ảnh Standard' }))
    expect(screen.queryByRole('button', { name: 'Ảnh tiếp theo' })).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
  })
})
