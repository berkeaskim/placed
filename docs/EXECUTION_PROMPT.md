Placed adlı hackathon uygulamasını, hazır olan implementation plan'a göre baştan sona inşa edeceksin.

## Bağlam
- Çalışma klasörü: `~/Repository/ucl-hackathon` (git repo). DİKKAT: `~/Repository/UCL_hackathon` adında boş bir klasör daha var; orayı kullanma.
- Sahibi Berke (UCL öğrencisi). Takım sadece Berke ve sen. Teslim: **Cuma 2026-10-16**. Berke ile Türkçe konuş; uygulamanın arayüzü ve kodu İngilizce.
- Şu dosyaları bu sırayla, eksiksiz oku:
  1. `docs/superpowers/specs/2026-10-13-placed-design.md`: onaylı spec.
  2. `docs/superpowers/plans/2026-10-13-placed.md`: 25 görevlik plan; Global Constraints ve Review Focus bölümleri her görev için geçerli.
  3. `docs/design/chosen-direction.dc.html`: seçilen arayüz tasarımı (renkler, fontlar, butonlar). Tüm UI görevleri buna uymalı.
  4. `docs/research/*.md`: career-ops çıkarımı ve kaynaklı CV kuralları. Görevler bu dosyalara referans veriyor.

## Nasıl çalışacaksın
- `superpowers:subagent-driven-development` skill'ini çağır ve ona harfiyen uy. Her görevi taze bir alt-ajan uygular, ardından taze bir reviewer görevi kontrol eder. Bir görev review'dan geçmeden bir sonrakine geçme. En sonda bütün branch'i review et.
- İşe başlamadan önce `superpowers:using-git-worktrees` ile bir feature branch veya worktree aç (ör. `feat/placed-build`). `main` üzerinde çalışma.
- Görevleri plandaki sırayla yap (1 → 25). Görevlerin birbirine verdiği arayüzler planda "Interfaces" bloklarında yazıyor. İsimleri ve tipleri birebir koru.
- TDD uygula: önce failing test, sonra kod. Her görev kendi commit'iyle biter. Commit mesajları şu satırla bitsin:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Planda bir hata bulursan (test ile kod çelişiyor, bir API değişmiş vb.) testin amacını koru ve kodu düzelt. Düzeltmeyi plana not olarak ekle ve bana raporla. Testi gevşeterek geçirme.

## Asla kesilmeyecekler
- CV Score'un kaynakları (citation'lar).
- Tailoring şeffaflığı: neye göre tailor edildi, ne değişti, neden.
- `verifyTailoring` (uydurma kontrolü).

Zaman daralırsa önce rozet animasyonlarını, sonra kanban'daki sürükle-bırakı (dropdown kalır), sonra quiz derinliğini kes. Bunu yapmadan önce Berke'ye sor.

## Berke'nin yapması gerekenler (bu adımlarda dur ve sor)
- **Görev 2:** Berke Supabase'de projeyi oluşturup URL ve anahtarları `.env.local`'a koyacak. Supabase MCP ile proje oluşturmak maliyet onayı gerektirir; Berke'nin açık onayı olmadan yapma. Migration'ı uygulamak için MCP `apply_migration` kullanabilirsin.
- **Görev 3:** Supabase'de redirect URL'lerinin eklenmesi. Google provider opsiyonel.
- **API anahtarı:** Henüz yok. Anthropic mi Gemini mi kullanılacağı belli değil (`AI_PROVIDER`). Anahtar gelene kadar her şey fixture/heuristic modunda çalışmalı. Anahtar istemek için işi bekletme.
- **Görev 25:** Vercel env değişkenleri ve deploy. Production'a deploy etmeden önce sor.
- Gerçek kişisel veri kullanma; demo personası kurgusal (Ayşe Demir). Uygulama hiçbir zaman öğrenci adına başvuru göndermez.

## Planlama sırasında fark edilen tuzaklar
- Next 16'da `middleware.ts` yerine `proxy.ts` kullanılıyor. Dev server uyarı verirse planda yazan yedek yönteme geç.
- `@google/genai`'de structured output alanı (`responseJsonSchema` ve `responseFormat`) sürüme göre değişebilir. `npm run typecheck` ile doğrula.
- Bazı Greenhouse şirketleri `boards-api.eu.greenhouse.io` üzerinde. Ashby slug'larında büyük/küçük harf önemli. `npm run validate-slugs` bunları çözer.
- `server-only` paketi tsx script'lerinde patlar. Script'ler `lib/supabase/admin.ts`'i değil `scripts/db.ts`'i kullanmalı.
- Görev 16 (161 kuralın aktarımı) en uzun görev. Üç parçada yap (genel → finans/consulting → tech/product) ve her parçadan sonra testi çalıştır.

## Raporlama
Her görev review'dan geçtiğinde bana tek satır yaz: görev no, ne yapıldı, test sonucu. Şu anlarda dur ve haber ver:
- Faz sonları: 10, 12, 19, 24 ve 25. görevlerden sonra. O fazın elle doğrulama adımlarının sonucunu da yaz.
- Bir test kalıcı olarak kırıldığında, ya da planla kodun çelişip bir karar gerektiği yerde.

Başlarken önce oku, sonra branch'i aç, sonra Görev 1'i alt-ajana ver.
