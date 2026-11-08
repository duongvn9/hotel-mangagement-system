import { render, screen } from '@testing-library/react'
import { DataTable } from './DataTable'

describe('DataTable server accessibility', () => {
  it('names the table and preserves row headers, search limits and pending pagination', () => {
    render(
      <DataTable
        rows={[{ id: '1', name: 'Long name '.repeat(30) }]}
        columns={[{ key: 'name', header: 'Tên', rowHeader: true }]}
        caption="Danh sách"
        scrollLabel="Danh sách, cuộn ngang"
        searchValue=""
        onSearchChange={() => {}}
        searchAriaLabel="Tìm theo tên"
        searchMaxLength={100}
        page={2}
        totalPages={3}
        onPageChange={() => {}}
        paginationDisabled
        paginationSummary="21 kết quả"
      />,
    )
    expect(screen.getByRole('table', { name: 'Danh sách' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Danh sách, cuộn ngang' })).toHaveAttribute(
      'tabindex',
      '0',
    )
    expect(screen.getByRole('rowheader')).toHaveTextContent('Long name')
    expect(screen.getByRole('searchbox')).toHaveAttribute('maxlength', '100')
    expect(screen.getByRole('button', { name: 'Trang trước' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled()
    expect(screen.getByText('21 kết quả')).toBeInTheDocument()
  })
})
