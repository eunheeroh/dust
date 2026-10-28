// Vercel 서버리스 함수 핸들러 정의 (CommonJS / Node.js 런타임 호환)
module.exports = async function handler(req, res) {
  // CORS 헤더 설정 (필요 시 외부 도메인 접근 허용)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // 주소 쿼리로 sido(시도 이름)를 추출하고 없으면 기본값 '서울' 사용
  const { sido = '서울' } = req.query;

  // 환경변수에서 에어코리아 Decoding 인증키 읽기 (코드에 하드코딩 금지)
  const serviceKey = process.env.AIRKOREA_KEY;

  // 환경변수에 인증키가 설정되어 있지 않은 경우 오류 응답 반환
  if (!serviceKey) {
    return res.status(500).json({
      error: '서버 환경변수(AIRKOREA_KEY)가 설정되지 않았습니다. Vercel 환경변수를 확인해주세요.'
    });
  }

  // 에어코리아 시도별 대기오염 측정정보 조회 API 주소
  const baseUrl = 'https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty';

  // Decoding 키와 한글 시도 이름을 안전하게 URL 인코딩하여 쿼리스트링 생성
  const queryParams = [
    `serviceKey=${encodeURIComponent(serviceKey)}`,
    'returnType=json',
    'numOfRows=100',
    'pageNo=1',
    `sidoName=${encodeURIComponent(sido)}`,
    'ver=1.3'
  ].join('&');

  try {
    // 에어코리아 오픈API에 비동기 데이터 요청
    const response = await fetch(`${baseUrl}?${queryParams}`);
    // 응답 본문을 텍스트 형태로 먼저 읽기
    const textData = await response.text();

    // 응답이 XML 에러 형식이거나 JSON이 아닌 경우 예외 처리
    let jsonData;
    try {
      jsonData = JSON.parse(textData);
    } catch (parseError) {
      // JSON 파싱 실패(XML 에러 문서 등) 시 한국어 에러 메시지 반환
      return res.status(400).json({
        error: '인증키 또는 요청값을 확인해주세요. (에어코리아 서비스 인증 오류)'
      });
    }

    // API 응답 결과 코드(resultCode) 검사 (00 또는 0이 정상)
    const resultCode = jsonData?.response?.header?.resultCode;
    const resultMsg = jsonData?.response?.header?.resultMsg;

    if (resultCode && resultCode !== '00' && resultCode !== '0') {
      return res.status(400).json({
        error: `오픈API 요청 실패: [${resultCode}] ${resultMsg || '정상적인 결과를 받지 못했습니다.'}`
      });
    }

    // 정상 JSON 응답 반환 (캐시 10분 설정으로 API 호출 최적화)
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
    return res.status(200).json(jsonData);
  } catch (error) {
    // 네트워크 오류 또는 기타 서버 예외 처리
    return res.status(500).json({
      error: `서버 통신 중 오류가 발생했습니다: ${error.message}`
    });
  }
};

