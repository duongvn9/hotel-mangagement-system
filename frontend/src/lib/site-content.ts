/* Nội dung giữ chỗ lấy từ prototype — Khoa duyệt trước khi lên môi trường thật */

export interface SiteContent {
  tagline: string
  address: string
  phone: string
  email: string
  roomCount: number
  intro: string
  /** Dòng ưu đãi ở khối kêu gọi cuối trang chủ (lấy từ prototype, chờ khách sạn xác nhận). */
  offer: string
  testimonials: Testimonial[]
}

export interface Testimonial {
  name: string
  /** 1–5 sao. */
  rating: number
  quote: string
}

export const siteContent: SiteContent = {
  tagline: 'Sang trọng tĩnh lặng bên vịnh biển.',
  address: '12 Trần Phú, Nha Trang',
  phone: '+84 258 000 1234',
  email: 'stay@emilyhotel.vn',
  roomCount: 24,
  intro:
    'Đá travertine, gỗ sồi và vải lanh. Spa tạc từ đá, căn bếp theo mùa chợ, và đội ngũ nhớ cả cách bạn uống cà phê.',
  offer: 'Miễn phí huỷ trước 48 giờ, bữa sáng và đưa đón sân bay cho mọi đặt phòng trực tiếp.',
  // Đánh giá giữ chỗ nhập tay từ prototype; thay bằng đánh giá thật khi có endpoint công khai.
  testimonials: [
    {
      name: 'Phạm Đức Huy',
      rating: 5,
      quote: 'Kỳ nghỉ tuyệt vời — nhân viên còn nhớ tên chúng tôi.',
    },
    { name: 'Hoàng Gia Khang', rating: 4, quote: 'Phòng rất đẹp, bữa sáng nên bắt đầu sớm hơn.' },
    { name: 'Phạm Đức Huy', rating: 5, quote: 'Suite hướng biển đẹp ngỡ ngàng.' },
  ],
}
