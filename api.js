import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { getPriceByAPI } from './index.js';

const app = express();
const PORT = process.env.PORT || 3000;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

// CORS 설정
app.use(cors());
app.use(express.json());

// 정적 파일 제공 (웹 인터페이스)
app.use(express.static('public'));

// 슬랙으로 메시지 전송하는 헬퍼 함수
async function sendToSlack(symbol, spotData, futuresData) {
  if (!SLACK_WEBHOOK_URL) {
    return;
  }

  try {
    const slackMessage = formatSlackMessage(symbol, spotData, futuresData);
    await axios.post(SLACK_WEBHOOK_URL, slackMessage);
    console.log(`✅ 슬랙으로 ${symbol} 시세 전송 완료`);
  } catch (error) {
    console.error('슬랙 웹훅 전송 오류:', error.message);
  }
}

// API 엔드포인트: 현물 시세 조회
app.get('/api/price/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const spotData = await getPriceByAPI(symbol, 'spot');
    
    if (!spotData) {
      return res.status(404).json({ 
        error: '가격 정보를 찾을 수 없습니다.',
        symbol: `${symbol}USDT`
      });
    }
    
    // 응답 전송
    res.json({
      success: true,
      data: spotData
    });

    // 슬랙으로도 전송 (비동기, 응답에 영향 없음)
    sendToSlack(symbol, spotData, null).catch(err => {
      console.error('슬랙 전송 실패:', err.message);
    });
  } catch (error) {
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다.',
      message: error.message 
    });
  }
});

// API 엔드포인트: 선물 시세 조회
app.get('/api/futures/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const futuresData = await getPriceByAPI(symbol, 'linear');
    
    if (!futuresData) {
      return res.status(404).json({ 
        error: '가격 정보를 찾을 수 없습니다.',
        symbol: `${symbol}USDT`
      });
    }
    
    // 응답 전송
    res.json({
      success: true,
      data: futuresData
    });

    // 슬랙으로도 전송 (비동기, 응답에 영향 없음)
    sendToSlack(symbol, null, futuresData).catch(err => {
      console.error('슬랙 전송 실패:', err.message);
    });
  } catch (error) {
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다.',
      message: error.message 
    });
  }
});

// API 엔드포인트: 현물 + 선물 모두 조회
app.get('/api/all/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const [spotData, futuresData] = await Promise.all([
      getPriceByAPI(symbol, 'spot'),
      getPriceByAPI(symbol, 'linear')
    ]);
    
    // 응답 전송
    res.json({
      success: true,
      data: {
        spot: spotData,
        futures: futuresData
      }
    });

    // 슬랙으로도 전송 (비동기, 응답에 영향 없음)
    sendToSlack(symbol, spotData, futuresData).catch(err => {
      console.error('슬랙 전송 실패:', err.message);
    });
  } catch (error) {
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다.',
      message: error.message 
    });
  }
});

// 슬랙 웹훅: 아웃고잉 웹훅으로 심볼 받아서 시세 조회 후 슬랙으로 전송
app.post('/webhook/slack', async (req, res) => {
  try {
    // 슬랙 아웃고잉 웹훅에서 심볼 추출
    let symbol = null;
    
    // 슬랙 메시지 형식에 따라 심볼 추출
    if (req.body.text) {
      // text 필드에서 심볼 추출 (예: "BTC" 또는 "BTC 시세 조회")
      const text = req.body.text.trim().toUpperCase();
      // 알파벳만 추출 (심볼은 보통 알파벳만)
      symbol = text.match(/[A-Z]{2,10}/)?.[0];
    } else if (req.body.event && req.body.event.text) {
      // Event API 형식
      const text = req.body.event.text.trim().toUpperCase();
      symbol = text.match(/[A-Z]{2,10}/)?.[0];
    } else if (req.body.symbol) {
      // 직접 symbol 필드가 있는 경우
      symbol = req.body.symbol.toUpperCase();
    }

    if (!symbol) {
      return res.status(400).json({
        error: '심볼을 찾을 수 없습니다. 메시지에 심볼을 포함해주세요. (예: BTC, ETH)'
      });
    }

    // 즉시 응답 (슬랙 타임아웃 방지)
    res.status(200).json({ 
      text: `🔍 ${symbol}USDT 시세 조회 중...`,
      response_type: 'in_channel'
    });

    // Bybit API로 시세 조회
    const [spotData, futuresData] = await Promise.all([
      getPriceByAPI(symbol, 'spot'),
      getPriceByAPI(symbol, 'linear')
    ]);

    // 슬랙으로 전송
    await sendToSlack(symbol, spotData, futuresData);

  } catch (error) {
    console.error('웹훅 처리 오류:', error.message);
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다.',
      message: error.message 
    });
  }
});

