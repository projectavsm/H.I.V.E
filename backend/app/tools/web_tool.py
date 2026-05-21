import httpx
from bs4 import BeautifulSoup
import urllib.parse
import logging

# Link up with the standardized system-wide logger instance
logger = logging.getLogger("H.I.V.E.Scraper")

class AutonomousWebScraper:
    @staticmethod
    async def fetch_live_web_context(query: str) -> str:
        print(f"[SCRAPER] Intercepting web stream for token query target: '{query}'")
        
        # URL encode the raw string query to ensure space characters map safely to URL structures
        encoded_query = urllib.parse.quote_plus(query)
        url = f"https://html.duckduckgo.com/html/?q={encoded_query}"
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5"
        }

        try:
            # Separate client config from operational request execution parameters
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Force follow_redirects to true to catch DuckDuckGo geo-routing hops cleanly
                response = await client.get(url, headers=headers, follow_redirects=True)
                
                if response.status_code != 200:
                    logger.error(f"[SCRAPER] Target connection rejected with HTTP Error Code: {response.status_code}")
                    return ""

                soup = BeautifulSoup(response.text, "html.parser")
                results = soup.find_all("a", class_="result__snippet")
                
                web_fragments = []
                for res in results[:3]:  # Capture top 3 structural organic hits
                    text_content = res.get_text().strip()
                    if text_content:
                        web_fragments.append(f"• {text_content}")
                
                if web_fragments:
                    logger.info(f"🌐 [SCRAPER] Web search executed. Successfully ingested {len(web_fragments)} live text frames.")
                    return "\n[LIVE WEB INTELLIGENCE CONTEXT]:\n" + "\n---\n".join(web_fragments)
                    
                logger.warning("⚠️ [SCRAPER] Search structural elements found 0 valid snippet containers.")
                
        except Exception as e:
            logger.critical(f"[SCRAPER] Exception fault during web intercept loop: {str(e)}")
            
        return ""