# PhotoNote — 개발 로드맵

> PRD: [photo-annotate-prd.md](photo-annotate-prd.md)
> 개발문서: [photo-annotate-dev.md](photo-annotate-dev.md)

전체 일정: **3주 MVP → 1주 폴리싱 → v2 백로그**

---

## Milestone M0 — 셋업 (Day 1)

- [ ] Vite + React + TS 프로젝트 생성
- [ ] ESLint + Prettier + Husky pre-commit
- [ ] React Router 라우트 골격 (`/`, `/camera`, `/photo/:id`, `/edit/:id`)
- [ ] Zustand store 골격 3개 (folders, files, editor)
- [ ] Dexie 스키마 v1 정의 + 빈 DB 동작 확인
- [ ] vite-plugin-pwa 기본 설정 (앱 셸 캐시만)
- [ ] 깃 초기 커밋

**완료 기준**: `npm run dev` 시 빈 홈 화면, IDB에 `photonote` DB 생성 확인.

---

## Milestone M1 — 촬영 & 저장 (Week 1, Day 2-5)

### M1.1 카메라 캡처
- [x] `getUserMedia` 후방 카메라 우선 (`facingMode: 'environment'`)
- [x] 셔터 버튼 → canvas로 프레임 캡처 → Blob
- [x] 권한 거부 시 갤러리 업로드 폴백 (`<input type="file" accept="image/*">`)

### M1.2 파일명 입력
- [x] 캡처 직후 모달 (default `IMG_yyyymmdd_HHmmss`)
- [x] 폴더 선택 (현재 폴더 default)
- [x] 이름 충돌 시 자동 `-N` 부여 (묻지 않음)

### M1.3 저장 파이프라인
- [x] `fileService.createOriginal(blob, name, folderId)` 구현
- [x] 썸네일 생성 (long-side 256px)
- [x] >10MB 자동 리사이즈 (long-side 4096 clamp)
- [x] DB insert → 홈 복귀

### M1.4 홈 그리드 (1차)
- [x] 현재 폴더의 사진 그리드 (썸네일 + 이름)
- [x] `[folderId+createdAt]` 인덱스로 정렬

**완료 기준**: 촬영 → 이름 입력 → 홈에 새 사진 thumb 노출. 새로고침해도 유지.

---

## Milestone M2 — 폴더 (Week 2, Day 6-7)

- [x] 폴더 생성/이름 변경/삭제 (root 1단계만)
- [x] 상단 셀렉터(FolderPicker) + 셀렉터로 현재 폴더 전환
- [x] 사진 이동: 선택 모드 → "이동" → 폴더 선택 다이얼로그
- [x] 폴더 삭제 시: 안에 사진 있으면 경고/이동 강제

**완료 기준**: 폴더 2개 만들고 사진을 양방향 이동, 새로고침 후 유지.

---

## Milestone M3 — 사진 상세 & 버전 그룹 (Week 2, Day 8-9)

- [x] 사진 상세 라우트 (`/photo/:id`)
  - 큰 미리보기, 메타(크기, 일시), [편집][다운로드][이동][삭제]
- [x] 버전 리스트: 같은 `rootId` 묶어서 시간순 표시
- [x] 그리드의 버전 그룹 뱃지 `+N` (대표는 최신 편집본)
- [x] 삭제 모달: 원본일 때 cascade vs detach 선택

**완료 기준**: 원본 1장 + 편집본 2장 그룹이 그리드에 1장+뱃지로, 상세에서 3장 리스트로 보임.

---

## Milestone M4 — 펜 에디터 (Week 2, Day 10-12)

### M4.1 캔버스
- [x] (raw canvas로 대체) 원본 이미지 배경에 원본 이미지 배경
- [x] 화면 fit (aspect-ratio CSS) (모바일 가로/세로 회전 대응)
- [x] stroke을 별도 캔버스 레이어으로 관리 (지우개 동작용)

### M4.2 도구
- [x] 펜: 색 4종 (검/빨/파/노), 굵기 3단
- [x] 지우개 (destination-out) (펜 stroke만 제거)
- [x] Undo/Redo (세션 내)

### M4.3 저장
- [x] flatten → jpeg blob (q 0.92)
- [x] `createEditedVersion(source, blob)` → 자동 `-N`
- [x] "다른 이름으로 저장" → 새 root로 시작

