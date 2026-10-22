# News Portal – Đề 19

Website tin tức thực hành dùng Node.js, Express, EJS, MySQL và Docker Compose. Website có trang danh sách tin, lọc theo danh mục, trang chi tiết và khu vực admin quản lý bài viết.

## Triển khai trên máy mới

Cần Docker Desktop và Docker Compose v2. Tạo file `.env` cục bộ từ mẫu; `-NoClobber` giúp tránh ghi đè nếu file đã có:

```powershell
Copy-Item .env.example .env -NoClobber
```

Mở `.env` và thay tất cả giá trị `replace_with_...` bằng secret riêng. Có thể tạo secret ngẫu nhiên bằng `openssl rand -hex 32`. Giữ `COMPOSE_PROJECT_NAME=news-portal`. Không commit hoặc gửi file `.env`.

Kiểm tra cấu hình rồi dựng các service:

```powershell
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

Theo dõi khởi tạo nếu service chưa healthy:

```powershell
docker compose logs --tail 100 mysql app nginx phpmyadmin
```

## MySQL và khởi tạo lần đầu

MySQL dùng database `news_portal`, application user `news_user`, server charset `utf8mb4` và collation `utf8mb4_0900_ai_ci`. MySQL chỉ nằm trong backend network, không publish cổng database ra host.

Trên datadir trống, MySQL image tạo database và application user từ biến môi trường trước, rồi chạy các file theo thứ tự tên:

1. `database/init/00-create-exporter-user.sh`: gọi trực tiếp MySQL client để tạo user `exporter` và cấp các quyền cần cho exporter. Script không phụ thuộc helper nội bộ `docker_process_sql`.
2. `database/schema.sql`: tạo `users`, `categories`, `posts` với khóa ngoại và `utf8mb4`.
3. `database/seed.sql`: thêm tài khoản admin placeholder, danh mục và bài viết mẫu.

Các script trong `/docker-entrypoint-initdb.d` chỉ chạy tự động khi datadir được khởi tạo lần đầu. Nếu MySQL đã có dữ liệu, thay đổi file init không tự chạy lại. Khi gặp lỗi init, xem log và xử lý theo migration có kiểm soát; không xóa volume để ép chạy lại. Không dùng `docker compose down -v`.

Compose dùng named volumes `news_portal_*` để giữ database và dữ liệu monitoring qua các lần dựng lại container.

## Truy cập và cổng

- Website qua Nginx: <http://localhost:8089> → `nginx:80` → `app:4000`.
- phpMyAdmin: <http://localhost:8083>; máy chủ MySQL là `mysql`, đăng nhập bằng `news_user` và `MYSQL_PASSWORD`.
- Grafana: <http://localhost:3001> (tài khoản `admin`, mật khẩu `GRAFANA_ADMIN_PASSWORD`).
- Prometheus: <http://localhost:9091>.
- cAdvisor: <http://localhost:8084>.

Các cổng host chỉ bind vào `127.0.0.1`. Nginx giữ các security headers, ẩn phiên bản server và chuyển tiếp `Host`, địa chỉ client cùng protocol tới app.

## Admin

Tên đăng nhập mẫu là `admin`; mật khẩu là `ADMIN_PASSWORD` trong `.env`. Ứng dụng lưu scrypt hash. Khi khởi động, ứng dụng ghi nhận charset/collation của MySQL và chỉ sửa các trường mojibake trên slug của bốn danh mục, ba bài viết seed đã định danh; các bài viết khác không bị cập nhật.

## Kiểm tra nhanh

```powershell
docker compose config --quiet
docker compose ps
docker compose logs --tail 100 mysql app nginx phpmyadmin
Invoke-WebRequest http://localhost:8089/ -UseBasicParsing
Invoke-WebRequest http://localhost:8083/ -UseBasicParsing
```

Không xóa volume hoặc reset database để xử lý lỗi triển khai. Sao lưu dữ liệu trước mọi migration thủ công.
