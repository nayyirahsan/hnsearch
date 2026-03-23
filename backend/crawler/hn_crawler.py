"""
Crawls the HN Firebase API and stores raw posts/comments in PostgreSQL.
Runs incrementally — tracks the last fetched item ID to avoid re-fetching.
"""
import httpx
import asyncio
import logging
import sys
import os
import time
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db import save_items_bulk

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

        semaphore = asyncio.Semaphore(10)  # balance speed with hosted DB connection limits
        processed = 0
        progress_lock = asyncio.Lock()
        save_queue: asyncio.Queue[dict] = asyncio.Queue(maxsize=3000)
        writer_done = asyncio.Event()
        write_batch_size = 300

        def save_batch_with_retry(batch: list[dict]) -> None:
            last_err: Exception | None = None
            for attempt in range(3):
                try:
                    save_items_bulk(batch)
                    return
                except Exception as e:
                    last_err = e
                    time.sleep(0.4 * (attempt + 1))
            raise RuntimeError(f"bulk save failed after retries: {last_err}")

        async def writer():
            loop = asyncio.get_event_loop()
            batch: list[dict] = []

            while True:
                if len(batch) >= write_batch_size:
                    try:
                        await loop.run_in_executor(None, save_batch_with_retry, batch.copy())
                    except Exception as e:
                        logger.warning(f"Failed to save batch of {len(batch)} items: {e}")
                    finally:
                        for _ in batch:
                            save_queue.task_done()
                        batch.clear()
                    continue

                if writer_done.is_set() and save_queue.empty():
                    if batch:
                        try:
                            await loop.run_in_executor(None, save_batch_with_retry, batch.copy())
                        except Exception as e:
                            logger.warning(f"Failed to save final batch of {len(batch)} items: {e}")
                        finally:
                            for _ in batch:
                                save_queue.task_done()
                            batch.clear()
                    break

                try:
                    item = await asyncio.wait_for(save_queue.get(), timeout=1.0)
                    batch.append(item)
                except TimeoutError:
                    if batch:
                        try:
                            await loop.run_in_executor(None, save_batch_with_retry, batch.copy())
                        except Exception as e:
                            logger.warning(f"Failed to save timed batch of {len(batch)} items: {e}")
                        finally:
                            for _ in batch:
                                save_queue.task_done()
                            batch.clear()

        writer_task = asyncio.create_task(writer())

        async def fetch_and_save(item_id):
            nonlocal processed
            async with semaphore:
                item = await fetch_item(client, item_id)
                if item and item.get("type") in ("story", "comment", "ask", "show", "job"):
                    await save_queue.put(item)
                async with progress_lock:
                    processed += 1
                    if processed % 1000 == 0:
                        logger.info(f"Processed {processed}/{limit} items...")

        tasks = [fetch_and_save(i) for i in range(start_id, max_id)]
        await asyncio.gather(*tasks)
        writer_done.set()
        await save_queue.join()
        await writer_task
        logger.info("Crawl complete.")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(crawl())
