# News Portal – Đề 19

Website tin tức thực hành dùng Node.js, Express, EJS, MySQL và Docker Compose. Website có trang danh sách tin, lọc danh mục, trang chi tiết và khu vực admin quản lý bài viết.

## Triển khai trên máy mới

Cần Docker Desktop và Docker Compose v2. Tạo file cấu hình cục bộ từ mẫu; tùy chọn NoClobber giúp tránh ghi đè file đã có:

~~~powershell
Copy-Item .env.example .env -NoClobber
~~~

Mở .env và thay các giá trị replace_with_... bằng secret riêng. Giữ COMPOSE_PROJECT_NAME=news-portal. Không commit hoặc gửi file .env.

~~~powershell
docker compose config --quiet
docker compose up -d --build
docker compose ps
~~~

Theo dõi khởi tạo nếu service chưa healthy:

~~~powershell
docker compose logs --tail 100 mysql app nginx phpmyadmin
~~~

Không xóa volume hoặc reset database để xử lý lỗi triển khai. Không dùng docker compose down -v.

## MySQL và khởi tạo lần đầu

MySQL dùng database news_portal, application user news_user, charset utf8mb4 và collation utf8mb4_0900_ai_ci. MySQL chỉ nằm trong backend network, không publish cổng database ra host.

Trên datadir trống, MySQL image tạo database và application user từ biến môi trường trước, rồi chạy các file theo thứ tự:

1. database/init/00-create-exporter-user.sh tạo user exporter và quyền cần thiết bằng MySQL client; script không phụ thuộc helper docker_process_sql.
2. database/schema.sql tạo users, categories, posts với khóa ngoại và utf8mb4.
3. database/seed.sql thêm tài khoản admin placeholder, danh mục và bài viết mẫu.

Các script init chỉ chạy tự động khi datadir được tạo lần đầu. Nếu MySQL đã có dữ liệu, thay đổi file init không tự chạy lại. Khi gặp lỗi init, xem log và xử lý theo migration có kiểm soát; không xóa volume để ép chạy lại.

## Monitoring và logging

Các URL local:

- Website qua Nginx: http://localhost:8089 → nginx:80 → app:4000.
- phpMyAdmin: http://localhost:8083; host MySQL là mysql.
- Grafana: http://localhost:3001; đăng nhập bằng admin và GRAFANA_ADMIN_PASSWORD.
- Prometheus: http://localhost:9091.
- cAdvisor: http://localhost:8084.

Prometheus scrape Prometheus, cAdvisor, Nginx Exporter và MySQL Exporter. Dashboard riêng News Portal được provision từ monitoring/dashboards/news-portal-monitoring.json, datasource UID ở monitoring/grafana-datasources.yml. Loki nhận Docker logs qua Promtail; bộ lọc Compose project dùng COMPOSE_PROJECT_NAME để tránh đọc log project khác. Nhãn chính là service và container.

Trong Grafana Explore, chọn datasource News Portal Loki và thử các truy vấn ở monitoring/logql-examples.md. Dashboard News Portal - Hạ tầng có trạng thái exporter, kết nối MySQL, CPU/RAM container và log app.

Kiểm tra read-only:

~~~powershell
docker compose ps
Invoke-WebRequest http://localhost:8089/ -UseBasicParsing
Invoke-WebRequest http://localhost:3001/api/health -UseBasicParsing
Invoke-WebRequest http://localhost:9091/-/ready -UseBasicParsing
~~~

Mở Prometheus → Status → Targets để xem bốn job ở trạng thái UP. Trong Prometheus Graph có thể chạy mysql_up, nginx_up, sum(rate(container_cpu_usage_seconds_total[5m])) và sum(container_memory_working_set_bytes).

## Security hardening hiện có

- App chạy bằng user node không phải root; cấu hình tại app/Dockerfile. Có thể xác minh bằng docker inspect container app và trường Config.User.
- App bỏ toàn bộ Linux capabilities và bật no-new-privileges trong docker-compose.yml; xác minh HostConfig.CapDrop và HostConfig.SecurityOpt sau khi container được tạo lại.
- Mạng frontend, backend và monitoring được tách trong docker-compose.yml. MySQL chỉ ở backend và không có host port; xác minh docker compose ps và docker inspect network memberships.
- Các cổng host bind vào 127.0.0.1; Nginx đặt server_tokens off và các security headers trong nginx/default.conf. Kiểm tra headers bằng curl -I http://localhost:8089.
- Admin dùng scrypt hash; session cookie đặt httpOnly, sameSite=lax, secure=auto và form quản trị có CSRF token. Cấu hình nằm trong app/index.js; kiểm tra phản hồi form đăng nhập và token khi trình diễn.
- Tài khoản ứng dụng MySQL được giới hạn theo database news_portal; exporter dùng user riêng với quyền exporter cần thiết. Không đưa mật khẩu thật vào repository.

Đây là các lớp giảm rủi ro cho môi trường demo, không phải khẳng định bảo mật tuyệt đối.

## Admin

Tên đăng nhập mẫu là admin; mật khẩu lấy từ ADMIN_PASSWORD trong .env. Ứng dụng lưu scrypt hash. Các route admin yêu cầu đăng nhập; bài viết có thể lưu bản nháp.

## Kiểm tra nhanh

~~~powershell
docker compose config --quiet
docker compose ps
docker compose logs --tail 100 mysql app nginx phpmyadmin prometheus loki promtail grafana
curl.exe -I http://localhost:8089/
~~~

Sao lưu dữ liệu trước mọi migration thủ công; không xóa volume hoặc reset database để xử lý lỗi triển khai.
