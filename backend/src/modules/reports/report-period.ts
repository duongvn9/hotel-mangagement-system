import { BadRequestException } from '@nestjs/common';
import { toBusinessDate } from '../../common/database/conventions.js';

export const REPORT_DAY_MS = 86_400_000;
export function reportPeriod(from: string, to: string) {
  const boundary = (day: string) => {
    const date = new Date(`${day}T00:00:00.000+07:00`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      !Number.isFinite(date.getTime()) ||
      toBusinessDate(date) !== day
    )
      throw new BadRequestException('Ngày lịch phải hợp lệ theo YYYY-MM-DD');
    return date;
  };
  const start = boundary(from);
  const last = boundary(to);
  const days = (last.getTime() - start.getTime()) / REPORT_DAY_MS + 1;
  if (days < 1)
    throw new BadRequestException('Ngày từ phải trước hoặc bằng ngày đến');
  if (days > 366)
    throw new BadRequestException('Kỳ báo cáo không quá 366 ngày');
  return { start, end: new Date(last.getTime() + REPORT_DAY_MS), days };
}
/** Iterate Vietnam calendar days; monthly edge buckets intentionally represent partial months. */
export function reportBuckets(
  from: string,
  to: string,
  granularity: 'day' | 'month',
) {
  const { start, days } = reportPeriod(from, to);
  return [
    ...new Set(
      Array.from({ length: days }, (_, i) => {
        const day = toBusinessDate(
          new Date(start.getTime() + i * REPORT_DAY_MS),
        );
        return granularity === 'month' ? day.slice(0, 7) : day;
      }),
    ),
  ];
}
