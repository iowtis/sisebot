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

// 가격 정보를 텍스트 형식으로 포맷팅하는 함수 (export)
export function formatPriceAsText(priceData, categoryName) {
  if (!priceData) {
    return `❌ ${categoryName} 가격 정보를 가져올 수 없습니다.`;
  }
  
  const categoryLabel = categoryName === '현물' ? '📊 현물 거래소' : '📈 선물 거래소';
  let text = `\n${categoryLabel} 시세 정보\n`;
  text += '━'.repeat(50) + '\n';
  text += `심볼: ${priceData.symbol}\n`;
  text += `현재가: $${parseFloat(priceData.lastPrice).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}\n`;
  text += `24시간 고가: $${parseFloat(priceData.high24h).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}\n`;
  text += `24시간 저가: $${parseFloat(priceData.low24h).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}\n`;
  text += `24시간 거래량: ${parseFloat(priceData.volume24h).toLocaleString('ko-KR')}\n`;
  
  const changePercent = (parseFloat(priceData.change24h) * 100).toFixed(2);
  const changeColor = parseFloat(changePercent) >= 0 ? '🟢' : '🔴';
  text += `24시간 변동률: ${changeColor} ${changePercent >= 0 ? '+' : ''}${changePercent}%\n`;
  
  // 선물 거래소의 경우 추가 정보 표시
  if (priceData.category === 'linear' && priceData.fundingRate !== undefined) {
    const fundingRate = (parseFloat(priceData.fundingRate) * 100).toFixed(4);
    text += `펀딩 수수료율: ${fundingRate}%\n`;
    if (priceData.openInterest) {
      text += `미결제약정: ${parseFloat(priceData.openInterest).toLocaleString('ko-KR')}\n`;
    }
  }
  
  text += '━'.repeat(50) + '\n';
  const urlType = priceData.category === 'linear' ? 'futures' : 'trade/usdt';
  text += `\nURL: https://www.bybit.com/${urlType}/${priceData.symbol}\n`;
  
  return text;
}

