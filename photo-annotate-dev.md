# PhotoNote — 개발 문서

> PRD: [photo-annotate-prd.md](photo-annotate-prd.md)
> 로드맵: [photo-annotate-roadmap.md](photo-annotate-roadmap.md)

---

## 1. 아키텍처 개요

```
┌─────────────────────────────────────────────────┐
│                  UI (React)                      │
│  Home · Camera · Detail · Editor · FolderTree   │
└──────────────┬──────────────────────────────────┘
               │
       ┌───────┴────────┐
       │  State (Zustand)│
       │  - foldersStore │
       │  - filesStore   │
       │  - editorStore  │
       └───────┬────────┘
               │
       ┌───────┴────────┐
       │  Domain Layer  │
       │  - fileService │ ← 버전 증분, flatten 저장
       │  - folderSvc   │
       │  - exportSvc   │ ← ZIP, 다운로드
       └───────┬────────┘
               │
       ┌───────┴────────┐
       │  Persistence   │
       │  Dexie (IDB)   │
       └────────────────┘
```

핵심 원칙:
- **원본 immutable**: `isOriginal: true`인 레코드는 어떤 경로로도 수정/덮어쓰기 불가. 서비스 레이어에서 가드.
- **편집은 항상 새 레코드**: Editor의 저장 = `createNewVersion()` 호출 → 새 row insert.
- **flatten 저장**: 펜 stroke은 캔버스에서 이미지로 합성되어 Blob 1장으로 저장. stroke 데이터는 보관 X.

---

## 2. 폴더 구조

```
photo-annotate/
├─ public/
│  └─ icons/                  # PWA 아이콘
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ routes/                 # React Router
│  │  ├─ Home.tsx
│  │  ├─ Camera.tsx
│  │  ├─ PhotoDetail.tsx
│  │  └─ Editor.tsx
│  ├─ components/
│  │  ├─ FolderTree.tsx
│  │  ├─ PhotoGrid.tsx
│  │  ├─ VersionBadge.tsx
│  │  ├─ FilenameModal.tsx
│  │  └─ editor/
│  │     ├─ Canvas.tsx
│  │     ├─ Toolbar.tsx
│  │     └─ ColorPicker.tsx
│  ├─ stores/
│  │  ├─ foldersStore.ts
│  │  ├─ filesStore.ts
│  │  └─ editorStore.ts
│  ├─ services/
│  │  ├─ fileService.ts       # 버전 증분 로직
│  │  ├─ folderService.ts
│  │  ├─ exportService.ts     # JSZip
│  │  └─ thumbnailService.ts
│  ├─ db/
│  │  ├─ schema.ts            # Dexie 정의
│  │  └─ migrations.ts
│  ├─ types/
│  │  └─ models.ts            # File, Folder 타입
│  ├─ utils/
│  │  ├─ filename.ts          # `-N` 증분 파서/생성
│  │  ├─ image.ts             # resize, flatten
│  │  └─ date.ts
│  └─ styles/
├─ vite.config.ts             # PWA plugin 설정
├─ package.json
└─ tsconfig.json
```

---

## 3. 데이터베이스 (Dexie)

```ts
// db/schema.ts
import Dexie, { Table } from 'dexie';

export interface FileRecord {
  id: string;          // uuid
  name: string;        // "photo" (확장자 제외)
  ext: string;         // "jpg"
  version: number;     // 0 = 원본
  parentId: string | null;
  rootId: string;      // 버전 그룹 키
  folderId: string;
  isOriginal: boolean;
  blob: Blob;
  thumbnail: Blob;
  width: number;
  height: number;
  size: number;
  createdAt: number;
}

export interface FolderRecord {
  id: string;
  name: string;
  parentFolderId: string | null;  // v1은 항상 null (root)
  createdAt: number;
}

class PhotoNoteDB extends Dexie {
  files!: Table<FileRecord, string>;
  folders!: Table<FolderRecord, string>;

  constructor() {
    super('photonote');
    this.version(1).stores({
      files: 'id, folderId, rootId, [folderId+createdAt], createdAt',
      folders: 'id, parentFolderId, createdAt',
    });
  }
}

export const db = new PhotoNoteDB();
```

인덱스 결정:
- `[folderId+createdAt]`: 폴더별 사진 그리드 정렬에 필요
- `rootId`: 버전 그룹 조회 (`db.files.where('rootId').equals(...)`)

---

## 4. 핵심 도메인 로직

### 4.1 버전 증분 알고리즘

```ts
// services/fileService.ts
async function nextVersionFilename(rootId: string, baseName: string): Promise<{ name: string; version: number }> {
  const siblings = await db.files
    .where('rootId').equals(rootId)
    .toArray();
  const maxVersion = Math.max(...siblings.map(f => f.version));
  const nextVersion = maxVersion + 1;
  return { name: `${baseName}-${nextVersion}`, version: nextVersion };
}

async function createEditedVersion(sourceFile: FileRecord, editedBlob: Blob): Promise<FileRecord> {
  const { name, version } = await nextVersionFilename(sourceFile.rootId, baseName(sourceFile));
  const thumbnail = await generateThumbnail(editedBlob);
  const record: FileRecord = {
    id: uuid(),
    name,
    ext: sourceFile.ext,
    version,
    parentId: sourceFile.id,    // 직전 source 추적
    rootId: sourceFile.rootId,  // 같은 root 유지
    folderId: sourceFile.folderId,
    isOriginal: false,
    blob: editedBlob,
    thumbnail,
    // ...
    createdAt: Date.now(),
  };
  await db.files.add(record);
  return record;
}
```

