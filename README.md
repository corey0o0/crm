# CRM App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## 📚 주요 문서

### 빠른 시작
- [빠른 시작 가이드](./QUICK_START.md) - 프로젝트 빠른 이해 및 시작 가이드

### 프로젝트 구조 및 참조
- [프로젝트 구조 문서](./PROJECT_STRUCTURE.md) - 전체 프로젝트 구조 및 폴더별 설명
- [파일 참조 가이드](./FILE_REFERENCE.md) - 주요 파일별 상세 설명 및 사용법

### 설정 및 배포
- [Netlify 환경 변수 설정 가이드](./NETLIFY_ENV_VARIABLES.md) - Netlify 배포 시 필요한 모든 환경 변수 목록
- [배포 가이드](./DEPLOYMENT_GUIDE.md) - 배포 절차 및 환경 설정
- [텔레그램 봇 토큰 업데이트 가이드](./TELEGRAM_BOT_UPDATE_GUIDE.md) - 텔레그램 봇 토큰 업데이트 방법
- [구글 클라이언트 ID 갱신 가이드](./GOOGLE_CLIENT_ID_UPDATE_GUIDE.md) - Google OAuth 클라이언트 ID 생성 및 업데이트 방법
- [구글 드라이브 재설정 가이드](./GOOGLE_DRIVE_RESET_GUIDE.md) - 구글 드라이브 연동 문제 해결 및 재설정 방법

### 기능 가이드
- [역할 및 권한 가이드](./ROLE_PERMISSION_GUIDE.md) - 권한 시스템 설명
- [Playwright 설정 가이드](./PLAYWRIGHT_SETUP.md) - 브라우저 자동화 설정

## 🔧 환경 변수 관리

**중요**: 모든 환경 변수는 `public/env.js` 파일에서 관리합니다.

- **로컬 개발**: `public/env.js` 파일 수정
- **Netlify 배포**: [NETLIFY_ENV_VARIABLES.md](./NETLIFY_ENV_VARIABLES.md) 참조

## 구글 드라이브 연동 설정

AS 디테일에서 파일 업로드 기능을 사용하려면 구글 드라이브 API 설정이 필요합니다.

### 1. Google Cloud Console 설정

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. "API 및 서비스" > "라이브러리"에서 "Google Drive API" 활성화
4. "API 및 서비스" > "사용자 인증 정보"에서 OAuth 2.0 클라이언트 ID 생성
5. 승인된 리디렉션 URI에 다음 추가 (쿼리 파라미터 없이):
   - `http://localhost:3000/google-auth-callback.html` (개발용)
   - `https://crmapp8893.netlify.app/google-auth-callback.html` (프로덕션용)
   
   ⚠️ **중요**: 쿼리 파라미터(`?service_id=*`)는 포함하지 마세요. 구글 OAuth는 redirect_uri가 정확히 일치해야 합니다.

### 2. 환경변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음을 추가:

```
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id_here
```

### 3. 사용 방법

1. AS 디테일 페이지에서 "첨부 파일" 섹션 확인
2. "파일 추가" 버튼 클릭
3. 구글 드라이브 인증 완료 (최초 1회)
4. 파일 선택하여 자동 업로드

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
