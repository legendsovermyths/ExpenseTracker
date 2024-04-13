tools = [
    {
        "type": "function",
        "function": {
            "name": "add_transaction",
            "description": "Records the transaction made by the user, don't make any assumption you can ask the user for any parameter you want. This function can only record one transaction, so for multiple transaction this needs to be called multiple times.",
            "parameters": {
                "type": "object",
                "properties": {
                    "amount": {
                        "type": "integer",
                        "description": "The amount the user paid, or recieved, if paid this need to be a negative number, is the user recieved and amount this need to be a positive number.",
                    },
                    "description": {
                        "type": "string",
                        "description": "A one-three words description of why the account is being paid",
                    },
                    "account": {
                        "type": "string",
                        "description": "If user mentioned an account it will go here otherwise default account will be taken. Only one word should be generated for this and needs to be uppercase.",
                    },
                    "message": {
                        "type": "string",
                        "description": "If there is anything sepcial about the amount or user mentions any other detail, this parameter will describe it.",
                    },
                    "category": {
                        "type": "string",
                        "enum": ["food", "transport", "bills", "travel", "other"],
                        "description": "User need not mention this, you can decide the category of the transaction."
                    }

                },
                "required": ["amount", "description", "category"],
            },
        }
    },
    {
        "type": "function",
        "function": {
            "name": "add_subscription",
            "description": "Records the subscription made by the user,don't make any assumption you can ask the user for any parameter you want. This includes amounts which will be deducted monthly, for example: subscription to Netflix, this function can only record one subscription, so for multiple subscriptions this needs to be called multiple times.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "The name of the subscription, for example: Netflix"
                    },
                    "amount": {
                        "type": "integer",
                        "description": "The amount the user will pay monthly for this subscription."
                    },
                    "account": {
                        "type": "string",
                        "description": "If user mentioned an account it will go here otherwise default account will be taken. Only one word should be generated for this and needs to be uppercase.",
                    }
                },
                "required": ["amount", "name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "add_account",
            "description": "Adds a new account to the database ,don't make any assumption you can ask the user for any parameter you want. This function can only add one account, so for multiple accounts this needs to be called multiple times.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "The name of the account, This parameter should strictly be one word and should be all uppercase,for example: HDFC"
                    },
                    "amount": {
                        "type": "integer",
                        "description": "The amount that is present in the account."
                    }
                },
                "required": ["amount", "name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "make_transactions_piechart",
            "description": "Makes a piechart of the transactions that are present in the database, it takes a groupby function as parameter, for example: groupby=Category, this will make a piechart of the transactions grouped by Category. After getting true status from the tool just say 'The result is on your screen' ot something similar like 'I am sure you are seeing them right now'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "group_by": {
                        "type": "string",
                        "description": "The parameter by which the transactions are to be grouped, it can be either Category or Account, If the user doesn't mention this parameter, you can put Category as default."
                    },
                },
                "required": ["group_by"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "display_transactions",
            "description": "displays all the transactions that are present in the database on users screen, after getting true status from the tool just say 'The result is on your screen'. and don't display naything from your side.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        },

    },
    {
        "type": "function",
        "function": {
            "name": "display_subscriptions",
            "description": "displays all the subscriptions that are present in the database on users screen. After getting true status from the tool just say 'The result is on your screen' or something similar.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        },

    },
    {
        "type": "function",
        "function": {
            "name": "display_accounts",
            "description": "displays all the accounts that are present in the database on users screen. After getting true status from the tool just say 'The result is on your screen'",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        },

    },
    {
        "type": "function",
        "function": {
            "name": "exit_application",
            "description": "exits the application whenever the user says goodbye or exit or anything that implies he is done for today.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        },

    }

]


messages = [{'role': 'system', 'content': "You are my finance assistant, you help with me with my money handling, since all the function calls affect the databse, YOU SHOULD NOT ASSUME ANY INFORMATION, ASK EVERYTHING THAT IS REQUIRED BEFORE PASSING THEM IN FUNCTION CALL. Every tool call you make would return True or False as response, if it's sTrue just say that the job is done, otherwise say that there has been error .You can ask the user for any detail you want."}, {'role': 'user', 'content': 'show me my transactions'}, {'role': 'assistant', 'content': None, 'tool_calls': [{'id': 'call_RWgtZhixTsK3bKmaRZuTQTY3', 'type': 'function', 'function': {'name': 'display_transactions', 'arguments': '{}'}}]}, {'role': 'tool', 'tool_call_id': 'call_RWgtZhixTsK3bKmaRZuTQTY3', 'name': 'display_transactions', 'content': 'True'}, {'role': 'assistant', 'content': 'The result is on your screen.'}, {'role': 'user', 'content': 'thanks'}, {'role': 'assistant', 'content': "You're welcome! If you need any further assistance, feel free to ask."}, {
    'role': 'user', 'content': 'show me my subscriptions'}, {'role': 'assistant', 'content': None, 'tool_calls': [{'id': 'call_vv63hpnlllbIEGDXO80sK1bO', 'type': 'function', 'function': {'name': 'display_subscriptions', 'arguments': '{}'}}]}, {'role': 'tool', 'tool_call_id': 'call_vv63hpnlllbIEGDXO80sK1bO', 'name': 'display_subscriptions', 'content': 'True'}, {'role': 'assistant', 'content': 'The result is on your screen.'}, {'role': 'user', 'content': 'thanks'}, {'role': 'assistant', 'content': "You're welcome! If you have any more questions, feel free to ask."}, {'role': 'user', 'content': 'show me my accounts'}, {'role': 'assistant', 'content': None, 'tool_calls': [{'id': 'call_9WjqzyMyv2BPCZeUyobk0Dps', 'type': 'function', 'function': {'name': 'display_accounts', 'arguments': '{}'}}]}, {'role': 'tool', 'tool_call_id': 'call_9WjqzyMyv2BPCZeUyobk0Dps', 'name': 'display_accounts', 'content': 'True'}, {'role': 'assistant', 'content': 'The result is on your screen.'}, {'role': 'user', 'content': 'thank you so much'}, {'role': 'assistant', 'content': "You're welcome! If there's anything else I can help you with, please let me know. Have a great day!"}]
