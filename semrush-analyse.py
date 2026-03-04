"""
Analyse concurrentielle Semrush - Riads Marrakech
Automatise Semrush via Playwright pour analyser le marché SEO des riads à Marrakech
"""

import asyncio
import json
import os
import time
from datetime import datetime
from playwright.async_api import async_playwright

OUTPUT_DIR = "/Users/c4b/Desktop/casbah-amor-site/semrush-data"
SCREENSHOTS_DIR = f"{OUTPUT_DIR}/screenshots"

# Mots-clés à analyser
KEYWORDS = [
    "riad marrakech",
    "riad marrakech avec piscine",
    "riad marrakech pas cher",
    "riad de luxe marrakech",
    "riad marrakech medina",
    "meilleur riad marrakech",
    "riad marrakech booking",
    "location riad marrakech",
    "riad privatif marrakech",
    "riad marrakech rooftop",
    "riad marrakech famille",
    "week end riad marrakech",
    "riad marrakech spa",
    "hotel riad marrakech",
    "airbnb riad marrakech",
]

# Domaines concurrents à analyser
COMPETITOR_DOMAINS = [
    "riad-yasmine.com",
    "riadkniza.com",
    "riad-jardin-secret.com",
    "riadfarnatchi.com",
    "riadlaaroussa.com",
    "lamamounia.com",
    "royalmansour.com",
    "riadgoloboy.com",
    "riad-72.com",
    "dardarma.com",
]


async def setup_dirs():
    os.makedirs(SCREENSHOTS_DIR, exist_ok=True)


