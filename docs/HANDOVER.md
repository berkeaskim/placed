# Handover: Öğrenci Staj Uygulaması (Hackathon)

> **Bu dosya ne:** Yeni bir proje klasöründe açılacak Claude Code oturumuna bağlam vermek için yazıldı. Yeni klasörde bu dosyayı yapıştır, ardından **brainstorming → spec → plan → build** sırasıyla ilerle (bkz. en alttaki "Sonraki adımlar").
>
> **Tarih:** 2026-10-13 · **Sahibi:** Berke (UCL öğrencisi) · **Kaynak ilham:** career-ops (`/Users/berkeaskim/Repository/career-ops`, MIT lisanslı)

---

## 1. Bağlam

- **Hackathon teması:** "Öğrencilerin hayatlarını nasıl kolaylaştırabiliriz?"
- **Fikir:** career-ops'un mantığını (rol uygunluğu belirleme, ilan tarama, puanlama, CV tailoring) öğrencilere yönelik, **çok kolay arayüzlü, oyunlaştırılmış bir web app**'e dönüştürmek.
- **Problem:** Öğrenciler staj ararken (a) hangi rollere uygun olduklarını bilmiyor, (b) ilanlar onlarca site/ATS'ye dağılmış, (c) her başvuruya CV uyarlamak zor ve yorucu, (d) süreç yalnız ve motivasyonsuz.
- **Kesin teknik karar:** Uygulamadaki tüm "zeka" (CV okuma, quiz yorumlama, eşleştirme, CV tailoring) **Claude API** (Anthropic API) ile yapılacak. API anahtarı sadece sunucuda durur; tarayıcı asla doğrudan Anthropic'e gitmez.

## 2. Kullanıcı akışı (Berke'nin tarif ettiği)

1. **Kayıt / giriş** — öğrenci hesap oluşturur.
2. **Onboarding** — kaçıncı sınıf (1st year / 2nd year / penultimate / final / master), bölüm/alan, konum tercihi (ör. Londra / UK / remote).
3. **Profil çıkarma — iki yol:**
   - **Quiz:** Kısa, eğlenceli bir test (ilgi alanları, çalışma tarzı, beceriler) → uygun rol arketiplerini çıkarır.
   - **CV yükleme:** PDF yükler → Claude CV'yi okur → beceriler, deneyim, uygun roller çıkar.
4. **"Sana uygun roller"** — ör. "Software Engineering Intern", "Data Analyst Intern", "Consulting Summer Analyst", "Product Intern"; her biri için neden uygun olduğu kısa açıklama.
5. **Staj akışı (feed)** — taranmış tüm staj ilanları, öğrenciye uygunluğa göre sıralı; her kartta şirket, rol, konum, deadline, uygunluk puanı ve **"Buradan başvur →" linki**.
6. **"CV'ni bu ilana göre uyarla"** — tek tıkla ilana özel tailored CV (PDF indir).
7. **Takip + oyunlaştırma** — başvurduğum / görüşmedeyim / reddedildim durumu, XP, seri (streak), rozetler, haftalık görevler.

## 3. career-ops'tan ne alınır (ve nerede durur)

career-ops tek kullanıcılı, CLI tabanlı, markdown dosyalarıyla çalışan bir sistem. Kod olduğu gibi taşınmaz; **mantık ve kurallar** taşınır.