### 4.2 신규 촬영 시 이름 충돌

```ts
async function resolveFilename(folderId: string, requestedName: string): Promise<string> {
  // 같은 폴더에서 같은 baseName이 root인 파일이 이미 있으면 -N 부여
  const existing = await db.files
    .where('folderId').equals(folderId)
    .filter(f => baseName(f) === requestedName && f.isOriginal)
    .first();
  if (!existing) return requestedName;
  // 묻지 않고 자동으로 다음 번호
  const { name } = await nextVersionFilename(existing.rootId, requestedName);
  return name;
}
```

엣지: 신규 촬영이 기존 root에 합류해야 하는지(`rootId` 공유) vs. 별도 root로 가는지 — PRD 5번 "같은 이름으로 신규 촬영 → 다음 번호 부여"는 **별도 root, 이름만 `-N`** 으로 해석. 결정 필요.

### 4.3 원본 삭제 처리

```ts
async function deleteFile(id: string, opts: { cascade: boolean }) {
  const f = await db.files.get(id);
  if (!f) return;
  if (f.isOriginal) {
    if (opts.cascade) {
      await db.files.where('rootId').equals(f.rootId).delete();
    } else {
      // 자식들의 rootId를 자기 id로 재지정 (root 끊기)
      const children = await db.files.where('rootId').equals(f.rootId).and(x => x.id !== f.id).toArray();
      for (const c of children) {
        await db.files.update(c.id, { rootId: c.id, parentId: null, isOriginal: true });
      }
      await db.files.delete(id);
    }
  } else {
    await db.files.delete(id);
  }
}
```

---

## 5. 에디터

### 5.1 Fabric.js 셋업
- 캔버스 = 원본 이미지 size로 생성 (오버사이즈는 표시용 scale, 저장 시 원본 해상도로 export)
- `freeDrawingBrush`: 색상/굵기 toolbar 바인딩
- 지우개: `globalCompositeOperation = 'destination-out'` 또는 별도 흰색 브러시 — 배경 위 펜만 지우려면 stroke을 별도 layer로 관리해야 함. **결정**: v1은 stroke layer 분리 (`fabric.Group`), 저장 시 flatten.

### 5.2 Undo/Redo
- 단순 stroke push/pop 스택. session 안에서만 유효, 저장 후 폐기.

### 5.3 저장
1. canvas.toDataURL → Blob (`image/jpeg`, quality 0.92)
2. `createEditedVersion(sourceFile, blob)` 호출
3. 라우트 복귀

---

## 6. PWA / 오프라인

- `vite-plugin-pwa` registerType `'autoUpdate'`
- 네트워크 의존성 없음 (모든 데이터 IndexedDB) → workbox는 앱 셸만 캐시
- manifest: standalone, theme color, 아이콘 192/512

---

## 7. 성능 / 용량

- 썸네일: long-side 256px, jpeg q=0.7 → ~20KB/장
- 원본 >10MB 자동 리사이즈: long-side 4096px clamp 옵션 (PRD 5번)
- IDB 사용량 모니터링: `navigator.storage.estimate()` → 설정 화면에 막대 표시
- cleanup 작업: 고아 thumbnail (file 없는데 thumb만 남은 경우) 주기적 sweep — v1은 수동 버튼

---

## 8. 테스트 전략

| 레이어 | 도구 | 대상 |
|---|---|---|
| Unit | Vitest | `fileService` 버전 증분, `filename` 파서, 삭제 cascade |
| 통합 | Vitest + fake-indexeddb | DB 스키마, 폴더 이동, ZIP export |
| E2E | Playwright (옵션) | 촬영→편집→저장 플로우, 라운드트립 |

핵심 테스트 케이스:
- 같은 root에 `-1`, `-2` 순차 생성
- `-1` 편집 시 `-3` 생성 (parent는 `-1`, root 동일)
- 원본 삭제 cascade vs. detach
- 큰 이미지 리사이즈 후 해상도 검증

---

## 9. 결정 필요 / 오픈 이슈

1. **카메라 출력 포맷**: jpeg vs. webp? webp는 용량 작지만 iOS 구버전 호환성. → v1은 jpeg.
2. **에디터 좌표계**: 원본 해상도 기준 vs. 표시 해상도 기준. 줌 도입 시 전자가 안전.
3. **신규 촬영 이름 충돌 시 root 합류 여부**: 위 4.2 참조. 별도 root 권장.
4. **버전 그룹 정렬**: 그리드에서 그룹 대표는 원본 vs. 최신 편집본? PRD는 "1장으로 묶고 뱃지 +N" — 대표 thumbnail은 최신 편집본 권장 (사용자가 마지막 작업 본 것).
5. **iOS Safari**: getUserMedia 동작 검증, IndexedDB Safari 버그(WAL 관련) 주의.

---

## 10. 의존성

```json
{
  "dependencies": {
    "react": "^18",
    "react-router-dom": "^6",
    "zustand": "^4",
    "dexie": "^4",
    "fabric": "^6",
    "jszip": "^3",
    "uuid": "^9"
  },
  "devDependencies": {
    "vite": "^5",
    "vite-plugin-pwa": "^0.20",
    "typescript": "^5",
    "vitest": "^1",
    "fake-indexeddb": "^5",
    "@playwright/test": "^1"
  }
}
```
