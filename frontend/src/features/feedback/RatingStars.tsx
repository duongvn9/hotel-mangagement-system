/** Điểm 1-5 sao, đọc được bằng trình đọc màn hình ("4 trên 5 sao"). */
export function RatingStars({ rating }: { rating: number }) {
  return (
    <span
      className="text-gold-500"
      role="img"
      aria-label={`${rating} trên 5 sao`}
      title={`${rating}/5`}
    >
      {'★'.repeat(rating)}
      <span className="text-stone-300">{'★'.repeat(5 - rating)}</span>
    </span>
  )
}
