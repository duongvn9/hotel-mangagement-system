import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { NotFoundPage } from './NotFoundPage'

describe('NotFoundPage', () => {
  it('hiển thị 404 và link về trang chủ', () => {
    render(
      <MemoryRouter initialEntries={['/unknown-path']}>
        <NotFoundPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeInTheDocument()
    expect(screen.getByText('/unknown-path')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Về trang chủ/ })).toHaveAttribute('href', '/')
  })
})
