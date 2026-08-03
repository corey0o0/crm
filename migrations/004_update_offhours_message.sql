-- 운영시간 외 안내 문구를 'AI 상담 안내'로 갱신
-- 코드 기본값(_chatbot_settings.js DEFAULTS)만 바꾸면 DB에 저장된 기존 값이 우선하므로
-- 실제 운영 반영을 위해 chatbot_settings 행을 직접 갱신한다.
UPDATE chatbot_settings
SET offhours_message = E'지금은 AI 상담 시간입니다 🤖\n궁금한 점을 입력해 주시면 바로 답변해 드릴게요.\n보다 자세한 확인이 필요하시면 [A/S 접수]를 이용해 주세요.\n접수 내용은 평일(월~금) 09:00~18:00에 확인 후 순차적으로 연락드리고 있습니다.',
    updated_at = now()
WHERE brand IN ('NB', 'NB2', 'XRB');
