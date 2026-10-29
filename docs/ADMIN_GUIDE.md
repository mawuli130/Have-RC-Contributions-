# Administrator & Treasurer Guide

For the people who run the Have R/C JHS 2022 group fund.

Two roles can open the **Admin Portal**:

| Capability | Treasurer | Administrator |
| --- | :--: | :--: |
| Approve / decline members | ✅ | ✅ |
| Verify or reject payments | ✅ | ✅ |
| Record cash payments | ✅ | ✅ |
| Set contribution rules | ✅ | ✅ |
| Add expenses, correct / reverse | ✅ | ✅ |
| View reports and CSV exports | ✅ | ✅ |
| Read the admin activity log | ✅ | ✅ |
| Change members' roles | ❌ | ✅ |
| Assign another administrator | ❌ | ✅ |

Admin rights are **never** granted by registering early or by an option at signup. See [`INITIAL_ADMIN.md`](INITIAL_ADMIN.md).

Open the portal from **More → Admin portal**.

---

## The 8 admin sections

### 1. Manage Members
New sign-ups appear under **Pending** with their name, email and registration date.

- **Approve** — they immediately gain access to group finances, and any outstanding contribution periods are created for them automatically.
- **Decline** — they get a notification with your reason and cannot sign in.
- **Change role** *(administrators only)* — promote a trusted member to **Treasurer**, or demote. The last administrator cannot remove their own role.

### 2. Contribution Settings
The group has not yet agreed an amount. While that is true, leave the amount **blank** and keep the schedule **inactive** — no member is charged and no obligations are generated.

When the group agrees:

1. Enter the **amount in GHS**.
2. Choose the **frequency** (weekly, monthly, quarterly, yearly or one-off).
3. Set the **first start date**, the **due day** and the **grace period** (how many days after the due date before a period counts as overdue).
4. Enter the treasurer's Mobile Money number and account name — members see these on the Contributions tab.
5. Switch **Schedule active** on, review the summary, and save.

The system then creates one obligation per approved member for every period from the start date up to today (never future periods) and never duplicates a period.

> Changing the amount later affects only **new** periods. Existing obligations keep the amount they were created with, so history stays accurate.

### 3. Review Payments
Pending member submissions, with the amount, date, method, private transaction reference and receipt.

- **Verify** — only after you have actually received the money. The payment posts to the ledger once, is allocated to the member's oldest unpaid periods, and the member is notified.
- **Reject** — a short reason is required and is sent to the member. A rejection never changes any balance.

Use **Cash** (top right) to record money you received offline: pick the member, amount, date and method. This is verified immediately because you witnessed it.

**Never verify a payment you have not received.**

### 4. Outstanding Members
Everyone with a balance, filterable by contribution period, sorted largest debt first.

Tap **Reminder** to preview the exact message:

> Hello [Name], this is a friendly reminder from the Have R/C JHS 2022 Old Students group. Our records show that your outstanding contribution balance is GH₵[Amount] for [Period]. If you have already paid, please contact the treasurer so your records can be updated. Thank you.

- **Share on WhatsApp** opens WhatsApp with the message addressed to that one member.
- **Send in-app reminder** puts the message in their notifications.

The app cannot confirm that a WhatsApp message was delivered or read. Never post an individual's balance in a group chat.

### 5. Add Expense
Fields: title, amount, reason, date paid, category, person/vendor paid, receipt (optional), notes.

Before saving you see a **confirmation screen** with the balance that will remain.

- If the amount is **larger than the recorded balance**, the app blocks it. To continue you must tick the exception box and write a real explanation — this is recorded on the expense and in the audit log, and is visible to members.
- After saving, the expense is posted to the ledger once, total expenses update, the balance recalculates, and the expense appears in every member's history.

### 6. Expense History
Every posted expense with its corrections. Use the date range to narrow the list and **CSV** to export.

- **Correct** — change the amount with a reason. The difference is posted to the ledger (money returns to the fund if the amount goes down).
- **Reverse** — return the whole amount to the fund; the expense stays visible marked *Reversed*.
- **Delete** — not possible, by database trigger.

### 7. Financial Reports
Live summary figures plus CSV exports: financial summary, member payment status, outstanding balances, payment history, expense history, the signed ledger, and the admin activity log. Exports are restricted to administrators and treasurers and contain **no receipts or transaction references**.

### 8. Admin Activity Log
Every administrative action with the actor's name, timestamp and details — approvals, payment decisions, expenses, corrections, rule changes, reminders. It cannot be edited from the app.

---

## Daily routine

**When money comes in**
1. Check the Mobile Money or bank account.
2. Open **Review Payments**, compare the amount, date and reference.
3. Verify (or reject with a reason).
4. Record any cash received with **Cash**.

**When money goes out**
1. Photograph the receipt before you file it.
2. **Add Expense** with a clear title, the true reason and the date paid.
3. Attach the photo and confirm.

**Weekly**
- Check **Outstanding Members** and send gentle reminders to those who have forgotten.
- Glance at the Admin dashboard: pending approvals, pending payments, overdue count.

**Monthly**
- Export the financial summary and expense CSVs for the group's records.
- Read the **Admin Activity Log** to make sure every entry is yours or your co-treasurer's.

---

## Rules that protect you

1. **Never verify a payment before the money arrives.** Verification is the moment it becomes real income.
2. **Never delete.** Correct or reverse with a reason. The database blocks deletion and members can see the history.
3. **Attach evidence when you can.** Transparency is the point of the app.
4. **Keep one administrator in reserve** so the group is never locked out.
5. **Keep references private.** Transaction references and receipts belong to one member and you.
6. **Reconcile.** The app shows the *recorded* balance. Compare it with the real account from time to time and correct any discrepancy through the documented adjustment process.
7. **Your name is on every action.** The audit log records it.

---

## What to tell members

- "Your status shows *Pending Verification* until I confirm the money arrived — then it updates automatically."
- "The balance you see is what the group has recorded, not a bank statement."
- "Only the figures needed for transparency are shared; your receipts and references are private."
- "If a figure is wrong, tell me and I will correct it properly with an audit trail."
