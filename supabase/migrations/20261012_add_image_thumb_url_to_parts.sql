-- 상품(parts) 리스트용 썸네일 이미지 컬럼 추가
-- image_url: 확대보기용 원본(큰) 이미지, image_thumb_url: 목록용 작은 썸네일
ALTER TABLE parts ADD COLUMN IF NOT EXISTS image_thumb_url text;
