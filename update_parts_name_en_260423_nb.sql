-- 260423 니어바이크 발주 마스터-1.xlsx 바코드 매칭 영문명 업데이트
-- 이미 name_en 있는 파츠는 제외, 171건
BEGIN;

UPDATE parts SET name_en = 'Bike support for Cargo' WHERE id = 946; -- [카고] 더블 레그 킥스탠드
UPDATE parts SET name_en = 'Bell  (신형 벨)' WHERE id = 958; -- 자전거 벨
UPDATE parts SET name_en = 'Seat post for Cargo/Blade' WHERE id = 943; -- [카고LT] 시트포스트 블랙
UPDATE parts SET name_en = 'Handlebar for Classic' WHERE id = 887; -- [클래식] 핸들바 실버
UPDATE parts SET name_en = 'Chainwheel and crank set for Classic' WHERE id = 892; -- [클래식] 크랭크 세트 - 실버
UPDATE parts SET name_en = 'Frame Lock for Blade FS/Cargo LT' WHERE id = 1123; -- [블레이드FS] 프레임 락
UPDATE parts SET name_en = 'Rear motor 20" set rim for Cargo' WHERE id = 941; -- [카고] 리어 모터 20 휠 세트
UPDATE parts SET name_en = 'Bell(New)' WHERE id = 1167; -- 자전거 벨(New)
UPDATE parts SET name_en = '16" Frame Black for Retro mini' WHERE id = 908; -- [레트로 미니] 프레임 - 매트 블랙
UPDATE parts SET name_en = 'Headlight gender NB to XRB for Retro20' WHERE id = 1150; -- 헤드라이트 XRB 젠더 케이블
UPDATE parts SET name_en = 'Tyre 20"x2.125" 1pcs for Classic' WHERE id = 893; -- [클래식] 투톤 타이어 20X2.125
UPDATE parts SET name_en = 'Gears for Blade' WHERE id = 1143; -- [블레이드FS/블레이드] 유성기어
UPDATE parts SET name_en = 'Front light for Cargo/Blade' WHERE id = 939; -- [카고LT/카고/블레이드FS/블레이드] 헤드라이트(전조등)
UPDATE parts SET name_en = 'Seat post for Classic' WHERE id = 891; -- [클래식] 시트포스트 - 실버
UPDATE parts SET name_en = 'Controller for Retro FS / BladeFS / CargoLT' WHERE id = 1164; -- [카고LT/블레이드FS/레트로FS] 컨트롤러
UPDATE parts SET name_en = 'Bike - Classic - matte white' WHERE id = 979; -- 클래식 Classic - 매트 화이트
UPDATE parts SET name_en = 'Battery case 15ah(with sticker) for Classic/Cargo/Retro' WHERE id = 971; -- 48V 15Ah KTX 배터리케이스(스티커 포함)
UPDATE parts SET name_en = 'Throttle speed derailler for Classic/Cargo/Retro' WHERE id = 948; -- 썸 스로틀 스위치
UPDATE parts SET name_en = 'Front brake set (KTET) for Retro' WHERE id = 964; -- KTET 프론트 브레이크 세트 - 레트로/레트로미니
UPDATE parts SET name_en = 'Bike - Classic - royal navy' WHERE id = 982; -- 클래식 Classic - 로얄 네이비
UPDATE parts SET name_en = 'Battery Fuse set(input 10pcs/output 10pcs)' WHERE id = 973; -- 배터리 퓨즈 세트(입력단 10개, 출력단 10개) 1세트
UPDATE parts SET name_en = 'Battery 10ah(with sticker) incluse case for Classic/Cargo/Retro' WHERE id = 969; -- 48V 10Ah KTX 배터리(거치형 배터리거치대 포함)
UPDATE parts SET name_en = 'Tube 20"x2.125" 1pcs for Classic' WHERE id = 894; -- [클래식] 이너 튜브 20X2.125	
UPDATE parts SET name_en = 'Chain for Retro mini' WHERE id = 913; -- [레트로 미니] 체인
UPDATE parts SET name_en = 'Gears for Retro20' WHERE id = 1151; -- [레트로FS/레트로] 유성기어
UPDATE parts SET name_en = 'Fork for Sprinter' WHERE id = 1070; -- [스프린터] 프론트 포크
UPDATE parts SET name_en = 'Bike - Retro Pro - Matte black' WHERE id = 1120; -- 레트로 FS Retro FS - 매트 블랙
UPDATE parts SET name_en = '기어 가드' WHERE id = 1169; -- 자전거 기어 가드
UPDATE parts SET name_en = 'Front Baby Seat for Cargo' WHERE id = 1159; -- [카고LT] 미들 유아안장
UPDATE parts SET name_en = 'Long wide Seat for RetroFS/Retro20' WHERE id = 1200; -- [레트로FS] 롱 와이드 시트
UPDATE parts SET name_en = 'Chain for Classic' WHERE id = 900; -- [클래식] 체인
UPDATE parts SET name_en = 'Bike - Blade - Metal grey' WHERE id = 1037; -- 블레이드 Blade  - 메탈 그레이
UPDATE parts SET name_en = 'Bike - Retro 20 - Matte black' WHERE id = 1035; -- 레트로 Retro - 매트 블랙
UPDATE parts SET name_en = 'Fork cap for Retro mini' WHERE id = 1154; -- [레트로 미니] 포크 캡
UPDATE parts SET name_en = 'Rear rack for Classic' WHERE id = 905; -- [클래식] 리어렉(짐받이) - 블랙
UPDATE parts SET name_en = 'Battery tray (No Line)' WHERE id = 1104; -- 배터리 거치대(KTX, 라인 없음)
UPDATE parts SET name_en = 'Bike - Retro Pro - Sand beige' WHERE id = 1121; -- 레트로 FS Retro FS - 샌드 베이지
UPDATE parts SET name_en = 'Front light for Retro mini' WHERE id = 918; -- [레트로 미니] 레트로 헤드라이트
UPDATE parts SET name_en = 'Front Axle for Blade' WHERE id = 1053; -- [블레이드FS/블레이드/카고LT] 프론트 엑슬
UPDATE parts SET name_en = 'Frame black for Cargo LT' WHERE id = 1156; -- [카고LT] 프레임 블랙
UPDATE parts SET name_en = 'Mudguard set for Sprinter' WHERE id = 1094; -- [스프린터] 머드가드 세트
UPDATE parts SET name_en = 'Saddle for Retro/Retro mini' WHERE id = 923; -- [레트로/레트로 미니] 블랙 시트(구)
UPDATE parts SET name_en = 'Grips for Classic' WHERE id = 901; -- [클래식] 그립 세트 - 브라운
UPDATE parts SET name_en = 'Rear rack for Retro/Retro mini' WHERE id = 921; -- [레트로/레트로 미니] 리어렉(짐받이)
UPDATE parts SET name_en = 'Chain for Cargo' WHERE id = 935; -- [카고] 체인
UPDATE parts SET name_en = 'Front rim set 20" with axle for Cargo' WHERE id = 940; -- [카고] 프론트 림 휠 세트(엑슬 포함)
UPDATE parts SET name_en = 'Rear seat for Cargo' WHERE id = 945; -- [카고LT/카고] 리어 보조 안장
UPDATE parts SET name_en = 'Bowl set for Classic/Cargo/Retro/Retro mini' WHERE id = 956; -- [클래식/레트로/카고] 헤드셋 베어링 캡 세트
UPDATE parts SET name_en = 'Front and rear fender for Cargo' WHERE id = 932; -- [카고] 머드가드 세트(프론트/리어)
UPDATE parts SET name_en = 'Tyre 20"x3.0" 1pcs for Cargo' WHERE id = 937; -- [카고] 광폭 타이어 20x3.0
UPDATE parts SET name_en = 'Front rack for Cargo' WHERE id = 930; -- [카고LT/카고] 프론트 렉 - 블랙
UPDATE parts SET name_en = 'Stem for Cargo' WHERE id = 934; -- [카고LT/카고] 스템
UPDATE parts SET name_en = 'Gears for Cargo' WHERE id = 1162; -- [카고] 유성기어
UPDATE parts SET name_en = 'Front and rear fender for Cargo LT' WHERE id = 1160; -- [카고LT] 머드가드
UPDATE parts SET name_en = 'PAS sensor for Classic/Cargo/Retro/Retro mini' WHERE id = 955; -- [클래식/레트로/카고] PAS 센서 
UPDATE parts SET name_en = 'Bike - Cargo - grey' WHERE id = 985; -- 카고 Cargo - 그레이
UPDATE parts SET name_en = 'Battery 20ah(with sticker) include case for Classic/Cargo/Retro' WHERE id = 967; -- 48V 20Ah KTX 배터리(거치형 배터리거치대 포함)
UPDATE parts SET name_en = 'Bike - Sprinter - Urban Gray' WHERE id = 1106; -- 스프린터 Sprinter - 어반 그레이
UPDATE parts SET name_en = 'Battery 15ah(with sticker) incluse case for Classic/Cargo/Retro' WHERE id = 968; -- 48V 15Ah KTX 배터리(거치형 배터리거치대 포함)
UPDATE parts SET name_en = 'Bike - Sprinter - Black' WHERE id = 1105; -- 스프린터 Sprinter - 블랙
UPDATE parts SET name_en = 'Rear light for Sprinter' WHERE id = 1089; -- [스프린터] 리어라이트(후미등)
UPDATE parts SET name_en = 'Seat for Sprinter' WHERE id = 1087; -- [스프린터] 시트
UPDATE parts SET name_en = 'Bike - Retro 20 - Sand beige' WHERE id = 1036; -- 레트로 Retro - 샌드 베이지
UPDATE parts SET name_en = 'Bike - Classic - urban green' WHERE id = 981; -- 클래식 Classic - 어반 그린
UPDATE parts SET name_en = 'Bike - Retro 16 - matte black' WHERE id = 983; -- 레트로 미니 Retro mini - 매트 블랙
UPDATE parts SET name_en = 'Bike - Classic - matte black' WHERE id = 980; -- 클래식 Classic - 매트 블랙
UPDATE parts SET name_en = 'Battery case 20ah(with sticker) for Classic/Cargo/Retro' WHERE id = 970; -- 48V 20Ah KTX 배터리케이스(스티커 포함)
UPDATE parts SET name_en = 'Bike - Retro 16 - sand beige' WHERE id = 984; -- 레트로 미니 Retro mini - 샌드베이지
UPDATE parts SET name_en = 'Front Axle for Retro20' WHERE id = 1064; -- [레트로FS/레트로] 프론트 엑슬
UPDATE parts SET name_en = 'Derailleur Hanger B for Cargo' WHERE id = 1023; -- [카고LT/카고] 드레일러 행어 B
UPDATE parts SET name_en = 'Rear motor set for Retro20' WHERE id = 1065; -- [레트로FS/레트로] 리어 모터 세트
UPDATE parts SET name_en = 'Chain wheel & crank arm set for Sprinter' WHERE id = 1080; -- [스프린터] 체인 크랭크 세트
UPDATE parts SET name_en = 'Main cable for Sprinter' WHERE id = 1075; -- [스프린터] 메인 케이블
UPDATE parts SET name_en = 'Gears for Classic' WHERE id = 1153; -- [클래식] 유성기어
UPDATE parts SET name_en = 'Seat post for Sprinter' WHERE id = 1085; -- [스프린터] 시트포스트
UPDATE parts SET name_en = 'Folding stem for Sprinter' WHERE id = 1082; -- [스프린터] 폴딩 스템
UPDATE parts SET name_en = 'Mudguard set for Retro20' WHERE id = 1059; -- [레트로] 머드가드 세트
UPDATE parts SET name_en = 'Mudguard set for Blade' WHERE id = 1050; -- [블레이드FS/블레이드] 머드가드 세트
UPDATE parts SET name_en = 'Pas sensor for Sprinter' WHERE id = 1077; -- [스프린터] 스피드 센서
UPDATE parts SET name_en = 'Handlebar for Cargo' WHERE id = 933; -- [카고LT/카고] 핸들바
UPDATE parts SET name_en = 'Frame metal grey for Blade' WHERE id = 1044; -- [블레이드] 프레임 - 메탈 그레이
UPDATE parts SET name_en = 'Folding footpeg for Cargo LT' WHERE id = 1259; -- [카고LT] 접이식 풋페그
UPDATE parts SET name_en = 'Alu frame green for Classic' WHERE id = 1095; -- [클래식] 프레임 - 어반 그린
UPDATE parts SET name_en = 'BB set 140mm for Classic (BB83 / 80mm / 140mm)' WHERE id = 1099; -- [클래식] BB 세트 140mm
UPDATE parts SET name_en = 'Electric harness for RetroFS/CargoLT' WHERE id = 1139; -- [레트로FS/블레이드FS/카고LT] 메인 케이블(N)
UPDATE parts SET name_en = '80cm rope with hook for Cargo' WHERE id = 931; -- [카고LT/카고] 고정끈 80cm
UPDATE parts SET name_en = 'Front Axle for Cargo' WHERE id = 1103; -- [카고] 프론트 엑슬 - 카고
UPDATE parts SET name_en = 'Rear wheel set(Lim, Spoke, Hub set with axle) for Sprinter' WHERE id = 1091; -- [스프린터] 리어 휠 세트(림, 스포크, 허브세트, 엑슬)
UPDATE parts SET name_en = 'Alu frame navy for Classic' WHERE id = 1096; -- [클래식] 프레임 - 로얄 네이비
UPDATE parts SET name_en = 'Display for Classic/Cargo/Retro/Retro mini' WHERE id = 954; -- [클래식/레트로/카고] 디스플레이 BN136(구)
UPDATE parts SET name_en = 'Frame matte black for Retro FS' WHERE id = 1145; -- [레트로FS] 프레임 - 매트블랙
UPDATE parts SET name_en = 'Mudguard set for Retro FS' WHERE id = 1149; -- [레트로FS] 머드가드 세트
UPDATE parts SET name_en = 'Electric harness for Classic/Cargo/Retro' WHERE id = 949; -- [클래식/레트로/카고] 메인 케이블
UPDATE parts SET name_en = 'Needle Roller Bearing for Sprinter' WHERE id = 1207; -- [스프린터] 니들 베어링
UPDATE parts SET name_en = 'Controller for Cargo' WHERE id = 952; -- [카고] 컨트롤러
UPDATE parts SET name_en = 'Motor set(Display/Crank/pedal/electronic line/controller/holder/Pas sensor) for Sprinter' WHERE id = 1078; -- [스프린터] 모터 세트
UPDATE parts SET name_en = 'Seat post clamp for Cargo' WHERE id = 944; -- [카고] 시트포스트 클램프(QR)
UPDATE parts SET name_en = 'Front rim set 16" with axle for Retro mini' WHERE id = 919; -- [레트로 미니] 프론트 마그네슘 16 휠 세트(엑슬 포함)
UPDATE parts SET name_en = 'Stem for Classic' WHERE id = 888; -- [클래식] 스템 실버
UPDATE parts SET name_en = 'Front spoke for Classic' WHERE id = 899; -- [클래식] 프론트용 스포크 - 실버
UPDATE parts SET name_en = 'Seat post clamp for Sprinter' WHERE id = 1086; -- [스프린터] 시트포스트 클램프(QR)
UPDATE parts SET name_en = 'Front rim set 20" with axle for Blade' WHERE id = 1052; -- [블레이드FS/블레이드/카고LT] 프론트 휠 세트(엑슬 포함)
UPDATE parts SET name_en = 'Front suspention fork for Retro20' WHERE id = 1058; -- [레트로] 프론트 서스펜션 포크
UPDATE parts SET name_en = 'Tube 20"x3.0" 1pcs for Cargo' WHERE id = 938; -- [카고] 튜브 20x3.0
UPDATE parts SET name_en = 'Saddle for Cargo' WHERE id = 942; -- [카고LT/카고] 와이드 시트 - 블랙
UPDATE parts SET name_en = 'Gear set for Sprinter' WHERE id = 1205; -- [스프린터] 이너기어 세트
UPDATE parts SET name_en = 'Controller for Classic' WHERE id = 951; -- [클래식] 컨트롤러
UPDATE parts SET name_en = 'Frame sand beige for Retro FS' WHERE id = 1146; -- [레트로FS] 프레임 - 샌드베이지
UPDATE parts SET name_en = 'Frame for Sprinter Black' WHERE id = 1068; -- [스프린터] 프레임 - 블랙
UPDATE parts SET name_en = 'Frame for Cargo' WHERE id = 928; -- [카고] 프레임 - 그레이
UPDATE parts SET name_en = 'Motor other set(Display/Crank/pedal/electronic line/controller/holder/Pas sensor) for Sprinter' WHERE id = 1079; -- [스프린터] E-파츠 세트
UPDATE parts SET name_en = 'Frame for Sprinter Gray' WHERE id = 1069; -- [스프린터] 프레임 - 그레이
UPDATE parts SET name_en = 'Headlight Holder for Retro20' WHERE id = 1061; -- [레트로FS/레트로] 헤드라이트 홀더
UPDATE parts SET name_en = 'Chain for Blade' WHERE id = 1055; -- [블레이드FS/블레이드] 체인
UPDATE parts SET name_en = 'Rear spoke for Classic' WHERE id = 898; -- [클래식] 리어용 스포크 - 실버
UPDATE parts SET name_en = 'Tall seat, saddle for Retro/Retro mini' WHERE id = 922; -- [레트로/레트로 미니] 톨시트
UPDATE parts SET name_en = 'Inner tube 2 set for Sprinter/Blade' WHERE id = 1073; -- [스프린터/블레이드FS/블레이드] 튜브 20x2.4 1개
UPDATE parts SET name_en = 'Front & rear spoke(set) for Sprinter' WHERE id = 1092; -- [스프린터] 스포크 세트
UPDATE parts SET name_en = 'Display for Sprinter' WHERE id = 1074; -- [스프린터] 디스플레이
UPDATE parts SET name_en = 'Fork for Cargo' WHERE id = 929; -- [카고] 프론트 포크 - 블랙
UPDATE parts SET name_en = 'Frame matte black for Retro20' WHERE id = 1056; -- [레트로] 프레임 - 매트블랙
UPDATE parts SET name_en = '7 Gear set for Classic/Cargo/Retro/Blade' WHERE id = 907; -- [클래식/카고/레트로/블레이드] 시마노 7단 기어 세트(드레일러, 라이트 쉬프터)
UPDATE parts SET name_en = 'Gears for Retro mini' WHERE id = 1155; -- [레트로 미니] 유성기어
UPDATE parts SET name_en = 'Handlebar for Retro mini' WHERE id = 911; -- [레트로 미니] 핸들바 - 블랙
UPDATE parts SET name_en = 'Front and rear fender for Retro mini' WHERE id = 910; -- [레트로 미니] 머드가드 세트(프론트/리어)
UPDATE parts SET name_en = 'Rear motor Set rim 16" for Retro mini' WHERE id = 920; -- [레트로 미니] 리어 모터 16 휠 세트
UPDATE parts SET name_en = 'Steel fork Beige for Retro mini' WHERE id = 1101; -- [레트로 미니] 프론트 포크 - 샌드베이지
UPDATE parts SET name_en = 'Headlight ring adaptor for Retro20' WHERE id = 1168; -- [레트로FS/레트로] 5인치 헤드라이트 링 아답터
UPDATE parts SET name_en = 'Tyre 16"x4.0" 1pcs for Retro mini' WHERE id = 916; -- [레트로 미니] 광폭 타이어 16x4.0
UPDATE parts SET name_en = '16" Frame Beige for Retro mini' WHERE id = 1100; -- [레트로 미니] 프레임 - 샌드베이지
UPDATE parts SET name_en = 'Steel fork Black for Retro mini' WHERE id = 909; -- [레트로 미니] 프론트 포크 - 매트 블랙
UPDATE parts SET name_en = 'Rim tape 20" for Classic' WHERE id = 904; -- [클래식] 림 테이프 20x2.125
UPDATE parts SET name_en = 'Seat post clamp for Classic' WHERE id = 890; -- [클래식] 시트포스트 클램프 - 실버
UPDATE parts SET name_en = 'Front fork for Classic' WHERE id = 886; -- [클래식] 프론트 포크
UPDATE parts SET name_en = 'Rear Wheel set with motor 20" for Classic
(all assembled with motor)' WHERE id = 896; -- [클래식] 리어 모터 20 휠 세트 - 실버
UPDATE parts SET name_en = 'Seat for Classic' WHERE id = 889; -- [클래식] 브라운 시트
UPDATE parts SET name_en = 'Front and rear fender for Classic' WHERE id = 903; -- [클래식] 머드가드세트(프론트, 리어) - 실버
UPDATE parts SET name_en = 'Front light for classic' WHERE id = 897; -- [클래식] 클래식 헤드라이트 - 실버
UPDATE parts SET name_en = 'Controller for Retro/Retro mini' WHERE id = 953; -- [레트로/레트로미니] 컨트롤러
UPDATE parts SET name_en = 'Derailleur Hanger A for Classic / Retro' WHERE id = 1022; -- [레트로/클래식] 드레일러 행어 A(X200맥스 공용)
UPDATE parts SET name_en = 'Front wheel set 20" for Classic
(rim, spoke, hub set with QR axle)' WHERE id = 895; -- [클래식] 프론트 휠 세트 (림, 스포크, 허브 세트, QR 엑슬) - 실버
UPDATE parts SET name_en = 'Alu frame matte white for Classic' WHERE id = 1043; -- [클래식] 프레임 - 매트 화이트
UPDATE parts SET name_en = 'Alu frame matte black for Classic' WHERE id = 885; -- [클래식] 프레임 - 매트 블랙
UPDATE parts SET name_en = 'Front rim set 20" with axle for Retro20' WHERE id = 1063; -- [레트로FS/레트로] 프론트 휠 세트(엑슬 포함)
UPDATE parts SET name_en = 'Seat post clamp for Blade' WHERE id = 1049; -- [블레이드FS/블레이드/카고LT] 시트포스트 클램프(볼트)
UPDATE parts SET name_en = 'Rear motor set for Blade' WHERE id = 1054; -- [블레이드FS/블레이드/카고LT] 리어 모터 세트
UPDATE parts SET name_en = 'Controller for Blade' WHERE id = 1163; -- [블레이드] 컨트롤러
UPDATE parts SET name_en = 'Front Axle for Retro mini' WHERE id = 1102; -- [레트로 미니] 프론트 엑슬
UPDATE parts SET name_en = 'Innova Tire 20"x4" 1pcs for Retro20' WHERE id = 1152; -- [레트로FS/레트로] 이노바 타이어 20x4.0
UPDATE parts SET name_en = 'Front Basket for Cargo' WHERE id = 1158; -- [레트로투어/카고LT/카고] 프론트 바스켓
UPDATE parts SET name_en = 'Chain for Retro20' WHERE id = 1066; -- [레트로FS/레트로] 체인
UPDATE parts SET name_en = 'Derailleur Hanger C for Blade' WHERE id = 1051; -- [블레이드FS/블레이드] 드레일러 행어 C
UPDATE parts SET name_en = 'Front Axle for Classic' WHERE id = 1098; -- [클래식] 프론트 엑슬(QR)
UPDATE parts SET name_en = 'Rear rack for Blade' WHERE id = 1048; -- [블레이드FS/블레이드] 리어렉
UPDATE parts SET name_en = 'Frame sand beige for Retro20' WHERE id = 1057; -- [레트로] 프레임 - 샌드베이지
UPDATE parts SET name_en = 'Seat post clamp for Blade FS/Cargo LT' WHERE id = 1142; -- [블레이드FS/블레이드/카고LT] 시트포스트 클램프(QR)
UPDATE parts SET name_en = 'Adjustable angle stem for Blade' WHERE id = 1047; -- [블레이드FS/블레이드] 가변 스템
UPDATE parts SET name_en = 'Front suspention fork for Blade' WHERE id = 1045; -- [블레이드FS/블레이드] 프론트 서스펜션 포크
UPDATE parts SET name_en = 'Front light with rubber pad for Sprinter' WHERE id = 1088; -- [스프린터] 헤드라이트
UPDATE parts SET name_en = 'Kick stand (Bike support) for Classic' WHERE id = 902; -- [클래식] 킥스탠드
UPDATE parts SET name_en = 'Handle for Sprinter' WHERE id = 1083; -- [스프린터] 핸들바
UPDATE parts SET name_en = 'Gear full set (Shimano 8 gears) for Sprinter' WHERE id = 1081; -- [스프린터] 8기어 세트(시마노)
UPDATE parts SET name_en = 'Front wheel set (Lim, Spoke, Hub set with QR axle) for Sprinter' WHERE id = 1090; -- [스프린터] 프론트 휠 세트(림, 스포크, 허브세트, QR 엑슬)
UPDATE parts SET name_en = 'Rim tape (set) for Sprinter' WHERE id = 1093; -- [스프린터] 림테이프 세트
UPDATE parts SET name_en = '7 Gear set shrot for Retro mini' WHERE id = 915; -- [레트로 미니] 시마노 7단 숏 기어 세트(드레일러, 라이트 쉬프터)
UPDATE parts SET name_en = 'Stem clamp for Classic' WHERE id = 1097; -- [클래식] 핸들포스트 클램프 실버
UPDATE parts SET name_en = 'Tyre 2 set for Sprinter/Blade' WHERE id = 1072; -- [스프린터/블레이드FS/블레이드] 20x2.4 켄다 타이어
UPDATE parts SET name_en = 'Chain for Sprinter' WHERE id = 1071; -- [스프린터] 체인
UPDATE parts SET name_en = 'Rear rack for Sprinter' WHERE id = 1084; -- [스프린터] 리어렉
UPDATE parts SET name_en = 'Fork spacer for Blade' WHERE id = 1046; -- [블레이드FS/블레이드] 포크 스페이서
UPDATE parts SET name_en = 'Headlight for Retro20' WHERE id = 1060; -- 5인치 헤드라이트 - 레트로20

COMMIT;