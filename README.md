# Biology Second Brain — Supabase Edition

GitHub Pages에서 돌아가는 정적 HTML/CSS/JavaScript Biology Wiki입니다.  
저장 방식 : Supabase Auth + Supabase Database + RLS를 사용

## 권한 구조

| Role | 가능 기능 |
|---|---|
| `owner` | 모든 논문 보기/추가/수정/삭제, visibility/status 변경, Owner Knowledge 관리, 사용자 role 승인/차단 |
| `member` | public/members 논문 보기, 논문 추가, 본인이 추가한 논문 수정, 개인 Knowledge 불가 |
| `viewer` | approved + public 논문만 보기, 추가/수정/삭제 불가 |
| `pending` | 로그인은 가능하지만 사이트 사용 불가, owner 승인 대기 |
| `blocked` | 접근 불가 |

Member가 추가한 논문은 자동으로 다음 상태로 저장됩니다.

```txt
visibility = members
review_status = pending_review
```

Owner는 `Library > Review Queue`에서 승인하거나 거절할 수 있습니다.

## 파일 구조

```text
biology-second-brain/
├── index.html
├── setup.sql
├── pages/
│   ├── add.html
│   ├── library.html
│   ├── entity.html
│   ├── cell_types/macrophage.html
│   ├── genes/cxcl13.html
│   ├── tissues/lung.html
│   └── papers/paper-001.html
└── assets/
    ├── data.js
    ├── search.js
    ├── style.css
    ├── supabase-config.js
    ├── auth-gate.js
    └── supabase-db.js
```

## Supabase 세팅 순서

### 1. Supabase SQL 실행

Supabase Dashboard → SQL Editor → New query에서 `setup.sql` 내용을 전체 복붙하고 Run 합니다.

이 SQL은 다음을 만듭니다.

- `profiles`
- `papers`
- `knowledge`
- RLS policies
- 회원가입 시 pending profile을 만드는 trigger
- owner/member/viewer 접근 제어

### 2. 첫 owner 지정

웹사이트에서 본인 이메일로 한 번 회원가입/로그인합니다.  
그 다음 Supabase SQL Editor에서 아래처럼 본인 이메일을 넣어 실행합니다.

```sql
update public.profiles
set role = 'owner'
where email = 'YOUR_EMAIL@example.com';
```

이후부터는 웹사이트 `Library > User Access`에서 다른 사용자를 `member`, `viewer`, `blocked`로 바꿀 수 있습니다.

### 3. Auth 설정

Supabase Dashboard에서 Auth 설정을 확인합니다.

추천 운영 방식:

- 처음 테스트할 때는 email signup 허용
- 안정화 후에는 invite-only 방식으로 운영
- 모르는 사람이 가입해도 기본 role은 `pending`이라 데이터 접근은 막힘

### 4. GitHub Pages에 업로드

이 폴더 안의 파일 구조 그대로 GitHub 저장소에 올립니다.

GitHub에서:

- Settings → Pages
- Source: Deploy from a branch
- Branch: main
- Folder: /(root)

으로 설정하면 됩니다.

## 중요한 보안 메모

`assets/supabase-config.js`에는 Supabase Project URL과 anon key가 들어 있습니다.  
anon key는 프론트엔드에 노출되는 public key라서 브라우저에서 보이는 것이 정상입니다.

진짜 보안은 anon key가 아니라 `setup.sql`의 RLS 정책이 담당합니다.

절대 넣으면 안 되는 것:

```txt
service_role key
Database password
개인 API secret key
```

이런 값은 GitHub에 올리면 안 됩니다.

## 사용 방법

1. 로그인합니다.
2. Owner가 사용자를 승인합니다.
3. `+ Add`에서 Paper를 입력합니다.
4. Member가 넣은 Paper는 pending_review 상태로 들어갑니다.
5. Owner가 `Library > Review Queue`에서 approve/reject 합니다.
6. 검색창에서 Disease / Gene / Cell Type / Tissue / Paper를 검색합니다.

## 현재 구현된 것

- Supabase 로그인/회원가입/Magic Link UI
- role 기반 접근 게이트
- pending/blocked 화면
- Paper 저장/수정/삭제
- Member 논문 추가 가능
- Viewer 읽기 전용
- Owner Knowledge 저장/수정/삭제
- Review Queue
- User Access role 변경
- 검색/자동 연결 그래프
- Disease-specific notes
- Pathway 표시
- Visibility/status badge

## 나중에 추가하면 좋은 것

- `terms` 테이블 기반 canonical name / alias 관리
- Lung / lung tissue / 폐 조직 자동 통합
- OpenAI API를 통한 논문 JSON 자동 정리
- Paper note를 논문별 owner memo로 분리
- 초대 이메일 발송 자동화
