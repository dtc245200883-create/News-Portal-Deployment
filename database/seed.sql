SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;

INSERT IGNORE INTO users (username, password_hash)
VALUES ('admin', 'configured-at-runtime');

INSERT IGNORE INTO categories (name, slug, description) VALUES
('Thời sự', 'thoi-su', 'Tin tức thời sự trong nước và quốc tế.'),
('Công nghệ', 'cong-nghe', 'Sản phẩm, xu hướng và chuyển động công nghệ.'),
('Giáo dục', 'giao-duc', 'Tin tức trường học, học tập và giáo dục.'),
('Đời sống', 'doi-song', 'Những câu chuyện gần gũi trong cuộc sống.');

INSERT IGNORE INTO posts (category_id, author_id, title, slug, excerpt, body, status, published_at)
SELECT c.id, u.id, 'Ngày hội đọc sách kết nối cộng đồng', 'ngay-hoi-doc-sach-ket-noi-cong-dong',
       'Một ngày hội nhỏ khuyến khích thói quen đọc và chia sẻ sách trong khu phố.',
       'Sáng nay, thư viện cộng đồng tổ chức ngày hội đọc sách với nhiều hoạt động dành cho học sinh và gia đình. Người tham dự có thể đổi sách, nghe kể chuyện và cùng giới thiệu những cuốn sách yêu thích.\n\nBan tổ chức cho biết hoạt động sẽ được duy trì định kỳ để tạo thêm không gian gặp gỡ và học hỏi cho cư dân.',
       'published', CURRENT_TIMESTAMP
FROM categories c JOIN users u ON u.username = 'admin' WHERE c.slug = 'doi-song';

INSERT IGNORE INTO posts (category_id, author_id, title, slug, excerpt, body, status, published_at)
SELECT c.id, u.id, 'Sinh viên phát triển ứng dụng hỗ trợ học nhóm', 'sinh-vien-phat-trien-ung-dung-ho-tro-hoc-nhom',
       'Nhóm sinh viên xây dựng công cụ đơn giản giúp lớp học sắp xếp lịch ôn tập.',
       'Một nhóm sinh viên ngành công nghệ thông tin vừa giới thiệu ứng dụng hỗ trợ các nhóm học tập lên lịch và chia sẻ tài liệu. Phiên bản thử nghiệm tập trung vào các chức năng cơ bản, dễ sử dụng trên điện thoại.\n\nNhóm dự kiến tiếp tục lấy ý kiến từ giảng viên và người học trước khi bổ sung tính năng mới.',
       'published', CURRENT_TIMESTAMP
FROM categories c JOIN users u ON u.username = 'admin' WHERE c.slug = 'cong-nghe';

INSERT IGNORE INTO posts (category_id, author_id, title, slug, excerpt, body, status, published_at)
SELECT c.id, u.id, 'Trường học mở thêm không gian tự học buổi tối', 'truong-hoc-mo-them-khong-gian-tu-hoc-buoi-toi',
       'Thư viện trường kéo dài giờ mở cửa trong mùa ôn tập để đáp ứng nhu cầu của sinh viên.',
       'Thư viện một trường đại học sẽ mở thêm khu tự học vào buổi tối trong giai đoạn ôn tập cuối kỳ. Không gian mới có bàn nhóm, khu vực yên tĩnh và hệ thống đăng ký chỗ ngồi.\n\nNhà trường cho biết sẽ theo dõi lượng sử dụng để điều chỉnh lịch phục vụ phù hợp.',
       'published', CURRENT_TIMESTAMP
FROM categories c JOIN users u ON u.username = 'admin' WHERE c.slug = 'giao-duc';
