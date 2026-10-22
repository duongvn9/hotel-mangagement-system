import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { NotFoundPage } from './NotFoundPage'

describe('NotFoundPage', () => {
  it('hiển thị 404 và link về trang chủ', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Về trang chủ' })).toHaveAttribute('href', '/')
  })
})
