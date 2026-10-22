/**
 * Quy ước dữ liệu chung (hợp đồng H1). Mọi schema trong src/modules phải theo:
 *
 * - Tên collection: số nhiều, chữ thường. Mongoose tự đổi tên model `User` thành `users`,
 *   chỉ khai báo `collection` khi tên tự sinh sai (ví dụ `Amenity` -> `amenities` là đúng).
 * - `@Schema({ timestamps: true })` để có `createdAt`, `updatedAt`.
 * - Xoá mềm: `@Prop({ default: true }) isActive: boolean`. Không xoá cứng dữ liệu nghiệp vụ.
 * - Tiền: số nguyên VND (`Number`, kiểm tra bằng `isMoneyVnd`), không dùng số thực.
 * - Thời điểm (`Date`) lưu UTC như mặc định của MongoDB.
 * - Ngày nghiệp vụ (ngày check-in/check-out, ngày báo cáo) tính theo giờ Việt Nam:
 *   dùng `toBusinessDate()`, lưu dạng chuỗi `YYYY-MM-DD`.
 * - Tham chiếu: `@Prop({ type: Types.ObjectId, ref: 'Room' })`, tên ref là tên model.
 */
export const BUSINESS_TIMEZONE = 'Asia/Ho_Chi_Minh';

const businessDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Ngày nghiệp vụ `YYYY-MM-DD` theo giờ Việt Nam của một thời điểm. */
export const toBusinessDate = (date: Date = new Date()): string =>
  businessDateFormat.format(date);

/** Tiền hợp lệ: số nguyên VND không âm. */
export const isMoneyVnd = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;
