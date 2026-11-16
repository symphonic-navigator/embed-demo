"""Fetch the curated demo sentences from Tatoeba and write demo_sentences.json.

The curation is the list of Tatoeba sentence ids below (chosen by hand on
2026-11-16): mostly Japanese, clearly distinct topics, and some sentences
whose French, German or English translation is also in the set, so that
cross-lingual hits can be checked. Texts and owners are fetched from the API
so the file can be verified and attributed (Tatoeba, CC BY 2.0 FR).

Usage: uv run python curate_demo_set.py
"""

import json
import time
import urllib.request
from pathlib import Path

API = "https://api.tatoeba.org/v1/sentences/{}"
LICENCES = {"CC BY 2.0 FR", "CC0 1.0"}

# (id, id of the sentence in this set that it translates, or None)
CURATED = [
    # cats
    (121990, None), (196697, None), (207307, None),
    # a dog
    (9011614, None),
    # rain, wind
    (193759, None), (203520, None), (185136, None),
    # trains
    (1256520, None), (155763, None),
    # food and drink
    (197008, None), (8754830, None), (161223, None), (224908, None),
    # books, music
    (159861, None), (110403, None),
    # doctors
    (212346, None), (118131, None),
    # sport, sea, mountains
    (160660, None), (185110, None), (194543, None),
    # tax, work
    (920490, None), (155533, None), (185391, None),
    # birthday, computers, cherry blossom
    (127344, None), (223728, None), (166847, None), (9415241, None),
    # translations of sentences above
    (12531, 203520), (6551, 161223), (683268, 160660), (3864, 920490),
    (438435, 155763), (362256, 212346), (344423, 166847),
    (22241, 185110), (31715, 194543), (61064, 223728), (22523, 185391),
    # French, not a translation of anything here
    (1210410, None),
]


def fetch(sentence_id: int) -> dict:
    req = urllib.request.Request(API.format(sentence_id), headers={"User-Agent": "embed-demo-curation"})
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.load(res)["data"]


def main() -> None:
    out = []
    for sentence_id, translation_of in CURATED:
        s = fetch(sentence_id)
        assert s["license"] in LICENCES, (sentence_id, s["license"])
        out.append({"sourceId": s["id"], "lang": s["lang"], "text": s["text"].strip(),
                    "owner": s["owner"], "translationOf": translation_of})
        print(s["id"], s["lang"], s["text"])
        time.sleep(0.2)  # be gentle with the API
    path = Path(__file__).parent / "demo_sentences.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n")
    print(f"Wrote {len(out)} sentences to {path}")


if __name__ == "__main__":
    main()
