"""One support turn; pip install openai. Tool execution belongs to the app."""
import json
import os
import sys
from pathlib import Path

from openai import OpenAI

JOB = json.loads(Path(__file__).with_name("job_description.json").read_text())


def complete(messages):
    client = OpenAI(
        base_url=os.environ["DISTIL_BASE_URL"],
        api_key=os.environ["DISTIL_API_KEY"],
        timeout=120,
        max_retries=0,
    )
    return client.chat.completions.create(
        model=os.environ["DISTIL_MODEL"],
        messages=[{"role": "system", "content": JOB["task_description"]}, *messages],
        tools=JOB["tools"],
        temperature=0,
        max_tokens=1024,
    )


if __name__ == "__main__":
    prompt = sys.argv[1] if len(sys.argv) > 1 else "What does the Team plan cost?"
    print(complete([{"role": "user", "content": prompt}]).model_dump_json(indent=2))
