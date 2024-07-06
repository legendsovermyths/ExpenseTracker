import json
import os

import openai
import requests
from dotenv import load_dotenv
from function_mapping import (
    functions,
    need_input_checking_functions,
    need_no_response_functions,
)
from prompt import messages, tools

load_dotenv()
openai.api_key = os.environ.get("api_key")

GPT_MODEL = "gpt-3.5-turbo"


def chat_completion_request(
    messages, tools=None, tool_choice=None, model=GPT_MODEL
) -> dict:
    headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + openai.api_key,
    }
    json_data = {"model": model, "messages": messages}
    if tools is not None:
        json_data.update({"tools": tools})
    if tool_choice is not None:
        json_data.update({"tool_choice": tool_choice})
    try:
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json=json_data,
        )
        response = response.json()
        return response
    except Exception as e:
        print("Unable to generate ChatCompletion response")
        print(f"Exception: {e}")


def parse_response(response) -> None:
    if response.get("tool_calls"):
        execute_function(response)
    if response.get("content"):
        print("Assistant: " + response.get("content"))


def execute_function(response):
    function_name = response.get("tool_calls")[0]["function"]["name"]
    function_arguements = json.loads(
        response.get("tool_calls")[0]["function"]["arguments"]
    )

    status = functions[function_name](**function_arguements)
    message = {
        "role": "tool",
        "tool_call_id": response["tool_calls"][0]["id"],
        "name": response["tool_calls"][0]["function"]["name"],
        "content": str(status),
    }
    messages.append(message)

    chat_response = chat_completion_request(messages=messages, tools=tools)
    assistant_message = chat_response["choices"][0]["message"]
    messages.append(assistant_message)
    if assistant_message.get("tool_calls"):
        execute_function(assistant_message)
    elif function_name not in need_no_response_functions:
        parse_response(assistant_message)
