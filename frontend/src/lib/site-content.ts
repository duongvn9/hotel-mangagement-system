/* Nội dung giữ chỗ lấy từ prototype — Khoa duyệt trước khi lên môi trường thật */

export interface SiteContent {
  tagline: string
  address: string
  phone: string
  email: string
  roomCount: number
  intro: string
}

export const siteContent: SiteContent = {
  tagline: 'Sang trọng tĩnh lặng bên vịnh biển.',
  address: '12 Trần Phú, Nha Trang',
  phone: '+84 258 000 1234',
  email: 'stay@emilyhotel.vn',
  roomCount: 24,
  intro:
    'Đá travertine, gỗ sồi và vải lanh. Spa tạc từ đá, căn bếp theo mùa chợ, và đội ngũ nhớ cả cách bạn uống cà phê.',
}
