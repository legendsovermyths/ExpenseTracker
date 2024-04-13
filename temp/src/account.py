import sys
import numpy as np
import os
import pandas as pd
import csv
from tabulate import tabulate

account_relative_file_path = "../data/accounts.csv"
account_absolute_file_path = os.path.abspath(
    account_relative_file_path)


def add_account(name, amount) -> bool:
    status = True
    accounts = pd.read_csv(account_absolute_file_path)

    id = accounts["ID"].max()+1 if not accounts.empty else 1
    try:
        with open(account_absolute_file_path, mode='a', newline='') as csv_file:
            csv_writer = csv.writer(csv_file)
            csv_writer.writerow(
                [id, name, int(amount)])
    except Exception as e:
        print(e)
        status = False

    return status


def update_account_amount(name, amount, operation) -> bool:
    accounts = pd.read_csv(account_absolute_file_path)
    status = True
    try:
        if operation == "add":
            accounts.loc[accounts['Name'] == name, 'Amount'] += amount
        elif operation == "subtract":
            accounts.loc[accounts['Name'] == name, 'Amount'] -= amount
        accounts.to_csv(account_absolute_file_path, index=False)
    except Exception as e:
        print(e)
        status = False
    return status


def display_accounts() -> bool:
    status = True
    try:
        accounts = pd.read_csv(account_absolute_file_path)
        print(tabulate(accounts, headers='keys', tablefmt='psql'))
    except Exception as e:
        print(e)
        status = False
    return status
