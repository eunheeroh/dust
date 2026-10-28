// Vercel 서버리스 API 엔드포인트 주소 설정
const API_URL = '/api/dust';

// DOM 요소: 시도 선택 셀렉트 박스
const sidoSelect = document.getElementById('sidoSelect');

// DOM 요소: 평균 미세먼지 제목 표시 엘리먼트
const averageTitle = document.getElementById('averageTitle');

// DOM 요소: 평균 미세먼지 수치 표시 엘리먼트
const averageValue = document.getElementById('averageValue');

// DOM 요소: 평균 미세먼지 상태 표시 엘리먼트
const averageStatus = document.getElementById('averageStatus');

// DOM 요소: 개별 측정소 카드들이 표시될 컨테이너
const stationGrid = document.getElementById('stationGrid');

// 등급 번호에 따른 한글 등급명 및 색상 매핑 함수
function getGradeInfo(grade) {
  // 등급이 1인 경우: 좋음
  if (grade === '1') {
    return { text: '좋음', className: 'grade-1', color: '#1d4ed8' };
  }
  // 등급이 2인 경우: 보통
  if (grade === '2') {
    return { text: '보통', className: 'grade-2', color: '#047857' };
  }
  // 등급이 3인 경우: 나쁨
  if (grade === '3') {
    return { text: '나쁨', className: 'grade-3', color: '#c2410c' };
  }
  // 등급이 4인 경우: 매우나쁨
  if (grade === '4') {
    return { text: '매우나쁨', className: 'grade-4', color: '#b91c1c' };
  }
  // 등급 값이 비어있거나 올바르지 않은 경우: 측정 안 됨 (회색 처리)
  return { text: '정보 없음', className: 'grade-null', color: '#64748b' };
}

// 측정값(미세먼지, 초미세먼지 등) 결측치('-') 여부 확인 및 문자열 정제 함수
function formatValue(value) {
  // 값이 없거나, 공백이거나, '-' 기호로 전달된 경우
  if (!value || value.trim() === '' || value.trim() === '-') {
    // "측정 안 됨" 문자열 반환
    return '측정 안 됨';
  }
  // 유효한 측정값인 경우 뒤에 단위(㎍/㎥)를 붙여서 반환
  return `${value} ㎍/㎥`;
}

// 선택한 시도의 대기오염 정보를 서버리스 API로 비동기 요청하는 함수
async function fetchDustData(sidoName) {
  // 로딩 중 상태 안내 메시지 표시
  stationGrid.innerHTML = '<div class="info-message">대기오염 데이터를 불러오는 중입니다...</div>';
  // 평균 타이틀 변경
  averageTitle.innerText = `${sidoName} 평균 미세먼지(PM10)`;
  // 평균 수치 초기화
  averageValue.innerText = '-';
  // 평균 상태 뱃지 초기화
  averageStatus.innerText = '계산 중';
  averageStatus.style.backgroundColor = '#94a3b8';

  // API 요청 실행 및 예외 처리
  try {
    // 내부 서버리스 함수 /api/dust?sido=... 호출
    const response = await fetch(`${API_URL}?sido=${encodeURIComponent(sidoName)}`);

    // 응답 본문을 JSON 객체로 파싱
    const data = await response.json();

    // HTTP 응답이 비정상이거나 서버리스 함수에서 에러를 반환한 경우
    if (!response.ok) {
      throw new Error(data.error || `서버 응답 오류 (상태코드: ${response.status})`);
    }

    // API 응답 결과에서 측정소 데이터 목록 추출
    const items = data?.response?.body?.items;

    // 측정 데이터가 없거나 비어있는 경우
    if (!items || items.length === 0) {
      stationGrid.innerHTML = '<div class="info-message">조회된 측정소 데이터가 없습니다.</div>';
      averageValue.innerText = '0';
      averageStatus.innerText = '데이터 없음';
      return;
    }

    // 받아온 측정 데이터를 화면에 렌더링하고 평균 수치 계산
    renderData(items, sidoName);
  } catch (error) {
    // 콘솔에 상세 에러 내용 기록
    console.error('API 요청 중 오류 발생:', error);

    // 에러 발생 시 사용자 친화적인 안내 메시지 화면 표시
    stationGrid.innerHTML = `
      <div class="info-message">
        <p style="color:#ef4444; font-weight:bold; margin-bottom:8px;">데이터를 불러오지 못했습니다.</p>
        <p style="font-size:0.95rem; color:#334155;">${error.message}</p>
      </div>
    `;
    // 평균값 영역 에러 표시
    averageValue.innerText = '-';
    averageStatus.innerText = '조회 실패';
    averageStatus.style.backgroundColor = '#ef4444';
  }
}

