"""
Analyse concurrentielle Semrush - Riads Marrakech
Contrôle Safari via AppleScript (session Semrush existante)
Extrait le HTML source de chaque page pour parser les données
"""

import subprocess
import time
import os
import json
import re
from datetime import datetime
from html.parser import HTMLParser

OUTPUT_DIR = "/Users/c4b/Desktop/casbah-amor-site/semrush-data"
SCREENSHOTS_DIR = f"{OUTPUT_DIR}/screenshots"
HTML_DIR = f"{OUTPUT_DIR}/html"
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
os.makedirs(HTML_DIR, exist_ok=True)

# =============================================
# SAFARI CONTROL
# =============================================

def safari_navigate(url):
    """Navigate Safari to URL"""
    script = f'''tell application "Safari"
        activate
        tell window 1
            set URL of current tab to "{url}"
        end tell
    end tell'''
    subprocess.run(["osascript", "-e", script], capture_output=True, text=True)


def safari_get_url():
    """Get current URL from Safari"""
    result = subprocess.run(
        ["osascript", "-e", 'tell application "Safari" to return URL of current tab of window 1'],
        capture_output=True, text=True
    )
    return result.stdout.strip()


def safari_get_title():
    """Get page title from Safari"""
    result = subprocess.run(
        ["osascript", "-e", 'tell application "Safari" to return name of current tab of window 1'],
        capture_output=True, text=True
    )
    return result.stdout.strip()


def safari_get_source():
    """Get full HTML source from Safari"""
    result = subprocess.run(
        ["osascript", "-e", 'tell application "Safari" to return source of document 1'],
        capture_output=True, text=True, timeout=30
    )
    return result.stdout


def safari_screenshot(filename):
    """Capture screen (Safari should be frontmost)"""
    subprocess.run(
        ["osascript", "-e", 'tell application "Safari" to activate'],
        capture_output=True
    )
    time.sleep(0.3)
    subprocess.run(
        ["screencapture", "-x", f"{SCREENSHOTS_DIR}/{filename}.png"],
        capture_output=True
    )


def navigate_wait_extract(url, name, wait=6):
    """Navigate, wait, get source + screenshot"""
    print(f"  📍 {name}...")
    safari_navigate(url)
    time.sleep(wait)

    title = safari_get_title()
    source = safari_get_source()
    safari_screenshot(name)

    # Save HTML
    with open(f"{HTML_DIR}/{name}.html", "w", encoding="utf-8") as f:
        f.write(source)

    print(f"     ✅ {title[:60]}... ({len(source)} chars)")
    return {"title": title, "source": source, "url": url}


# =============================================
# HTML PARSING HELPERS
# =============================================

def extract_text_from_html(html):
    """Strip HTML tags and return text"""
    clean = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
    clean = re.sub(r'<style[^>]*>.*?</style>', '', clean, flags=re.DOTALL)
    clean = re.sub(r'<[^>]+>', ' ', clean)
    clean = re.sub(r'\s+', ' ', clean)
    return clean.strip()


def find_metrics_in_text(text):
    """Find common Semrush metrics in page text"""
    metrics = {}

    # Volume
    vol_match = re.search(r'(?:Volume|Search Volume)[:\s]*([0-9,.]+[KkMm]?)', text)
    if vol_match:
        metrics['volume'] = vol_match.group(1)

    # Keyword Difficulty
    kd_match = re.search(r'(?:Keyword Difficulty|KD)[:\s]*([0-9.]+)%?', text)
    if kd_match:
        metrics['keyword_difficulty'] = kd_match.group(1)

    # CPC
    cpc_match = re.search(r'(?:CPC)[:\s]*\$?([0-9.]+)', text)
    if cpc_match:
        metrics['cpc'] = cpc_match.group(1)

    # Traffic
    traffic_match = re.search(r'(?:Organic.*?Traffic|Traffic)[:\s]*([0-9,.]+[KkMm]?)', text)
    if traffic_match:
        metrics['organic_traffic'] = traffic_match.group(1)

    # Keywords count
    kw_match = re.search(r'(?:Organic.*?Keywords|Keywords)[:\s]*([0-9,.]+[KkMm]?)', text)
    if kw_match:
        metrics['organic_keywords'] = kw_match.group(1)

    # Backlinks
    bl_match = re.search(r'(?:Backlinks)[:\s]*([0-9,.]+[KkMm]?)', text)
    if bl_match:
        metrics['backlinks'] = bl_match.group(1)

    # Authority Score
    as_match = re.search(r'(?:Authority Score)[:\s]*([0-9]+)', text)
    if as_match:
        metrics['authority_score'] = as_match.group(1)

    return metrics


