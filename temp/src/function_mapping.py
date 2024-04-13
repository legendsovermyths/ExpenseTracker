from transaction import *
from account import *
from manager import exit_application


functions = {
    "add_transaction": add_transaction,
    "exit_application": exit_application,
    "add_subscription": add_subscription,
    "add_account": add_account,
    "display_transactions": display_transactions,
    "display_accounts": display_accounts,
    "display_subscriptions": display_subscriptions,
    "make_transactions_piechart": make_transactions_piechart,
}

need_input_checking_functions = {
    "add_transaction": ["amount being paid or recieved", "a description of the transaction(can be as small as one word)"],
    "add_subscription": ["monthly amount being paid", "name of subscription"],
    "add_account": ["amount for the account", "name of the account"],
}

need_no_response_functions = {
    "display_transactions": display_transactions,
    "display_accounts": display_accounts,
    "display_subscriptions": display_subscriptions,
    "make_transactions_piechart": make_transactions_piechart,
}