// 측정소 목록 렌더링 및 평균 미세먼지 수치 계산 함수
function renderData(items, sidoName) {
  // 미세먼지 유효 측정값의 총합을 저장할 변수
  let pm10Sum = 0;
  // 유효한 측정소의 개수를 저장할 변수
  let validCount = 0;
  // 카드 HTML 조각을 모아둘 문자열 변수
  let cardsHtml = '';

  // 각 측정소별 데이터를 순회하며 카드 생성
  items.forEach(item => {
    // 측정소 이름
    const stationName = item.stationName || '알 수 없음';
    // 미세먼지 PM10 원본 값
    const pm10Raw = item.pm10Value;
    // 초미세먼지 PM2.5 원본 값
    const pm25Raw = item.pm25Value;
    // 미세먼지 등급 (1~4 또는 빈값)
    const pm10Grade = item.pm10Grade;
    // 측정 시각
    const dataTime = item.dataTime || '시간 정보 없음';

    // 등급 정보(한글명, CSS 클래스 등) 조회
    const gradeInfo = getGradeInfo(pm10Grade);

    // 미세먼지 수치가 유효한 숫자인지 확인 (결측치 '-' 등 제외)
    if (pm10Raw && pm10Raw.trim() !== '' && pm10Raw.trim() !== '-' && !isNaN(pm10Raw)) {
      pm10Sum += parseFloat(pm10Raw);
      validCount += 1;
    }

    // 개별 측정소 카드 HTML 템플릿 생성
    cardsHtml += `
      <article class="station-card ${gradeInfo.className}">
        <div class="card-header">
          <span class="station-name">${stationName}</span>
          <span class="grade-badge">${gradeInfo.text}</span>
        </div>
        <div class="card-body">
          <div class="metric-row">
            <span class="metric-label">미세먼지 (PM10)</span>
            <span class="metric-value">${formatValue(pm10Raw)}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">초미세먼지 (PM2.5)</span>
            <span class="metric-value">${formatValue(pm25Raw)}</span>
          </div>
        </div>
        <div class="card-footer">
          측정 시각: ${dataTime}
        </div>
      </article>
    `;
  });

  // 카드 그리드에 동적으로 생성된 카드 삽입
  stationGrid.innerHTML = cardsHtml;

  // 유효한 측정값이 1개 이상 있는 경우 평균 계산
  if (validCount > 0) {
    // 소수점 첫째 자리까지 반올림 계산
    const average = Math.round(pm10Sum / validCount);
    // 화면에 큰 숫자로 평균 표시
    averageValue.innerText = average;

    // 평균값에 따른 종합 대기질 판정 및 뱃지 색상 업데이트
    if (average <= 30) {
      averageStatus.innerText = '좋음';
      averageStatus.style.backgroundColor = '#1d4ed8';
    } else if (average <= 80) {
      averageStatus.innerText = '보통';
      averageStatus.style.backgroundColor = '#047857';
    } else if (average <= 150) {
      averageStatus.innerText = '나쁨';
      averageStatus.style.backgroundColor = '#c2410c';
    } else {
      averageStatus.innerText = '매우나쁨';
      averageStatus.style.backgroundColor = '#b91c1c';
    }
  } else {
    // 모든 측정소가 결측치인 경우 처리
    averageValue.innerText = '측정 안 됨';
    averageStatus.innerText = '데이터 없음';
    averageStatus.style.backgroundColor = '#64748b';
  }
}

// 시도 드롭다운 변경 이벤트 리스너 등록
sidoSelect.addEventListener('change', (event) => {
  // 선택된 시도명으로 데이터 다시 조회
  fetchDustData(event.target.value);
});

// 페이지 첫 로딩 시 기본값인 '서울' 데이터 자동 조회
fetchDustData(sidoSelect.value);
