# Bybit 시세 조회 봇

Bybit 거래소의 암호화폐 시세를 조회하는 Node.js 봇입니다. 현물(Spot)과 선물(Futures) 거래소의 시세를 동시에 조회할 수 있으며, CLI와 웹 인터페이스, REST API를 모두 지원합니다.

## 주요 기능

- ✅ **현물 거래소 시세 조회** - Spot 거래소 실시간 가격
- ✅ **선물 거래소 시세 조회** - Futures 거래소 실시간 가격
- ✅ **CLI 인터페이스** - 터미널에서 대화형 조회
- ✅ **웹 인터페이스** - 브라우저에서 시세 조회
- ✅ **REST API** - 다른 애플리케이션에서 호출 가능
- ✅ **슬랙 웹훅 연동** - 슬랙에서 심볼 전송 시 시세 자동 조회 및 응답

## 설치

```bash
npm install
```

## 사용 방법

### 1. CLI 모드 (터미널 대화형)

```bash
npm start
```

또는

```bash
node index.js
```

프로그램을 실행한 후, 조회하고 싶은 심볼(예: BTC, ETH, SOL 등)을 입력하면 해당 코인의 현물과 선물 시세를 동시에 조회합니다.

### 2. 웹 서버 모드

```bash
npm run api
```

또는

```bash
node api.js
```

서버가 실행되면 브라우저에서 `http://localhost:3000`으로 접속하여 웹 인터페이스를 사용할 수 있습니다.

## 제공되는 정보

### 현물 거래소
- 현재가
- 24시간 고가/저가
- 24시간 거래량
- 24시간 변동률
- Bybit 거래 페이지 URL

### 선물 거래소
- 현재가
- 24시간 고가/저가
- 24시간 거래량
- 24시간 변동률
- **펀딩 수수료율** (Funding Rate)
- **미결제약정** (Open Interest)
- Bybit 선물 거래 페이지 URL

## API 엔드포인트

웹 서버 모드에서 사용 가능한 REST API:

### 현물 시세 조회
```
GET /api/price/:symbol
```
예: `http://localhost:3000/api/price/BTC`

### 선물 시세 조회
```
GET /api/futures/:symbol
```
예: `http://localhost:3000/api/futures/BTC`

### 현물 + 선물 모두 조회
```
GET /api/all/:symbol
```
예: `http://localhost:3000/api/all/BTC`

### 헬스 체크
```
GET /health
```

### 슬랙 웹훅 (아웃고잉 웹훅)
```
POST /webhook/slack
```

슬랙 아웃고잉 웹훅으로 심볼을 전송하면, 시세를 조회하여 슬랙으로 응답을 전송합니다.

**설정 방법:**

1. 슬랙 앱에서 Incoming Webhooks 활성화
2. Webhook URL 복사
3. 환경 변수 설정:
   ```bash
   export SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```
   또는 `.env` 파일 생성:
   ```
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```

4. 슬랙 앱에서 아웃고잉 웹훅 설정:
   - Request URL: `http://your-server:3000/webhook/slack`
   - 메시지에 심볼 포함 (예: "BTC", "ETH 시세 조회")

**사용 예시:**
- 슬랙에서 "BTC" 메시지 전송 → BTC 시세 조회 후 슬랙으로 응답
- 슬랙에서 "ETH 시세" 메시지 전송 → ETH 시세 조회 후 슬랙으로 응답

## 프로젝트 구조

```
sise/
├── index.js          # CLI 모드 (터미널 대화형)
├── api.js            # 웹 서버 (Express)
├── public/
│   └── index.html    # 웹 인터페이스
├── package.json      # 프로젝트 설정
└── README.md         # 이 파일
```

## 종료

### CLI 모드
프로그램을 종료하려면 `exit` 또는 `quit`를 입력하세요.

### 웹 서버 모드
터미널에서 `Ctrl + C`를 눌러 서버를 종료하세요.

## 기술 스택

- **Node.js** - 런타임 환경
- **Express** - 웹 서버 프레임워크
- **Axios** - HTTP 클라이언트
- **Bybit API** - 시세 데이터 소스

## 라이선스

ISC
