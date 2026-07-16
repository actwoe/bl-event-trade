# BL Event Trade Board

팝업·콜라보 카페 굿즈 교환판을 만들고 PNG로 저장하는 Next.js 프로젝트입니다.

## 주요 구조

- `app/page.tsx`: 공개 행사 목록
- `components/home/EventCollectionBrowser.tsx`: 행사 상태 필터와 6개 단위 더보기
- `app/trade/[slug]/page.tsx`: 행사별 교환판 데이터 로드
- `components/trade-editor/`: 일반 사용자와 관리자 테스트가 함께 사용하는 공통 교환판 편집기
- `components/trade/`: 교환판 카드·미리보기 보조 UI
- `app/admin/trade-lab/page.tsx`: 실제 공통 편집기를 사용하는 관리자 교환판 테스트
- `app/api/image-proxy/route.ts`: 브라우저 직접 이미지 로드가 실패했을 때만 사용하는 제한적 fallback

## 무료 사용량 절약 원칙

- 교환판 PNG는 사용자의 브라우저 Canvas에서 생성합니다.
- Supabase Storage 이미지는 브라우저에서 CORS 직접 로드를 먼저 시도합니다.
- 직접 로드가 실패한 이미지만 `/api/image-proxy`를 사용합니다.
- 메인 행사 목록은 ISR로 한 번 로드하고, 상태 필터와 더보기는 브라우저에서 처리합니다.
- 사용하지 않는 서버 PNG 생성 API와 무거운 이미지 처리 의존성은 두지 않습니다.

## 개발 명령

```bash
npm install
npm run dev
npm run build
npm run lint
```

로컬 주소는 기본적으로 `http://localhost:3000`입니다.

## 배포 전 확인

1. `npm run build`가 성공하는지 확인합니다.
2. 메인에서 전체·예정·진행중·종료 필터와 더보기를 확인합니다.
3. PC와 모바일에서 PNG 저장을 확인합니다.
4. 브라우저 Network 탭에서 대부분의 Supabase 이미지가 직접 로드되고, `/api/image-proxy`는 fallback일 때만 호출되는지 확인합니다.
5. 관리자 교환판 테스트와 실제 교환판이 동일한 `TradeEditor`를 사용하는지 확인합니다.
