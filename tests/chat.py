#!/usr/bin/env python3
"""Terminal chat interface for Jarvis. Run from project root:
    python -m tests.chat
"""
import asyncio
import sys
import uuid

from langchain_core.messages import HumanMessage

from backend.agent.graph import get_graph
from backend.tools.registry import ALL_TOOLS

SESSION_ID = str(uuid.uuid4())


async def main():
    graph = get_graph(tools=ALL_TOOLS)
    print("Jarvis terminal chat. Type 'exit' or Ctrl+C to quit.\n")

    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye!")
            break

        if not user_input:
            continue
        if user_input.lower() in {"exit", "quit"}:
            print("Bye!")
            break

        print("Jarvis: ", end="", flush=True)
        try:
            async for event in graph.astream_events(
                {
                    "messages": [HumanMessage(content=user_input)],
                    "session_id": SESSION_ID,
                },
                version="v2",
            ):
                kind = event["event"]

                if kind == "on_chat_model_stream":
                    chunk = event["data"]["chunk"]
                    token = chunk.content if hasattr(chunk, "content") else ""
                    if token:
                        print(token, end="", flush=True)

                elif kind == "on_tool_start":
                    print(f"\n[tool: {event.get('name')}]", end="", flush=True)

        except Exception as exc:
            print(f"\n[error] {exc}", file=sys.stderr)

        print()  # newline after response


if __name__ == "__main__":
    asyncio.run(main())
