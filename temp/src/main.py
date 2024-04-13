from prompt import messages, tools
from utilities import chat_completion_request, parse_response


def main():
    while True:
        prompt = input("User: ")

        message = {"role": "user", "content": prompt}
        messages.append(message)

        chat_response = chat_completion_request(
            messages=messages, tools=tools
        )
        assistant_message = chat_response["choices"][0]["message"]
        messages.append(assistant_message)
        parse_response(assistant_message)


if __name__ == "__main__":
    main()
