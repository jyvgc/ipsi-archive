# 입학 자료실 (입학처 내부용 엑셀 열람 웹앱)

## 1. Firebase 준비
1. Firebase 콘솔 → 새 프로젝트 → 웹 앱 추가 → 설정값 복사
2. Authentication → 로그인 방법 → **Google** 사용 설정
3. Firestore Database 생성 (프로덕션 모드), Storage 생성
4. Firestore 규칙 탭에 `firestore.rules`, Storage 규칙 탭에 `storage.rules` 내용 붙여넣고 게시
   (Storage 규칙이 Firestore를 참조할 때 콘솔에서 권한 허용 안내가 나오면 '허용')
5. **첫 관리자 등록(콘솔에서 직접 1회)**
   Firestore → 컬렉션 `allowedUsers` → 문서 ID = 본인 구글 이메일(소문자) → 필드 `role` (string) = `admin`
   이후 다른 사용자는 앱의 [관리 › 사용자 관리]에서 추가합니다.
6. **Storage CORS 설정(필수, 표 열람·다운로드용)**
   `cors.json`의 도메인을 실제 Vercel 주소로 바꾼 뒤 Google Cloud Shell에서:
   `gsutil cors set cors.json gs://<STORAGE_BUCKET>`

## 2. 로컬 실행
```
cp .env.local.example .env.local   # 값 입력
npm install
npm run dev                         # http://localhost:3000
```

## 3. Vercel 배포
GitHub에 올림 → Vercel Import → Environment Variables에 `.env.local` 6개 값 입력 → Deploy
배포 후 Firebase Authentication → 설정 → **승인된 도메인**에 `xxx.vercel.app` 추가

## 4. 데이터 구조
- `allowedUsers/{email}` : role(admin|viewer), name
- `files/{id}` : year, round, category, title, fileName, sheetNames, rowCount, originalPath, dataPath
- Storage `files/{id}/original.xlsx`(원본), `files/{id}/data.json`(SheetJS 변환본, 열람 시 1회만 읽음)
- `userPrefs/{email}` : favorites[]
- `logs` : email, action(view/download/upload/delete), fileId, title, at

## 5. 사용 팁
- 표 위에 제목 줄이 있는 엑셀은 업로드 시 '머리글 행 번호'를 조정 (미리보기로 열 이름 확인)
- 열 이름 클릭 = 정렬(오름→내림→해제), ⏷ = 값 선택 필터
- 필터 결과는 '현재 결과 엑셀 저장'으로 내려받기 가능
- 주소창 `?f=문서ID` 로 특정 자료 바로 열기 (권한자끼리 링크 공유)
