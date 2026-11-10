# Bối cảnh dự án
`sales-web` là website tĩnh song ngữ (VI ở gốc `/`, EN ở `/en/`) giới thiệu dịch vụ
website/app/domain-hosting-email/chuyển đổi số, deploy trên Vercel. Không có framework,
không có database. Backend hiện tại chỉ có `api/consultation.js` (Vercel Node function,
CommonJS) nhận form tư vấn và gửi email qua Resend. Frontend: HTML tĩnh, `css/site.css`,
`js/site.js`, hệ thống i18n bằng `data-i18n` (`js/i18n.js`, `js/lang/vi.js|en.js`).
Các file `css/style.css`, `css/skins/`, `css/style-switcher.css`, `js/style-switcher.js`,
`js/script.js`, `blog-single.html` là phần di sản của template cũ.

# Mục tiêu đang làm
Thêm trang quản trị `/admin` để quản lý lead (yêu cầu tư vấn), dùng Supabase
(Postgres + Auth). Chỉ làm Giai đoạn 1 (quản lý lead). KHÔNG làm CMS blog/dự án.

# Quy tắc bắt buộc
1. Không sửa nội dung, bố cục hay style của các trang public hiện có, kể cả các
   placeholder dạng `[... — cần cập nhật]`. Chỉ sửa khi bước hiện tại yêu cầu rõ.
2. Giữ stack hiện tại: HTML/CSS/JS thuần, không thêm framework, không thêm bước build
   cho phần public. Admin cũng là HTML/JS thuần; thư viện ngoài chỉ nạp từ CDN với phiên
   bản ghim cụ thể.
3. Giao diện admin tái sử dụng biến màu và phong cách trong `css/site.css`.
   Admin viết bằng tiếng Việt, không cần i18n.
4. Tuyệt đối không commit secret. Mọi key đọc từ biến môi trường. Service role key chỉ
   được dùng trong `api/` (server), không bao giờ xuất hiện trong file phục vụ cho trình duyệt.
   Anon key và Supabase URL được phép xuất hiện ở frontend.
5. Dữ liệu từ người dùng luôn được validate ở server và escape khi hiển thị (chống XSS).
   Trong admin không dùng `innerHTML` với dữ liệu lead; dùng `textContent`.
6. Không xóa file di sản và không đổi tên/di chuyển file ngoài phạm vi yêu cầu.
   Nếu thấy nên dọn, ghi vào mục "Đề xuất" trong báo cáo cuối thay vì tự làm.
7. Sau mỗi thay đổi liên quan i18n chạy `node scripts/check-i18n.js`.
8. Trước khi báo hoàn thành: tự chạy kiểm tra có thể chạy được (lint cú pháp bằng
   `node --check`, test script nếu có), rồi liệt kê rõ phần nào đã kiểm chứng, phần nào
   chưa thể kiểm chứng (ví dụ cần Supabase thật).
9. Nếu yêu cầu mơ hồ hoặc cần quyết định ngoài phạm vi, hỏi lại thay vì đoán.
10. Báo cáo cuối mỗi lần làm gồm: danh sách file đã tạo/sửa, cách chạy/kiểm tra,
    biến môi trường mới, các việc bạn (chủ dự án) cần làm thủ công.