async def wait_for_semrush_login(page):
    """Navigue vers Semrush et attend que l'utilisateur soit connecté"""
    print("\n🔑 Navigation vers Semrush...")
    await page.goto("https://www.semrush.com/analytics/overview/", wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(3)

    # Vérifier si déjà connecté
    if "login" in page.url.lower() or "sso" in page.url.lower():
        print("\n⚠️  Tu n'es pas connecté à Semrush dans ce navigateur.")
        print("👉 Connecte-toi manuellement dans la fenêtre qui s'est ouverte.")
        print("⏳ J'attends que tu sois connecté (max 120 secondes)...\n")

        for i in range(120):
            await asyncio.sleep(1)
            current_url = page.url
            if "login" not in current_url.lower() and "sso" not in current_url.lower():
                print("✅ Connexion détectée !")
                await asyncio.sleep(2)
                return True

        print("❌ Timeout - pas de connexion détectée après 120s")
        return False

    print("✅ Déjà connecté à Semrush !")
    return True


async def keyword_overview(page, keyword, index):
    """Analyse un mot-clé via Keyword Overview"""
    print(f"\n📊 [{index+1}/{len(KEYWORDS)}] Analyse mot-clé : '{keyword}'")

    encoded = keyword.replace(" ", "+")
    url = f"https://www.semrush.com/analytics/keywordoverview/?q={encoded}&db=fr"
    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(4)

    # Screenshot
    safe_name = keyword.replace(" ", "_")
    await page.screenshot(
        path=f"{SCREENSHOTS_DIR}/kw_{safe_name}.png",
        full_page=False
    )

    # Extraire les données visibles
    data = await page.evaluate("""() => {
        const getText = (sel) => {
            const el = document.querySelector(sel);
            return el ? el.innerText.trim() : null;
        };

        const getAllText = (sel) => {
            return Array.from(document.querySelectorAll(sel)).map(el => el.innerText.trim());
        };

        // Essayer de récupérer les métriques principales
        const allText = document.body.innerText;

        return {
            pageTitle: document.title,
            url: window.location.href,
            bodyText: allText.substring(0, 8000),
        };
    }""")

    return {
        "keyword": keyword,
        "url": data["url"],
        "raw_text": data["bodyText"],
        "screenshot": f"kw_{safe_name}.png"
    }


async def keyword_magic_tool(page, seed_keyword):
    """Utilise le Keyword Magic Tool pour trouver des opportunités"""
    print(f"\n🪄 Keyword Magic Tool : '{seed_keyword}'")

    encoded = seed_keyword.replace(" ", "+")
    url = f"https://www.semrush.com/analytics/keywordmagic/?q={encoded}&db=fr"
    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(5)

    await page.screenshot(
        path=f"{SCREENSHOTS_DIR}/magic_riad_marrakech.png",
        full_page=False
    )

    # Essayer de cliquer sur "Volume" pour trier par volume décroissant
    try:
        volume_header = page.locator("text=Volume").first
        if await volume_header.is_visible(timeout=3000):
            await volume_header.click()
            await asyncio.sleep(2)
            await page.screenshot(
                path=f"{SCREENSHOTS_DIR}/magic_riad_marrakech_sorted.png",
                full_page=False
            )
    except:
        pass

    # Extraire le tableau de mots-clés
    data = await page.evaluate("""() => {
        const rows = document.querySelectorAll('table tbody tr');
        const keywords = [];
        rows.forEach((row, i) => {
            if (i < 50) {
                const cells = row.querySelectorAll('td');
                const texts = Array.from(cells).map(c => c.innerText.trim());
                if (texts.length > 0) keywords.push(texts);
            }
        });
        return {
            keywordCount: rows.length,
            keywords: keywords,
            bodyText: document.body.innerText.substring(0, 10000)
        };
    }""")

    return data


async def organic_research(page, domain, index, total):
    """Analyse organique d'un domaine concurrent"""
    print(f"\n🔍 [{index+1}/{total}] Analyse domaine : {domain}")

    url = f"https://www.semrush.com/analytics/organic/overview/?db=fr&q={domain}"
    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(4)

    safe_name = domain.replace(".", "_")
    await page.screenshot(
        path=f"{SCREENSHOTS_DIR}/domain_{safe_name}.png",
        full_page=False
    )

    # Extraire les données
    data = await page.evaluate("""() => {
        return {
            pageTitle: document.title,
            url: window.location.href,
            bodyText: document.body.innerText.substring(0, 8000),
        };
    }""")

    return {
        "domain": domain,
        "raw_text": data["bodyText"],
        "screenshot": f"domain_{safe_name}.png"
    }


async def organic_positions(page, domain):
    """Récupère les positions organiques d'un domaine"""
    print(f"   📍 Positions organiques : {domain}")

    url = f"https://www.semrush.com/analytics/organic/positions/?db=fr&q={domain}"
    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(4)

    safe_name = domain.replace(".", "_")
    await page.screenshot(
        path=f"{SCREENSHOTS_DIR}/positions_{safe_name}.png",
        full_page=False
    )

    data = await page.evaluate("""() => {
        const rows = document.querySelectorAll('table tbody tr');
        const positions = [];
        rows.forEach((row, i) => {
            if (i < 30) {
                const cells = row.querySelectorAll('td');
                const texts = Array.from(cells).map(c => c.innerText.trim());
                if (texts.length > 0) positions.push(texts);
            }
        });
        return {
            positionCount: rows.length,
            positions: positions,
            bodyText: document.body.innerText.substring(0, 6000)
        };
    }""")

    return {
        "domain": domain,
        "positions": data["positions"],
        "count": data["positionCount"],
        "raw_text": data["bodyText"]
    }


async def backlink_overview(page, domain, index, total):
    """Analyse des backlinks d'un concurrent"""
    print(f"\n🔗 [{index+1}/{total}] Backlinks : {domain}")

    url = f"https://www.semrush.com/analytics/backlinks/overview/?q={domain}"
    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(4)

    safe_name = domain.replace(".", "_")
    await page.screenshot(
        path=f"{SCREENSHOTS_DIR}/backlinks_{safe_name}.png",
        full_page=False
    )

    data = await page.evaluate("""() => {
        return {
            bodyText: document.body.innerText.substring(0, 5000),
        };
    }""")

    return {
        "domain": domain,
        "raw_text": data["bodyText"],
        "screenshot": f"backlinks_{safe_name}.png"
    }


async def keyword_gap(page, domains):
    """Analyse le gap de mots-clés entre concurrents"""
    print(f"\n🔀 Keyword Gap Analysis...")

    # Prendre les 5 premiers domaines pour le gap
    gap_domains = domains[:5]
    params = "&".join([f"domains[]={d}" for d in gap_domains])
    url = f"https://www.semrush.com/analytics/keywordgap/?db=fr&{params}"
    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(5)

    await page.screenshot(
        path=f"{SCREENSHOTS_DIR}/keyword_gap.png",
        full_page=False
    )

    data = await page.evaluate("""() => {
        return {
            bodyText: document.body.innerText.substring(0, 10000),
        };
    }""")

    return data


async def serp_analysis(page, keyword):
    """Analyse la SERP pour un mot-clé donné"""
    print(f"\n🏆 Analyse SERP : '{keyword}'")

    encoded = keyword.replace(" ", "+")
    # Utiliser l'outil Organic Research > Competitors pour voir qui rank
    url = f"https://www.semrush.com/analytics/keywordoverview/?q={encoded}&db=fr"
    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(4)

    # Scroll vers le bas pour voir les résultats SERP
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
    await asyncio.sleep(2)

    await page.screenshot(
        path=f"{SCREENSHOTS_DIR}/serp_{keyword.replace(' ', '_')}.png",
        full_page=True
    )

    data = await page.evaluate("""() => {
        return {
            bodyText: document.body.innerText.substring(0, 12000),
        };
    }""")

    return {
        "keyword": keyword,
        "raw_text": data["bodyText"]
    }


async def traffic_analytics(page, domain, index, total):
    """Traffic Analytics pour un domaine (si disponible dans le plan)"""
    print(f"\n📈 [{index+1}/{total}] Traffic Analytics : {domain}")

    url = f"https://www.semrush.com/analytics/traffic/overview/?q={domain}"
    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(4)

    safe_name = domain.replace(".", "_")
    await page.screenshot(
        path=f"{SCREENSHOTS_DIR}/traffic_{safe_name}.png",
        full_page=False
    )

    data = await page.evaluate("""() => {
        return {
            bodyText: document.body.innerText.substring(0, 5000),
        };
    }""")

    return {
        "domain": domain,
        "raw_text": data["bodyText"]
    }


async def main():
    print("=" * 60)
    print("🏛️  ANALYSE CONCURRENTIELLE SEMRUSH - RIADS MARRAKECH")
    print(f"📅 {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print("=" * 60)

    await setup_dirs()

    all_data = {
        "date": datetime.now().isoformat(),
        "target": "Casbah Amor - Riad Marrakech",
        "keywords": [],
        "magic_tool": None,
        "competitors": [],
        "backlinks": [],
        "keyword_gap": None,
        "serp": [],
        "traffic": [],
    }

    async with async_playwright() as p:
        # Lancer le navigateur avec contexte persistant (garde les cookies)
        context = await p.chromium.launch_persistent_context(
            user_data_dir=f"{OUTPUT_DIR}/.browser-data",
            headless=False,
            viewport={"width": 1440, "height": 900},
            args=["--start-maximized"],
        )

        page = context.pages[0] if context.pages else await context.new_page()

        # 1. LOGIN SEMRUSH
        logged_in = await wait_for_semrush_login(page)
        if not logged_in:
            await context.close()
            return

        # =============================================
        # PHASE 1 : ANALYSE DES MOTS-CLÉS
        # =============================================
        print("\n" + "=" * 60)
        print("📊 PHASE 1 : ANALYSE DES MOTS-CLÉS")
        print("=" * 60)

        for i, kw in enumerate(KEYWORDS):
            try:
                result = await keyword_overview(page, kw, i)
                all_data["keywords"].append(result)
                await asyncio.sleep(2)  # Éviter le rate limiting
            except Exception as e:
                print(f"   ⚠️ Erreur sur '{kw}': {e}")

        # =============================================
        # PHASE 2 : KEYWORD MAGIC TOOL
        # =============================================
        print("\n" + "=" * 60)
        print("🪄 PHASE 2 : KEYWORD MAGIC TOOL")
        print("=" * 60)

        try:
            magic_data = await keyword_magic_tool(page, "riad marrakech")
            all_data["magic_tool"] = magic_data
        except Exception as e:
            print(f"   ⚠️ Erreur Magic Tool: {e}")

        # =============================================
        # PHASE 3 : ANALYSE DES CONCURRENTS (DOMAINES)
        # =============================================
        print("\n" + "=" * 60)
        print("🔍 PHASE 3 : ANALYSE DES DOMAINES CONCURRENTS")
        print("=" * 60)

        total = len(COMPETITOR_DOMAINS)
        for i, domain in enumerate(COMPETITOR_DOMAINS):
            try:
                # Overview organique
                overview = await organic_research(page, domain, i, total)
                await asyncio.sleep(1)

                # Positions organiques
                positions = await organic_positions(page, domain)
                await asyncio.sleep(1)

                all_data["competitors"].append({
                    "domain": domain,
                    "overview": overview,
                    "positions": positions
                })
                await asyncio.sleep(1)
            except Exception as e:
                print(f"   ⚠️ Erreur sur '{domain}': {e}")

        # =============================================
        # PHASE 4 : BACKLINKS DES CONCURRENTS
        # =============================================
        print("\n" + "=" * 60)
        print("🔗 PHASE 4 : ANALYSE DES BACKLINKS")
        print("=" * 60)

        for i, domain in enumerate(COMPETITOR_DOMAINS):
            try:
                bl_data = await backlink_overview(page, domain, i, total)
                all_data["backlinks"].append(bl_data)
                await asyncio.sleep(2)
            except Exception as e:
                print(f"   ⚠️ Erreur backlinks '{domain}': {e}")

        # =============================================
        # PHASE 5 : KEYWORD GAP
        # =============================================
        print("\n" + "=" * 60)
        print("🔀 PHASE 5 : KEYWORD GAP ANALYSIS")
        print("=" * 60)

        try:
            gap_data = await keyword_gap(page, COMPETITOR_DOMAINS)
            all_data["keyword_gap"] = gap_data
        except Exception as e:
            print(f"   ⚠️ Erreur Keyword Gap: {e}")

        # =============================================
        # PHASE 6 : ANALYSE SERP (top 3 keywords)
        # =============================================
        print("\n" + "=" * 60)
        print("🏆 PHASE 6 : ANALYSE SERP DÉTAILLÉE")
        print("=" * 60)

        top_keywords = ["riad marrakech", "riad marrakech avec piscine", "riad de luxe marrakech"]
        for kw in top_keywords:
            try:
                serp_data = await serp_analysis(page, kw)
                all_data["serp"].append(serp_data)
                await asyncio.sleep(2)
            except Exception as e:
                print(f"   ⚠️ Erreur SERP '{kw}': {e}")

        # =============================================
        # PHASE 7 : TRAFFIC ANALYTICS (top 5 concurrents)
        # =============================================
        print("\n" + "=" * 60)
        print("📈 PHASE 7 : TRAFFIC ANALYTICS")
        print("=" * 60)

        top_competitors = COMPETITOR_DOMAINS[:5]
        for i, domain in enumerate(top_competitors):
            try:
                traffic = await traffic_analytics(page, domain, i, len(top_competitors))
                all_data["traffic"].append(traffic)
                await asyncio.sleep(2)
            except Exception as e:
                print(f"   ⚠️ Erreur traffic '{domain}': {e}")

        # Sauvegarder les données brutes
        with open(f"{OUTPUT_DIR}/semrush_raw_data.json", "w", encoding="utf-8") as f:
            json.dump(all_data, f, ensure_ascii=False, indent=2)

        print("\n" + "=" * 60)
        print("✅ ANALYSE TERMINÉE !")
        print(f"📁 Données sauvegardées dans : {OUTPUT_DIR}")
        print(f"📸 {len(os.listdir(SCREENSHOTS_DIR))} screenshots capturés")
        print(f"📊 {len(all_data['keywords'])} mots-clés analysés")
        print(f"🏢 {len(all_data['competitors'])} concurrents analysés")
        print("=" * 60)

        # Garder le navigateur ouvert 5 secondes pour vérification
        await asyncio.sleep(5)
        await context.close()


if __name__ == "__main__":
    asyncio.run(main())
