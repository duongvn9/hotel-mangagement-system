/** Cây lau sậy bên bờ hồ: x là chân thân, cao `height`, nghiêng `lean` (đơn vị viewBox). */
const REEDS = [
  { x: 470, height: 250, lean: -14 },
  { x: 496, height: 310, lean: 6 },
  { x: 522, height: 220, lean: 18 },
  { x: 548, height: 280, lean: -6 },
  { x: 574, height: 200, lean: 12 },
  { x: 428, height: 170, lean: -20 },
  { x: 596, height: 260, lean: -10 },
]

const GROUND = 520

/** Cửa sổ sáng đèn của khu nhà gỗ: toạ độ góc trên trái trong viewBox. */
const WINDOWS = [
  [78, 252],
  [122, 252],
  [166, 252],
  [210, 252],
  [78, 292],
  [166, 292],
  [210, 292],
]

/**
 * Mặt hồ lúc hoàng hôn: khu nhà gỗ sáng đèn bên trái, trăng soi xuống mặt nước, lau sậy phía trước.
 * Vẽ hoàn toàn bằng token màu của design system (không có ảnh ngoài nên không bao giờ vỡ ảnh).
 */
export function LakeIllustration({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 640 520"
      role="img"
      aria-label="Mặt hồ yên tĩnh lúc hoàng hôn, hàng lau sậy bên bờ và khu nhà gỗ sáng đèn"
      preserveAspectRatio="xMidYMid slice"
      className={className}
    >
      <rect width="640" height="340" className="fill-pearl-800" />
      <circle cx="470" cy="116" r="78" className="fill-gold-500" opacity="0.14" />
      <circle cx="470" cy="116" r="46" className="fill-gold-200" />
      <path
        d="M0 306 C80 252 150 286 232 258 S392 232 470 266 S586 276 640 250 V346 H0 Z"
        className="fill-pearl-700"
      />

      {/* Khu nhà gỗ */}
      <polygon points="40,222 160,168 280,222" className="fill-pearl-900" />
      <rect x="52" y="222" width="216" height="124" className="fill-pearl-900" />
      {[88, 132, 176, 220].map((x) => (
        <line
          key={x}
          x1={x}
          y1="224"
          x2={x}
          y2="344"
          className="stroke-pearl-800"
          strokeWidth="2"
        />
      ))}
      {WINDOWS.map(([x, y]) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width="24"
          height="28"
          rx="2"
          className="fill-gold-200"
        />
      ))}
      <rect x="122" y="292" width="30" height="54" rx="2" className="fill-brandy-600" />

      {/* Mặt hồ và vệt trăng */}
      <rect y="340" width="640" height="180" className="fill-lake-600" opacity="0.62" />
      <rect x="52" y="346" width="216" height="64" className="fill-pearl-900" opacity="0.32" />
      {[
        [434, 356, 72],
        [446, 374, 52],
        [454, 392, 36],
        [460, 410, 24],
      ].map(([x, y, width]) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width={width}
          height="3"
          rx="1.5"
          className="fill-gold-200"
          opacity="0.55"
        />
      ))}

      {/* Lau sậy phía trước */}
      {REEDS.map(({ x, height, lean }) => {
        const topX = x + lean * 1.6
        const topY = GROUND - height
        return (
          <g key={x}>
            <path
              d={`M${x} ${GROUND} Q${x + lean} ${GROUND - height / 2} ${topX} ${topY}`}
              className="fill-none stroke-reed-700"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <ellipse
              cx={topX}
              cy={topY - 6}
              rx="5"
              ry="17"
              transform={`rotate(${lean} ${topX} ${topY})`}
              className="fill-brandy-400"
            />
          </g>
        )
      })}
      <path
        d="M0 520 V484 C110 470 210 500 330 490 S540 472 640 486 V520 Z"
        className="fill-pearl-900"
      />
    </svg>
  )
}