// 인사이트 분석 함수
export function analyzeInsights(spotData, futuresData, avgPrice = null, leverage = null, targetPrice = null) {
  const insights = {
    pricePosition: null,
    marketSentiment: null,
    volatility: null,
    riskLevel: null,
    targetReachability: null,
    volumeAnalysis: null,
    priceTrend: null,
    tradingRecommendation: null,
    stopLossRecommendation: null
  };

  // 가격 위치 분석 (현재가가 24시간 범위에서 어느 위치에 있는지)
  if (spotData) {
    const currentPrice = parseFloat(spotData.lastPrice);
    const high24h = parseFloat(spotData.high24h);
    const low24h = parseFloat(spotData.low24h);
    const priceRange = high24h - low24h;
    
    if (priceRange > 0) {
      const positionFromLow = ((currentPrice - low24h) / priceRange) * 100;
      let simpleDesc = '';
      let advice = '';
      
      if (positionFromLow >= 70) {
        simpleDesc = '지금 가격이 하루 중 거의 최고가 근처예요';
        advice = '⚠️ 조심: 지금 사면 비쌀 수 있어요. 조금 더 내려올 때를 기다려보세요.';
      } else if (positionFromLow <= 30) {
        simpleDesc = '지금 가격이 하루 중 거의 최저가 근처예요';
        advice = '💡 기회: 지금이 사기 좋은 타이밍일 수 있어요!';
      } else {
        simpleDesc = '지금 가격이 하루 중 중간 정도예요';
        advice = '📊 보통: 적당한 가격대예요. 추가 정보를 확인해보세요.';
      }
      
      insights.pricePosition = {
        percentage: positionFromLow.toFixed(1),
        level: positionFromLow >= 70 ? 'high' : positionFromLow <= 30 ? 'low' : 'mid',
        description: simpleDesc,
        advice: advice
      };
    }
  }

  // 시장 심리 분석 (펀딩 수수료율 기반)
  if (futuresData && futuresData.fundingRate !== undefined) {
    const fundingRate = parseFloat(futuresData.fundingRate) * 100;
    let sentiment = '중립';
    let sentimentEmoji = '⚖️';
    let simpleDesc = '';
    let advice = '';
    
    if (fundingRate > 0.01) {
      sentiment = '매수 과열';
      sentimentEmoji = '🔥';
      simpleDesc = '시장이 너무 뜨거워요! 많은 사람들이 사고 있어요.';
      advice = '⚠️ 조심: 지금 사면 위험할 수 있어요. 조금 기다려보세요.';
    } else if (fundingRate < -0.01) {
      sentiment = '매도 과열';
      sentimentEmoji = '❄️';
      simpleDesc = '시장이 너무 차가워요! 많은 사람들이 팔고 있어요.';
      advice = '💡 기회: 지금 사기 좋은 타이밍일 수 있어요!';
    } else if (fundingRate > 0) {
      sentiment = '약간의 매수 우세';
      sentimentEmoji = '📈';
      simpleDesc = '사는 사람이 조금 더 많아요. 가격이 오를 수 있어요.';
      advice = '📊 보통: 약간의 상승 압력이 있어요.';
    } else if (fundingRate < 0) {
      sentiment = '약간의 매도 우세';
      sentimentEmoji = '📉';
      simpleDesc = '파는 사람이 조금 더 많아요. 가격이 내릴 수 있어요.';
      advice = '📊 보통: 약간의 하락 압력이 있어요.';
    } else {
      simpleDesc = '시장이 균형을 이루고 있어요.';
      advice = '📊 보통: 특별한 신호는 없어요.';
    }
    
    insights.marketSentiment = {
      fundingRate: fundingRate.toFixed(4),
      sentiment: sentiment,
      emoji: sentimentEmoji,
      description: simpleDesc,
      advice: advice
    };
  }

  // 변동성 분석
  if (spotData) {
    const change24h = parseFloat(spotData.change24h) * 100;
    const high24h = parseFloat(spotData.high24h);
    const low24h = parseFloat(spotData.low24h);
    const priceRange = ((high24h - low24h) / low24h) * 100;
    
    let volatilityLevel = '보통';
    let volatilityEmoji = '📊';
    let simpleDesc = '';
    let advice = '';
    
    if (priceRange > 15) {
      volatilityLevel = '매우 높음';
      volatilityEmoji = '⚡';
      simpleDesc = '가격이 엄청나게 요동치고 있어요!';
      advice = '⚠️ 매우 위험: 가격이 급격하게 변할 수 있어요. 조심하세요!';
    } else if (priceRange > 10) {
      volatilityLevel = '높음';
      volatilityEmoji = '📈';
      simpleDesc = '가격이 많이 요동치고 있어요.';
      advice = '⚠️ 주의: 가격 변동이 크니 신중하게 결정하세요.';
    } else if (priceRange < 3) {
      volatilityLevel = '낮음';
      volatilityEmoji = '➡️';
      simpleDesc = '가격이 안정적이에요.';
      advice = '✅ 안정: 가격 변동이 작아서 비교적 안전해요.';
    } else {
      simpleDesc = '가격 변동이 보통이에요.';
      advice = '📊 보통: 일반적인 수준의 변동이에요.';
    }
    
    insights.volatility = {
      range: priceRange.toFixed(2),
      change24h: change24h.toFixed(2),
      level: volatilityLevel,
      emoji: volatilityEmoji,
      description: simpleDesc,
      advice: advice
    };
  }

  // 리스크 레벨 분석 (변동률과 레버리지 기반)
  if (spotData && leverage) {
    const change24h = Math.abs(parseFloat(spotData.change24h) * 100);
    const riskScore = change24h * leverage;
    
    let riskLevel = '낮음';
    let riskEmoji = '🟢';
    let riskColor = '#10b981';
    let simpleDesc = '';
    let advice = '';
    
    if (riskScore > 50) {
      riskLevel = '매우 높음';
      riskEmoji = '🔴';
      riskColor = '#ef4444';
      simpleDesc = '위험도가 매우 높아요!';
      advice = '🚨 매우 위험: 손실이 클 수 있어요. 레버리지를 줄이거나 거래를 피하세요!';
    } else if (riskScore > 30) {
      riskLevel = '높음';
      riskEmoji = '🟠';
      riskColor = '#f59e0b';
      simpleDesc = '위험도가 높아요.';
      advice = '⚠️ 주의: 손실 가능성이 있어요. 신중하게 결정하세요.';
    } else if (riskScore > 15) {
      riskLevel = '보통';
      riskEmoji = '🟡';
      riskColor = '#eab308';
      simpleDesc = '위험도가 보통이에요.';
      advice = '📊 보통: 적당한 수준의 위험이에요.';
    } else {
      simpleDesc = '위험도가 낮아요.';
      advice = '✅ 안전: 비교적 안전한 수준이에요.';
    }
    
    insights.riskLevel = {
      score: riskScore.toFixed(2),
      level: riskLevel,
      emoji: riskEmoji,
      color: riskColor,
      description: simpleDesc,
      advice: advice
    };
  }

  // 목표가 도달 가능성 분석
  if (spotData && avgPrice && targetPrice) {
    const currentPrice = parseFloat(spotData.lastPrice);
    const change24h = parseFloat(spotData.change24h) * 100;
    const distanceToTarget = ((targetPrice - currentPrice) / currentPrice) * 100;
    const distanceFromAvg = ((currentPrice - avgPrice) / avgPrice) * 100;
    
    let reachability = '보통';
    let reachabilityEmoji = '📊';
    let reachabilityColor = '#6b7280';
    
    // 목표가가 평균단가보다 높은 경우 (롱 포지션)
    if (targetPrice > avgPrice) {
      if (distanceToTarget < 0) {
        reachability = '이미 도달';
        reachabilityEmoji = '✅';
        reachabilityColor = '#10b981';
      } else if (change24h > 5 && distanceToTarget < 10) {
        reachability = '높음';
        reachabilityEmoji = '🚀';
        reachabilityColor = '#10b981';
      } else if (change24h < -5 && distanceToTarget > 20) {
        reachability = '낮음';
        reachabilityEmoji = '⚠️';
        reachabilityColor = '#ef4444';
      } else if (distanceFromAvg > 0) {
        reachability = '보통';
        reachabilityEmoji = '📈';
        reachabilityColor = '#6b7280';
      }
    } else {
      // 목표가가 평균단가보다 낮은 경우 (숏 포지션)
      if (distanceToTarget > 0) {
        reachability = '이미 도달';
        reachabilityEmoji = '✅';
        reachabilityColor = '#10b981';
      } else if (change24h < -5 && Math.abs(distanceToTarget) < 10) {
        reachability = '높음';
        reachabilityEmoji = '📉';
        reachabilityColor = '#10b981';
      } else if (change24h > 5 && Math.abs(distanceToTarget) > 20) {
        reachability = '낮음';
        reachabilityEmoji = '⚠️';
        reachabilityColor = '#ef4444';
      }
    }
    
    let simpleDesc = '';
    let advice = '';
    
    if (reachability === '이미 도달') {
      simpleDesc = '목표가를 이미 넘었어요!';
      advice = '🎉 축하: 목표가를 달성했어요! 이익 실현을 고려해보세요.';
    } else if (reachability === '높음') {
      simpleDesc = `목표가까지 ${Math.abs(distanceToTarget).toFixed(2)}% 남았어요. 도달 가능성이 높아요!`;
      advice = '🚀 좋아요: 현재 추세가 좋아서 목표가에 도달할 가능성이 높아요!';
    } else if (reachability === '낮음') {
      simpleDesc = `목표가까지 ${Math.abs(distanceToTarget).toFixed(2)}% 남았어요. 도달이 어려울 수 있어요.`;
      advice = '⚠️ 주의: 현재 추세가 좋지 않아서 목표가 도달이 어려울 수 있어요.';
    } else {
      simpleDesc = `목표가까지 ${Math.abs(distanceToTarget).toFixed(2)}% 남았어요.`;
      advice = '📊 보통: 목표가 도달 가능성이 보통이에요.';
    }
    
    insights.targetReachability = {
      distance: distanceToTarget.toFixed(2),
      reachability: reachability,
      emoji: reachabilityEmoji,
      color: reachabilityColor,
      description: simpleDesc,
      advice: advice
    };
  }

  // 거래량 분석
  if (spotData) {
    const change24h = parseFloat(spotData.change24h) * 100;
    
    let volumeStatus = '보통';
    let volumeEmoji = '📊';
    let simpleDesc = '';
    let advice = '';
    
    if (change24h > 5) {
      volumeStatus = '활발 (상승)';
      volumeEmoji = '📈';
      simpleDesc = '거래가 활발하고 가격이 오르고 있어요!';
      advice = '✅ 좋은 신호: 많은 사람들이 사고 있어서 가격이 오르고 있어요.';
    } else if (change24h < -5) {
      volumeStatus = '활발 (하락)';
      volumeEmoji = '📉';
      simpleDesc = '거래가 활발하지만 가격이 내리고 있어요.';
      advice = '⚠️ 주의: 많은 사람들이 팔고 있어서 가격이 내리고 있어요.';
    } else if (Math.abs(change24h) < 2) {
      volumeStatus = '조용함';
      volumeEmoji = '😴';
      simpleDesc = '거래가 조용하고 가격 변동이 작아요.';
      advice = '📊 보통: 시장이 조용해요. 큰 움직임을 기다리는 중일 수 있어요.';
    } else {
      volumeStatus = '보통';
      volumeEmoji = '📊';
      simpleDesc = '거래량이 보통 수준이에요.';
      advice = '📊 보통: 일반적인 거래 활동이에요.';
    }
    
    insights.volumeAnalysis = {
      status: volumeStatus,
      emoji: volumeEmoji,
      description: simpleDesc,
      advice: advice
    };
  }

  // 가격 추세 분석
  if (spotData) {
    const change24h = parseFloat(spotData.change24h) * 100;
    const currentPrice = parseFloat(spotData.lastPrice);
    const high24h = parseFloat(spotData.highPrice24h);
    const low24h = parseFloat(spotData.lowPrice24h);
    
    let trend = '보통';
    let trendEmoji = '➡️';
    let simpleDesc = '';
    let advice = '';
    
    if (change24h > 5) {
      const positionFromLow = ((currentPrice - low24h) / (high24h - low24h)) * 100;
      if (positionFromLow > 60) {
        trend = '강한 상승';
        trendEmoji = '🚀';
        simpleDesc = '가격이 강하게 오르고 있어요!';
        advice = '📈 상승 추세: 가격이 계속 오를 수 있어요. 하지만 너무 높으면 조심하세요.';
      } else {
        trend = '상승';
        trendEmoji = '📈';
        simpleDesc = '가격이 오르고 있어요.';
        advice = '📈 상승 중: 가격이 오르는 추세예요.';
      }
    } else if (change24h < -5) {
      const positionFromLow = ((currentPrice - low24h) / (high24h - low24h)) * 100;
      if (positionFromLow < 40) {
        trend = '강한 하락';
        trendEmoji = '📉';
        simpleDesc = '가격이 강하게 내리고 있어요.';
        advice = '📉 하락 추세: 가격이 계속 내릴 수 있어요. 조심하세요.';
      } else {
        trend = '하락';
        trendEmoji = '📉';
        simpleDesc = '가격이 내리고 있어요.';
        advice = '📉 하락 중: 가격이 내리는 추세예요.';
      }
    } else {
      trend = '횡보';
      trendEmoji = '➡️';
      simpleDesc = '가격이 옆으로 움직이고 있어요.';
      advice = '➡️ 횡보: 가격이 크게 변하지 않고 있어요.';
    }
    
    insights.priceTrend = {
      trend: trend,
      emoji: trendEmoji,
      change24h: change24h.toFixed(2),
      description: simpleDesc,
      advice: advice
    };
  }

  // 매수/매도 타이밍 추천 (종합 판단)
  if (spotData) {
    const change24h = parseFloat(spotData.change24h) * 100;
    const currentPrice = parseFloat(spotData.lastPrice);
    const high24h = parseFloat(spotData.highPrice24h);
    const low24h = parseFloat(spotData.lowPrice24h);
    const positionFromLow = ((currentPrice - low24h) / (high24h - low24h)) * 100;
    
    let recommendation = '관망';
    let recommendationEmoji = '👀';
    let simpleDesc = '';
    let advice = '';
    let recommendationColor = '#6b7280';
    
    const isLowPrice = positionFromLow <= 30;
    const isHighPrice = positionFromLow >= 70;
    const isRising = change24h > 3;
    const isFalling = change24h < -3;
    
    if (isLowPrice && !isFalling) {
      recommendation = '매수 고려';
      recommendationEmoji = '🟢';
      simpleDesc = '지금이 사기 좋은 타이밍일 수 있어요!';
      advice = '💡 매수 기회: 가격이 낮은 위치에 있고 하락이 멈춘 것 같아요.';
      recommendationColor = '#10b981';
    } else if (isHighPrice && isRising) {
      recommendation = '매도 고려';
      recommendationEmoji = '🔴';
      simpleDesc = '지금이 팔기 좋은 타이밍일 수 있어요!';
      advice = '💰 매도 기회: 가격이 높은 위치에 있고 상승 중이에요. 이익 실현을 고려해보세요.';
      recommendationColor = '#ef4444';
    } else if (isHighPrice && !isRising) {
      recommendation = '매수 주의';
      recommendationEmoji = '⚠️';
      simpleDesc = '지금 사면 비쌀 수 있어요.';
      advice = '⚠️ 주의: 가격이 높은 위치에 있어요. 조금 더 내려올 때를 기다려보세요.';
      recommendationColor = '#f59e0b';
    } else if (isFalling) {
      recommendation = '관망 권장';
      recommendationEmoji = '👀';
      simpleDesc = '가격이 내리고 있어요. 조금 더 기다려보세요.';
      advice = '👀 관망: 가격이 하락 중이에요. 더 내려올 수 있으니 기다려보세요.';
      recommendationColor = '#6b7280';
    } else {
      recommendation = '관망';
      recommendationEmoji = '👀';
      simpleDesc = '특별한 신호는 없어요.';
      advice = '👀 관망: 명확한 매수/매도 신호가 없어요. 추가 정보를 확인해보세요.';
      recommendationColor = '#6b7280';
    }
    
    insights.tradingRecommendation = {
      recommendation: recommendation,
      emoji: recommendationEmoji,
      color: recommendationColor,
      description: simpleDesc,
      advice: advice
    };
  }

  // 손절가 추천 (평균단가와 레버리지가 있을 때)
  if (spotData && avgPrice && leverage) {
    const currentPrice = parseFloat(spotData.lastPrice);
    const isLong = currentPrice > avgPrice; // 롱 포지션인지
    
    let stopLossPrice = 0;
    let stopLossPercent = 0;
    let simpleDesc = '';
    let advice = '';
    
    if (isLong) {
      // 롱 포지션: 손절가는 평균단가보다 낮게
      const riskPercent = 100 / leverage;
      stopLossPercent = -(riskPercent * 0.5);
      stopLossPrice = avgPrice * (1 + stopLossPercent / 100);
      
      simpleDesc = `손절가는 평균단가의 ${Math.abs(stopLossPercent).toFixed(1)}% 아래인 $${stopLossPrice.toFixed(2)} 근처에 두는 게 좋아요.`;
      advice = `🛡️ 손절가: $${stopLossPrice.toFixed(2)} 근처에 손절가를 설정하세요. 큰 손실을 막을 수 있어요.`;
    } else {
      // 숏 포지션: 손절가는 평균단가보다 높게
      const riskPercent = 100 / leverage;
      stopLossPercent = riskPercent * 0.5;
      stopLossPrice = avgPrice * (1 + stopLossPercent / 100);
      
      simpleDesc = `손절가는 평균단가의 ${stopLossPercent.toFixed(1)}% 위인 $${stopLossPrice.toFixed(2)} 근처에 두는 게 좋아요.`;
      advice = `🛡️ 손절가: $${stopLossPrice.toFixed(2)} 근처에 손절가를 설정하세요. 큰 손실을 막을 수 있어요.`;
    }
    
    insights.stopLossRecommendation = {
      price: stopLossPrice.toFixed(2),
      percent: stopLossPercent.toFixed(1),
      description: simpleDesc,
      advice: advice
    };
  }

  return insights;
}

// 가격 정보 출력 (콘솔용)
function displayPrice(priceData, categoryName) {
  console.log(formatPriceAsText(priceData, categoryName));
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

