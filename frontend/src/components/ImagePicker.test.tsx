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

  it('lets reception attach several photos up to the limit', () => {
    const images = [
      { src: 'blob:a', label: 'Ảnh 1' },
      { src: 'blob:b', label: 'Ảnh 2' },
    ]
    const onRemove = vi.fn()
    render(
      <ImagePicker
        images={images}
        max={5}
        label="Ảnh giấy tờ"
        name="Khoa"
        onChoose={() => {}}
        onRemove={onRemove}
      />,
    )

    expect(screen.getByText('2 / 5 ảnh')).toBeInTheDocument()
    expect(screen.getByLabelText('Ảnh giấy tờ')).toHaveAttribute('multiple')
    expect(screen.getByText(/Tối đa 5 ảnh JPG, PNG hoặc WebP/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ ảnh 2' }))
    expect(onRemove).toHaveBeenCalledWith(1)
  })

  it('stops accepting photos once the limit is reached', () => {
    const images = Array.from({ length: 5 }, (_, index) => ({
      src: `blob:${index}`,
      label: `Ảnh ${index + 1}`,
    }))
    render(
      <ImagePicker
        images={images}
        max={5}
        label="Ảnh giấy tờ"
        name="Khoa"
        onChoose={() => {}}
        onRemove={() => {}}
      />,
    )

    expect(screen.getByText('5 / 5 ảnh')).toBeInTheDocument()
    expect(screen.getByLabelText('Ảnh giấy tờ')).toBeDisabled()
  })
})
