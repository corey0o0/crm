-- NB 브랜드 상품명 [기종] 접두 -> 상품명 - 기종 접미 변환 (XRB 컨벤션 통일)
-- 총 152건
BEGIN;

UPDATE parts SET name = '더블 레그 킥스탠드 - 카고' WHERE id = 946; -- was: [카고] 더블 레그 킥스탠드
UPDATE parts SET name = '메인 케이블 - 스프린터' WHERE id = 1075; -- was: [스프린터] 메인 케이블
UPDATE parts SET name = '유성기어 - 클래식' WHERE id = 1153; -- was: [클래식] 유성기어
UPDATE parts SET name = '시트포스트 - 스프린터' WHERE id = 1085; -- was: [스프린터] 시트포스트
UPDATE parts SET name = '고정끈 80cm - 카고 LT/카고' WHERE id = 931; -- was: [카고LT/카고] 고정끈 80cm
UPDATE parts SET name = '프론트 엑슬 - 카고' WHERE id = 1103; -- was: [카고] 프론트 엑슬 - 카고
UPDATE parts SET name = '리어 휠 세트(림, 스포크, 허브세트, 엑슬) - 스프린터' WHERE id = 1091; -- was: [스프린터] 리어 휠 세트(림, 스포크, 허브세트, 엑슬)
UPDATE parts SET name = '프레임 - 로얄 네이비 - 클래식' WHERE id = 1096; -- was: [클래식] 프레임 - 로얄 네이비
UPDATE parts SET name = '디스플레이 BN136(구) - 클래식/레트로/카고' WHERE id = 954; -- was: [클래식/레트로/카고] 디스플레이 BN136(구)
UPDATE parts SET name = '프레임 크림화이트 - 레트로 투어' WHERE id = 1356; -- was: [레트로투어] 프레임 크림화이트 - 레트로 투어
UPDATE parts SET name = '시트포스트 블랙 - 카고 LT' WHERE id = 943; -- was: [카고LT] 시트포스트 블랙
UPDATE parts SET name = '핸들바 실버 - 클래식' WHERE id = 887; -- was: [클래식] 핸들바 실버
UPDATE parts SET name = '프레임 - 매트블랙 - 레트로 FS' WHERE id = 1145; -- was: [레트로FS] 프레임 - 매트블랙
UPDATE parts SET name = '시트포스트 클램프(QR) - 카고' WHERE id = 944; -- was: [카고] 시트포스트 클램프(QR)
UPDATE parts SET name = '크랭크 세트 - 실버 - 클래식' WHERE id = 892; -- was: [클래식] 크랭크 세트 - 실버
UPDATE parts SET name = '프레임 락 - 블레이드 FS' WHERE id = 1123; -- was: [블레이드FS] 프레임 락
UPDATE parts SET name = '프론트 마그네슘 16 휠 세트(엑슬 포함) - 레트로 미니' WHERE id = 919; -- was: [레트로 미니] 프론트 마그네슘 16 휠 세트(엑슬 포함)
UPDATE parts SET name = '스템 실버 - 클래식' WHERE id = 888; -- was: [클래식] 스템 실버
UPDATE parts SET name = '프론트용 스포크 - 실버 - 클래식' WHERE id = 899; -- was: [클래식] 프론트용 스포크 - 실버
UPDATE parts SET name = '시트포스트 클램프(QR) - 스프린터' WHERE id = 1086; -- was: [스프린터] 시트포스트 클램프(QR)
UPDATE parts SET name = '프론트 휠 세트(엑슬 포함) - 블레이드 FS/블레이드/카고 LT' WHERE id = 1052; -- was: [블레이드FS/블레이드/카고LT] 프론트 휠 세트(엑슬 포함)
UPDATE parts SET name = '컨트롤러 - 클래식' WHERE id = 951; -- was: [클래식] 컨트롤러
UPDATE parts SET name = '프레임 - 샌드베이지 - 레트로 FS' WHERE id = 1146; -- was: [레트로FS] 프레임 - 샌드베이지
UPDATE parts SET name = '프레임 - 블랙 - 스프린터' WHERE id = 1068; -- was: [스프린터] 프레임 - 블랙
UPDATE parts SET name = '프레임 - 그레이 - 카고' WHERE id = 928; -- was: [카고] 프레임 - 그레이
UPDATE parts SET name = 'E-파츠 세트 - 스프린터' WHERE id = 1079; -- was: [스프린터] E-파츠 세트
UPDATE parts SET name = '프레임 - 그레이 - 스프린터' WHERE id = 1069; -- was: [스프린터] 프레임 - 그레이
UPDATE parts SET name = '헤드라이트 홀더 - 레트로 FS/레트로' WHERE id = 1061; -- was: [레트로FS/레트로] 헤드라이트 홀더
UPDATE parts SET name = '체인 - 블레이드 FS/블레이드' WHERE id = 1055; -- was: [블레이드FS/블레이드] 체인
UPDATE parts SET name = '리어용 스포크 - 실버 - 클래식' WHERE id = 898; -- was: [클래식] 리어용 스포크 - 실버
UPDATE parts SET name = '리어 모터 20 휠 세트 - 카고' WHERE id = 941; -- was: [카고] 리어 모터 20 휠 세트
UPDATE parts SET name = '프레임 샌드 - 레트로 투어' WHERE id = 1355; -- was: [레트로투어] 프레임 샌드 - 레트로 투어
UPDATE parts SET name = '프레임 - 매트 블랙 - 레트로 미니' WHERE id = 908; -- was: [레트로 미니] 프레임 - 매트 블랙
UPDATE parts SET name = '프론트 림 베어링 세트(2 pcs) - 레트로 투어' WHERE id = 1352; -- was: [레트로투어] 프론트 림 베어링 세트(2 pcs) - 레트로 투어
UPDATE parts SET name = '톨시트 - 레트로/레트로 미니' WHERE id = 922; -- was: [레트로/레트로 미니] 톨시트
UPDATE parts SET name = '튜브 20x2.4 1개 - 스프린터/블레이드 FS/블레이드' WHERE id = 1073; -- was: [스프린터/블레이드FS/블레이드] 튜브 20x2.4 1개
UPDATE parts SET name = '스포크 세트 - 스프린터' WHERE id = 1092; -- was: [스프린터] 스포크 세트
UPDATE parts SET name = '디스플레이 - 스프린터' WHERE id = 1074; -- was: [스프린터] 디스플레이
UPDATE parts SET name = '투톤 타이어 20X2.125 - 클래식' WHERE id = 893; -- was: [클래식] 투톤 타이어 20X2.125
UPDATE parts SET name = '리어 모터 16 휠 세트 - 레트로 미니' WHERE id = 920; -- was: [레트로 미니] 리어 모터 16 휠 세트
UPDATE parts SET name = '프론트 포크 - 샌드베이지 - 레트로 미니' WHERE id = 1101; -- was: [레트로 미니] 프론트 포크 - 샌드베이지
UPDATE parts SET name = '광폭 타이어 16x4.0 - 레트로 미니' WHERE id = 916; -- was: [레트로 미니] 광폭 타이어 16x4.0
UPDATE parts SET name = '유성기어 - 블레이드 FS/블레이드' WHERE id = 1143; -- was: [블레이드FS/블레이드] 유성기어
UPDATE parts SET name = '헤드라이트(전조등) - 카고 LT/카고/블레이드 FS/블레이드' WHERE id = 939; -- was: [카고LT/카고/블레이드FS/블레이드] 헤드라이트(전조등)
UPDATE parts SET name = '프레임 - 샌드베이지 - 레트로 미니' WHERE id = 1100; -- was: [레트로 미니] 프레임 - 샌드베이지
UPDATE parts SET name = '프론트 포크 - 매트 블랙 - 레트로 미니' WHERE id = 909; -- was: [레트로 미니] 프론트 포크 - 매트 블랙
UPDATE parts SET name = '컨트롤러 - 레트로/레트로 미니' WHERE id = 953; -- was: [레트로/레트로미니] 컨트롤러
UPDATE parts SET name = '드레일러 행어 A(X200맥스 공용) - 레트로/X200 MAX' WHERE id = 1022; -- was: [레트로/클래식] 드레일러 행어 A(X200맥스 공용)
UPDATE parts SET name = '시트포스트 - 실버 - 클래식' WHERE id = 891; -- was: [클래식] 시트포스트 - 실버
UPDATE parts SET name = '컨트롤러(사용X) - 클래식/레트로/카고' WHERE id = 950; -- was: [클래식/레트로/카고] 컨트롤러(사용X)
UPDATE parts SET name = '이너 튜브 20X2.125 - 클래식' WHERE id = 894; -- was: [클래식] 이너 튜브 20X2.125
UPDATE parts SET name = '프론트 휠 세트 (림, 스포크, 허브 세트, QR 엑슬) - 실버 - 클래식' WHERE id = 895; -- was: [클래식] 프론트 휠 세트 (림, 스포크, 허브 세트, QR 엑슬) - 실버
UPDATE parts SET name = '프레임 - 매트 화이트 - 클래식' WHERE id = 1043; -- was: [클래식] 프레임 - 매트 화이트
UPDATE parts SET name = '프레임 - 매트 블랙 - 클래식' WHERE id = 885; -- was: [클래식] 프레임 - 매트 블랙
UPDATE parts SET name = '프론트 휠 세트(엑슬 포함) - 레트로 FS/레트로' WHERE id = 1063; -- was: [레트로FS/레트로] 프론트 휠 세트(엑슬 포함)
UPDATE parts SET name = '시트포스트 클램프(볼트) - 블레이드 FS/블레이드/카고 LT' WHERE id = 1049; -- was: [블레이드FS/블레이드/카고LT] 시트포스트 클램프(볼트)
UPDATE parts SET name = '이노바 타이어 20x4.0 - 레트로 FS/레트로' WHERE id = 1152; -- was: [레트로FS/레트로] 이노바 타이어 20x4.0
UPDATE parts SET name = '프론트 바스켓 - 레트로 투어/카고 LT/카고' WHERE id = 1158; -- was: [레트로투어/카고LT/카고] 프론트 바스켓
UPDATE parts SET name = '체인 - 레트로 FS/레트로' WHERE id = 1066; -- was: [레트로FS/레트로] 체인
UPDATE parts SET name = '드레일러 행어 C - 블레이드 FS/블레이드' WHERE id = 1051; -- was: [블레이드FS/블레이드] 드레일러 행어 C
UPDATE parts SET name = '프론트 엑슬(QR) - 클래식' WHERE id = 1098; -- was: [클래식] 프론트 엑슬(QR)
UPDATE parts SET name = '리어렉 - 블레이드 FS/블레이드' WHERE id = 1048; -- was: [블레이드FS/블레이드] 리어렉
UPDATE parts SET name = '프레임 - 샌드베이지 - 레트로' WHERE id = 1057; -- was: [레트로] 프레임 - 샌드베이지
UPDATE parts SET name = '시트포스트 클램프(QR) - 블레이드 FS/블레이드/카고 LT' WHERE id = 1142; -- was: [블레이드FS/블레이드/카고LT] 시트포스트 클램프(QR)
UPDATE parts SET name = '체인 - 레트로 미니' WHERE id = 913; -- was: [레트로 미니] 체인
UPDATE parts SET name = '핸들바 - 스프린터' WHERE id = 1083; -- was: [스프린터] 핸들바
UPDATE parts SET name = '8기어 세트(시마노) - 스프린터' WHERE id = 1081; -- was: [스프린터] 8기어 세트(시마노)
UPDATE parts SET name = '프론트 휠 세트(림, 스포크, 허브세트, QR 엑슬) - 스프린터' WHERE id = 1090; -- was: [스프린터] 프론트 휠 세트(림, 스포크, 허브세트, QR 엑슬)
UPDATE parts SET name = '림테이프 세트 - 스프린터' WHERE id = 1093; -- was: [스프린터] 림테이프 세트
UPDATE parts SET name = '시마노 7단 숏 기어 세트(드레일러, 라이트 쉬프터) - 레트로 미니' WHERE id = 915; -- was: [레트로 미니] 시마노 7단 숏 기어 세트(드레일러, 라이트 쉬프터)
UPDATE parts SET name = '핸들포스트 클램프 실버 - 클래식' WHERE id = 1097; -- was: [클래식] 핸들포스트 클램프 실버
UPDATE parts SET name = '20x2.4 켄다 타이어 - 스프린터/블레이드 FS/블레이드' WHERE id = 1072; -- was: [스프린터/블레이드FS/블레이드] 20x2.4 켄다 타이어
UPDATE parts SET name = '체인 - 스프린터' WHERE id = 1071; -- was: [스프린터] 체인
UPDATE parts SET name = '리어렉 - 스프린터' WHERE id = 1084; -- was: [스프린터] 리어렉
UPDATE parts SET name = '유성기어 - 레트로 FS/레트로' WHERE id = 1151; -- was: [레트로FS/레트로] 유성기어
UPDATE parts SET name = '포크 스페이서 - 블레이드 FS/블레이드' WHERE id = 1046; -- was: [블레이드FS/블레이드] 포크 스페이서
UPDATE parts SET name = '프론트 포크 - 스프린터' WHERE id = 1070; -- was: [스프린터] 프론트 포크
UPDATE parts SET name = '미들 유아안장 - 카고 LT' WHERE id = 1159; -- was: [카고LT] 미들 유아안장
UPDATE parts SET name = '롱 와이드 시트 - 레트로 FS' WHERE id = 1200; -- was: [레트로FS] 롱 와이드 시트
UPDATE parts SET name = '체인 - 클래식' WHERE id = 900; -- was: [클래식] 체인
UPDATE parts SET name = '프론트 바스켓 - 레트로투어' WHERE id = 1310; -- was: [레트로투어] 프론트 바스켓
UPDATE parts SET name = '포크 캡 - 레트로 미니' WHERE id = 1154; -- was: [레트로 미니] 포크 캡
UPDATE parts SET name = '리어렉(짐받이) - 블랙 - 클래식' WHERE id = 905; -- was: [클래식] 리어렉(짐받이) - 블랙
UPDATE parts SET name = '레트로 헤드라이트 - 레트로 미니' WHERE id = 918; -- was: [레트로 미니] 레트로 헤드라이트
UPDATE parts SET name = '프론트 엑슬 - 블레이드 FS/블레이드/카고 LT' WHERE id = 1053; -- was: [블레이드FS/블레이드/카고LT] 프론트 엑슬
UPDATE parts SET name = '프레임 블랙 - 카고 LT' WHERE id = 1156; -- was: [카고LT] 프레임 블랙
UPDATE parts SET name = '머드가드 세트 - 스프린터' WHERE id = 1094; -- was: [스프린터] 머드가드 세트
UPDATE parts SET name = '블랙 시트(구) - 레트로/레트로 미니' WHERE id = 923; -- was: [레트로/레트로 미니] 블랙 시트(구)
UPDATE parts SET name = '그립 세트 - 브라운 - 클래식' WHERE id = 901; -- was: [클래식] 그립 세트 - 브라운
UPDATE parts SET name = '리어렉(짐받이) - 레트로/레트로 미니' WHERE id = 921; -- was: [레트로/레트로 미니] 리어렉(짐받이)
UPDATE parts SET name = '이너 튜브 16x4.0 - 레트로 투어/레트로 미니' WHERE id = 917; -- was: [레트로투어/레트로미니] 이너 튜브 16x4.0
UPDATE parts SET name = '체인 - 카고' WHERE id = 935; -- was: [카고] 체인
UPDATE parts SET name = '프론트 림 휠 세트(엑슬 포함) - 카고' WHERE id = 940; -- was: [카고] 프론트 림 휠 세트(엑슬 포함)
UPDATE parts SET name = '리어 보조 안장 - 카고 LT/카고' WHERE id = 945; -- was: [카고LT/카고] 리어 보조 안장
UPDATE parts SET name = '헤드셋 베어링 캡 세트 - 클래식/레트로/카고' WHERE id = 956; -- was: [클래식/레트로/카고] 헤드셋 베어링 캡 세트
UPDATE parts SET name = '머드가드 세트(프론트/리어) - 카고' WHERE id = 932; -- was: [카고] 머드가드 세트(프론트/리어)
UPDATE parts SET name = '광폭 타이어 20x3.0 - 카고' WHERE id = 937; -- was: [카고] 광폭 타이어 20x3.0
UPDATE parts SET name = '프론트 렉 - 블랙 - 카고 LT/카고' WHERE id = 930; -- was: [카고LT/카고] 프론트 렉 - 블랙
UPDATE parts SET name = '스템 - 카고 LT/카고' WHERE id = 934; -- was: [카고LT/카고] 스템
UPDATE parts SET name = '유성기어 - 카고' WHERE id = 1162; -- was: [카고] 유성기어
UPDATE parts SET name = '머드가드 - 카고 LT' WHERE id = 1160; -- was: [카고LT] 머드가드
UPDATE parts SET name = 'PAS 센서 - 클래식/레트로/카고' WHERE id = 955; -- was: [클래식/레트로/카고] PAS 센서
UPDATE parts SET name = '리어라이트(후미등) - 스프린터' WHERE id = 1089; -- was: [스프린터] 리어라이트(후미등)
UPDATE parts SET name = '시트 - 스프린터' WHERE id = 1087; -- was: [스프린터] 시트
UPDATE parts SET name = '프론트 엑슬 - 레트로 FS/레트로' WHERE id = 1064; -- was: [레트로FS/레트로] 프론트 엑슬
UPDATE parts SET name = '드레일러 행어 B - 카고 LT/카고' WHERE id = 1023; -- was: [카고LT/카고] 드레일러 행어 B
UPDATE parts SET name = '리어 모터 세트 - 레트로 FS/레트로' WHERE id = 1065; -- was: [레트로FS/레트로] 리어 모터 세트
UPDATE parts SET name = '체인 크랭크 세트 - 스프린터' WHERE id = 1080; -- was: [스프린터] 체인 크랭크 세트
UPDATE parts SET name = '폴딩 스템 - 스프린터' WHERE id = 1082; -- was: [스프린터] 폴딩 스템
UPDATE parts SET name = '머드가드 세트 - 레트로' WHERE id = 1059; -- was: [레트로] 머드가드 세트
UPDATE parts SET name = '머드가드 세트 - 블레이드 FS/블레이드' WHERE id = 1050; -- was: [블레이드FS/블레이드] 머드가드 세트
UPDATE parts SET name = '스피드 센서 - 스프린터' WHERE id = 1077; -- was: [스프린터] 스피드 센서
UPDATE parts SET name = '핸들바 - 카고 LT/카고' WHERE id = 933; -- was: [카고LT/카고] 핸들바
UPDATE parts SET name = '프레임 - 메탈 그레이 - 블레이드' WHERE id = 1044; -- was: [블레이드] 프레임 - 메탈 그레이
UPDATE parts SET name = '프레임 - 블랙 - 블레이드 FS' WHERE id = 1140; -- was: [블레이드FS] 프레임 - 블랙
UPDATE parts SET name = '드레일러 행어 D - 스프린터' WHERE id = 1135; -- was: [스프린터] 드레일러 행어 D
UPDATE parts SET name = '크랭크 세트 52T - 레트로 미니/카고' WHERE id = 927; -- was: [레트로 미니/카고] 크랭크 세트 52T
UPDATE parts SET name = '프레임 - 어반 그린 - 클래식' WHERE id = 1095; -- was: [클래식] 프레임 - 어반 그린
UPDATE parts SET name = 'BB 세트 140mm - 클래식' WHERE id = 1099; -- was: [클래식] BB 세트 140mm
UPDATE parts SET name = '메인 케이블(N) - 레트로 FS/블레이드 FS/카고 LT' WHERE id = 1139; -- was: [레트로FS/블레이드FS/카고LT] 메인 케이블(N)
UPDATE parts SET name = '머드가드 세트 - 레트로 FS' WHERE id = 1149; -- was: [레트로FS] 머드가드 세트
UPDATE parts SET name = '메인 케이블 - 클래식/레트로/카고' WHERE id = 949; -- was: [클래식/레트로/카고] 메인 케이블
UPDATE parts SET name = '컨트롤러 - 카고' WHERE id = 952; -- was: [카고] 컨트롤러
UPDATE parts SET name = '모터 세트 - 스프린터' WHERE id = 1078; -- was: [스프린터] 모터 세트
UPDATE parts SET name = 'BB 세트 170mm - 카고/블레이드 FS/블레이드' WHERE id = 906; -- was: [카고/블레이드FS/블레이드] BB 세트 170mm
UPDATE parts SET name = '보울 세트 - 레트로 투어' WHERE id = 1346; -- was: [레트로투어] 보울 세트 - 레트로 투어
UPDATE parts SET name = '프론트 서스펜션 포크 - 레트로' WHERE id = 1058; -- was: [레트로] 프론트 서스펜션 포크
UPDATE parts SET name = '튜브 20x3.0 - 카고' WHERE id = 938; -- was: [카고] 튜브 20x3.0
UPDATE parts SET name = '와이드 시트 - 블랙 - 카고 LT/카고' WHERE id = 942; -- was: [카고LT/카고] 와이드 시트 - 블랙
UPDATE parts SET name = '이너기어 세트 - 스프린터' WHERE id = 1205; -- was: [스프린터] 이너기어 세트
UPDATE parts SET name = '프론트 포크 - 블랙 - 카고' WHERE id = 929; -- was: [카고] 프론트 포크 - 블랙
UPDATE parts SET name = '프레임 - 매트블랙 - 레트로' WHERE id = 1056; -- was: [레트로] 프레임 - 매트블랙
UPDATE parts SET name = '시마노 7단 기어 세트(드레일러, 라이트 쉬프터) - 클래식/카고/레트로/블레이드' WHERE id = 907; -- was: [클래식/카고/레트로/블레이드] 시마노 7단 기어 세트(드레일러, 라이트 쉬프터)
UPDATE parts SET name = '유성기어 - 레트로 미니' WHERE id = 1155; -- was: [레트로 미니] 유성기어
UPDATE parts SET name = '핸들바 - 블랙 - 레트로 미니' WHERE id = 911; -- was: [레트로 미니] 핸들바 - 블랙
UPDATE parts SET name = '머드가드 세트(프론트/리어) - 레트로 미니' WHERE id = 910; -- was: [레트로 미니] 머드가드 세트(프론트/리어)
UPDATE parts SET name = '유성기어(SL) - 레트로 투어' WHERE id = 1291; -- was: [레트로투어] 유성기어(SL) - 레트로 투어
UPDATE parts SET name = '림 테이프 20x2.125 - 클래식' WHERE id = 904; -- was: [클래식] 림 테이프 20x2.125
UPDATE parts SET name = '시트포스트 클램프 - 실버 - 클래식' WHERE id = 890; -- was: [클래식] 시트포스트 클램프 - 실버
UPDATE parts SET name = '프론트 포크 - 클래식' WHERE id = 886; -- was: [클래식] 프론트 포크
UPDATE parts SET name = '리어 모터 20 휠 세트 - 실버 - 클래식' WHERE id = 896; -- was: [클래식] 리어 모터 20 휠 세트 - 실버
UPDATE parts SET name = '브라운 시트 - 클래식' WHERE id = 889; -- was: [클래식] 브라운 시트
UPDATE parts SET name = '머드가드세트(프론트, 리어) - 실버 - 클래식' WHERE id = 903; -- was: [클래식] 머드가드세트(프론트, 리어) - 실버
UPDATE parts SET name = '클래식 헤드라이트 - 실버 - 클래식' WHERE id = 897; -- was: [클래식] 클래식 헤드라이트 - 실버
UPDATE parts SET name = '리어 모터 세트 - 블레이드 FS/블레이드/카고 LT' WHERE id = 1054; -- was: [블레이드FS/블레이드/카고LT] 리어 모터 세트
UPDATE parts SET name = '프론트 엑슬 - 레트로 미니' WHERE id = 1102; -- was: [레트로 미니] 프론트 엑슬
UPDATE parts SET name = '피봇세트 - 레트로 FS' WHERE id = 1147; -- was: [레트로FS] 피봇세트
UPDATE parts SET name = '프레임 매트그린 - 레트로 투어' WHERE id = 1357; -- was: [레트로투어] 프레임 매트그린 - 레트로 투어
UPDATE parts SET name = '가변 스템 - 블레이드 FS/블레이드' WHERE id = 1047; -- was: [블레이드FS/블레이드] 가변 스템
UPDATE parts SET name = '프론트 서스펜션 포크 - 블레이드 FS/블레이드' WHERE id = 1045; -- was: [블레이드FS/블레이드] 프론트 서스펜션 포크
UPDATE parts SET name = '헤드라이트 - 스프린터' WHERE id = 1088; -- was: [스프린터] 헤드라이트
UPDATE parts SET name = '킥스탠드 - 클래식' WHERE id = 902; -- was: [클래식] 킥스탠드

COMMIT;
