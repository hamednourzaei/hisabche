-- ============================================================================
-- MODULE CUSTOMER — the opening balance means two different things
--
-- ⚠️ THIS FILE IS READ-ONLY. It writes nothing, changes nothing, and is safe to
-- run at any time. It exists because the fix is a PRODUCT DECISION, not a code
-- change, and the decision needs real numbers from your data.
--
-- ----------------------------------------------------------------------------
-- WHAT THE CODE DOES TODAY
--
-- `customers.opening_balance` is stored for every customer. But
-- `CustomerService.getBalance()` computes what a party owes by summing
-- `transactions_view` ONLY — it never reads that column. So the opening
-- balance reaches the balance in exactly one case:
--
--   type = 'credit'  -> `create()` also inserts a `transactions` row of type
--                       'sale' with description 'Credit sale - opening
--                       balance'. It is counted, once, through that row.
--
--   anything else    -> the column is stored and NOTHING reads it. The
--                       customer's balance is 0 until they transact.
--
-- So a customer brought over from a paper ledger owing 5,000,000, entered as a
-- cash customer, shows a balance of zero. Nothing errors. The figure simply
-- understates the debt, and it understates the receivables total with it.
--
-- ----------------------------------------------------------------------------
-- WHY THIS IS NOT FIXED IN CODE WITHOUT YOU
--
-- The obvious fix — add `opening_balance` to the sum — would DOUBLE-COUNT
-- every credit customer, because theirs is already in `transactions`. The two
-- populations cannot be told apart safely after the fact: the only marker is
-- an English description string that a person could also have typed.
--
-- Removing the opening `transactions` rows and reading the column everywhere
-- would be a DESTRUCTIVE migration over posted history. That is a stop
-- condition in this project: history is reported first, never rewritten
-- silently.
--
-- So: these queries tell you how large each population is. Then you decide.
--
-- ----------------------------------------------------------------------------
-- THE TWO WAYS OUT, once you have the numbers
--
--   A. THE COLUMN IS THE TRUTH.
--      Stop writing the opening `transactions` row, add the column to the
--      balance, and delete the existing opening rows in one audited migration.
--      Correct and uniform; touches posted history.
--
--   B. THE TRANSACTION IS THE TRUTH.
--      Post an opening row for every customer that has a non-zero
--      `opening_balance` and no opening row yet, whatever their type. Additive
--      only — nothing existing is changed. The column becomes a record of what
--      was entered, not a number anything reads.
--
-- B is additive and A is not. Neither should be run before section 1 below is
-- reported, because if section 1 returns 0 there is nothing to decide.
-- ============================================================================


-- ============================================================================
-- 1. HOW BIG IS THE PROBLEM
--
-- Customers carrying an opening balance that NOTHING currently counts.
-- If `affected_customers` is 0, no data is affected and this is a code
-- tidiness question only.
-- ============================================================================

SELECT
  count(*)                                   AS affected_customers,
  count(DISTINCT c.workspace_id)             AS affected_workspaces,
  sum(c.opening_balance)                     AS uncounted_total,
  min(c.opening_balance)                     AS smallest,
  max(c.opening_balance)                     AS largest
FROM public.customers c
WHERE coalesce(c.opening_balance, 0) <> 0
  AND coalesce(c.type, 'cash') <> 'credit';


-- ============================================================================
-- 2. THE SAME, PER WORKSPACE
--
-- So you can see whether it is one migrated shop or everybody.
-- ============================================================================

SELECT
  c.workspace_id,
  count(*)               AS customers,
  sum(c.opening_balance) AS uncounted_total
FROM public.customers c
WHERE coalesce(c.opening_balance, 0) <> 0
  AND coalesce(c.type, 'cash') <> 'credit'
GROUP BY c.workspace_id
ORDER BY uncounted_total DESC
LIMIT 50;


-- ============================================================================
-- 3. ⚠️ THE DOUBLE-COUNT RISK, MEASURED
--
-- Credit customers whose opening balance IS already posted. These are the rows
-- that option A would have to remove, and that option B must not post twice.
--
-- `opening_rows` greater than 1 for any customer means the opening balance was
-- posted more than once already — worth knowing before either option.
-- ============================================================================

SELECT
  count(*)                        AS credit_customers_with_opening,
  sum(t.opening_rows)             AS opening_rows_total,
  count(*) FILTER (WHERE t.opening_rows > 1) AS customers_posted_more_than_once
FROM (
  SELECT
    c.id,
    (
      SELECT count(*)
      FROM public.transactions x
      WHERE x.customer_id  = c.id
        AND x.workspace_id = c.workspace_id
        AND x.description  = 'Credit sale - opening balance'
    ) AS opening_rows
  FROM public.customers c
  WHERE coalesce(c.opening_balance, 0) <> 0
    AND c.type = 'credit'
) t;


-- ============================================================================
-- 4. ⚠️ DISAGREEMENTS
--
-- Credit customers whose posted opening row does NOT match the column. Any row
-- here means the two records already tell different stories, and neither
-- option can be applied to them mechanically.
--
-- Expected: no rows.
-- ============================================================================

SELECT
  c.workspace_id,
  c.id                AS customer_id,
  c.full_name,
  c.opening_balance   AS column_says,
  x.amount            AS transaction_says
FROM public.customers c
JOIN public.transactions x
  ON  x.customer_id  = c.id
  AND x.workspace_id = c.workspace_id
  AND x.description  = 'Credit sale - opening balance'
WHERE c.type = 'credit'
  AND coalesce(c.opening_balance, 0) <> coalesce(x.amount, 0)
ORDER BY abs(coalesce(c.opening_balance, 0) - coalesce(x.amount, 0)) DESC
LIMIT 100;


-- ============================================================================
-- 5. PARTIES LARGE ENOUGH TO HAVE HIT THE OLD BALANCE TRUNCATION
--
-- Unrelated to the opening balance, and included because it is the same
-- question asked of the same table: `getBalance` used to sum only the first
-- 10,000 movements. Any customer at or above that had a WRONG balance shown
-- until the paging fix. This tells you whether anyone was actually affected.
--
-- Expected for most deployments: no rows.
-- ============================================================================

SELECT
  x.workspace_id,
  x.customer_id,
  count(*) AS movements
FROM public.transactions x
WHERE x.customer_id IS NOT NULL
GROUP BY x.workspace_id, x.customer_id
HAVING count(*) >= 10000
ORDER BY count(*) DESC
LIMIT 50;
