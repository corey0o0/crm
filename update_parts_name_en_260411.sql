-- 260411 엑스라이더 발주 마스터.xlsx 바코드 매칭 영문명 업데이트
-- 이미 name_en 있는 파츠는 제외, 290건
BEGIN;

UPDATE parts SET name_en = 'Dbsm for X200S/X200' WHERE id = 550; -- DBSM X200
UPDATE parts SET name_en = 'Controller for X200T (2000W)' WHERE id = 547; -- 컨트롤러 X200T (2000W)
UPDATE parts SET name_en = 'Bike - X50 Chrome' WHERE id = 523; -- X50 미러크롬
UPDATE parts SET name_en = 'Bike support(kick stand) Blue' WHERE id = 778; -- 컬러 킥스탠드 블루
UPDATE parts SET name_en = 'Motor set for X100 (350W)' WHERE id = 555; -- 모터 세트 X100 (350W)
UPDATE parts SET name_en = 'Rear rack Red' WHERE id = 761; -- 컬러 리어렉 레드
UPDATE parts SET name_en = 'Bike - X200 Pro chrome' WHERE id = 520; -- X200 Pro 미러크롬
UPDATE parts SET name_en = '48V Battery KTX tray(XT60)' WHERE id = 542; -- 48V KTX 배터리 거치대 X200 (트레이, XT60)
UPDATE parts SET name_en = 'Bike - mini pro beige' WHERE id = 535; -- 미니 mini Pro 베이지
UPDATE parts SET name_en = 'Controller for New X100' WHERE id = 544; -- 컨트롤러 New X100
UPDATE parts SET name_en = 'Controller for X200 Pro/X100 Pro' WHERE id = 576; -- 컨트롤러 - X200 Pro/X100 Pro
UPDATE parts SET name_en = 'Bike - X200 Pro hot pink' WHERE id = 525; -- X200 Pro 핑크
UPDATE parts SET name_en = 'Bike - X200 Pro till blue' WHERE id = 524; -- X200 Pro 틸블루
UPDATE parts SET name_en = 'Gears for X200S (bafang, 1000W)' WHERE id = 537; -- 유성기어 X200S (바팡, 1000W)
UPDATE parts SET name_en = 'Bike - mini black' WHERE id = 534; -- 미니 mini 블랙
UPDATE parts SET name_en = 'Bike - X100 Max black' WHERE id = 528; -- X100 MAX 블랙
UPDATE parts SET name_en = 'Controller for X200S (1000W)' WHERE id = 546; -- 컨트롤러 X200S (1000W)
UPDATE parts SET name_en = 'Bike - X200 Max black' WHERE id = 526; -- X200 MAX 블랙
UPDATE parts SET name_en = 'Bike - Turbo Pro mirror chrome' WHERE id = 521; -- Turbo Pro 미러크롬
UPDATE parts SET name_en = 'Controller for X100 (350W)' WHERE id = 548; -- 컨트롤러 X100 (350W)
UPDATE parts SET name_en = 'Bike support(kick stand) Red' WHERE id = 775; -- 컬러 킥스탠드 레드
UPDATE parts SET name_en = 'Rear brake set XOD for X200 Pro/X200/X200S' WHERE id = 594; -- 리어 브레이크 세트 XOD
UPDATE parts SET name_en = '48V 2A charger DC' WHERE id = 601; -- 48V 2A 일반충전기 DC
UPDATE parts SET name_en = 'Rear rack Yellow' WHERE id = 762; -- 컬러 리어렉 옐로우
UPDATE parts SET name_en = 'Front brake set XOD for X200 Pro/X200/X200S' WHERE id = 593; -- 프론트 브레이크 세트 XOD
UPDATE parts SET name_en = 'Seat lefter for X200' WHERE id = 798; -- 시트리프트 X200
UPDATE parts SET name_en = 'Front light for X200/X200S/X200T/NewX100' WHERE id = 558; -- 헤드라이트 X200/X200S-사용X
UPDATE parts SET name_en = 'Disc rotor 180E 1.8mm X100/X100S' WHERE id = 641; -- 디스크 로터 180E 1.8mm X100/X100S
UPDATE parts SET name_en = 'Mini charger' WHERE id = 605; -- 미니 차저
UPDATE parts SET name_en = 'Rim tape' WHERE id = 653; -- 림테이프
UPDATE parts SET name_en = 'Main cable electric harness for X200 Pro/X100 Pro/Turbo Pro' WHERE id = 587; -- 메인 케이블 세트 - X200 Pro/Turbo Pro/X100 Pro
UPDATE parts SET name_en = 'Motor ring' WHERE id = 661; -- 모터링
UPDATE parts SET name_en = 'Frame black X50' WHERE id = 723; -- 프레임 블랙 - X50
UPDATE parts SET name_en = 'Tyre VEE XRB 20x4.5 1pcs' WHERE id = 1018; -- Vee XRB 타이어 20x4.5 1개
UPDATE parts SET name_en = 'Rear light for X100/X100S' WHERE id = 561; -- 리어라이트 - X100/X100S
UPDATE parts SET name_en = 'Chain for X200' WHERE id = 655; -- 체인 - X200
UPDATE parts SET name_en = 'Brake Sensor(KTET)' WHERE id = 1112; -- KTET 브레이크 센서
UPDATE parts SET name_en = 'Compression ring' WHERE id = 724; -- 헤드튜브 컴프레션 링
UPDATE parts SET name_en = 'Battery case for mini' WHERE id = 682; -- 시트포스트 배터리 케이스 - 미니
UPDATE parts SET name_en = 'Tyre VEE huntsman 20x4.0 1pcs' WHERE id = 698; -- Vee 헌츠맨 타이어 20x4.0 1개
UPDATE parts SET name_en = 'BB EST' WHERE id = 725; -- 헤드튜브 베어링 세트(2개)
UPDATE parts SET name_en = 'Tyre VEE huntsman 20x4.8 1pcs' WHERE id = 699; -- Vee 헌츠맨 타이어 20x4.8 1개
UPDATE parts SET name_en = 'Rear light alarm braket for seat' WHERE id = 737; -- 리어 스마트 알람 안장 브라켓
UPDATE parts SET name_en = 'Long H shape handle silver' WHERE id = 715; -- 롱H핸들 실버
UPDATE parts SET name_en = 'Sunflower nut(mojo)' WHERE id = 729; -- 해바라기 너트(mojo)
UPDATE parts SET name_en = 'Upper cap' WHERE id = 726; -- 탑캡&볼트
UPDATE parts SET name_en = 'BB set(178mm) for X50' WHERE id = 719; -- 사각 BB 세트(178mm)
UPDATE parts SET name_en = 'Helical band' WHERE id = 727; -- 헬리컬 밴드
UPDATE parts SET name_en = 'Carbon style mudguard for X200' WHERE id = 702; -- 카본 스타일 머드가드 X200
UPDATE parts SET name_en = 'Rear light for X200T (60V)' WHERE id = 562; -- 리어라이트 - X200T(60V)
UPDATE parts SET name_en = 'Wind Sheild Pink' WHERE id = 758; -- 컬러 윈드실드 핑크
UPDATE parts SET name_en = 'Rear rack Pink' WHERE id = 763; -- 컬러 리어렉 핑크
UPDATE parts SET name_en = 'Seat clamp black(QR) for X50' WHERE id = 717; -- 시트포스트 클램프 X50 블랙
UPDATE parts SET name_en = 'Fastace Disc rotor 203E 2.3mm for Turbo Pro' WHERE id = 703; -- Fastace 디스크 로터 203E 2.3mm - Turbo Pro
UPDATE parts SET name_en = 'Seat clamp chrome(QR) for X50' WHERE id = 710; -- 시트포스트 클램프 X50 크롬
UPDATE parts SET name_en = 'Front fork for X100 Pro
(mojo)' WHERE id = 720; -- 프론트 포크 X100프로/New X100
UPDATE parts SET name_en = 'Bag M for X200/X200S/X200T/X200Pro/TurboPro' WHERE id = 806; -- 수납가방 M
UPDATE parts SET name_en = 'Wind Sheild Yellow' WHERE id = 757; -- 컬러 윈드실드 옐로우
UPDATE parts SET name_en = 'Bag L for X200/X200S/X200T/X200Pro/TurboPro' WHERE id = 807; -- 수납가방 L
UPDATE parts SET name_en = 'Foot peg for Turbo Pro/X200T' WHERE id = 736; -- BB 풋페그 - 터보프로/X200T(페달 제거)
UPDATE parts SET name_en = '60V 25Ah jumbo Battery yellow' WHERE id = 838; -- 60V 25Ah 점보 배터리-옐로우
UPDATE parts SET name_en = 'Bike - X200 Pro metal grey' WHERE id = 1235; -- X200 Pro - 메탈 그레이
UPDATE parts SET name_en = '48V 35Ah jumbo Battery white' WHERE id = 834; -- 48V 35Ah 점보 배터리-화이트
UPDATE parts SET name_en = 'Jumbo case chrome' WHERE id = 813; -- 점보 케이스-크롬
UPDATE parts SET name_en = '60V 25Ah jumbo Battery red' WHERE id = 837; -- 60V 25Ah 점보 배터리-레드
UPDATE parts SET name_en = '60V 25Ah jumbo Battery chrome' WHERE id = 836; -- 60V 25Ah 점보 배터리-크롬
UPDATE parts SET name_en = 'Tektro Brake sensor' WHERE id = 1245; -- 브레이크 센서 텍트로
UPDATE parts SET name_en = 'Jumbo case matte black' WHERE id = 812; -- 점보 케이스-무광블랙
UPDATE parts SET name_en = 'Main cable electric harness for X100/X100S' WHERE id = 567; -- 메인 케이블 X100/X100S
UPDATE parts SET name_en = 'Motor Bearing for X200Max/X100Max/X200Pro/X50' WHERE id = 1189; -- 모터 베어링 - X200 MAX/X100 MAX/X200 Pro/X50
UPDATE parts SET name_en = 'Rear light for X100 Pro/X200 Pro/Turbo Pro (12V)' WHERE id = 621; -- 리어라이트 12V - X200 Pro/X100 Pro/Turbo Pro
UPDATE parts SET name_en = 'Brake sensor for Turbo Pro' WHERE id = 597; -- 브레이크 센서 - Turbo Pro
UPDATE parts SET name_en = 'Rear brake lever for Turbo Pro' WHERE id = 684; -- 리어 브레이크 래버 - Turbo Pro
UPDATE parts SET name_en = 'Seat post black for X50' WHERE id = 718; -- 시트포스트 X50 블랙
UPDATE parts SET name_en = 'Front brake set for Turbo Pro
(Fastace)' WHERE id = 692; -- 프론트 브레이크 세트 - Turbo Pro
UPDATE parts SET name_en = 'Fork guard sticker Yellow for X100 Max' WHERE id = 785; -- 컬러 포크가드 스티커 옐로우 - X100 MAX
UPDATE parts SET name_en = 'Fork guard sticker Yellow for X200 Max' WHERE id = 752; -- 컬러 포크가드 스티커 옐로우 - X200 MAX
UPDATE parts SET name_en = 'KKE brake line holder with screw for Pro' WHERE id = 734; -- KKE 브레이크 라인 홀더 - X200 Pro/Turbo Pro/X50
UPDATE parts SET name_en = 'Dbsm for Turbo Pro' WHERE id = 586; -- DBSM - Turbo Pro
UPDATE parts SET name_en = 'Front brake lever for Turbo Pro
(fastace)' WHERE id = 683; -- 프론트 브레이크 래버 - Turbo Pro
UPDATE parts SET name_en = 'Bike - X100 Max grey' WHERE id = 529; -- X100 MAX 어반 그레이
UPDATE parts SET name_en = 'Fork guard sticker Black for X100 Max' WHERE id = 788; -- 컬러 포크가드 스티커 블랙 - X100 MAX
UPDATE parts SET name_en = 'Gears for X200Max/X100Max/X200 Pro/X100 Pro/X50' WHERE id = 540; -- 유성기어 - X200 MAX/X100 Pro/X200 Pro/X50
UPDATE parts SET name_en = 'Cowboy suspension 20" (RED dial) for X100 Max' WHERE id = 782; -- cowboy 서스펜션 포크 - X100 MAX
UPDATE parts SET name_en = 'Frame beige for X200 with Pivot set' WHERE id = 664; -- 프레임 베이지 X200
UPDATE parts SET name_en = 'Motor set for Turbo S(1500W)' WHERE id = 578; -- 모터 세트 - Turbo Pro
UPDATE parts SET name_en = '12v DC converter for X200 Pro/X100 Pro/Turbo Pro' WHERE id = 610; -- DC 컨버터 - X200 Pro/Turbo Pro/X100 Pro
UPDATE parts SET name_en = 'Fork guard sticker Pink for X200 Max' WHERE id = 753; -- 컬러 포크가드 스티커 핑크 - X200 MAX
UPDATE parts SET name_en = 'Rear brake set for Turbo Pro' WHERE id = 689; -- 리어 브레이크 세트 - Turbo Pro
UPDATE parts SET name_en = '60V 5A charger 3 pin' WHERE id = 821; -- 60V 5A 고속 충전기 3핀
UPDATE parts SET name_en = 'Tekkro disc rotor 180E 1.8mm Tektro X200 Pro/X100 Pro/X50' WHERE id = 707; -- 텍트로 디스크 로터 180E 1.8mm X200 프로/X100 프로/X50
UPDATE parts SET name_en = 'XRB Brake pad set for X200/X200S/X200T/New X100(2pcs)' WHERE id = 643; -- XRB 브레이크 패드 세트 X200/X200S/X200T/New X100(2개)
UPDATE parts SET name_en = 'Alarm system set for X200 Pro/Turbo Pro/X100 Pro' WHERE id = 687; -- 알람 시스템 세트(모듈, 리모컨) - X200 Pro/Turbo Pro/X100 Pro
UPDATE parts SET name_en = 'XRB Disc rotor 180E 3mm X200/X200S/X200T/New X100' WHERE id = 640; -- XRB 디스크 로터 180E 3mm X200/X200S/X200T/New X100
UPDATE parts SET name_en = 'Front axle for Turbo Pro' WHERE id = 730; -- 프론트 엑슬 - Turbo Pro
UPDATE parts SET name_en = 'Mudguard set (front & middle & rear) Red' WHERE id = 770; -- 컬러 머드가드 세트 레드 - X200 MAX
UPDATE parts SET name_en = 'Side rack set Blue X200 Max' WHERE id = 768; -- 컬러 사이드렉 세트 블루 - X200 MAX/X100 MAX/X200 Pro
UPDATE parts SET name_en = 'Front light for X200/X200S/X200T/NewX100' WHERE id = 557; -- 헤드라이트 - X200/X200S/X200T/New X100
UPDATE parts SET name_en = 'Motor set for X200 Pro/X100 Pro/X50' WHERE id = 595; -- 모터 세트 - X200 Pro/X100 Pro
UPDATE parts SET name_en = 'Left switch for mini' WHERE id = 569; -- 기능 스위치 - 미니
UPDATE parts SET name_en = 'Front rim with axle for Turbo S' WHERE id = 592; -- 프론트 림 - Turbo Pro
UPDATE parts SET name_en = 'Fork guard sticker Black for X200 Max' WHERE id = 755; -- 컬러 포크가드 스티커 블랙 - X200 MAX
UPDATE parts SET name_en = 'Side rack set Pink X200 Max' WHERE id = 767; -- 컬러 사이드렉 세트 핑크 - X200 MAX/X100 MAX/X200 Pro
UPDATE parts SET name_en = '60V 25Ah jumbo Battery white' WHERE id = 839; -- 60V 25Ah 점보 배터리-화이트
UPDATE parts SET name_en = 'Controller plate for Turbo Pro' WHERE id = 735; -- 컨트롤러 플레이트 - Turbo Pro
UPDATE parts SET name_en = 'Mudguard set (front & middle & rear) Yellow' WHERE id = 771; -- 컬러 머드가드 세트 옐로우 - X200 MAX
UPDATE parts SET name_en = 'Side rack set Yellow X200 Max' WHERE id = 766; -- 컬러 사이드렉 세트 옐로우 - X200 MAX/X100 MAX/X200 Pro
UPDATE parts SET name_en = 'Fork guard sticker Red for X100 Max' WHERE id = 784; -- 컬러 포크가드 스티커 레드 - X100 MAX
UPDATE parts SET name_en = 'Mudguard set (front & middle & rear) Pink' WHERE id = 772; -- 컬러 머드가드 세트 핑크 - X200 MAX
UPDATE parts SET name_en = 'Folding foot peg KKE for X200 Pro/Turbo Pro/X50' WHERE id = 793; -- 접이식 풋페그(유아발판) - X200 Pro/Turbo Pro/X50
UPDATE parts SET name_en = 'Fork guard sticker Blue for X100 Max' WHERE id = 787; -- 컬러 포크가드 스티커 블루 - X100 MAX
UPDATE parts SET name_en = 'Short Seat Black for X100 Max' WHERE id = 1038; -- 소프트 숏시트 - X100 MAX
UPDATE parts SET name_en = 'Front rim with axle for X200 Pro/X100 Pro' WHERE id = 591; -- 프론트 림 - X200 Pro/X100 Pro
UPDATE parts SET name_en = 'Fork guard sticker Blue for X200 Max' WHERE id = 754; -- 컬러 포크가드 스티커 블루 - X200 MAX
UPDATE parts SET name_en = 'Relay for X100 Pro/X200 Pro/Turbo Pro' WHERE id = 606; -- 릴레이 - X200 Pro/Turbo Pro/X100 Pro
UPDATE parts SET name_en = 'Dbsm for X200 Pro' WHERE id = 585; -- DBSM - X200 Pro
UPDATE parts SET name_en = 'Mudguard set (front & middle & rear) Black for X200 Max' WHERE id = 774; -- 컬러 머드가드 세트 블랙 - X200 MAX
UPDATE parts SET name_en = 'Front light / option 1 / 7"' WHERE id = 580; -- 서클 헤드라이트 - X200 Pro/Turbo Pro/X100 Pro
UPDATE parts SET name_en = 'Tektro rear brake set for X200Pro/X100Pro' WHERE id = 604; -- 리어 브레이크 세트 텍트로
UPDATE parts SET name_en = '48V 20Ah Mini jumbo battery Black' WHERE id = 626; -- 48V 20Ah 미니점보 배터리(볼턴, LG셀)
UPDATE parts SET name_en = 'Front rim with axle for X200/X200S/NewX100 (bafang)' WHERE id = 630; -- 프론트 림 X200/X200S/New X100 (바팡)
UPDATE parts SET name_en = 'Front brake set for X100/X100S' WHERE id = 636; -- 프론트 브레이크 세트 X100/X100S
UPDATE parts SET name_en = 'Multi box' WHERE id = 598; -- 멀티박스
UPDATE parts SET name_en = 'DC to 3pin gender cable' WHERE id = 608; -- DC to 3핀 변환젠더 케이블
UPDATE parts SET name_en = 'Brake sensor for XOD' WHERE id = 596; -- 브레이크 센서 XOD
UPDATE parts SET name_en = 'Front rim with axle for X200T' WHERE id = 631; -- 프론트 림 X200T
UPDATE parts SET name_en = 'Extention cable for rear light' WHERE id = 623; -- 리어라이트 연장 케이블
UPDATE parts SET name_en = 'Rear light alarm system' WHERE id = 625; -- 리어 스마트 알람 시스템
UPDATE parts SET name_en = '3pin to 2pin gender cable' WHERE id = 600; -- 디펜더 라이트 젠더 3핀 to 2핀
UPDATE parts SET name_en = 'Frame black for X200 with Pivot set' WHERE id = 629; -- 프레임 블랙 X200
UPDATE parts SET name_en = 'Long seat brown for X200' WHERE id = 662; -- 뉴 롱시트 브라운
UPDATE parts SET name_en = '48V Battery KTX tray(2pin) for X100/X100S' WHERE id = 618; -- 48V KTX 배터리 트레이 for X100/X100S (2핀)
UPDATE parts SET name_en = 'Tyre Innova 20x4.0 1pcs' WHERE id = 647; -- 이노바 타이어 20x4.0 1개
UPDATE parts SET name_en = 'Rear brake set for X100/X100S' WHERE id = 638; -- 리어 브레이크 세트 X100/X100S
UPDATE parts SET name_en = 'Bike - X200 Max Beige' WHERE id = 1032; -- X200 MAX 베이지
UPDATE parts SET name_en = 'Inner tube for 20"x4.0-1/4 1pcs' WHERE id = 651; -- 이너튜브 켄다 20"x4.0-1/4 1개
UPDATE parts SET name_en = 'Controller for Turbo S(1500W)' WHERE id = 577; -- 컨트롤러 - Turbo Pro
UPDATE parts SET name_en = '60V 2A charger 3 pin' WHERE id = 602; -- 60V 2A 일반충전기 3핀
UPDATE parts SET name_en = 'Mudguard set for X100/X100S
(front & rear)' WHERE id = 646; -- 머드가드 세트 X100/X100S
UPDATE parts SET name_en = 'USS seat suspention' WHERE id = 1033; -- USS 시트 서스펜션
UPDATE parts SET name_en = 'Rear motor for X100S (1000W)' WHERE id = 607; -- 리어 모터 X100S (1000W)
UPDATE parts SET name_en = 'Controller for X200 Max (X200 프로 대비 5cm 김)' WHERE id = 1244; -- 컨트롤러 X200맥스(뉴라인)
UPDATE parts SET name_en = 'Gears for X200/NewX100 (bafang, 500W)' WHERE id = 536; -- 유성기어 X200/New X100(바팡, 500W)
UPDATE parts SET name_en = '48V 30Ah battery pack' WHERE id = 827; -- 48V 30Ah 보조배터리
UPDATE parts SET name_en = 'Jumbo case yellow' WHERE id = 815; -- 점보 케이스-옐로우
UPDATE parts SET name_en = 'Main cable electric harness for X200 Pro/X100 Pro/Turbo Pro' WHERE id = 551; -- 메인 케이블 세트 터보프로-사용X
UPDATE parts SET name_en = '48V 20Ah KTX Battery' WHERE id = 818; -- 48V 20Ah KTX 배터리(볼턴, LG셀)
UPDATE parts SET name_en = 'Bike - X200 Max grey' WHERE id = 527; -- X200 MAX 어반 그레이
UPDATE parts SET name_en = '48V 35Ah jumbo battery matte black' WHERE id = 830; -- 48V 35Ah 점보 배터리-무광블랙
UPDATE parts SET name_en = 'Folding foot peg fo NewX100/X100/X100S' WHERE id = 803; -- 접이식 풋페그 세트(2인승차 발판) New X100/X100/X100S
UPDATE parts SET name_en = 'Gears for X100 (350W)' WHERE id = 539; -- 유성기어 X100 (350W)
UPDATE parts SET name_en = 'Brake sensor XRB for New X100/X200/X200S/X200T' WHERE id = 624; -- 브레이크 센서 XRB New X100/X200/X200S/X200T
UPDATE parts SET name_en = '48V 15Ah KTX Battery' WHERE id = 817; -- 48V LG KTX 배터리팩 15Ah
UPDATE parts SET name_en = '60Ah 30Ah battery pack' WHERE id = 828; -- 60V 30Ah 보조배터리
UPDATE parts SET name_en = 'Tyre for 20"x4.0 (kenda) 1pcs' WHERE id = 648; -- 켄다 타이어 20x4.0 1개
UPDATE parts SET name_en = 'Bike - X200 Pro black' WHERE id = 517; -- X200 Pro 블랙
UPDATE parts SET name_en = 'Controller Adaptor for X200 Pro/X100 Pro/X50
Controller(Plug-in type) - Motor(Thread type)' WHERE id = 1242; -- 컨트 케이블 아답터 X200프로/X100/X50 (구형 컨트 선->신형 컨트 선로 변환)
UPDATE parts SET name_en = '48V 20Ah battery pack' WHERE id = 825; -- 48V 20Ah 보조배터리
UPDATE parts SET name_en = 'Pedal set' WHERE id = 658; -- 페달 세트
UPDATE parts SET name_en = 'Jumbo case white' WHERE id = 816; -- 점보 케이스-화이트
UPDATE parts SET name_en = '48V 35Ah jumbo battery chrome' WHERE id = 831; -- 48V 35Ah 점보 배터리-크롬
UPDATE parts SET name_en = 'BB 170mm set' WHERE id = 657; -- 사각 BB 170mm 세트
UPDATE parts SET name_en = 'Front fork for X200/X200S/X200T/New X100
(mojo)' WHERE id = 633; -- 프론트 포크 X200/X200S/X200T/New X100
UPDATE parts SET name_en = '60V 25Ah jumbo Battery glossy black' WHERE id = 820; -- 60V 25Ah 점보 배터리-유광블랙
UPDATE parts SET name_en = 'Chain for X100/X100S' WHERE id = 709; -- 체인 - X100/X100S
UPDATE parts SET name_en = 'Bike - X200 Max metal grey' WHERE id = 1234; -- X200 Max - 메탈그레이
UPDATE parts SET name_en = '48V 25Ah battery pack' WHERE id = 826; -- 48V 25Ah 보조배터리
UPDATE parts SET name_en = 'Brake Olive and Connecting Insert Set(KTET)' WHERE id = 1246; -- KTET 오토바이 브레이크 올리브, 인서트 세트
UPDATE parts SET name_en = '48V 10Ah battery pack' WHERE id = 823; -- 48V 10Ah 보조배터리
UPDATE parts SET name_en = '48V 50Ah battery pack for mini' WHERE id = 829; -- 48V 50Ah 보조배터리
UPDATE parts SET name_en = 'Rear rack Blue' WHERE id = 764; -- 컬러 리어렉 블루
UPDATE parts SET name_en = 'Short seat brown for X200 Pro/Turbo Pro/X200/X200S/X200T' WHERE id = 797; -- 숏시트 브라운 X200
UPDATE parts SET name_en = 'Front Axel for X200/X200S/New X100(bafang)' WHERE id = 794; -- 프론트 엑슬 X200/X200S/New X100
UPDATE parts SET name_en = 'Rear brake set(KTET)  라인 5cm 길게 (X100S에 짧음)
(TYPE 4) for X200 Pro (KKE)' WHERE id = 789; -- KTET 오토바이 리어 브레이크 세트(180mm, 2,8mm)
UPDATE parts SET name_en = 'Jumbo case glossy black' WHERE id = 795; -- 점보 케이스-유광블랙
UPDATE parts SET name_en = 'Foot peg for X200' WHERE id = 802; -- 풋페그 세트(발판)-사용X
UPDATE parts SET name_en = 'Bag S' WHERE id = 805; -- 수납가방 S
UPDATE parts SET name_en = 'Bike support(kick stand) Pink' WHERE id = 777; -- 컬러 킥스탠드 핑크
UPDATE parts SET name_en = 'Frame Black for X100 Max' WHERE id = 780; -- 프레임 블랙 - X100 MAX
UPDATE parts SET name_en = 'Bike support(kick stand) Yellow' WHERE id = 776; -- 컬러 킥스탠드 옐로우
UPDATE parts SET name_en = 'Headset spacer set(3 pcs)' WHERE id = 654; -- 핸들 링(헤드셋 스페이서) 3개 세트
UPDATE parts SET name_en = 'Sunflower nut(KKE)' WHERE id = 731; -- 해바라기 너트(KKE)
UPDATE parts SET name_en = 'Front Folding foot peg(New) for X200Max/X100Max/X200Pro' WHERE id = 721; -- 접이식 풋페그(유아발판) 미들, KKE
UPDATE parts SET name_en = 'Brake caliper adaptor set (TYPE 2)
for X200Max/X100Max/X100/X100S(mojo crown)' WHERE id = 1210; -- KTET 오토바이 캘리퍼 아답터 세트(TYPE 2) for X100/X100S(모조 크라운)
UPDATE parts SET name_en = 'Front brake set (KTET)
(TYPE 4) for X200 Pro (KKE)' WHERE id = 790; -- KTET 오토바이 프론트 브레이크 세트(180mm, 2.8mm)
UPDATE parts SET name_en = 'Ktet Front Brake Lever' WHERE id = 1113; -- KTET 프론트 브레이크 래버 
UPDATE parts SET name_en = 'Wind Sheild Red' WHERE id = 756; -- 컬러 윈드실드 레드
UPDATE parts SET name_en = 'Motor set for X200S (bafang, 1000W)' WHERE id = 553; -- 모터 세트 X200S (바팡, 1000W)
UPDATE parts SET name_en = '60V 2A charger DC' WHERE id = 579; -- 60V 2A 일반충전기 DC
UPDATE parts SET name_en = 'Phone holder' WHERE id = 809; -- 360도 원터치 핸드폰 거치대
UPDATE parts SET name_en = 'Tektro front brake set for X200Pro/X100Pro' WHERE id = 603; -- 프론트 브레이크 세트 텍트로
UPDATE parts SET name_en = 'XT 90 to XT60 gender set' WHERE id = 622; -- XT90 to XT60 젠더 세트(암수 다름)
UPDATE parts SET name_en = 'Wind Sheild Blue' WHERE id = 759; -- 컬러 윈드실드 블루
UPDATE parts SET name_en = 'Defender light' WHERE id = 599; -- 디펜더 라이트
UPDATE parts SET name_en = 'Front axel for X100 Max' WHERE id = 1218; -- 프론트 엑슬 - X100맥스(Cowboy)
UPDATE parts SET name_en = 'Folding foot peg set fo mini' WHERE id = 810; -- 접이식 풋페그(발판) 세트 - 미니
UPDATE parts SET name_en = '48V Mini jumbo Battery tray
(No line, only tray)' WHERE id = 1019; -- 미니 점보 배터리 거치대(트레이, 선없음)
UPDATE parts SET name_en = 'Front fork for X100/X100S' WHERE id = 634; -- 프론트 포크 X100/X100S
UPDATE parts SET name_en = 'Bike - Turbo Pro black' WHERE id = 518; -- Turbo Pro 블랙
UPDATE parts SET name_en = 'Front rim for X100/X100S' WHERE id = 632; -- 프론트 림 X100/X100S
UPDATE parts SET name_en = 'Side rack set for X200' WHERE id = 799; -- 사이드렉 세트 X200
UPDATE parts SET name_en = 'Tall seat for X200' WHERE id = 700; -- 톨시트 블랙 X200
UPDATE parts SET name_en = 'Jumbo case red' WHERE id = 814; -- 점보 케이스-레드
UPDATE parts SET name_en = 'Rear suspention set for X200/X200S/X200T' WHERE id = 639; -- 리어 서스펜션 2개 세트 X200/X200S/X200T(구)
UPDATE parts SET name_en = 'Wind sheild' WHERE id = 808; -- 윈드실드 블랙(구)
UPDATE parts SET name_en = 'Bike - X100 Pro black' WHERE id = 516; -- X100 Pro 블랙
UPDATE parts SET name_en = 'Long seat black for X200' WHERE id = 701; -- 뉴 롱시트 블랙 X200
UPDATE parts SET name_en = '60V 25Ah jumbo Battery matte black' WHERE id = 835; -- 60V 25Ah 점보 배터리-무광블랙
UPDATE parts SET name_en = 'H shape handle chrome' WHERE id = 716; --  H핸들 크롬
UPDATE parts SET name_en = '48V 35Ah jumbo battery glossy black' WHERE id = 819; -- 48V 35Ah 점보 배터리-유광블랙
UPDATE parts SET name_en = 'Rear rack for X100/X100S' WHERE id = 801; -- 리어렉(짐받이) X100/X100S
UPDATE parts SET name_en = '48V 35Ah jumbo Battery red' WHERE id = 832; -- 48V 35Ah 점보 배터리-레드
UPDATE parts SET name_en = 'Controller for X200 (500W)' WHERE id = 545; -- 컨트롤러 X200 500W
UPDATE parts SET name_en = 'Short seat black for X200 Pro/Turbo Pro/X200/X200S/X200T' WHERE id = 796; -- 숏시트 블랙 X200
UPDATE parts SET name_en = 'Brake caliper adaptor set (TYPE 3)
for X200/X200S/X200T/New X100(mojo upsidedown)' WHERE id = 1213; -- KTET 오토바이 캘리퍼 아답터 세트(TYPE 3) for X200/X200S/X200T/New X100(모조 도립식)
UPDATE parts SET name_en = 'Pas sensor for X100/X100S' WHERE id = 564; -- PAS 센서 X100/X100S
UPDATE parts SET name_en = 'Front light holder for New X100/X200' WHERE id = 559; -- 헤드라이트 홀더 - New X100/X200
UPDATE parts SET name_en = 'Controller for X100S (1000W)' WHERE id = 549; -- 컨트롤러 X100S (1000W)
UPDATE parts SET name_en = 'Motor set for X200T' WHERE id = 554; -- 모터 세트 X200T
UPDATE parts SET name_en = 'Mud guard set for X200/X200S/X200T' WHERE id = 645; -- 머드가드 세트 X200/X200S/X200T
UPDATE parts SET name_en = 'Motor set for X100S (1000W)' WHERE id = 556; -- 모터 세트 X100S (1000W)
UPDATE parts SET name_en = 'Gears for X100S (1000W)' WHERE id = 538; -- 유성기어 X100S (1000W)
UPDATE parts SET name_en = 'Rear brake set XRB for New X100/X200/X200S/X200T' WHERE id = 637; -- 리어 브레이크 세트 New X100/X200
UPDATE parts SET name_en = 'Ktet Rear Brake Lever' WHERE id = 1114; -- KTET 리어 브레이크 래버
UPDATE parts SET name_en = 'Battery Dust & Rain cover for  Mini Jumbo & Hailong20ah' WHERE id = 1193; -- 점보 배터리 방수 커버(48V 35Ah, 60V 25Ah)
UPDATE parts SET name_en = 'Upgrade kit (X200 Pro system)' WHERE id = 1025; -- 업그레이드 키트(X100/X100S->X200 Pro)
UPDATE parts SET name_en = 'Disk rotor(180E, 3mm) (KTET) 로터 세트' WHERE id = 791; -- KTET 디스크 로터(180mm, 2.8mm)
UPDATE parts SET name_en = '48V 15Ah battery pack' WHERE id = 824; -- 48V 15Ah 보조배터리
UPDATE parts SET name_en = '48V 35Ah jumbo Battery yellow' WHERE id = 833; -- 48V 35Ah 점보 배터리-옐로우
UPDATE parts SET name_en = 'Bike - X50 Black' WHERE id = 522; -- X50 블랙
UPDATE parts SET name_en = 'Motor set for X200/New X100 (bafang, 500W)' WHERE id = 552; -- 모터 세트 X200/New X100(바팡, 500W)
UPDATE parts SET name_en = 'Left switch for X200/X200S/X200T/NewX100' WHERE id = 563; -- 기능 스위치 - X200/X200S/X200T/New X100
UPDATE parts SET name_en = 'Front brake set XRB for New X100/X200/X200S/X200T' WHERE id = 635; -- 프론트 브레이크 세트 New X100/X200
UPDATE parts SET name_en = 'Main cable electric harness for X200/X200S/X200T/New X100' WHERE id = 588; -- 메인 케이블 세트 X200/X200S/X200T/New X100
UPDATE parts SET name_en = 'Front Motor Gears for mini' WHERE id = 1117; -- 유성기어-미니 프론트
UPDATE parts SET name_en = 'Rear light for X200/NewX100/mini (48V)' WHERE id = 560; -- 리어라이트 - X200/X200S/New X100/미니(48V,방향)
UPDATE parts SET name_en = 'Pas sensor for X100 Pro' WHERE id = 619; -- PAS 센서 X100맥스/X100프로/NX100
UPDATE parts SET name_en = 'Seat black for mini' WHERE id = 675; -- 스프링 시트-블랙 미니
UPDATE parts SET name_en = '48V Battery KTX tray(XT60) for X50' WHERE id = 620; -- 48V KTX 배터리 트레이 X50 (XT60,방수)
UPDATE parts SET name_en = 'Frame mirror chrome for X200 with Pivot set' WHERE id = 1237; -- 프레임 미러크롬 - X200프로/터보 프로/X200/X200고급형(S)/X200T
UPDATE parts SET name_en = 'Jumbo battery (35ah)' WHERE id = 1194; -- 미니 점보 배터리&KTX 배터리 방수커버(48V 20Ah)
UPDATE parts SET name_en = 'Chain for X50' WHERE id = 1215; -- 체인 - X50
UPDATE parts SET name_en = 'Frame black for X100Pro/New X100' WHERE id = 628; -- 프레임 블랙 X100프로/New X100
UPDATE parts SET name_en = 'Frame metal grey for X200 with Pivot set' WHERE id = 1238; -- 프레임 메탈그레이 - X200프로/터보 프로/X200/X200고급형(S)/X200T
UPDATE parts SET name_en = 'Storage Bag for X200 Max' WHERE id = 1029; -- 수납가방 - X200 MAX
UPDATE parts SET name_en = 'Front light / option 3 / 7"' WHERE id = 581; -- 불렛 헤드라이트 - X200 Pro/Turbo Pro/X100 Pro
UPDATE parts SET name_en = 'Front fork for mini' WHERE id = 669; -- 프론트 포크 - 미니
UPDATE parts SET name_en = '48V Mini jumbo Battery tray for X100 Max
(XT60 cable-150cm)' WHERE id = 1020; -- 48V 미니점보 배터리 거치대(트레이, X100맥스)
UPDATE parts SET name_en = 'Brake caliper adaptor set (TYPE 6)
for X200 Pro/Turbo Pro/X50 (KKE)' WHERE id = 1212; -- KTET 오토바이 캘리퍼 아답터 세트(TYPE 6) for X200프로/터보프로/X50 (KKE) - type 4와 같음
UPDATE parts SET name_en = 'Brake caliper adaptor set (TYPE 5)
for X200Max/X100Max' WHERE id = 1211; -- 	KTET 오토바이 캘리퍼 아답터 세트(TYPE 5) for X200맥스/X100맥스 - type 2와 같음
UPDATE parts SET name_en = 'Rear air suspention set for X200 Pro/Turbo Pro' WHERE id = 694; -- 리어 듀얼 에어 서스펜션 X200프로/터보프로(구)
UPDATE parts SET name_en = 'Seat post chrome for X50' WHERE id = 711; -- 시트포스트 X50 크롬
UPDATE parts SET name_en = 'Chain for X100 Max' WHERE id = 781; -- 체인 - X100 MAX
UPDATE parts SET name_en = 'Motor set for X200 Pro/X100 Pro (24" New line)' WHERE id = 614; -- 모터 세트 X200프로/X100프로(뉴라인)
UPDATE parts SET name_en = 'Seat brown for mini' WHERE id = 676; -- 스프링 시트-브라운 미니
UPDATE parts SET name_en = 'XOD Disc rotor 180E 2.3mm for X200 Pro/X100 Pro/X200/X200S' WHERE id = 704; -- XOD 디스크 로터 180E 2.3mm X200프로/X10프로X200/X200S
UPDATE parts SET name_en = 'Front brake set XOD for mini' WHERE id = 673; -- 프론트 브레이크 세트 XOD - 미니
UPDATE parts SET name_en = '48V Battery KTX tray(XT60) long ver for X100Pro' WHERE id = 617; -- 48V KTX 배터리 트레이 X100프로 (XT60, 롱)
UPDATE parts SET name_en = 'Pas sensor for X200/NewX100' WHERE id = 615; -- PAS 센서 X200맥스/X200프로/터보프로/X200/X200S/X200T
UPDATE parts SET name_en = 'Tekkto brake pad set for X200Pro/X100Pro/X50 (2pcs)' WHERE id = 642; -- 텍트로 브레이크 패드 세트 X200Pro/X100/Pro/X50
UPDATE parts SET name_en = 'Fastace brake pad set for TurboPro (2pcs)' WHERE id = 685; -- Faceace 브레이크 패드 세트 터보프로 (2개)
UPDATE parts SET name_en = 'Rear Motor Gears for mini' WHERE id = 1118; -- 유성기어-미니 리어
UPDATE parts SET name_en = 'Mudguard set for X100 Pro/NewX100
(front & rear)' WHERE id = 644; -- 머드가드 세트 X100프로/New X100
UPDATE parts SET name_en = 'XOD Brake pad set X200 Pro/X100 ProX200/X00S/X100/X100S (2pcs)' WHERE id = 1024; -- XOD 브레이크 패드 세트 X200프로/X100프로/X200/X200고급/X100/미니(2개)
UPDATE parts SET name_en = 'Mudguard set (front & middle & rear) Blue' WHERE id = 773; -- 컬러 머드가드 세트 블루 - X200 MAX
UPDATE parts SET name_en = 'Controller for mini' WHERE id = 574; -- 컨트롤러 - 미니
UPDATE parts SET name_en = 'Reflector set for mini' WHERE id = 678; -- 반사경 세트 - 미니
UPDATE parts SET name_en = 'Rear rack for X50' WHERE id = 706; -- 리어렉 - X50
UPDATE parts SET name_en = 'Seat post battery for mini' WHERE id = 572; -- 시트포스트 배터리 - 미니
UPDATE parts SET name_en = 'Rear motor for mini' WHERE id = 570; -- 리어 모터 - 미니
UPDATE parts SET name_en = 'Front motor for mini' WHERE id = 571; -- 프론트 모터 - 미니
UPDATE parts SET name_en = 'Front light for mini' WHERE id = 568; -- 헤드라이트 - 미니
UPDATE parts SET name_en = 'Mudguard set for mini
(front & rear)' WHERE id = 677; -- 머드가드 세트 - 미니
UPDATE parts SET name_en = 'Seat clamp for mini' WHERE id = 722; -- 시트포스트 클램프 - 미니
UPDATE parts SET name_en = 'Controller case for mini' WHERE id = 680; -- 컨트롤러 케이스 - 미니
UPDATE parts SET name_en = 'Handle for mini' WHERE id = 671; -- 핸들바 - 미니
UPDATE parts SET name_en = 'Stem for mini' WHERE id = 672; -- 스템 - 미니
UPDATE parts SET name_en = 'Foot peg set for mini' WHERE id = 667; -- 풋페그(발판) 세트 - 미니
UPDATE parts SET name_en = 'Battery cable for mini' WHERE id = 589; -- 배터리 케이블 케이블 - 미니
UPDATE parts SET name_en = 'Rear disc brake set XOD for mini' WHERE id = 674; -- 리어 브레이크 세트 XOD - 미니
UPDATE parts SET name_en = 'Bag for mini' WHERE id = 679; -- 수납가방 - 미니
UPDATE parts SET name_en = 'Rear rack for mini' WHERE id = 666; -- 리어렉(짐받이) - 미니
UPDATE parts SET name_en = 'Battery gender cable for mini' WHERE id = 575; -- 배터리 젠더 케이블 - 미니
UPDATE parts SET name_en = 'Rear suspention set for mini' WHERE id = 668; -- 리어 서스펜션 - 미니
UPDATE parts SET name_en = 'Side support(kick stand) for mini' WHERE id = 670; -- 킥스탠드 - 미니
UPDATE parts SET name_en = 'Main cable electric harness for mini' WHERE id = 573; -- 메인 케이블 세트 - 미니
UPDATE parts SET name_en = 'Basket for mini' WHERE id = 811; -- 다용도 바스켓 - 미니
UPDATE parts SET name_en = 'Fork guard sticker Red for X200 Max' WHERE id = 751; -- 컬러 포크가드 스티커 레드 - X200 MAX
UPDATE parts SET name_en = 'Side rack set Red X200 Max' WHERE id = 765; -- 컬러 사이드렉 세트 레드 - X200 MAX/X100 MAX/X200 Pro
UPDATE parts SET name_en = 'Fork guard sticker Pink for X100 Max' WHERE id = 786; -- 컬러 포크가드 스티커 핑크 - X100 MAX

COMMIT;