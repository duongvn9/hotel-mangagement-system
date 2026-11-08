import { fireEvent, render, screen } from '@testing-library/react'
import { ImagePicker } from './ImagePicker'

describe('retained ImagePicker presentation', () => {
  it('keeps the legacy appearance by default', () => {
    const { container } = render(
      <ImagePicker images={[]} name="" onChoose={() => {}} onRemove={() => {}} />,
    )
    expect(container.firstChild).toHaveClass('bg-cream-100/40')
    expect(screen.getByLabelText('Ảnh tiện nghi')).not.toHaveAttribute('multiple')
  })
  it('renders the prototype empty state with an accessible single-file control', () => {
    const { container } = render(
      <ImagePicker
        appearance="prototype"
        images={[]}
        name=""
        onChoose={() => {}}
        onRemove={() => {}}
      />,
    )
    expect(container.firstChild).toHaveClass('border-border', 'bg-surface/40')
    expect(screen.getByLabelText('Ảnh tiện nghi')).toHaveAccessibleDescription(
      'Một ảnh JPG, PNG hoặc WebP, tối đa 5 MB.',
    )
    expect(screen.getByText('0 / 1 ảnh')).toBeInTheDocument()
  })
  it('preserves choose/remove callbacks, long labels, and the viewer action', () => {
    const choose = vi.fn()
    const remove = vi.fn()
    const long = 'TênẢnh'.repeat(80)
    render(
      <ImagePicker
        appearance="prototype"
        images={[{ src: '/image.jpg', label: long }]}
        name={long}
        onChoose={choose}
        onRemove={remove}
      />,
    )
    expect(screen.getByRole('img', { name: long })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Phóng to ảnh 1' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ ảnh 1' }))
    expect(remove).toHaveBeenCalledWith(0)
    const file = new File(['image'], 'new.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText('Ảnh tiện nghi'), { target: { files: [file] } })
    expect(choose).toHaveBeenCalledWith([file])
    expect(screen.getByLabelText('Ảnh tiện nghi')).toHaveValue('')
  })
})