// 슬랙 메시지 포맷 생성 함수
function formatSlackMessage(symbol, spotData, futuresData) {
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `📊 ${symbol}USDT 시세 정보`,
        emoji: true
      }
    },
    {
      type: 'divider'
    }
  ];

  // 현물 거래소 정보
  if (spotData) {
    const changePercent = (parseFloat(spotData.change24h) * 100).toFixed(2);
    const changeEmoji = parseFloat(changePercent) >= 0 ? '🟢' : '🔴';
    const changeSign = parseFloat(changePercent) >= 0 ? '+' : '';

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*📊 현물 거래소*\n` +
              `현재가: *$${parseFloat(spotData.lastPrice).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}*\n` +
              `24시간 고가: $${parseFloat(spotData.high24h).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}\n` +
              `24시간 저가: $${parseFloat(spotData.low24h).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}\n` +
              `24시간 거래량: ${parseFloat(spotData.volume24h).toLocaleString('ko-KR')}\n` +
              `24시간 변동률: ${changeEmoji} *${changeSign}${changePercent}%*`
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '거래 페이지',
          emoji: true
        },
        url: `https://www.bybit.com/trade/usdt/${spotData.symbol}`,
        action_id: 'button-action'
      }
    });
  } else {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*📊 현물 거래소*\n❌ 가격 정보를 가져올 수 없습니다.`
      }
    });
  }

  blocks.push({ type: 'divider' });

  // 선물 거래소 정보
  if (futuresData) {
    const changePercent = (parseFloat(futuresData.change24h) * 100).toFixed(2);
    const changeEmoji = parseFloat(changePercent) >= 0 ? '🟢' : '🔴';
    const changeSign = parseFloat(changePercent) >= 0 ? '+' : '';

    let futuresText = `*📈 선물 거래소*\n` +
                      `현재가: *$${parseFloat(futuresData.lastPrice).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}*\n` +
                      `24시간 고가: $${parseFloat(futuresData.high24h).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}\n` +
                      `24시간 저가: $${parseFloat(futuresData.low24h).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}\n` +
                      `24시간 거래량: ${parseFloat(futuresData.volume24h).toLocaleString('ko-KR')}\n` +
                      `24시간 변동률: ${changeEmoji} *${changeSign}${changePercent}%*`;

    if (futuresData.fundingRate !== undefined) {
      const fundingRate = (parseFloat(futuresData.fundingRate) * 100).toFixed(4);
      futuresText += `\n펀딩 수수료율: ${fundingRate}%`;
    }

    if (futuresData.openInterest) {
      futuresText += `\n미결제약정: ${parseFloat(futuresData.openInterest).toLocaleString('ko-KR')}`;
    }

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: futuresText
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '거래 페이지',
          emoji: true
        },
        url: `https://www.bybit.com/futures/${futuresData.symbol}`,
        action_id: 'button-action-2'
      }
    });
  } else {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*📈 선물 거래소*\n❌ 가격 정보를 가져올 수 없습니다.`
      }
    });
  }

  return {
    blocks: blocks,
    text: `${symbol}USDT 시세 정보`
  };
}

// 헬스 체크
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`📡 API 엔드포인트:`);
  console.log(`   - 현물: http://localhost:${PORT}/api/price/:symbol`);
  console.log(`   - 선물: http://localhost:${PORT}/api/futures/:symbol`);
  console.log(`   - 전체: http://localhost:${PORT}/api/all/:symbol`);
  console.log(`   - 슬랙 웹훅: http://localhost:${PORT}/webhook/slack`);
  console.log(`🌐 웹 인터페이스: http://localhost:${PORT}`);
  if (SLACK_WEBHOOK_URL) {
    console.log(`✅ 슬랙 웹훅 URL이 설정되었습니다.`);
  } else {
    console.log(`⚠️  SLACK_WEBHOOK_URL 환경 변수를 설정해주세요.`);
  }
});

