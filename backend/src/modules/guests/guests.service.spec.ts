import { Role } from '../../common/constants/role.enum.js';
import { GuestsService } from './guests.service.js';

type MatchedEmail = { _id: string | null };
type Stat = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  lastBookedAt: Date;
  totalBookings: number;
  completedStays: number;
  lastCheckIn: Date | null;
};
type Account = { email: string; fullName: string; phone?: string };

function setup(data: {
  matched: MatchedEmail[];
  stats?: Stat[];
  accounts?: Account[];
}) {
  const aggregate = vi
    .fn()
    .mockResolvedValueOnce(data.matched)
    .mockResolvedValueOnce(data.stats ?? []);
  const bookings = { aggregate };
  const find = vi.fn(() => ({
    select: () => ({ lean: async () => data.accounts ?? [] }),
  }));
  const users = { find };
  const sut = new GuestsService(bookings as never, users as never);
  return { sut, aggregate, find };
}

const query = { q: 'ann', page: 1, limit: 20 };

describe('GuestsService.search', () => {
  it('includes a customer account that has never booked', async () => {
    const { sut } = setup({
      matched: [],
      accounts: [
        { email: 'cara@example.test', fullName: 'Cara', phone: '0900' },
      ],
    });

    const result = await sut.search(query);

    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual({
      name: 'Cara',
      email: 'cara@example.test',
      phone: '0900',
      hasAccount: true,
      totalBookings: 0,
      completedStays: 0,
      lastCheckIn: null,
    });
  });

  it('only searches active customer accounts', async () => {
    const { sut, find } = setup({ matched: [], accounts: [] });

    await sut.search(query);

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ role: Role.Customer, isActive: true }),
    );
  });

  it('merges an account and its bookings into one entry keyed by email', async () => {
    const { sut } = setup({
      matched: [{ _id: 'ann@example.test' }],
      accounts: [
        { email: 'ann@example.test', fullName: 'Ann Account', phone: '0900' },
      ],
      stats: [
        {
          _id: 'ann@example.test',
          name: 'Ann Booking',
          email: 'Ann@Example.test',
          phone: '0911',
          lastBookedAt: new Date('2026-01-02T00:00:00Z'),
          totalBookings: 2,
          completedStays: 1,
          lastCheckIn: new Date('2026-01-01T00:00:00Z'),
        },
      ],
    });

    const result = await sut.search(query);

    expect(result.total).toBe(1);
    // Ưu tiên tên/SĐT từ tài khoản, không lấy từ booking.
    expect(result.items[0]).toMatchObject({
      name: 'Ann Account',
      phone: '0900',
      hasAccount: true,
      totalBookings: 2,
      completedStays: 1,
    });
  });

  it('marks a booking guest with no account as not having one', async () => {
    const { sut } = setup({
      matched: [{ _id: 'bob@example.test' }],
      accounts: [],
      stats: [
        {
          _id: 'bob@example.test',
          name: 'Bob',
          email: 'bob@example.test',
          phone: '0911',
          lastBookedAt: new Date('2026-01-04T00:00:00Z'),
          totalBookings: 1,
          completedStays: 0,
          lastCheckIn: null,
        },
      ],
    });

    const result = await sut.search(query);

    expect(result.items[0]).toMatchObject({ hasAccount: false, name: 'Bob' });
  });

  it('orders guests with bookings before account-only guests', async () => {
    const { sut } = setup({
      matched: [{ _id: 'bob@example.test' }],
      accounts: [{ email: 'cara@example.test', fullName: 'Cara' }],
      stats: [
        {
          _id: 'bob@example.test',
          name: 'Bob',
          email: 'bob@example.test',
          phone: '0911',
          lastBookedAt: new Date('2026-01-04T00:00:00Z'),
          totalBookings: 1,
          completedStays: 0,
          lastCheckIn: null,
        },
      ],
    });

    const result = await sut.search(query);

    expect(result.items.map((item) => item.email)).toEqual([
      'bob@example.test',
      'cara@example.test',
    ]);
    expect(result.items[1]).toMatchObject({
      phone: '',
      hasAccount: true,
      totalBookings: 0,
    });
  });

  it('returns nothing and skips the stats query when no one matches', async () => {
    const { sut, aggregate, find } = setup({ matched: [], accounts: [] });

    const result = await sut.search(query);

    expect(result).toEqual({ items: [], total: 0, page: 1, limit: 20 });
    expect(find).toHaveBeenCalledTimes(1);
    // Chỉ chạy aggregate bước tìm email, không chạy bước thống kê.
    expect(aggregate).toHaveBeenCalledTimes(1);
  });

  it('paginates the merged results', async () => {
    const { sut } = setup({
      matched: [{ _id: 'a@example.test' }, { _id: 'b@example.test' }],
      accounts: [],
      stats: [
        {
          _id: 'a@example.test',
          name: 'A',
          email: 'a@example.test',
          phone: '',
          lastBookedAt: new Date('2026-01-02T00:00:00Z'),
          totalBookings: 1,
          completedStays: 0,
          lastCheckIn: null,
        },
        {
          _id: 'b@example.test',
          name: 'B',
          email: 'b@example.test',
          phone: '',
          lastBookedAt: new Date('2026-01-01T00:00:00Z'),
          totalBookings: 1,
          completedStays: 0,
          lastCheckIn: null,
        },
      ],
    });

    const result = await sut.search({ q: 'x', page: 2, limit: 1 });

    expect(result).toMatchObject({ total: 2, page: 2, limit: 1 });
    expect(result.items.map((item) => item.email)).toEqual(['b@example.test']);
  });
});
