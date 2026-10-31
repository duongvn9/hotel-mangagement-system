/** Object keys verified against hms; no user avatar files are present. */
export const SEED_ASSETS = {
  'room-types': {
    Standard: [
      '/images/seeds/room-types/standard-01.jpg',
      '/images/seeds/room-types/standard-02.jpg',
      '/images/seeds/room-types/standard-03.jpg',
    ],
    Deluxe: [
      '/images/seeds/room-types/deluxe-01.jpg',
      '/images/seeds/room-types/deluxe-02.jpg',
      '/images/seeds/room-types/deluxe-03.jpg',
    ],
    Suite: [
      '/images/seeds/room-types/suite-01.jpg',
      '/images/seeds/room-types/suite-02.jpg',
      '/images/seeds/room-types/suite-03.jpg',
    ],
  },
  services: {
    'Giặt ủi': '/images/seeds/services/laundry.jpg',
    'Ăn sáng tại phòng': '/images/seeds/services/in-room-breakfast.jpg',
    'Đưa đón sân bay': '/images/seeds/services/airport-transfer.jpg',
    'Đón tiếp khách': '/images/seeds/services/guest-welcome.jpg',
    'Thông tin du lịch': '/images/seeds/services/tourist-information.jpg',
    'Chăm sóc spa': '/images/seeds/services/spa-care.jpg',
  },
  amenities: {
    'Wi-Fi': '/images/seeds/amenities/wifi.svg',
    'Điều hòa': '/images/seeds/amenities/air-conditioning.svg',
    'Bồn tắm': '/images/seeds/amenities/bathtub.svg',
    'Máy sấy tóc': '/images/seeds/amenities/hair-dryer.svg',
    'Điện thoại bàn': '/images/seeds/amenities/desk-phone.svg',
  },
  equipment: {
    'AC-102': '/images/seeds/equipment/ac-102.jpg',
    'TV-102': '/images/seeds/equipment/tv-102.jpg',
    'SAFE-201': '/images/seeds/equipment/safe-201.jpg',
    'HEATER-301': '/images/seeds/equipment/heater-301.jpg',
    'LIFT-01': '/images/seeds/equipment/lift.jpg',
    'GEN-01': '/images/seeds/equipment/gen-01.jpg',
    'PUMP-OLD': '/images/seeds/equipment/pump-old.jpg',
  },
} as const;