# =============================================
# MAIN ANALYSIS
# =============================================

def main():
    print("=" * 60)
    print("🏛️  ANALYSE CONCURRENTIELLE SEMRUSH")
    print("   RIADS MARRAKECH - Casbah Amor")
    print(f"📅 {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print("=" * 60)

    results = {
        "date": datetime.now().isoformat(),
        "target": "Casbah Amor",
        "keywords": {},
        "magic_tool": {},
        "competitors": {},
        "backlinks": {},
        "serp": {},
    }

    # =============================================
    # Vérifier qu'on est bien connecté à Semrush
    # =============================================
    print("\n🔑 Vérification connexion Semrush...")
    safari_navigate("https://www.semrush.com/analytics/overview/")
    time.sleep(5)
    current_url = safari_get_url()
    title = safari_get_title()
    print(f"   URL: {current_url}")
    print(f"   Title: {title}")

    if "login" in current_url.lower() or "sso" in current_url.lower():
        print("\n❌ Pas connecté à Semrush sur Safari !")
        print("   Connecte-toi d'abord sur Safari puis relance le script.")
        return

    print("   ✅ Connecté à Semrush !")

    # =============================================
    # PHASE 1 : KEYWORD OVERVIEW
    # =============================================
    keywords = [
        "riad marrakech",
        "riad marrakech avec piscine",
        "riad marrakech pas cher",
        "riad de luxe marrakech",
        "riad marrakech medina",
        "meilleur riad marrakech",
        "location riad marrakech",
        "riad privatif marrakech",
        "riad marrakech rooftop",
        "riad marrakech famille",
        "riad marrakech spa",
        "airbnb riad marrakech",
        "riad marrakech couple",
        "week end marrakech riad",
        "riad marrakech piscine chauffee",
    ]

    print(f"\n{'='*60}")
    print(f"📊 PHASE 1 : KEYWORD OVERVIEW ({len(keywords)} mots-clés)")
    print(f"{'='*60}")

    for i, kw in enumerate(keywords):
        encoded = kw.replace(" ", "+")
        safe = kw.replace(" ", "_")
        url = f"https://www.semrush.com/analytics/keywordoverview/?q={encoded}&db=fr"

        data = navigate_wait_extract(url, f"kw_{safe}", wait=5)
        text = extract_text_from_html(data["source"])
        metrics = find_metrics_in_text(text)

        results["keywords"][kw] = {
            "metrics": metrics,
            "title": data["title"],
        }

        if metrics:
            print(f"     📈 {metrics}")

        time.sleep(1)

    # =============================================
    # PHASE 2 : KEYWORD MAGIC TOOL
    # =============================================
    print(f"\n{'='*60}")
    print("🪄 PHASE 2 : KEYWORD MAGIC TOOL")
    print(f"{'='*60}")

    magic_keywords = ["riad marrakech", "riad luxe marrakech", "hebergement marrakech"]
    for mk in magic_keywords:
        encoded = mk.replace(" ", "+")
        safe = mk.replace(" ", "_")
        url = f"https://www.semrush.com/analytics/keywordmagic/?q={encoded}&db=fr"
        data = navigate_wait_extract(url, f"magic_{safe}", wait=7)
        text = extract_text_from_html(data["source"])
        results["magic_tool"][mk] = {
            "text_extract": text[:3000],
            "title": data["title"],
        }
        time.sleep(2)

    # =============================================
    # PHASE 3 : DOMAINES CONCURRENTS - ORGANIC OVERVIEW
    # =============================================
    competitor_domains = [
        "riad-yasmine.com",
        "riadkniza.com",
        "riad-jardin-secret.com",
        "riadfarnatchi.com",
        "riadlaaroussa.com",
        "lamamounia.com",
        "royalmansour.com",
        "riad-72.com",
        "dardarma.com",
        "kasbahamour.com",
    ]

    print(f"\n{'='*60}")
    print(f"🔍 PHASE 3 : ANALYSE ORGANIQUE ({len(competitor_domains)} domaines)")
    print(f"{'='*60}")

    for i, domain in enumerate(competitor_domains):
        safe = domain.replace(".", "_")

        # Overview organique
        url = f"https://www.semrush.com/analytics/organic/overview/?db=fr&q={domain}"
        data = navigate_wait_extract(url, f"organic_{safe}", wait=5)
        text = extract_text_from_html(data["source"])
        metrics = find_metrics_in_text(text)

        results["competitors"][domain] = {
            "overview_metrics": metrics,
            "title": data["title"],
            "overview_text": text[:2000],
        }

        if metrics:
            print(f"     📈 {metrics}")

        time.sleep(1)

        # Positions organiques
        url = f"https://www.semrush.com/analytics/organic/positions/?db=fr&q={domain}"
        data = navigate_wait_extract(url, f"positions_{safe}", wait=5)
        text = extract_text_from_html(data["source"])
        results["competitors"][domain]["positions_text"] = text[:3000]

        time.sleep(1)

    # =============================================
    # PHASE 4 : BACKLINKS
    # =============================================
    print(f"\n{'='*60}")
    print(f"🔗 PHASE 4 : BACKLINKS ({len(competitor_domains)} domaines)")
    print(f"{'='*60}")

    for i, domain in enumerate(competitor_domains):
        safe = domain.replace(".", "_")
        url = f"https://www.semrush.com/analytics/backlinks/overview/?q={domain}"
        data = navigate_wait_extract(url, f"backlinks_{safe}", wait=5)
        text = extract_text_from_html(data["source"])
        metrics = find_metrics_in_text(text)

        results["backlinks"][domain] = {
            "metrics": metrics,
            "title": data["title"],
            "text": text[:2000],
        }

        if metrics:
            print(f"     📈 {metrics}")

        time.sleep(1)

    # =============================================
    # PHASE 5 : SERP ANALYSIS (top keywords)
    # =============================================
    print(f"\n{'='*60}")
    print("🏆 PHASE 5 : SERP ANALYSIS")
    print(f"{'='*60}")

    serp_keywords = [
        "riad marrakech",
        "riad marrakech avec piscine",
        "riad de luxe marrakech",
        "meilleur riad marrakech",
        "riad privatif marrakech",
    ]

    for kw in serp_keywords:
        encoded = kw.replace(" ", "+")
        safe = kw.replace(" ", "_")
        # SERP analysis via keyword overview (scroll to SERP section)
        url = f"https://www.semrush.com/analytics/keywordoverview/?q={encoded}&db=fr"
        data = navigate_wait_extract(url, f"serp_{safe}", wait=5)
        text = extract_text_from_html(data["source"])
        results["serp"][kw] = {
            "text": text[:4000],
            "title": data["title"],
        }
        time.sleep(1)

    # =============================================
    # SAUVEGARDE FINALE
    # =============================================
    output_file = f"{OUTPUT_DIR}/semrush_results.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    # Résumé
    n_screenshots = len([f for f in os.listdir(SCREENSHOTS_DIR) if f.endswith(".png")])
    n_html = len([f for f in os.listdir(HTML_DIR) if f.endswith(".html")])

    print(f"\n{'='*60}")
    print("✅ ANALYSE TERMINÉE !")
    print(f"📁 Dossier: {OUTPUT_DIR}")
    print(f"📸 {n_screenshots} screenshots")
    print(f"📄 {n_html} pages HTML sauvegardées")
    print(f"📊 {len(results['keywords'])} mots-clés analysés")
    print(f"🏢 {len(results['competitors'])} concurrents analysés")
    print(f"🔗 {len(results['backlinks'])} analyses backlinks")
    print(f"💾 Données: {output_file}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