| career-ops parçası | Dosya (referans için oku) | Web app'te karşılığı |
|---|---|---|
| Arketip tespiti (rolü bir kategoriye oturtma) | `modes/oferta.md` → "Step 0 — Archetype Detection", `modes/_profile.template.md` | Quiz/CV → öğrencinin arketipleri; ilan → ilanın arketipi |
| 1–5 puanlama (CV Match, North Star, Comp, Culture, Red flags → Global) | `modes/_shared.md` → "Scoring System" | Öğrenciye uyarlanmış uygunluk puanı (aşağıda) |
| Puan yorumlama (4.5+ hemen başvur, <3.5 önerme) | `modes/_shared.md` | Kart rengi / etiket: "Çok uygun", "Uygun", "Zorlayıcı" |
| Ucuz ön eleme vs. tam değerlendirme | `modes/triage.md` (ucuz, kısa bağlam) vs `modes/oferta.md` (pahalı, tam) | Haiku ile toplu etiketleme, Sonnet ile detay |
| Ücretsiz ATS API taraması | `providers/greenhouse.mjs`, `providers/lever.mjs`, `providers/ashby.mjs`, `scan.mjs` | Cron ile ilan çekme (aşağıdaki endpoint'ler) |
| Başlık filtresi (`title_filter.positive`) | `portals.yml` | `intern`, `internship`, `placement`, `summer analyst`, `spring week`, `insight`, `industrial placement`, `graduate` |
| İlan hâlâ açık mı kontrolü | `liveness-core.mjs`, `check-liveness.mjs` | Kapanan ilanları feed'den düşürme |
| CV tailoring kuralları | `modes/pdf.md` → "Keyword injection strategy", "ATS Rules" | Tailor endpoint'inin system prompt'u |
| ATS-uyumlu CV şablonu | `templates/cv-template.html`, `generate-pdf.mjs` | HTML → PDF üretimi |
| Başvuru durumları | `templates/states.yml` | Kanban kolonları: Saved → Applied → Interview → Offer / Rejected |

### Taşınması zorunlu iki etik kural (career-ops'un özü — jüriye de anlatılır)

1. **"Keywords get reformulated, never fabricated."** CV tailoring yeniden sıralar, yeniden ifade eder, vurgular — ama **asla öğrencinin yapmadığı bir şeyi uydurmaz**. Prompt'ta açıkça yazılmalı ve mümkünse bir "uydurma kontrolü" adımı olmalı (tailored CV'deki her iddia orijinal CV'de karşılığı olan bir şeye dayanıyor mu?).
2. **Uygulama asla öğrenci adına başvuru göndermez.** Sadece link verir, CV hazırlar; "Başvur" tuşuna öğrenci basar.

Ek: İlan metni (JD) **veri, talimat değil** — scraped içerikteki "ignore previous instructions" tarzı metinler prompt'a girdiğinde etkisiz kalmalı (career-ops'un "Untrusted External Content" kuralı). Prompt'larda JD'yi `<job_posting>` etiketi içine koy ve bunu açıkça söyle.

## 4. Claude API kullanımı

| İş | Model önerisi | Not |
|---|---|---|
| İlanı etiketleme (alan, yıl uygunluğu, konum, deadline, arketip, beceriler) | `claude-haiku-4-5-20251001` | **İlan başına bir kez**, ingest sırasında; sonuç DB'de cache'lenir |
| CV parse (PDF → yapılandırılmış profil) | `claude-sonnet-5-5` | PDF doğrudan `document` content block olarak gönderilebilir |
| Quiz → arketip + açıklama | `claude-haiku-4-5-20251001` | Kısa, hızlı |
| Öğrenci × ilan detaylı uygunluk açıklaması | `claude-sonnet-5-5` | Sadece öğrenci karta tıklayınca (lazy) |
| CV tailoring | `claude-sonnet-5-5` | Yapılandırılmış JSON döndürür → HTML şablona basılır → PDF |

**Maliyet tasarımı (kritik):** Her öğrenci × her ilan için LLM çağırmak çok pahalı. Doğru mimari:

