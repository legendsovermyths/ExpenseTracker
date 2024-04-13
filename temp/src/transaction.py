import csv
from datetime import datetime
from tabulate import tabulate
from account import update_account_amount
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
import os

transaction_relative_file_path = "../data/transactions.csv"
subscription_relative_file_path = "../data/subscriptions.csv"
transaction_absolute_file_path = os.path.abspath(
    transaction_relative_file_path)
subscription_absolute_file_path = os.path.abspath(
    subscription_relative_file_path)


def add_transaction(amount, description, category, account="CASH", message="") -> bool:
    status = True
    current_date = datetime.now().strftime("%Y-%m-%d")
    try:
        with open(transaction_absolute_file_path, mode='a', newline='') as csv_file:
            csv_writer = csv.writer(csv_file)
            csv_writer.writerow(
                [amount, current_date, description, account, message, category])
            update_account_amount(account, amount, "add")

    except Exception as e:
        print(Exception)
        status = False

    return status


def add_subscription(name, amount, account="CASH") -> bool:
    status = True
    current_date = datetime.now().strftime("%Y-%m-%d")
    subscriptions = pd.read_csv(subscription_absolute_file_path)

    id = subscriptions["ID"].max()+1 if not subscriptions.empty else 1
    try:
        with open(subscription_absolute_file_path, mode='a', newline='') as csv_file:
            csv_writer = csv.writer(csv_file)
            csv_writer.writerow(
                [id, name, amount, current_date, account])
    except Exception as e:
        print(e)
        status = False

    return status


def display_transactions() -> bool:
    status = True
    try:
        transactions = pd.read_csv(transaction_absolute_file_path)
        print(tabulate(transactions, headers='keys', tablefmt='psql'))
    except Exception as e:
        print(e)
        status = False
    return status


def display_subscriptions() -> bool:
    status = True
    try:
        subscriptions = pd.read_csv(subscription_absolute_file_path)
        print(tabulate(subscriptions, headers='keys', tablefmt='psql'))
    except Exception as e:
        print(e)
        status = False
    return status


def make_transactions_piechart(group_by) -> bool:
    status = True
    try:
        transactions = pd.read_csv(transaction_absolute_file_path)
        transactions = transactions[transactions['Amount'] < 0]
        transactions['Amount'] = transactions['Amount'].abs()
        transactions = transactions.groupby(group_by).sum()
        transactions = transactions.reset_index()
        colors = ['#ff9999', '#66b3ff', '#99ff99',
                  '#ffcc99', "#FF9B9B", "#D0F5BE", "#FFC1C1"]
        fig1, ax1 = plt.subplots()
        patches, texts, autotexts = ax1.pie(transactions["Amount"], labels=transactions[group_by],
                                            autopct='%1.1f%%', startangle=90, colors=colors)
        for text in texts:
            text.set_color('grey')
        for autotext in autotexts:
            autotext.set_color('grey')
        ax1.axis('equal')
        plt.legend(transactions[group_by], loc="best")
        plt.axis('equal')
        plt.tight_layout()
        plt.show()
    except Exception as e:
        print(e)
        status = False
    return status
