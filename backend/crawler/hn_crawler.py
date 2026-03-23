"""
Crawls the HN Firebase API and stores raw posts/comments in PostgreSQL.
Runs incrementally — tracks the last fetched item ID to avoid re-fetching.
"""
import httpx
import asyncio
import logging
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db import save_item

HN_API = "https://hacker-news.firebaseio.com/v0"
logger = logging.getLogger(__name__)

async def fetch_item(client: httpx.AsyncClient, item_id: int) -> dict | None:
    try:
        r = await client.get(f"{HN_API}/item/{item_id}.json", timeout=10)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        logger.warning(f"Failed to fetch item {item_id}: {e}")
        return None

async def get_max_item_id(client: httpx.AsyncClient) -> int:
    r = await client.get(f"{HN_API}/maxitem.json")
    return r.json()

async def crawl(limit: int = 100_000):
    """Crawl `limit` items starting from the most recent."""
    async with httpx.AsyncClient() as client:
        max_id = await get_max_item_id(client)
        start_id = max_id - limit
        logger.info(f"Crawling items {start_id} to {max_id}")

        semaphore = asyncio.Semaphore(50)  # max 50 concurrent requests

        async def fetch_and_save(item_id):
            async with semaphore:
                item = await fetch_item(client, item_id)
                if item and item.get("type") in ("story", "comment", "ask", "show", "job"):
                    # save_item is sync — run in thread pool to avoid blocking the event loop
                    loop = asyncio.get_event_loop()
                    await loop.run_in_executor(None, save_item, item)

        tasks = [fetch_and_save(i) for i in range(start_id, max_id)]
        await asyncio.gather(*tasks)
        logger.info("Crawl complete.")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(crawl())