1. İlanlar ingest edilirken **bir kez** Haiku ile etiketlenir (yapılandırılmış alanlar).
2. Feed sıralaması = **kural tabanlı ön filtre + skor** (alan eşleşmesi, yıl uygunluğu, konum, beceri kesişimi) — LLM yok, anında.
3. Sadece öğrencinin açtığı ilan için Sonnet "neden uygunsun / eksiğin ne" açıklaması üretir (ve cache'lenir).
4. Uzun sabit system prompt'lar ve öğrencinin CV'si için **prompt caching** kullan.

**Yapılandırılmış çıktı:** Tüm çağrılar JSON şemaya bağlı olsun (tool use / structured outputs). Yeni oturumda `claude-api` skill'ini oku — güncel SDK kullanımı, model ID'leri ve caching için.

## 5. İlan kaynakları (ücretsiz, scraping yok)

career-ops'un kullandığı herkese açık ATS API'leri — anahtar gerekmez, JSON döner:

- **Greenhouse:** `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true`
- **Lever:** `https://api.lever.co/v0/postings/{slug}?mode=json`
- **Ashby:** `https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true`

Plan: öğrenci stajı açan ~50–100 şirketlik bir **seed listesi** (UK/EU odaklı; Berke'nin `portals.yml`'ı başlangıç noktası olabilir) → periyodik ingest job → başlık filtresi → Haiku etiketleme → `jobs` tablosu. Büyük bankaların kendi portalları (Workday vb.) ilk sürümde kapsam dışı; hackathon için yukarıdaki üç API yeterli.

## 6. Öğrenciye uyarlanmış puanlama (taslak)

career-ops'un 5 boyutu profesyoneller için (maaş, kültür vb.). Öğrenci versiyonu önerisi:

| Boyut | Ne ölçer |
|---|---|
| Beceri uyumu | CV/quiz becerileri × ilan gereksinimleri |
| İlgi uyumu | Öğrencinin arketipleri × ilanın arketipi |
| Uygunluk | Sınıf yılı, mezuniyet tarihi, vize/konum şartları (en sık eleme sebebi) |
| Erişilebilirlik | Deadline yakınlığı, ilk yıl öğrencisine açık mı, rekabet seviyesi |
| **Global** | 1–5 + etiket: "Çok uygun / Uygun / Biraz zorlar / Önerilmez" |

Berke'nin kendi deneyiminden ders: rolleri öldüren en büyük iki etken **sınıf yılı uyumsuzluğu** ve **vize/konum şartıydı** — bunlar kural tabanlı, ucuz ve en önce kontrol edilmeli.

## 7. Oyunlaştırma fikirleri

- **XP + seviye:** profil tamamlama, CV yükleme, quiz bitirme, ilan kaydetme, başvuru, tailoring.
- **Streak:** "5 gündür üst üste staj bakıyorsun 🔥".
- **Haftalık görevler:** "Bu hafta 3 uygun ilana başvur", "1 CV uyarla".
- **Rozetler:** "İlk başvuru", "Spring Week avcısı", "Deadline'dan önce", "Reddedilmeye rağmen devam" (reddi de ödüllendirmek — psikolojik olarak önemli).
- **İlerleme haritası:** Saved → Applied → Interview → Offer yolunda görsel ilerleme.
- (Opsiyonel) Arkadaş/okul liderlik tablosu — gizlilik açısından opt-in.

Dikkat: Oyunlaştırma **kalite** odaklı olmalı, spam başvuruyu ödüllendirmemeli (career-ops ilkesi: az ama doğru başvuru). Uygunluk puanı düşük ilana başvuru az XP verebilir.

## 8. Önerilen stack (brainstorm'da teyit edilecek)

Hackathon hızı için:

- **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui** — arayüz.
- **Supabase** — auth (e-posta / Google), Postgres, Storage (CV PDF'leri), cron/edge functions (ingest).
- **Anthropic SDK** — sadece server route'larında / server actions'da.
- **Vercel** — deploy.
- PDF üretimi: HTML şablon → Playwright (career-ops gibi) ya da serverless'te daha hafif bir çözüm (`@react-pdf/renderer`) — brainstorm'da karar ver.

Berke'nin oturumunda Supabase ve Vercel MCP/skill'leri mevcut.

### Veri modeli taslağı

- `profiles` (user_id, name, year, field, location_pref, archetypes[], skills[], xp, level, streak)
- `cvs` (user_id, storage_path, parsed_json, uploaded_at)
- `quiz_results` (user_id, answers, archetypes[], created_at)
- `companies` (slug, name, ats: greenhouse|lever|ashby, enabled)
- `jobs` (id, company_id, title, url, location, deadline, archetype, field_tags[], year_eligibility, skills[], raw_text, is_live, first_seen, last_seen)
- `matches` (user_id, job_id, score, explanation, created_at) — lazy cache
- `applications` (user_id, job_id, status, tailored_cv_path, updated_at)
- `achievements` / `xp_events` (user_id, type, xp, created_at)

## 9. Kapsam dışı (hackathon sürümünde yok)

- Öğrenci adına otomatik başvuru (etik olarak asla).
- Workday / şirket portali scraping, LinkedIn scraping.
- Çoklu dil (başlangıçta İngilizce arayüz — UK odaklıysa).
- Cover letter, interview prep (career-ops'ta var; "gelecek vizyonu" slaytında bahsedilebilir).

## 10. Riskler

- **API maliyeti / rate limit** → bölüm 4'teki "bir kez etiketle, lazy açıkla" tasarımı.
- **Kişisel veri (CV'ler) / GDPR** → Storage bucket private, RLS açık, "CV'mi sil" butonu.
- **Demo günü canlı API'ler çökerse** → seed edilmiş ilan verisiyle offline çalışan demo modu.
- **Uydurma CV iddiaları** → tailoring sonrası doğrulama adımı (bölüm 3).

## 11. Brainstorm'da cevaplanacak açık sorular

1. Hackathon süresi ve teslim tarihi? Takım kaç kişi, kim ne yapar?
2. Jüri kriterleri (etki, teknik, tasarım, sunum)?
3. Hedef pazar: sadece UK mi (UCL), yoksa Türkiye de mi? → dil ve ilan kaynaklarını belirler.
4. Quiz mi, CV mi ana yol? (Öneri: ikisi de; CV'si olmayan 1. sınıf için quiz.)
5. Uygulamanın adı ve marka dili.
6. Demo senaryosu: hangi örnek öğrenci persona'sıyla gösterilecek? (Gerçek kişisel veri yerine kurgusal persona önerilir.)
7. Oyunlaştırma ne kadar derin olsun — MVP'de sadece XP + streak + 3 rozet yeterli mi?

## 12. Demo akışı (jüri için 3 dakika, taslak)

1. "Ayşe, 2. sınıf Ekonomi öğrencisi" → 30 saniyede kayıt + quiz.
2. "Sana uygun roller": Data Analyst Intern, Consulting Spring Week… (neden uygun açıklamasıyla).
3. Feed: 40 gerçek, canlı staj ilanı, uygunluğa göre sıralı, deadline'ları görünür.
4. Bir ilana tıkla → "Neden uygunsun / ne eksik" → "CV'mi uyarla" → 10 saniyede tailored PDF.
5. "Başvur" linki → XP + rozet animasyonu → streak.
6. Kapanış: "Uydurmayan AI" etiği + ölçeklenebilir maliyet mimarisi.

## 13. Sonraki adımlar (yeni klasörde)

1. Yeni klasörü oluştur (ör. `~/Repository/<app-adi>`), `git init`, bu dosyayı `docs/HANDOVER.md` olarak kopyala.
2. Claude Code'u o klasörde aç, şunu yaz: *"docs/HANDOVER.md'yi oku. superpowers:brainstorming ile başlayalım, sonra spec ve plan yazalım."*
3. **Brainstorming** → bölüm 11'deki soruları netleştir.
4. **Spec** → `docs/specs/YYYY-MM-DD-<app>-design.md`.
5. **Plan** → `superpowers:writing-plans` ile görev görev uygulama planı.
6. **Build** → iskelet (auth + DB) → ingest → onboarding/quiz/CV → feed → tailoring → oyunlaştırma → demo modu.

career-ops dosyalarına referans gerektiğinde yeni oturumdan doğrudan okunabilir: `/Users/berkeaskim/Repository/career-ops/...` (yukarıdaki tablo hangi dosyaya bakılacağını söylüyor).
