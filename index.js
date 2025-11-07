import axios from 'axios';
import * as readline from 'readline';

// Bybit API를 사용하여 가격 조회
export async function getPriceByAPI(symbol, category = 'spot') {
  try {
    const response = await axios.get('https://api.bybit.com/v5/market/tickers', {
      params: {
        category: category,
        symbol: `${symbol}USDT`
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.bybit.com/',
        'Origin': 'https://www.bybit.com'
      }
    });
    
    if (response.data && response.data.result && response.data.result.list && response.data.result.list.length > 0) {
      const ticker = response.data.result.list[0];
      return {
        category: category,
        symbol: ticker.symbol,
        lastPrice: ticker.lastPrice,
        high24h: ticker.highPrice24h,
        low24h: ticker.lowPrice24h,
        volume24h: ticker.volume24h,
        change24h: ticker.price24hPcnt,
        // 선물 거래소의 경우 추가 정보
        fundingRate: ticker.fundingRate,
        openInterest: ticker.openInterest
      };
    }
    return null;
  } catch (error) {
    if (error.response) {
      // 서버가 응답했지만 에러 상태 코드
      console.error(`API 조회 중 오류 (${category}):`, error.response.status, error.response.statusText);
      console.error('응답 데이터:', error.response.data);
    } else if (error.request) {
      // 요청은 보냈지만 응답이 없음
      console.error(`API 조회 중 오류 (${category}): 요청은 보냈지만 응답이 없습니다.`);
    } else {
      // 요청 설정 중 오류
      console.error(`API 조회 중 오류 (${category}):`, error.message);
    }
    return null;
  }
}

// 가격 정보 출력
function displayPrice(priceData, categoryName) {
  if (!priceData) {
    console.log(`❌ ${categoryName} 가격 정보를 가져올 수 없습니다.`);
    return;
  }
  
  const categoryLabel = categoryName === '현물' ? '📊 현물 거래소' : '📈 선물 거래소';
  console.log(`\n${categoryLabel} 시세 정보`);
  console.log('━'.repeat(50));
  console.log(`심볼: ${priceData.symbol}`);
  console.log(`현재가: $${parseFloat(priceData.lastPrice).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`);
  console.log(`24시간 고가: $${parseFloat(priceData.high24h).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`);
  console.log(`24시간 저가: $${parseFloat(priceData.low24h).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`);
  console.log(`24시간 거래량: ${parseFloat(priceData.volume24h).toLocaleString('ko-KR')}`);
  
  const changePercent = (parseFloat(priceData.change24h) * 100).toFixed(2);
  const changeColor = parseFloat(changePercent) >= 0 ? '🟢' : '🔴';
  console.log(`24시간 변동률: ${changeColor} ${changePercent}%`);
  
  // 선물 거래소의 경우 추가 정보 표시
  if (priceData.category === 'linear' && priceData.fundingRate !== undefined) {
    const fundingRate = (parseFloat(priceData.fundingRate) * 100).toFixed(4);
    console.log(`펀딩 수수료율: ${fundingRate}%`);
    if (priceData.openInterest) {
      console.log(`미결제약정: ${parseFloat(priceData.openInterest).toLocaleString('ko-KR')}`);
    }
  }
  
  console.log('━'.repeat(50));
  const urlType = priceData.category === 'linear' ? 'futures' : 'trade/usdt';
  console.log(`\nURL: https://www.bybit.com/${urlType}/${priceData.symbol}\n`);
}

// 메인 함수
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const askSymbol = () => {
    rl.question('조회할 심볼을 입력하세요 (예: BTC, ETH, SOL 등, 종료하려면 "exit" 또는 "quit" 입력): ', async (symbol) => {
      if (symbol.toLowerCase() === 'exit' || symbol.toLowerCase() === 'quit') {
        console.log('\n👋 프로그램을 종료합니다.');
        rl.close();
        return;
      }

      if (!symbol || symbol.trim() === '') {
        console.log('⚠️  심볼을 입력해주세요.\n');
        askSymbol();
        return;
      }

      const cleanSymbol = symbol.trim().toUpperCase();
      console.log(`\n🔍 ${cleanSymbol}USDT 조회 중...`);
      
      // 현물과 선물 거래소 모두 조회
      const [spotData, futuresData] = await Promise.all([
        getPriceByAPI(cleanSymbol, 'spot'),
        getPriceByAPI(cleanSymbol, 'linear')
      ]);
      
      displayPrice(spotData, '현물');
      displayPrice(futuresData, '선물');
      
      askSymbol();
    });
  };

  console.log('🚀 Bybit 시세 조회 봇 시작\n');
  askSymbol();
}

main().catch(console.error);

