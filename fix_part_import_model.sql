-- 매입처=수입, 구분=파츠, 기종(model) 비어있는 항목 자동 기종채움 (이름 전체 텍스트 스캔 매칭, 자동생성)
-- 총 397건
-- Supabase SQL Editor에서 실행하세요

BEGIN;

UPDATE parts SET model = 'X200 Pro/X100 Pro' WHERE id = 576 AND (model IS NULL OR model = ''); -- 컨트롤러 - X200프로/X100프로
UPDATE parts SET model = '카고' WHERE id = 946 AND (model IS NULL OR model = ''); -- [카고] 더블 레그 킥스탠드
UPDATE parts SET model = '레트로 투어' WHERE id = 1356 AND (model IS NULL OR model = ''); -- [레트로투어] 프레임 크림화이트
UPDATE parts SET model = '레트로/카고/블레이드' WHERE id = 1315 AND (model IS NULL OR model = ''); -- [레트로/카고/블레이드] 리어라이트 연장 케이블 
UPDATE parts SET model = '카고 LT' WHERE id = 943 AND (model IS NULL OR model = ''); -- [카고LT] 시트포스트 블랙
UPDATE parts SET model = '클래식' WHERE id = 887 AND (model IS NULL OR model = ''); -- [클래식] 핸들바 실버
UPDATE parts SET model = 'X200 GT/X100 GT/X50 GT/레트로 FS' WHERE id = 1348 AND (model IS NULL OR model = ''); -- 머드가드 세트-X200GT/X100GT/X50GT/레트로FS
UPDATE parts SET model = 'X50 GT/레트로 투어' WHERE id = 1334 AND (model IS NULL OR model = ''); -- 리어라이트(방향지시등 포함) - X50GT/레트로투어
UPDATE parts SET model = 'Turbo S' WHERE id = 1316 AND (model IS NULL OR model = ''); -- 프론트 엑슬 터보 S
UPDATE parts SET model = '터보 GT/X200 GT/X100 GT/레트로 FS' WHERE id = 1344 AND (model IS NULL OR model = ''); -- 보울 세트-터보GT/X200GT/X100GT/레트로FS
UPDATE parts SET model = 'X200 Pro/Turbo Pro/X100 Pro' WHERE id = 587 AND (model IS NULL OR model = ''); -- 메인 케이블 세트 - X200프로/터보프로/X100프로
UPDATE parts SET model = '미니' WHERE id = 605 AND (model IS NULL OR model = ''); -- 미니 차저
UPDATE parts SET model = 'X50' WHERE id = 723 AND (model IS NULL OR model = ''); -- 프레임 블랙 - X50
UPDATE parts SET model = 'X50 SL' WHERE id = 1185 AND (model IS NULL OR model = ''); -- 시트포스트 클램프(bolt type) X50 SL
UPDATE parts SET model = 'X200 맥스 SL/X100 맥스 SL/X200 프로 SL/X50 SL' WHERE id = 1178 AND (model IS NULL OR model = ''); -- 모터세트(SL) X200맥스SL/X100맥스SL/X200프로SL/X50SL
UPDATE parts SET model = '클래식' WHERE id = 892 AND (model IS NULL OR model = ''); -- [클래식] 크랭크 세트 - 실버
UPDATE parts SET model = '블레이드 FS' WHERE id = 1123 AND (model IS NULL OR model = ''); -- [블레이드FS] 프레임 락
UPDATE parts SET model = '레트로 투어' WHERE id = 1294 AND (model IS NULL OR model = ''); -- [레트로투어] 블랙캣 타이어 16x4.0
UPDATE parts SET model = '미니' WHERE id = 682 AND (model IS NULL OR model = ''); -- 시트포스트 배터리 케이스 - 미니
UPDATE parts SET model = 'X200 프로 SL' WHERE id = 1263 AND (model IS NULL OR model = ''); -- 프레임 블랙 - X200프로SL
UPDATE parts SET model = '카고' WHERE id = 941 AND (model IS NULL OR model = ''); -- [카고] 리어 모터 20 휠 세트
UPDATE parts SET model = 'X50' WHERE id = 717 AND (model IS NULL OR model = ''); -- 시트포스트 클램프 X50 블랙
UPDATE parts SET model = 'Turbo Pro' WHERE id = 703 AND (model IS NULL OR model = ''); -- Fastace 디스크 로터 203E 2.3mm - 터보프로
UPDATE parts SET model = '레트로 미니' WHERE id = 908 AND (model IS NULL OR model = ''); -- [레트로 미니] 프레임 - 매트 블랙
UPDATE parts SET model = 'X50' WHERE id = 710 AND (model IS NULL OR model = ''); -- 시트포스트 클램프 X50 크롬
UPDATE parts SET model = 'X100 Pro' WHERE id = 720 AND (model IS NULL OR model = ''); -- 프론트 포크 X100프로/New X100
UPDATE parts SET model = '미니' WHERE id = 749 AND (model IS NULL OR model = ''); -- 컬러 미니점보 상단케이스 블루
UPDATE parts SET model = 'Turbo Pro' WHERE id = 736 AND (model IS NULL OR model = ''); -- BB 풋페그 - 터보프로/X200T(페달 제거)
UPDATE parts SET model = '클래식' WHERE id = 893 AND (model IS NULL OR model = ''); -- [클래식] 투톤 타이어 20X2.125
UPDATE parts SET model = 'X50' WHERE id = 718 AND (model IS NULL OR model = ''); -- 시트포스트 X50 블랙
UPDATE parts SET model = '블레이드 FS/블레이드' WHERE id = 1143 AND (model IS NULL OR model = ''); -- [블레이드FS/블레이드] 유성기어
UPDATE parts SET model = '카고 LT/카고/블레이드 FS/블레이드' WHERE id = 939 AND (model IS NULL OR model = ''); -- [카고LT/카고/블레이드FS/블레이드] 헤드라이트(전조등)
UPDATE parts SET model = '클래식' WHERE id = 891 AND (model IS NULL OR model = ''); -- [클래식] 시트포스트 - 실버
UPDATE parts SET model = '카고 LT/블레이드 FS/레트로 FS' WHERE id = 1164 AND (model IS NULL OR model = ''); -- [카고LT/블레이드FS/레트로FS] 컨트롤러
UPDATE parts SET model = 'X200 Pro/X100 Pro/X50' WHERE id = 707 AND (model IS NULL OR model = ''); -- 텍트로 디스크 로터 180E 1.8mm X200 프로/X100 프로/X50
UPDATE parts SET model = '클래식' WHERE id = 894 AND (model IS NULL OR model = ''); -- [클래식] 이너 튜브 20X2.125	
UPDATE parts SET model = '미니' WHERE id = 569 AND (model IS NULL OR model = ''); -- 기능 스위치 - 미니
UPDATE parts SET model = 'X200 맥스 SL/X100 맥스 SL/X200 프로 SL/X50 FS' WHERE id = 1223 AND (model IS NULL OR model = ''); -- 모터 너트 세트 - X200맥스SL/X100맥스SL/X200프로SL/X50FS
UPDATE parts SET model = '레트로 미니' WHERE id = 913 AND (model IS NULL OR model = ''); -- [레트로 미니] 체인
UPDATE parts SET model = 'X200 Pro/X100 Pro' WHERE id = 1016 AND (model IS NULL OR model = ''); -- 컨트롤러 X200프로/X100프로 (뉴라인)
UPDATE parts SET model = '레트로 FS/레트로' WHERE id = 1151 AND (model IS NULL OR model = ''); -- [레트로FS/레트로] 유성기어
UPDATE parts SET model = 'X200 프로 SL' WHERE id = 1264 AND (model IS NULL OR model = ''); -- 프레임 메탈그레이 - X200프로SL
UPDATE parts SET model = 'X200 맥스 SL' WHERE id = 1249 AND (model IS NULL OR model = ''); -- 머드가드 세트 블랙 X200 맥스 SL(신형)
UPDATE parts SET model = '스프린터' WHERE id = 1070 AND (model IS NULL OR model = ''); -- [스프린터] 프론트 포크
UPDATE parts SET model = 'Turbo S' WHERE id = 1197 AND (model IS NULL OR model = ''); -- 프론트 림 - 터보S
UPDATE parts SET model = '카고 LT' WHERE id = 1159 AND (model IS NULL OR model = ''); -- [카고LT] 미들 유아안장
UPDATE parts SET model = '레트로 FS' WHERE id = 1200 AND (model IS NULL OR model = ''); -- [레트로FS] 롱 와이드 시트
UPDATE parts SET model = 'Turbo Pro' WHERE id = 577 AND (model IS NULL OR model = ''); -- 컨트롤러 - 터보프로
UPDATE parts SET model = '클래식' WHERE id = 900 AND (model IS NULL OR model = ''); -- [클래식] 체인
UPDATE parts SET model = '레트로 미니' WHERE id = 1154 AND (model IS NULL OR model = ''); -- [레트로 미니] 포크 캡
UPDATE parts SET model = '클래식' WHERE id = 905 AND (model IS NULL OR model = ''); -- [클래식] 리어렉(짐받이) - 블랙
UPDATE parts SET model = '레트로 미니' WHERE id = 918 AND (model IS NULL OR model = ''); -- [레트로 미니] 레트로 헤드라이트
UPDATE parts SET model = '블레이드 FS/블레이드/카고 LT' WHERE id = 1053 AND (model IS NULL OR model = ''); -- [블레이드FS/블레이드/카고LT] 프론트 엑슬
UPDATE parts SET model = '카고 LT' WHERE id = 1156 AND (model IS NULL OR model = ''); -- [카고LT] 프레임 블랙
UPDATE parts SET model = '스프린터' WHERE id = 1094 AND (model IS NULL OR model = ''); -- [스프린터] 머드가드 세트
UPDATE parts SET model = '레트로/레트로 미니' WHERE id = 923 AND (model IS NULL OR model = ''); -- [레트로/레트로 미니] 블랙 시트(구)
UPDATE parts SET model = '카고' WHERE id = 936 AND (model IS NULL OR model = ''); -- [카고] 체인 텐셔너(미들)
UPDATE parts SET model = '터보 GT' WHERE id = 1335 AND (model IS NULL OR model = ''); -- 페달 키트 - 터보GT
UPDATE parts SET model = '레트로 투어' WHERE id = 1268 AND (model IS NULL OR model = ''); -- [레트로투어] 시트 튜브 홀더
UPDATE parts SET model = '클래식' WHERE id = 901 AND (model IS NULL OR model = ''); -- [클래식] 그립 세트 - 브라운
UPDATE parts SET model = 'X200 GT/X100 GT/터보 GT' WHERE id = 1328 AND (model IS NULL OR model = ''); -- 방향지시등(N) - X200GT/X100GT/터보GT
UPDATE parts SET model = '레트로 투어' WHERE id = 1270 AND (model IS NULL OR model = ''); -- [레트로투어] 시트 튜브 고정 나사세트
UPDATE parts SET model = '레트로/레트로 미니' WHERE id = 921 AND (model IS NULL OR model = ''); -- [레트로/레트로 미니] 리어렉(짐받이)
UPDATE parts SET model = '레트로 투어/레트로 미니' WHERE id = 917 AND (model IS NULL OR model = ''); -- [레트로투어/레트로미니] 이너 튜브 16x4.0
UPDATE parts SET model = '카고' WHERE id = 935 AND (model IS NULL OR model = ''); -- [카고] 체인
UPDATE parts SET model = '카고' WHERE id = 940 AND (model IS NULL OR model = ''); -- [카고] 프론트 림 휠 세트(엑슬 포함)
UPDATE parts SET model = '레트로 투어' WHERE id = 1267 AND (model IS NULL OR model = ''); -- [레트로투어] 스윙암 피봇 세트
UPDATE parts SET model = '카고 LT/카고' WHERE id = 945 AND (model IS NULL OR model = ''); -- [카고LT/카고] 리어 보조 안장
UPDATE parts SET model = '클래식/레트로/카고' WHERE id = 956 AND (model IS NULL OR model = ''); -- [클래식/레트로/카고] 헤드셋 베어링 캡 세트
UPDATE parts SET model = '카고' WHERE id = 932 AND (model IS NULL OR model = ''); -- [카고] 머드가드 세트(프론트/리어)
UPDATE parts SET model = '카고' WHERE id = 937 AND (model IS NULL OR model = ''); -- [카고] 광폭 타이어 20x3.0
UPDATE parts SET model = '카고 LT/카고' WHERE id = 930 AND (model IS NULL OR model = ''); -- [카고LT/카고] 프론트 렉 - 블랙
UPDATE parts SET model = '카고 LT/카고' WHERE id = 934 AND (model IS NULL OR model = ''); -- [카고LT/카고] 스템
UPDATE parts SET model = '터보 GT' WHERE id = 1365 AND (model IS NULL OR model = ''); -- 프레임 블랙 - 터보GT
UPDATE parts SET model = 'X200 GT' WHERE id = 1367 AND (model IS NULL OR model = ''); -- 프레임 블랙 - X200GT
UPDATE parts SET model = 'X200 GT' WHERE id = 1368 AND (model IS NULL OR model = ''); -- 프레임 베이지 - X200GT
UPDATE parts SET model = 'X50 GT' WHERE id = 1337 AND (model IS NULL OR model = ''); -- 에어 서스펜션 포크 - X50GT
UPDATE parts SET model = '카고' WHERE id = 1162 AND (model IS NULL OR model = ''); -- [카고] 유성기어
UPDATE parts SET model = 'X200 GT/X100 GT' WHERE id = 1336 AND (model IS NULL OR model = ''); -- 에어 서스펜션 포크 - X200GT/X100GT
UPDATE parts SET model = 'X100 MAX' WHERE id = 1218 AND (model IS NULL OR model = ''); -- 프론트 엑슬 - X100맥스(Cowboy)
UPDATE parts SET model = 'X200 MAX' WHERE id = 1021 AND (model IS NULL OR model = ''); -- 48V 미니점보 배터리 거치대(트레이, X200맥스)
UPDATE parts SET model = '카고 LT' WHERE id = 1160 AND (model IS NULL OR model = ''); -- [카고LT] 머드가드
UPDATE parts SET model = 'X200 MAX' WHERE id = 745 AND (model IS NULL OR model = ''); -- 체인 - X200맥스
UPDATE parts SET model = '미니' WHERE id = 750 AND (model IS NULL OR model = ''); -- 컬러 미니점보 상단케이스 블랙
UPDATE parts SET model = '미니' WHERE id = 810 AND (model IS NULL OR model = ''); -- 접이식 풋페그(발판) 세트 - 미니
UPDATE parts SET model = '레트로 FS' WHERE id = 1339 AND (model IS NULL OR model = ''); -- 유압 서스펜션 포크-레트로FS
UPDATE parts SET model = '미니' WHERE id = 1019 AND (model IS NULL OR model = ''); -- 미니 점보 배터리 거치대(트레이, 선없음)
UPDATE parts SET model = '클래식/레트로/카고' WHERE id = 955 AND (model IS NULL OR model = ''); -- [클래식/레트로/카고] PAS 센서 
UPDATE parts SET model = 'X50 FS' WHERE id = 1180 AND (model IS NULL OR model = ''); -- 컨트롤러 - X50 FS
UPDATE parts SET model = '터보 GT' WHERE id = 1338 AND (model IS NULL OR model = ''); -- 유압 서스펜션 포크 - 터보GT
UPDATE parts SET model = '레트로 투어' WHERE id = 1269 AND (model IS NULL OR model = ''); -- [레트로투어] 시트 튜브
UPDATE parts SET model = '스프린터' WHERE id = 1089 AND (model IS NULL OR model = ''); -- [스프린터] 리어라이트(후미등)
UPDATE parts SET model = 'X200 Pro' WHERE id = 1025 AND (model IS NULL OR model = ''); -- 업그레이드 키트(X100/X100S->X200 Pro)
UPDATE parts SET model = '스프린터' WHERE id = 1087 AND (model IS NULL OR model = ''); -- [스프린터] 시트
UPDATE parts SET model = '레트로 FS/레트로' WHERE id = 1064 AND (model IS NULL OR model = ''); -- [레트로FS/레트로] 프론트 엑슬
UPDATE parts SET model = '카고 LT/카고' WHERE id = 1023 AND (model IS NULL OR model = ''); -- [카고LT/카고] 드레일러 행어 B
UPDATE parts SET model = '레트로 FS/레트로' WHERE id = 1065 AND (model IS NULL OR model = ''); -- [레트로FS/레트로] 리어 모터 세트
UPDATE parts SET model = '스프린터' WHERE id = 1080 AND (model IS NULL OR model = ''); -- [스프린터] 체인 크랭크 세트
UPDATE parts SET model = 'Turbo S' WHERE id = 1198 AND (model IS NULL OR model = ''); -- 유성기어 터보S (1500W)
UPDATE parts SET model = '스프린터' WHERE id = 1075 AND (model IS NULL OR model = ''); -- [스프린터] 메인 케이블
UPDATE parts SET model = '클래식' WHERE id = 1153 AND (model IS NULL OR model = ''); -- [클래식] 유성기어
UPDATE parts SET model = '스프린터' WHERE id = 1085 AND (model IS NULL OR model = ''); -- [스프린터] 시트포스트
UPDATE parts SET model = '스프린터' WHERE id = 1082 AND (model IS NULL OR model = ''); -- [스프린터] 폴딩 스템
UPDATE parts SET model = '레트로 투어' WHERE id = 1301 AND (model IS NULL OR model = ''); -- [레트로투어] PAS 센서(30cm)
UPDATE parts SET model = 'X200 MAX/레트로 FS' WHERE id = 1313 AND (model IS NULL OR model = ''); -- 모터 홀더 X200 맥스/레트로 FS
UPDATE parts SET model = '레트로' WHERE id = 1059 AND (model IS NULL OR model = ''); -- [레트로] 머드가드 세트
UPDATE parts SET model = '블레이드 FS/블레이드' WHERE id = 1050 AND (model IS NULL OR model = ''); -- [블레이드FS/블레이드] 머드가드 세트
UPDATE parts SET model = 'X200 MAX' WHERE id = 1175 AND (model IS NULL OR model = ''); -- 소프트 톨시트 브라운 - X200맥스
UPDATE parts SET model = 'X200 GT/X200 MAX' WHERE id = 740 AND (model IS NULL OR model = ''); -- 리어 미들 서스펜션(KKE) - X200GT/X200맥스
UPDATE parts SET model = '레트로 투어' WHERE id = 1272 AND (model IS NULL OR model = ''); -- [레트로투어] 유압 서스펜션 포크
UPDATE parts SET model = '스프린터' WHERE id = 1077 AND (model IS NULL OR model = ''); -- [스프린터] 스피드 센서
UPDATE parts SET model = '터보 GT' WHERE id = 1340 AND (model IS NULL OR model = ''); -- 피봇 - 터보GT
UPDATE parts SET model = '카고 LT/카고' WHERE id = 933 AND (model IS NULL OR model = ''); -- [카고LT/카고] 핸들바
UPDATE parts SET model = 'X200 MAX/X100 MAX/X200 Pro/X50' WHERE id = 1189 AND (model IS NULL OR model = ''); -- 모터 베어링 - X200맥스/X100맥스/X200프로/X50
UPDATE parts SET model = 'X200 MAX' WHERE id = 1119 AND (model IS NULL OR model = ''); -- PAS 센서 X200맥스(5cm 긴거)
UPDATE parts SET model = '블레이드' WHERE id = 1044 AND (model IS NULL OR model = ''); -- [블레이드] 프레임 - 메탈 그레이
UPDATE parts SET model = '카고 LT' WHERE id = 1259 AND (model IS NULL OR model = ''); -- [카고LT] 접이식 풋페그
UPDATE parts SET model = 'X200 Pro/X100 Pro/Turbo Pro' WHERE id = 621 AND (model IS NULL OR model = ''); -- 리어라이트 12V - X200프로/X100프로/터보프로
UPDATE parts SET model = '클래식' WHERE id = 1095 AND (model IS NULL OR model = ''); -- [클래식] 프레임 - 어반 그린
UPDATE parts SET model = '클래식' WHERE id = 1099 AND (model IS NULL OR model = ''); -- [클래식] BB 세트 140mm
UPDATE parts SET model = '레트로 FS/블레이드 FS/카고 LT' WHERE id = 1139 AND (model IS NULL OR model = ''); -- [레트로FS/블레이드FS/카고LT] 메인 케이블(N)
UPDATE parts SET model = '카고 LT/카고' WHERE id = 931 AND (model IS NULL OR model = ''); -- [카고LT/카고] 고정끈 80cm
UPDATE parts SET model = '블레이드 FS' WHERE id = 1140 AND (model IS NULL OR model = ''); -- [블레이드FS] 프레임 - 블랙
UPDATE parts SET model = '카고' WHERE id = 1103 AND (model IS NULL OR model = ''); -- [카고] 프론트 엑슬 - 카고
UPDATE parts SET model = '스프린터' WHERE id = 1135 AND (model IS NULL OR model = ''); -- [스프린터] 드레일러 행어 D
UPDATE parts SET model = '레트로 투어' WHERE id = 1273 AND (model IS NULL OR model = ''); -- [레트로투어] 리어 듀얼 서스펜션
UPDATE parts SET model = '스프린터' WHERE id = 1091 AND (model IS NULL OR model = ''); -- [스프린터] 리어 휠 세트(림, 스포크, 허브세트, 엑슬)
UPDATE parts SET model = '클래식' WHERE id = 1096 AND (model IS NULL OR model = ''); -- [클래식] 프레임 - 로얄 네이비
UPDATE parts SET model = '미니' WHERE id = 1117 AND (model IS NULL OR model = ''); -- 유성기어-미니 프론트
UPDATE parts SET model = '레트로 미니/카고' WHERE id = 927 AND (model IS NULL OR model = ''); -- [레트로 미니/카고] 크랭크 세트 52T
UPDATE parts SET model = '미니' WHERE id = 560 AND (model IS NULL OR model = ''); -- 리어라이트 - X200/X200S/New X100/미니(48V,방향)
UPDATE parts SET model = '클래식/레트로/카고' WHERE id = 954 AND (model IS NULL OR model = ''); -- [클래식/레트로/카고] 디스플레이 BN136(구)
UPDATE parts SET model = 'Turbo Pro' WHERE id = 597 AND (model IS NULL OR model = ''); -- 브레이크 센서 - 터보프로
UPDATE parts SET model = '레트로 FS' WHERE id = 1145 AND (model IS NULL OR model = ''); -- [레트로FS] 프레임 - 매트블랙
UPDATE parts SET model = '레트로 투어' WHERE id = 1304 AND (model IS NULL OR model = ''); -- [레트로투어] 리어 라이트
UPDATE parts SET model = 'X100 MAX/X100 Pro' WHERE id = 619 AND (model IS NULL OR model = ''); -- PAS 센서 X100맥스/X100프로/NX100
UPDATE parts SET model = '미니' WHERE id = 675 AND (model IS NULL OR model = ''); -- 스프링 시트-블랙 미니
UPDATE parts SET model = 'Turbo Pro' WHERE id = 684 AND (model IS NULL OR model = ''); -- 리어 브레이크 래버 - 터보프로
UPDATE parts SET model = '레트로 투어' WHERE id = 1309 AND (model IS NULL OR model = ''); -- [레트로투어] 유아안장
UPDATE parts SET model = 'X50 GT' WHERE id = 1345 AND (model IS NULL OR model = ''); -- 보울 세트 - X50GT
UPDATE parts SET model = 'X50' WHERE id = 620 AND (model IS NULL OR model = ''); -- 48V KTX 배터리 트레이 X50 (XT60,방수)
UPDATE parts SET model = 'X100 MAX' WHERE id = 1239 AND (model IS NULL OR model = ''); -- 프레임 베이지 - X100맥스
UPDATE parts SET model = 'X200 Pro' WHERE id = 1202 AND (model IS NULL OR model = ''); -- 머드가드 세트 - X200 프로 / 터보 프로 / X200
UPDATE parts SET model = 'X200 Pro' WHERE id = 1237 AND (model IS NULL OR model = ''); -- 프레임 미러크롬 - X200프로/터보 프로/X200/X200고급형(S)/X200T
UPDATE parts SET model = 'X200 MAX' WHERE id = 1029 AND (model IS NULL OR model = ''); -- 수납가방 - X200맥스
UPDATE parts SET model = '스프린터' WHERE id = 1208 AND (model IS NULL OR model = ''); -- [스프린터] 리어라이트 연장 케이블
UPDATE parts SET model = '레트로 투어' WHERE id = 1346 AND (model IS NULL OR model = ''); -- [레트로투어] 보울 세트
UPDATE parts SET model = '레트로 투어' WHERE id = 1275 AND (model IS NULL OR model = ''); -- [레트로투어] 핸들바(22mm/31.8mm/65cm)
UPDATE parts SET model = '미니' WHERE id = 1194 AND (model IS NULL OR model = ''); -- 미니 점보 배터리&KTX 배터리 방수커버(48V 20Ah)
UPDATE parts SET model = '레트로 FS' WHERE id = 1149 AND (model IS NULL OR model = ''); -- [레트로FS] 머드가드 세트
UPDATE parts SET model = 'X50' WHERE id = 1215 AND (model IS NULL OR model = ''); -- 체인 - X50
UPDATE parts SET model = '클래식/레트로/카고' WHERE id = 949 AND (model IS NULL OR model = ''); -- [클래식/레트로/카고] 메인 케이블
UPDATE parts SET model = 'X100 Pro' WHERE id = 628 AND (model IS NULL OR model = ''); -- 프레임 블랙 X100프로/New X100
UPDATE parts SET model = 'X200 Pro' WHERE id = 1238 AND (model IS NULL OR model = ''); -- 프레임 메탈그레이 - X200프로/터보 프로/X200/X200고급형(S)/X200T
UPDATE parts SET model = 'X200 MAX' WHERE id = 741 AND (model IS NULL OR model = ''); -- 소프트 숏시트 블랙 - X200맥스
UPDATE parts SET model = 'X100 MAX' WHERE id = 1240 AND (model IS NULL OR model = ''); -- 프레임 어반 그레이 - X100맥스
UPDATE parts SET model = '스프린터' WHERE id = 1207 AND (model IS NULL OR model = ''); -- [스프린터] 니들 베어링
UPDATE parts SET model = '레트로 투어' WHERE id = 1276 AND (model IS NULL OR model = ''); -- [레트로투어] 스템(28.6mm/31.8mm)
UPDATE parts SET model = '레트로 투어' WHERE id = 1312 AND (model IS NULL OR model = ''); -- [레트로투어] 보조바퀴
UPDATE parts SET model = '카고/블레이드 FS/블레이드' WHERE id = 906 AND (model IS NULL OR model = ''); -- [카고/블레이드FS/블레이드] BB 세트 170mm
UPDATE parts SET model = '카고' WHERE id = 952 AND (model IS NULL OR model = ''); -- [카고] 컨트롤러
UPDATE parts SET model = '스프린터' WHERE id = 1078 AND (model IS NULL OR model = ''); -- [스프린터] 모터 세트
UPDATE parts SET model = '카고' WHERE id = 944 AND (model IS NULL OR model = ''); -- [카고] 시트포스트 클램프(QR)
UPDATE parts SET model = '블레이드 FS' WHERE id = 1206 AND (model IS NULL OR model = ''); -- [블레이드FS] 프레임 락 홀더
UPDATE parts SET model = '레트로 미니' WHERE id = 919 AND (model IS NULL OR model = ''); -- [레트로 미니] 프론트 마그네슘 16 휠 세트(엑슬 포함)
UPDATE parts SET model = '클래식' WHERE id = 888 AND (model IS NULL OR model = ''); -- [클래식] 스템 실버
UPDATE parts SET model = 'Turbo Pro' WHERE id = 692 AND (model IS NULL OR model = ''); -- 프론트 브레이크 세트 - 터보프로
UPDATE parts SET model = 'X100 GT' WHERE id = 1374 AND (model IS NULL OR model = ''); -- 체인 - X100GT
UPDATE parts SET model = '클래식' WHERE id = 899 AND (model IS NULL OR model = ''); -- [클래식] 프론트용 스포크 - 실버
UPDATE parts SET model = 'X100 MAX' WHERE id = 785 AND (model IS NULL OR model = ''); -- 컬러 포크가드 스티커 옐로우 - X100맥스
UPDATE parts SET model = 'X200 Pro/X100 Pro' WHERE id = 1241 AND (model IS NULL OR model = ''); -- 리어라이트(구) - X200 프로 / X100 프로 / 터보 프로
UPDATE parts SET model = '스프린터' WHERE id = 1086 AND (model IS NULL OR model = ''); -- [스프린터] 시트포스트 클램프(QR)
UPDATE parts SET model = '블레이드 FS/블레이드/카고 LT' WHERE id = 1052 AND (model IS NULL OR model = ''); -- [블레이드FS/블레이드/카고LT] 프론트 휠 세트(엑슬 포함)
UPDATE parts SET model = '레트로' WHERE id = 1058 AND (model IS NULL OR model = ''); -- [레트로] 프론트 서스펜션 포크
UPDATE parts SET model = 'X200 GT/터보 GT' WHERE id = 1375 AND (model IS NULL OR model = ''); -- 체인 - X200GT/터보GT
UPDATE parts SET model = '레트로 투어' WHERE id = 1311 AND (model IS NULL OR model = ''); -- [레트로투어] 미들 바스켓
UPDATE parts SET model = '레트로 FS' WHERE id = 1377 AND (model IS NULL OR model = ''); -- 체인 - 레트로FS
UPDATE parts SET model = 'X50 GT' WHERE id = 1376 AND (model IS NULL OR model = ''); -- 체인 - X50GT
UPDATE parts SET model = '레트로 투어' WHERE id = 1282 AND (model IS NULL OR model = ''); -- [레트로투어] 스마트 히팅 그립
UPDATE parts SET model = '카고' WHERE id = 938 AND (model IS NULL OR model = ''); -- [카고] 튜브 20x3.0
UPDATE parts SET model = '레트로 투어' WHERE id = 1284 AND (model IS NULL OR model = ''); -- [레트로투어] 크랭크 세트 160mm 44T
UPDATE parts SET model = 'X200 Pro/Turbo Pro/X100 Pro' WHERE id = 581 AND (model IS NULL OR model = ''); -- 불렛 헤드라이트 - X200프로/터보프로/X100프로
UPDATE parts SET model = '카고 LT/카고' WHERE id = 942 AND (model IS NULL OR model = ''); -- [카고LT/카고] 와이드 시트 - 블랙
UPDATE parts SET model = '스프린터' WHERE id = 1205 AND (model IS NULL OR model = ''); -- [스프린터] 이너기어 세트
UPDATE parts SET model = '클래식' WHERE id = 951 AND (model IS NULL OR model = ''); -- [클래식] 컨트롤러
UPDATE parts SET model = 'X200 Pro/X100 Pro/X50' WHERE id = 1226 AND (model IS NULL OR model = ''); -- 모터 플러그 아답터 X200프로/X100프로/X50 (뉴컨트 to 구모터 컨넥터 변환)
UPDATE parts SET model = '레트로 FS' WHERE id = 1146 AND (model IS NULL OR model = ''); -- [레트로FS] 프레임 - 샌드베이지
UPDATE parts SET model = 'X200 Pro/Turbo Pro/X100 Pro' WHERE id = 690 AND (model IS NULL OR model = ''); -- 헤드라이트 링 아답터 - X200프로/터보프로/X100프로
UPDATE parts SET model = '스프린터' WHERE id = 1068 AND (model IS NULL OR model = ''); -- [스프린터] 프레임 - 블랙
UPDATE parts SET model = 'X200 GT/X100 GT/X50 GT/터보 GT/X200 Pro/Turbo Pro/X100 Pro/레트로 투어' WHERE id = 686 AND (model IS NULL OR model = ''); -- 기능 스위치 - X200GT/X100GT/X50GT/터보GT/X200프로/터보프로/X100프로/레트로투어
UPDATE parts SET model = '레트로 투어' WHERE id = 1307 AND (model IS NULL OR model = ''); -- [레트로투어] 볼트너트 세트
UPDATE parts SET model = '레트로 투어' WHERE id = 1274 AND (model IS NULL OR model = ''); -- [레트로투어] 헤드셋 세트
UPDATE parts SET model = '카고' WHERE id = 928 AND (model IS NULL OR model = ''); -- [카고] 프레임 - 그레이
UPDATE parts SET model = '스프린터' WHERE id = 1079 AND (model IS NULL OR model = ''); -- [스프린터] E-파츠 세트
UPDATE parts SET model = '스프린터' WHERE id = 1069 AND (model IS NULL OR model = ''); -- [스프린터] 프레임 - 그레이
UPDATE parts SET model = 'X100 GT/X50 GT' WHERE id = 1379 AND (model IS NULL OR model = ''); -- 체인 텐셔너 세트 - X100GT/X50GT
UPDATE parts SET model = 'X200 MAX' WHERE id = 752 AND (model IS NULL OR model = ''); -- 컬러 포크가드 스티커 옐로우 - X200맥스
UPDATE parts SET model = '레트로 FS/레트로' WHERE id = 1061 AND (model IS NULL OR model = ''); -- [레트로FS/레트로] 헤드라이트 홀더
UPDATE parts SET model = '블레이드 FS/블레이드' WHERE id = 1055 AND (model IS NULL OR model = ''); -- [블레이드FS/블레이드] 체인
UPDATE parts SET model = '클래식' WHERE id = 898 AND (model IS NULL OR model = ''); -- [클래식] 리어용 스포크 - 실버
UPDATE parts SET model = '레트로/레트로 미니' WHERE id = 922 AND (model IS NULL OR model = ''); -- [레트로/레트로 미니] 톨시트
UPDATE parts SET model = '레트로 투어' WHERE id = 1352 AND (model IS NULL OR model = ''); -- [레트로투어] 프론트 림 베어링 세트(2 pcs)
UPDATE parts SET model = '터보 GT' WHERE id = 1380 AND (model IS NULL OR model = ''); -- 체인 텐셔너 세트 - 터보GT
UPDATE parts SET model = '스프린터/블레이드 FS/블레이드' WHERE id = 1073 AND (model IS NULL OR model = ''); -- [스프린터/블레이드FS/블레이드] 튜브 20x2.4 1개
UPDATE parts SET model = '스프린터' WHERE id = 1092 AND (model IS NULL OR model = ''); -- [스프린터] 스포크 세트
UPDATE parts SET model = '레트로 투어' WHERE id = 1286 AND (model IS NULL OR model = ''); -- [레트로투어] 체인(126pcs)
UPDATE parts SET model = '스프린터' WHERE id = 1074 AND (model IS NULL OR model = ''); -- [스프린터] 디스플레이
UPDATE parts SET model = '카고' WHERE id = 929 AND (model IS NULL OR model = ''); -- [카고] 프론트 포크 - 블랙
UPDATE parts SET model = '카고 LT' WHERE id = 1157 AND (model IS NULL OR model = ''); -- [카고LT] 서스펜션 포크 블랙
UPDATE parts SET model = '미니' WHERE id = 669 AND (model IS NULL OR model = ''); -- 프론트 포크 - 미니
UPDATE parts SET model = '레트로' WHERE id = 1056 AND (model IS NULL OR model = ''); -- [레트로] 프레임 - 매트블랙
UPDATE parts SET model = '클래식/카고/레트로/블레이드' WHERE id = 907 AND (model IS NULL OR model = ''); -- [클래식/카고/레트로/블레이드] 시마노 7단 기어 세트(드레일러, 라이트 쉬프터)
UPDATE parts SET model = '레트로 투어' WHERE id = 1290 AND (model IS NULL OR model = ''); -- [레트로투어] 프론트 림-엑슬포함(16x4)
UPDATE parts SET model = '레트로 투어' WHERE id = 1289 AND (model IS NULL OR model = ''); -- [레트로투어] 모터 세트(16x4, 48V 500W SL)
UPDATE parts SET model = '레트로 투어' WHERE id = 1296 AND (model IS NULL OR model = ''); -- [레트로투어] 킥스탠드
UPDATE parts SET model = '레트로 투어' WHERE id = 1291 AND (model IS NULL OR model = ''); -- [레트로투어] 유성기어(SL)
UPDATE parts SET model = 'X100 MAX' WHERE id = 780 AND (model IS NULL OR model = ''); -- 프레임 블랙 - X100맥스
UPDATE parts SET model = '레트로 미니' WHERE id = 1155 AND (model IS NULL OR model = ''); -- [레트로 미니] 유성기어
UPDATE parts SET model = 'X100 MAX' WHERE id = 1020 AND (model IS NULL OR model = ''); -- 48V 미니점보 배터리 거치대(트레이, X100맥스)
UPDATE parts SET model = '레트로 미니' WHERE id = 911 AND (model IS NULL OR model = ''); -- [레트로 미니] 핸들바 - 블랙
UPDATE parts SET model = '레트로 미니' WHERE id = 910 AND (model IS NULL OR model = ''); -- [레트로 미니] 머드가드 세트(프론트/리어)
UPDATE parts SET model = 'X200 Pro/Turbo Pro/X50' WHERE id = 1212 AND (model IS NULL OR model = ''); -- KTET 오토바이 캘리퍼 아답터 세트(TYPE 6) for X200프로/터보프로/X50 (KKE) - type 4와 같음
UPDATE parts SET model = '레트로 미니' WHERE id = 920 AND (model IS NULL OR model = ''); -- [레트로 미니] 리어 모터 16 휠 세트
UPDATE parts SET model = '레트로 미니' WHERE id = 1101 AND (model IS NULL OR model = ''); -- [레트로 미니] 프론트 포크 - 샌드베이지
UPDATE parts SET model = 'X100 MAX' WHERE id = 781 AND (model IS NULL OR model = ''); -- 체인 - X100맥스
UPDATE parts SET model = '레트로 FS/레트로' WHERE id = 1168 AND (model IS NULL OR model = ''); -- [레트로FS/레트로] 5인치 헤드라이트 링 아답터
UPDATE parts SET model = '레트로 미니' WHERE id = 916 AND (model IS NULL OR model = ''); -- [레트로 미니] 광폭 타이어 16x4.0
UPDATE parts SET model = '레트로 미니' WHERE id = 1100 AND (model IS NULL OR model = ''); -- [레트로 미니] 프레임 - 샌드베이지
UPDATE parts SET model = 'X200 MAX/X100 MAX' WHERE id = 1211 AND (model IS NULL OR model = ''); -- 	KTET 오토바이 캘리퍼 아답터 세트(TYPE 5) for X200맥스/X100맥스 - type 2와 같음
UPDATE parts SET model = 'X200 Pro/Turbo Pro/X50' WHERE id = 734 AND (model IS NULL OR model = ''); -- KKE 브레이크 라인 홀더 - X200프로/터보프로/X50
UPDATE parts SET model = '레트로 미니' WHERE id = 909 AND (model IS NULL OR model = ''); -- [레트로 미니] 프론트 포크 - 매트 블랙
UPDATE parts SET model = 'X200 Pro/Turbo Pro' WHERE id = 694 AND (model IS NULL OR model = ''); -- 리어 듀얼 에어 서스펜션 X200프로/터보프로(구)
UPDATE parts SET model = 'X200 MAX' WHERE id = 744 AND (model IS NULL OR model = ''); -- 체인 텐셔너 세트 - X200맥스
UPDATE parts SET model = 'X50' WHERE id = 711 AND (model IS NULL OR model = ''); -- 시트포스트 X50 크롬
UPDATE parts SET model = 'X200 MAX' WHERE id = 1252 AND (model IS NULL OR model = ''); -- 프레임 베이지 - X200맥스
UPDATE parts SET model = 'Turbo Pro' WHERE id = 586 AND (model IS NULL OR model = ''); -- DBSM - 터보프로
UPDATE parts SET model = 'X200 Pro/X100 Pro/Turbo Pro' WHERE id = 688 AND (model IS NULL OR model = ''); -- 모터사이클 경적 - X200프로/X100프로/터보프로(12V)
UPDATE parts SET model = 'X200 Pro/X100 Pro' WHERE id = 614 AND (model IS NULL OR model = ''); -- 모터 세트 X200프로/X100프로(뉴라인)
UPDATE parts SET model = '클래식' WHERE id = 904 AND (model IS NULL OR model = ''); -- [클래식] 림 테이프 20x2.125
UPDATE parts SET model = 'X200 MAX' WHERE id = 1250 AND (model IS NULL OR model = ''); -- 프레임 메탈그레이 - X200맥스
UPDATE parts SET model = '미니' WHERE id = 748 AND (model IS NULL OR model = ''); -- 컬러  미니점보 상단케이스 핑크
UPDATE parts SET model = '미니' WHERE id = 746 AND (model IS NULL OR model = ''); -- 컬러  미니점보 상단케이스 레드
UPDATE parts SET model = '미니' WHERE id = 676 AND (model IS NULL OR model = ''); -- 스프링 시트-브라운 미니
UPDATE parts SET model = 'X200 Pro' WHERE id = 704 AND (model IS NULL OR model = ''); -- XOD 디스크 로터 180E 2.3mm X200프로/X10프로X200/X200S
UPDATE parts SET model = '미니' WHERE id = 673 AND (model IS NULL OR model = ''); -- 프론트 브레이크 세트 XOD - 미니
UPDATE parts SET model = '클래식' WHERE id = 890 AND (model IS NULL OR model = ''); -- [클래식] 시트포스트 클램프 - 실버
UPDATE parts SET model = '클래식' WHERE id = 886 AND (model IS NULL OR model = ''); -- [클래식] 프론트 포크
UPDATE parts SET model = 'X100 Pro' WHERE id = 617 AND (model IS NULL OR model = ''); -- 48V KTX 배터리 트레이 X100프로 (XT60, 롱)
UPDATE parts SET model = 'X200 MAX/X200 Pro/Turbo Pro' WHERE id = 615 AND (model IS NULL OR model = ''); -- PAS 센서 X200맥스/X200프로/터보프로/X200/X200S/X200T
UPDATE parts SET model = 'Turbo Pro' WHERE id = 683 AND (model IS NULL OR model = ''); -- 프론트 브레이크 래버 - 터보프로
UPDATE parts SET model = '클래식' WHERE id = 896 AND (model IS NULL OR model = ''); -- [클래식] 리어 모터 20 휠 세트 - 실버
UPDATE parts SET model = 'X200 Pro/X50' WHERE id = 642 AND (model IS NULL OR model = ''); -- 텍트로 브레이크 패드 세트 X200Pro/X100/Pro/X50
UPDATE parts SET model = '클래식' WHERE id = 889 AND (model IS NULL OR model = ''); -- [클래식] 브라운 시트
UPDATE parts SET model = '클래식' WHERE id = 903 AND (model IS NULL OR model = ''); -- [클래식] 머드가드세트(프론트, 리어) - 실버
UPDATE parts SET model = 'X50 GT/레트로 FS/레트로 투어' WHERE id = 1300 AND (model IS NULL OR model = ''); -- [X50GT/레트로FS/레트로투어] 컨트롤러
UPDATE parts SET model = '레트로 FS' WHERE id = 1148 AND (model IS NULL OR model = ''); -- [레트로FS] 리어 유압 서스펜션
UPDATE parts SET model = '클래식' WHERE id = 897 AND (model IS NULL OR model = ''); -- [클래식] 클래식 헤드라이트 - 실버
UPDATE parts SET model = '레트로/레트로 미니' WHERE id = 953 AND (model IS NULL OR model = ''); -- [레트로/레트로미니] 컨트롤러
UPDATE parts SET model = '레트로/X200 MAX' WHERE id = 1022 AND (model IS NULL OR model = ''); -- [레트로/클래식] 드레일러 행어 A(X200맥스 공용)
UPDATE parts SET model = '클래식' WHERE id = 895 AND (model IS NULL OR model = ''); -- [클래식] 프론트 휠 세트 (림, 스포크, 허브 세트, QR 엑슬) - 실버
UPDATE parts SET model = '클래식' WHERE id = 1043 AND (model IS NULL OR model = ''); -- [클래식] 프레임 - 매트 화이트
UPDATE parts SET model = '클래식' WHERE id = 885 AND (model IS NULL OR model = ''); -- [클래식] 프레임 - 매트 블랙
UPDATE parts SET model = '레트로 FS/레트로' WHERE id = 1063 AND (model IS NULL OR model = ''); -- [레트로FS/레트로] 프론트 휠 세트(엑슬 포함)
UPDATE parts SET model = '블레이드 FS/블레이드/카고 LT' WHERE id = 1049 AND (model IS NULL OR model = ''); -- [블레이드FS/블레이드/카고LT] 시트포스트 클램프(볼트)
UPDATE parts SET model = '레트로 투어' WHERE id = 1297 AND (model IS NULL OR model = ''); -- [레트로투어] 배터리 트레이(5핀)
UPDATE parts SET model = 'Turbo Pro' WHERE id = 685 AND (model IS NULL OR model = ''); -- Faceace 브레이크 패드 세트 터보프로 (2개)
UPDATE parts SET model = '레트로 투어' WHERE id = 1357 AND (model IS NULL OR model = ''); -- [레트로투어] 프레임 매트그린
UPDATE parts SET model = '레트로 투어' WHERE id = 1361 AND (model IS NULL OR model = ''); -- [레트로투어] 체인 텐셔너(드레일러)
UPDATE parts SET model = '레트로 투어' WHERE id = 1355 AND (model IS NULL OR model = ''); -- [레트로투어] 프레임 샌드
UPDATE parts SET model = 'X50 GT' WHERE id = 1369 AND (model IS NULL OR model = ''); -- 프레임 블랙 - X50GT
UPDATE parts SET model = 'X200 MAX' WHERE id = 1227 AND (model IS NULL OR model = ''); -- 스윙암 피봇 세트 - X200맥스
UPDATE parts SET model = '미니' WHERE id = 1118 AND (model IS NULL OR model = ''); -- 유성기어-미니 리어
UPDATE parts SET model = 'X100 Pro' WHERE id = 644 AND (model IS NULL OR model = ''); -- 머드가드 세트 X100프로/New X100
UPDATE parts SET model = '레트로 투어' WHERE id = 1271 AND (model IS NULL OR model = ''); -- [레트로투어] 와이드 시트 - 블랙
UPDATE parts SET model = 'X200 맥스 SL/X100 맥스 SL/X200 프로 SL/X50 SL' WHERE id = 1179 AND (model IS NULL OR model = ''); -- 유성기어(SL) X200맥스SL/X100맥스SL/X200프로SL/X50SL
UPDATE parts SET model = '레트로 투어' WHERE id = 1266 AND (model IS NULL OR model = ''); -- [레트로투어] 프레임 블랙
UPDATE parts SET model = '블레이드 FS/블레이드/카고 LT' WHERE id = 1054 AND (model IS NULL OR model = ''); -- [블레이드FS/블레이드/카고LT] 리어 모터 세트
UPDATE parts SET model = '블레이드' WHERE id = 1163 AND (model IS NULL OR model = ''); -- [블레이드] 컨트롤러
UPDATE parts SET model = '레트로 FS' WHERE id = 1147 AND (model IS NULL OR model = ''); -- [레트로FS] 피봇세트
UPDATE parts SET model = '레트로 미니' WHERE id = 1102 AND (model IS NULL OR model = ''); -- [레트로 미니] 프론트 엑슬
UPDATE parts SET model = '레트로 투어' WHERE id = 1306 AND (model IS NULL OR model = ''); -- [레트로투어] 메인 케이블(키박스 라인 포함)
UPDATE parts SET model = '레트로 FS/레트로' WHERE id = 1152 AND (model IS NULL OR model = ''); -- [레트로FS/레트로] 이노바 타이어 20x4.0
UPDATE parts SET model = '레트로 투어' WHERE id = 1353 AND (model IS NULL OR model = ''); -- [레트로투어] 모터 베어링 세트
UPDATE parts SET model = '레트로 투어' WHERE id = 1303 AND (model IS NULL OR model = ''); -- [레트로투어] 프론트 라이트
UPDATE parts SET model = '레트로 투어/카고 LT/카고' WHERE id = 1158 AND (model IS NULL OR model = ''); -- [레트로투어/카고LT/카고] 프론트 바스켓
UPDATE parts SET model = '레트로 FS/레트로' WHERE id = 1066 AND (model IS NULL OR model = ''); -- [레트로FS/레트로] 체인
UPDATE parts SET model = '블레이드 FS/블레이드' WHERE id = 1051 AND (model IS NULL OR model = ''); -- [블레이드FS/블레이드] 드레일러 행어 C
UPDATE parts SET model = '클래식' WHERE id = 1098 AND (model IS NULL OR model = ''); -- [클래식] 프론트 엑슬(QR)
UPDATE parts SET model = '블레이드 FS/블레이드' WHERE id = 1048 AND (model IS NULL OR model = ''); -- [블레이드FS/블레이드] 리어렉
UPDATE parts SET model = '레트로' WHERE id = 1057 AND (model IS NULL OR model = ''); -- [레트로] 프레임 - 샌드베이지
UPDATE parts SET model = '블레이드 FS/블레이드/카고 LT' WHERE id = 1142 AND (model IS NULL OR model = ''); -- [블레이드FS/블레이드/카고LT] 시트포스트 클램프(QR)
UPDATE parts SET model = '레트로 투어' WHERE id = 1360 AND (model IS NULL OR model = ''); -- [레트로투어] 로드스타 타이어 16x4.0
UPDATE parts SET model = '블레이드 FS/블레이드' WHERE id = 1047 AND (model IS NULL OR model = ''); -- [블레이드FS/블레이드] 가변 스템
UPDATE parts SET model = '레트로 투어' WHERE id = 1305 AND (model IS NULL OR model = ''); -- [레트로투어] 머드가드 세트
UPDATE parts SET model = '블레이드 FS/블레이드' WHERE id = 1045 AND (model IS NULL OR model = ''); -- [블레이드FS/블레이드] 프론트 서스펜션 포크
UPDATE parts SET model = '스프린터' WHERE id = 1088 AND (model IS NULL OR model = ''); -- [스프린터] 헤드라이트
UPDATE parts SET model = '클래식' WHERE id = 902 AND (model IS NULL OR model = ''); -- [클래식] 킥스탠드
UPDATE parts SET model = 'X200 GT/X100 GT/X50 GT/레트로 FS' WHERE id = 1341 AND (model IS NULL OR model = ''); -- 킥스탠드-X200GT/X100GT/X50GT/레트로FS
UPDATE parts SET model = '스프린터' WHERE id = 1083 AND (model IS NULL OR model = ''); -- [스프린터] 핸들바
UPDATE parts SET model = '스프린터' WHERE id = 1081 AND (model IS NULL OR model = ''); -- [스프린터] 8기어 세트(시마노)
UPDATE parts SET model = '스프린터' WHERE id = 1090 AND (model IS NULL OR model = ''); -- [스프린터] 프론트 휠 세트(림, 스포크, 허브세트, QR 엑슬)
UPDATE parts SET model = '스프린터' WHERE id = 1093 AND (model IS NULL OR model = ''); -- [스프린터] 림테이프 세트
UPDATE parts SET model = '레트로 미니' WHERE id = 915 AND (model IS NULL OR model = ''); -- [레트로 미니] 시마노 7단 숏 기어 세트(드레일러, 라이트 쉬프터)
UPDATE parts SET model = 'X200 MAX' WHERE id = 773 AND (model IS NULL OR model = ''); -- 컬러 머드가드 세트 블루 - X200맥스
UPDATE parts SET model = '클래식' WHERE id = 1097 AND (model IS NULL OR model = ''); -- [클래식] 핸들포스트 클램프 실버
UPDATE parts SET model = '스프린터/블레이드 FS/블레이드' WHERE id = 1072 AND (model IS NULL OR model = ''); -- [스프린터/블레이드FS/블레이드] 20x2.4 켄다 타이어
UPDATE parts SET model = '스프린터' WHERE id = 1071 AND (model IS NULL OR model = ''); -- [스프린터] 체인
UPDATE parts SET model = '미니' WHERE id = 747 AND (model IS NULL OR model = ''); -- 컬러  미니점보 상단케이스 옐로우
UPDATE parts SET model = 'X200 Pro/X100 Pro/미니' WHERE id = 1024 AND (model IS NULL OR model = ''); -- XOD 브레이크 패드 세트 X200프로/X100프로/X200/X200고급/X100/미니(2개)
UPDATE parts SET model = '스프린터' WHERE id = 1084 AND (model IS NULL OR model = ''); -- [스프린터] 리어렉
UPDATE parts SET model = '블레이드 FS/블레이드' WHERE id = 1046 AND (model IS NULL OR model = ''); -- [블레이드FS/블레이드] 포크 스페이서
UPDATE parts SET model = 'X200 GT/X100 GT/X50 GT/터보 GT' WHERE id = 1350 AND (model IS NULL OR model = ''); -- 스마트 히팅 그립 - X200GT/X100GT/X50GT/터보GT
UPDATE parts SET model = '터보 GT' WHERE id = 1347 AND (model IS NULL OR model = ''); -- 머드가드 세트 - 터보GT
UPDATE parts SET model = 'X100 GT' WHERE id = 1366 AND (model IS NULL OR model = ''); -- 프레임 블랙 - X100GT
UPDATE parts SET model = 'X200 MAX/X100 MAX/X200 Pro/Turbo Pro/X100 Pro' WHERE id = 1228 AND (model IS NULL OR model = ''); -- 리어라이트 - X200맥스/X100맥스/X200프로/터보프로/X100프로
UPDATE parts SET model = 'X200 MAX/X100 MAX/X200 Pro' WHERE id = 1230 AND (model IS NULL OR model = ''); -- 연장 브라켓 X200맥스/X100맥스/X200프로 (사이드렉 연장)
UPDATE parts SET model = 'X200 GT/X200 Pro/Turbo Pro' WHERE id = 1177 AND (model IS NULL OR model = ''); -- 소프트 리어 듀얼 서스펜션 - X200GT/X200프로/터보프로
UPDATE parts SET model = 'X200 MAX' WHERE id = 1251 AND (model IS NULL OR model = ''); -- 프레임 어반그레이 - X200맥스
UPDATE parts SET model = 'X200 GT/레트로 FS/레트로 투어' WHERE id = 1378 AND (model IS NULL OR model = ''); -- 체인 텐셔너(드레일러) - X200GT/레트로FS/레트로투어
UPDATE parts SET model = 'X100 MAX' WHERE id = 788 AND (model IS NULL OR model = ''); -- 컬러 포크가드 스티커 블랙 - X100맥스
UPDATE parts SET model = '미니' WHERE id = 574 AND (model IS NULL OR model = ''); -- 컨트롤러 - 미니
UPDATE parts SET model = 'X200 MAX/X100 Pro/X200 Pro/X50' WHERE id = 540 AND (model IS NULL OR model = ''); -- 유성기어 - X200맥스/X100프로/X200프로/X50
UPDATE parts SET model = 'X100 MAX' WHERE id = 782 AND (model IS NULL OR model = ''); -- cowboy 서스펜션 포크 - X100맥스
UPDATE parts SET model = 'Turbo Pro' WHERE id = 578 AND (model IS NULL OR model = ''); -- 모터 세트 - 터보프로
UPDATE parts SET model = 'X50' WHERE id = 612 AND (model IS NULL OR model = ''); -- 메인 케이블 세트 - X50
UPDATE parts SET model = 'X200 Pro/Turbo Pro/X100 Pro' WHERE id = 610 AND (model IS NULL OR model = ''); -- DC 컨버터 - X200프로/터보프로/X100프로
UPDATE parts SET model = '레트로' WHERE id = 1060 AND (model IS NULL OR model = ''); -- 5인치 헤드라이트 - 레트로20
UPDATE parts SET model = 'X200 MAX' WHERE id = 753 AND (model IS NULL OR model = ''); -- 컬러 포크가드 스티커 핑크 - X200맥스
UPDATE parts SET model = 'Turbo Pro' WHERE id = 689 AND (model IS NULL OR model = ''); -- 리어 브레이크 세트 - 터보프로
UPDATE parts SET model = '미니' WHERE id = 678 AND (model IS NULL OR model = ''); -- 반사경 세트 - 미니
UPDATE parts SET model = 'X200 Pro/Turbo Pro/X100 Pro' WHERE id = 687 AND (model IS NULL OR model = ''); -- 알람 시스템 세트(모듈, 리모컨) - X200프로/터보프로/X100프로
UPDATE parts SET model = 'X200 프로 SL' WHERE id = 1265 AND (model IS NULL OR model = ''); -- 프레임 베이지 - X200프로SL
UPDATE parts SET model = 'X200 프로 SL/X100 맥스 SL/X50 FS' WHERE id = 1260 AND (model IS NULL OR model = ''); -- Cowboy 포크가드 - X200프로SL/X100맥스SL/X50FS
UPDATE parts SET model = 'X50' WHERE id = 712 AND (model IS NULL OR model = ''); -- 와이드 시트 - X50
UPDATE parts SET model = 'Turbo Pro' WHERE id = 730 AND (model IS NULL OR model = ''); -- 프론트 엑슬 - 터보프로
UPDATE parts SET model = 'X50' WHERE id = 713 AND (model IS NULL OR model = ''); -- 머드가드 세트 - X50
UPDATE parts SET model = 'X200 MAX/X100 MAX/X200 Pro' WHERE id = 769 AND (model IS NULL OR model = ''); -- 컬러 사이드렉 세트 블랙 - X200맥스/X100맥스/X200프로
UPDATE parts SET model = 'X200 MAX' WHERE id = 770 AND (model IS NULL OR model = ''); -- 컬러 머드가드 세트 레드 - X200맥스
UPDATE parts SET model = 'X200 MAX/X100 MAX/X200 Pro' WHERE id = 768 AND (model IS NULL OR model = ''); -- 컬러 사이드렉 세트 블루 - X200맥스/X100맥스/X200프로
UPDATE parts SET model = 'X50' WHERE id = 706 AND (model IS NULL OR model = ''); -- 리어렉 - X50
UPDATE parts SET model = 'X200 Pro/X100 Pro' WHERE id = 595 AND (model IS NULL OR model = ''); -- 모터 세트 - X200프로/X100프로
UPDATE parts SET model = '미니' WHERE id = 572 AND (model IS NULL OR model = ''); -- 시트포스트 배터리 - 미니
UPDATE parts SET model = '미니' WHERE id = 570 AND (model IS NULL OR model = ''); -- 리어 모터 - 미니
UPDATE parts SET model = '미니' WHERE id = 571 AND (model IS NULL OR model = ''); -- 프론트 모터 - 미니
UPDATE parts SET model = 'Turbo Pro' WHERE id = 592 AND (model IS NULL OR model = ''); -- 프론트 림 - 터보프로
UPDATE parts SET model = 'X200 MAX' WHERE id = 755 AND (model IS NULL OR model = ''); -- 컬러 포크가드 스티커 블랙 - X200맥스
UPDATE parts SET model = 'X200 MAX' WHERE id = 739 AND (model IS NULL OR model = ''); -- 프레임 블랙 - X200맥스
UPDATE parts SET model = '미니' WHERE id = 568 AND (model IS NULL OR model = ''); -- 헤드라이트 - 미니
UPDATE parts SET model = 'X50' WHERE id = 611 AND (model IS NULL OR model = ''); -- 헤드라이트 스위치 - X50
UPDATE parts SET model = 'X200 MAX/X100 MAX/X200 Pro' WHERE id = 767 AND (model IS NULL OR model = ''); -- 컬러 사이드렉 세트 핑크 - X200맥스/X100맥스/X200프로
UPDATE parts SET model = '미니' WHERE id = 677 AND (model IS NULL OR model = ''); -- 머드가드 세트 - 미니
UPDATE parts SET model = '미니' WHERE id = 722 AND (model IS NULL OR model = ''); -- 시트포스트 클램프 - 미니
UPDATE parts SET model = 'X200 MAX' WHERE id = 743 AND (model IS NULL OR model = ''); -- 소프트 톨시트 블랙 - X200맥스
UPDATE parts SET model = 'X200 Pro/X100 Pro/X50' WHERE id = 733 AND (model IS NULL OR model = ''); -- 프론트 엑슬 - X200프로/X100프로/X50
UPDATE parts SET model = 'Turbo S' WHERE id = 1195 AND (model IS NULL OR model = ''); -- 컨트롤러 - 터보S
UPDATE parts SET model = 'Turbo Pro' WHERE id = 735 AND (model IS NULL OR model = ''); -- 컨트롤러 플레이트 - 터보프로
UPDATE parts SET model = '미니' WHERE id = 680 AND (model IS NULL OR model = ''); -- 컨트롤러 케이스 - 미니
UPDATE parts SET model = 'X200 MAX' WHERE id = 771 AND (model IS NULL OR model = ''); -- 컬러 머드가드 세트 옐로우 - X200맥스
UPDATE parts SET model = '미니' WHERE id = 671 AND (model IS NULL OR model = ''); -- 핸들바 - 미니
UPDATE parts SET model = '미니' WHERE id = 672 AND (model IS NULL OR model = ''); -- 스템 - 미니
UPDATE parts SET model = '미니' WHERE id = 667 AND (model IS NULL OR model = ''); -- 풋페그(발판) 세트 - 미니
UPDATE parts SET model = 'X200 MAX/X100 MAX/X200 Pro' WHERE id = 766 AND (model IS NULL OR model = ''); -- 컬러 사이드렉 세트 옐로우 - X200맥스/X100맥스/X200프로
UPDATE parts SET model = 'X100 MAX' WHERE id = 784 AND (model IS NULL OR model = ''); -- 컬러 포크가드 스티커 레드 - X100맥스
UPDATE parts SET model = 'X100 MAX' WHERE id = 783 AND (model IS NULL OR model = ''); -- 소프트 롱시트 블랙 - X100맥스
UPDATE parts SET model = 'X200 MAX' WHERE id = 772 AND (model IS NULL OR model = ''); -- 컬러 머드가드 세트 핑크 - X200맥스
UPDATE parts SET model = 'Turbo S' WHERE id = 1196 AND (model IS NULL OR model = ''); -- 모터 세트 - 터보S
UPDATE parts SET model = '미니' WHERE id = 589 AND (model IS NULL OR model = ''); -- 배터리 케이블 케이블 - 미니
UPDATE parts SET model = 'X200 Pro/Turbo Pro/X50' WHERE id = 793 AND (model IS NULL OR model = ''); -- 접이식 풋페그(유아발판) - X200프로/터보프로/X50
UPDATE parts SET model = 'X100 MAX' WHERE id = 787 AND (model IS NULL OR model = ''); -- 컬러 포크가드 스티커 블루 - X100맥스
UPDATE parts SET model = 'X100 MAX' WHERE id = 1038 AND (model IS NULL OR model = ''); -- 소프트 숏시트 - X100맥스
UPDATE parts SET model = 'X200 Pro/X100 Pro' WHERE id = 591 AND (model IS NULL OR model = ''); -- 프론트 림 - X200프로/X100프로
UPDATE parts SET model = 'X200 MAX' WHERE id = 754 AND (model IS NULL OR model = ''); -- 컬러 포크가드 스티커 블루 - X200맥스
UPDATE parts SET model = 'X200 Pro/Turbo Pro/X100 Pro' WHERE id = 606 AND (model IS NULL OR model = ''); -- 릴레이 - X200프로/터보프로/X100프로
UPDATE parts SET model = 'X200 Pro/Turbo Pro/X100 Pro' WHERE id = 691 AND (model IS NULL OR model = ''); -- 헤드라이트 홀더 - X200프로/터보프로/X100프로
UPDATE parts SET model = 'X200 Pro' WHERE id = 585 AND (model IS NULL OR model = ''); -- DBSM - X200프로
UPDATE parts SET model = 'X200 MAX' WHERE id = 774 AND (model IS NULL OR model = ''); -- 컬러 머드가드 세트 블랙 - X200맥스
UPDATE parts SET model = 'X200 Pro/Turbo Pro/X100 Pro' WHERE id = 580 AND (model IS NULL OR model = ''); -- 서클 헤드라이트 - X200프로/터보프로/X100프로
UPDATE parts SET model = 'X200 MAX' WHERE id = 751 AND (model IS NULL OR model = ''); -- 컬러 포크가드 스티커 레드 - X200맥스
UPDATE parts SET model = 'X200 MAX/X100 MAX/X200 Pro' WHERE id = 765 AND (model IS NULL OR model = ''); -- 컬러 사이드렉 세트 레드 - X200맥스/X100맥스/X200프로
UPDATE parts SET model = '미니' WHERE id = 674 AND (model IS NULL OR model = ''); -- 리어 브레이크 세트 XOD - 미니
UPDATE parts SET model = '미니' WHERE id = 681 AND (model IS NULL OR model = ''); -- 튜브리스 타이어 1개 - 미니
UPDATE parts SET model = '미니' WHERE id = 679 AND (model IS NULL OR model = ''); -- 수납가방 - 미니
UPDATE parts SET model = '미니' WHERE id = 666 AND (model IS NULL OR model = ''); -- 리어렉(짐받이) - 미니
UPDATE parts SET model = '미니' WHERE id = 575 AND (model IS NULL OR model = ''); -- 배터리 젠더 케이블 - 미니
UPDATE parts SET model = '미니' WHERE id = 668 AND (model IS NULL OR model = ''); -- 리어 서스펜션 - 미니
UPDATE parts SET model = 'X200 MAX/X100 MAX/X200 Pro/Turbo Pro/X50' WHERE id = 695 AND (model IS NULL OR model = ''); -- KKE 프론트 유압 포크 - X200MAX/X100MAX/X200프로/터보프로/X50
UPDATE parts SET model = '미니' WHERE id = 670 AND (model IS NULL OR model = ''); -- 킥스탠드 - 미니
UPDATE parts SET model = '미니' WHERE id = 573 AND (model IS NULL OR model = ''); -- 메인 케이블 세트 - 미니
UPDATE parts SET model = '미니' WHERE id = 811 AND (model IS NULL OR model = ''); -- 다용도 바스켓 - 미니
UPDATE parts SET model = 'X200 Pro/Turbo Pro/X50' WHERE id = 708 AND (model IS NULL OR model = ''); -- KKE 포크가드 세트 - X200프로/터보프로/X50
UPDATE parts SET model = 'X200 MAX/X100 MAX/X200 Pro/X50' WHERE id = 1188 AND (model IS NULL OR model = ''); -- 프론트 림 베어링 세트 - X200맥스/X100맥스/X200프로/X50
UPDATE parts SET model = 'X100 MAX' WHERE id = 786 AND (model IS NULL OR model = ''); -- 컬러 포크가드 스티커 핑크 - X100맥스
UPDATE parts SET model = 'X200 MAX' WHERE id = 742 AND (model IS NULL OR model = ''); -- 소프트 롱시트 블랙 - X200맥스
UPDATE parts SET model = 'X200 MAX' WHERE id = 1176 AND (model IS NULL OR model = ''); -- 소프트 숏시트 브라운 - X200맥스
UPDATE parts SET model = 'X200 MAX' WHERE id = 1174 AND (model IS NULL OR model = ''); -- 소프트 롱시트 브라운 - X200맥스
UPDATE parts SET model = 'X200 Pro/Turbo Pro/X100 Pro' WHERE id = 582 AND (model IS NULL OR model = ''); -- 방향지시등(윙카) 세트 - X200프로/터보프로/X100프로
UPDATE parts SET model = 'X50' WHERE id = 613 AND (model IS NULL OR model = ''); -- 컨트롤러 - X50

COMMIT;