**완료 기준**: 원본 편집 → `-1` 생성, `-1` 편집 → `-2` 생성, parent/root 추적 검증 (DB 직접 확인).

---

## Milestone M5 — 다운로드 (Week 3, Day 13-14)

- [x] 개별 다운로드 (Blob → `URL.createObjectURL` → `<a download>`)
- [x] 폴더 선택 → ZIP 다운로드 (JSZip, 진행률 표시)
- [x] 버전 그룹은 모두 포함 (`photo.jpg`, `photo-1.jpg` 둘 다)

**완료 기준**: 폴더 ZIP 받아서 압축 해제 시 파일명 그대로, 원본+편집본 모두 존재.

---

## Milestone M6 — PWA & 폴리싱 (Week 3, Day 15-17)

- [x] PWA 매니페스트 + 아이콘 (192/512)
- [ ] 오프라인 동작 검증 — 모바일 실기기 단계에서 (네트워크 끊고 사용)
- [x] 설치 가능 프롬프트 (beforeinstallprompt 훅) (Add to Home Screen)
- [x] IDB 용량 표시 (`storage.estimate()`)
- [x] 로딩/에러 상태 일관화
- [x] 빈 상태 UI (사진 없음, 폴더 없음)
- [ ] 다크모드 — 옵션, 보류 (시스템 따라가기) — 옵션
- [ ] iOS Safari / Chrome Android — 실기기 단계에서 Android 실기기 검수

**완료 기준**: 모바일에 설치 → 네트워크 OFF에서 촬영/편집/저장 완전 동작.

---

## Milestone M7 — 테스트 & 배포 (Week 3, Day 18-21)

- [x] Vitest unit: 버전 증분, 파일명 파서, 삭제 cascade
- [x] fake-indexeddb 통합 테스트
- [ ] (선택) Playwright — v1.5에서 1개 시나리오: 촬영→편집→다운로드
- [ ] Vercel/Netlify/GitHub Pages 중 택1 배포
- [ ] HTTPS 확인 — 배포 시 (getUserMedia 필수)
- [ ] 사용 가이드 README 작성

**완료 기준**: 배포 URL에서 모바일로 접속, 카메라 권한 정상, 일반 사용자 5분 내 첫 사진 저장 가능.

---

## 일정 요약

| 주차 | 마일스톤 | 산출물 |
|---|---|---|
| Week 1 | M0 + M1 | 촬영해서 IDB에 저장, 홈 그리드 표시 |
| Week 2 | M2 + M3 + M4 | 폴더, 버전 그룹, 펜 에디터 |
| Week 3 | M5 + M6 + M7 | 다운로드, PWA, 배포 |
| Week 4 | (버퍼) | 실기기 버그 잡기, 사용성 폴리싱 |

---

## 리스크 & 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| iOS Safari getUserMedia 제약 | 촬영 불가 | 갤러리 업로드 폴백을 동등 1순위로 |
| Fabric.js 모바일 터치 정확도 | 그리기 품질 | 초기에 실기기 테스트, 안 되면 perfect-freehand로 교체 |
| IndexedDB 용량 한계 | 저장 실패 | quota 모니터링 + 사용자 안내, 큰 이미지 리사이즈 강제 |
| PWA 캐시 stale | 업데이트 안 됨 | autoUpdate 모드 + skipWaiting 패턴 |
| 버전 증분 race | 같은 번호 중복 | 트랜잭션 안에서 max+1 계산 (Dexie `transaction`) |

---

## v2 백로그 (PRD 8장)

우선순위 안:
1. **다단계 폴더** — 사용자 데이터 늘면 즉시 필요
2. **태그·검색** — 폴더 외 분류 축
3. **File System Access API** — PC 사용자에게 가장 큰 가치 (진짜 파일로 저장)
4. **형광펜·텍스트·도형** — 에디터 확장
5. **모자이크** — 사생활 보호 수요
6. **클라우드 동기화** — 멀티 디바이스 (서버 도입 필요, 비용 검토)
7. **버전 트리 시각화** — 데이터 모델은 이미 parent 추적, UI만 추가

---

## 진행 추적

각 마일스톤 완료 시 이 파일의 체크박스 갱신. PR 단위는 마일스톤 하위 섹션(M1.1, M1.2 …) 기준 권장.
