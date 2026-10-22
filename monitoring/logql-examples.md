# Ví dụ LogQL

Chọn datasource **News Portal Loki** trong Grafana Explore. Các truy vấn dưới đây đã được chạy qua Loki với khoảng thời gian 24 giờ gần nhất; mỗi truy vấn giới hạn tối đa 10 dòng để kiểm tra nhanh.

1. Log truy cập Nginx:

   ~~~logql
   {service="nginx"}
   ~~~

2. Log MySQL:

   ~~~logql
   {service="mysql"}
   ~~~

3. Log ứng dụng Node.js:

   ~~~logql
   {service="app"}
   ~~~

4. Tìm warning/error không phân biệt chữ hoa thường trên mọi service:

   ~~~logql
   {service=~".+"} |~ "(?i)warn|error"
   ~~~

Loki gắn nhãn service theo tên service Compose và container theo tên container. Có thể thêm bộ lọc nhãn, ví dụ {service="nginx", container="news-portal-nginx-1"}. Nếu Explore trả về rỗng, hãy tăng khoảng thời gian ở góc trên bên phải và kiểm tra Promtail cùng Loki; không tạo log mẫu để làm đầy kết quả.

Để trình diễn: mở Grafana → Explore → chọn News Portal Loki → dán từng truy vấn → đặt khoảng thời gian Last 24 hours. Với truy vấn tìm lỗi, kết quả rỗng cũng là kết quả hợp lệ nếu không có warning/error trong khoảng đã chọn.