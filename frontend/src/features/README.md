# features/

Mỗi nhóm chức năng một thư mục, khớp với module backend:

```
features/bookings/
├── api.ts            # hàm gọi API (dùng api từ @/lib/api-client)
├── hooks.ts          # useQuery / useMutation
├── components/       # component riêng của feature
├── pages/            # trang của feature
└── routes.tsx        # mảng route, gộp vào src/app/router.tsx
```

Component dùng chung nhiều feature (Button, Input, Modal, Table…) để ở `src/components/`.
Màu, font, khoảng cách luôn dùng token của design system (xem `DESIGN.md`), không viết mã hex trong component.
