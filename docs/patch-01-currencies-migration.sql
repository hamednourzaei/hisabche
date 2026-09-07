-- ============================================================================
-- PATCH 1 / L0.1 — the `currencies` reference table.
--
-- Direct inspection of the live schema found no `currencies` table at all:
-- `products.currency`, `invoices.currency` and `payments.currency` are free
-- text with nothing behind them. L0.1 was never closed.
--
-- ---------------------------------------------------------------------------
-- ⚠️ SEEDING 162 CURRENCIES DOES NOT MAKE 162 CURRENCIES USABLE
--
-- This is the trap in this patch, and it is the same one L0.1 was stopped for
-- the first time.
--
-- Rule 9 requires that an unknown currency code resolve to `undefined`
-- precision rather than borrow another currency''s. `FRACTION_DIGITS` in
-- @hisabche/formatting covers the 25 codes the product actually supports. If
-- the onboarding picker were wired to "every row in this table", someone could
-- select BHD and every amount in that workspace would be formatted with NO
-- precision contract — a WRONG AMOUNT, not a missing option.
--
-- So `is_active` is the gate. It is seeded true for exactly the 25 codes in
-- CURRENCY_CODES and false for the other 137. The table is the reference;
-- `is_active` is the product''s policy. Verification query 4 checks they agree.
--
-- Widening the product to a new currency is therefore three deliberate steps:
--   1. UPDATE currencies SET is_active = true WHERE code = '...'
--   2. add it to CURRENCY_CODES in packages/validation
--   3. add its precision AND its sign in packages/formatting
-- `currency-policy.test.ts` stays red until 2 and 3 are both done.
--
-- ---------------------------------------------------------------------------
-- ⚠️ NO FOREIGN KEY IN THIS PATCH — DELIBERATE (G3)
--
-- `products.currency` and its siblings may hold values that predate any list.
-- A FK added blind fails on exactly those rows, and "delete the offending
-- rows" is not a repair anyone has agreed to. Verification query 3 COUNTS
-- them. The FK statements are at the bottom, commented out, to be run only if
-- that query returns nothing.
--
-- ---------------------------------------------------------------------------
-- ⚠️ decimal_places FOLLOWS ISO 4217, WITH ONE STATED EXCEPTION
--
--   0 minor units : BIF CLP DJF GNF ISK JPY KMF KRW PYG RWF UGX UYI VND VUV
--                   XAF XOF XPF
--   3 minor units : BHD IQD JOD KWD LYD OMR TND
--   4 minor units : CLF UYW
--   2 minor units : everything else
--
-- ISO records "N.A." for the precious metals. The product prices them by
-- weight and already decided 3 — a milligram; see the DECIMAL POLICY note in
-- packages/formatting/src/money.ts. Two decimals would round every gold
-- invoice to the centigram. The table carries 3 for XAU/XAG/XPT/XPD so it
-- agrees with the code that formats them.
--
-- IRT (Toman) is not an ISO code. It is here because it is what Iranian users
-- actually price in, and the product already supports it.
--
-- ---------------------------------------------------------------------------
-- ⚠️ FOUR CODES WHERE THE PRODUCT DELIBERATELY DEPARTS FROM THIS TABLE
--
--   code   this table (ISO)   FRACTION_DIGITS (product)
--   AFN    2                  0
--   IRR    2                  0
--   IRT    2 (n/a in ISO)     0
--   PKR    2                  0
--
-- ISO is right that the afghani has 100 pul and the rupee 100 paisa. Nobody
-- prices in them. The product writes these four without minor units, which is
-- the DECIMAL POLICY note in packages/formatting/src/money.ts, and that is the
-- figure every screen and every invoice uses.
--
-- This table keeps the ISO value because it is a reference table and lying in
-- it would make it useless for anything else. The divergence is intentional,
-- listed here, and pinned by `currency-policy.test.ts` — which fails on any
-- divergence that is NOT one of these four, so a new unexplained mismatch is
-- still caught.
--
-- ⚠️ `decimal_places` in this table is therefore NOT what formats money. The
-- code is. Do not wire a formatter to this column without deciding which of
-- the two wins for these four.
--
-- ---------------------------------------------------------------------------
-- ADDITIVE AND IDEMPOTENT. Creates one table, drops nothing, changes no
-- existing row. `ON CONFLICT DO NOTHING` so a re-run cannot overwrite an
-- `is_active` an operator has since changed by hand.
--
-- ROLLBACK / MITIGATION
--   DROP TABLE IF EXISTS currencies;
--
--   Nothing references it until the FKs at the bottom are added, so dropping
--   it returns the database exactly to its present state.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS currencies (
  code           text PRIMARY KEY,
  name           text NOT NULL,
  name_fa        text,
  symbol         text,

  -- ISO 4217 minor units. See the header for the non-2 groups and for the one
  -- deliberate departure (the metals).
  decimal_places integer NOT NULL DEFAULT 2,

  -- ⚠️ WHETHER THE PRODUCT SUPPORTS IT, NOT WHETHER IT EXISTS.
  --
  -- Every row here is a real currency. `is_active` marks the ones this product
  -- can format, price and post in — the 25 that CURRENCY_CODES and
  -- FRACTION_DIGITS both cover. A picker offering an inactive code would
  -- produce amounts with no precision contract.
  is_active      boolean NOT NULL DEFAULT false,

  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT currencies_code_format CHECK (code ~ '^[A-Z]{3}$'),
  CONSTRAINT currencies_decimals_sane CHECK (decimal_places BETWEEN 0 AND 4)
);

COMMENT ON TABLE currencies IS
  'ISO 4217 reference data (Patch 1 / L0.1). Global - no workspace_id. is_active marks the subset the product supports: it must stay in step with CURRENCY_CODES in packages/validation and FRACTION_DIGITS in packages/formatting, or amounts format with no precision contract (rule 9).';

COMMENT ON COLUMN currencies.is_active IS
  'Product support, not existence. Activating a code without adding it to CURRENCY_CODES and FRACTION_DIGITS produces wrong amounts, not a missing option.';

INSERT INTO currencies (code, name, name_fa, symbol, decimal_places) VALUES
  ('AED', 'UAE Dirham', 'درهم امارات', 'د.إ', 2),
  ('AFN', 'Afghani', 'افغانی', '؋', 2),
  ('ALL', 'Lek', 'لک آلبانی', NULL, 2),
  ('AMD', 'Armenian Dram', 'درام ارمنستان', NULL, 2),
  ('ANG', 'Netherlands Antillean Guilder', 'Netherlands Antillean Guilder', NULL, 2),
  ('AOA', 'Kwanza', 'Kwanza', NULL, 2),
  ('ARS', 'Argentine Peso', 'پزو آرژانتین', NULL, 2),
  ('AUD', 'Australian Dollar', 'دالر استرالیا', '$', 2),
  ('AWG', 'Aruban Florin', 'Aruban Florin', NULL, 2),
  ('AZN', 'Azerbaijan Manat', 'منات آذربایجان', NULL, 2),
  ('BAM', 'Convertible Mark', 'Convertible Mark', NULL, 2),
  ('BBD', 'Barbados Dollar', 'Barbados Dollar', NULL, 2),
  ('BDT', 'Taka', 'تاکای بنگلادش', NULL, 2),
  ('BGN', 'Bulgarian Lev', 'Bulgarian Lev', NULL, 2),
  ('BHD', 'Bahraini Dinar', 'دینار بحرین', NULL, 3),
  ('BIF', 'Burundi Franc', 'Burundi Franc', NULL, 0),
  ('BMD', 'Bermudian Dollar', 'Bermudian Dollar', NULL, 2),
  ('BND', 'Brunei Dollar', 'Brunei Dollar', NULL, 2),
  ('BOB', 'Boliviano', 'Boliviano', NULL, 2),
  ('BRL', 'Brazilian Real', 'رئال برزیل', 'R$', 2),
  ('BSD', 'Bahamian Dollar', 'Bahamian Dollar', NULL, 2),
  ('BTN', 'Ngultrum', 'Ngultrum', NULL, 2),
  ('BWP', 'Pula', 'Pula', NULL, 2),
  ('BYN', 'Belarusian Ruble', 'Belarusian Ruble', NULL, 2),
  ('BZD', 'Belize Dollar', 'Belize Dollar', NULL, 2),
  ('CAD', 'Canadian Dollar', 'دالر کانادا', '$', 2),
  ('CDF', 'Congolese Franc', 'Congolese Franc', NULL, 2),
  ('CHF', 'Swiss Franc', 'فرانک سوئیس', 'CHF', 2),
  ('CLF', 'Unidad de Fomento', 'Unidad de Fomento', NULL, 4),
  ('CLP', 'Chilean Peso', 'Chilean Peso', NULL, 0),
  ('CNY', 'Yuan Renminbi', 'یوان چین', '¥', 2),
  ('COP', 'Colombian Peso', 'Colombian Peso', NULL, 2),
  ('CRC', 'Costa Rican Colon', 'Costa Rican Colon', NULL, 2),
  ('CUP', 'Cuban Peso', 'Cuban Peso', NULL, 2),
  ('CVE', 'Cabo Verde Escudo', 'Cabo Verde Escudo', NULL, 2),
  ('CZK', 'Czech Koruna', 'کرون چک', NULL, 2),
  ('DJF', 'Djibouti Franc', 'Djibouti Franc', NULL, 0),
  ('DKK', 'Danish Krone', 'کرون دانمارک', NULL, 2),
  ('DOP', 'Dominican Peso', 'Dominican Peso', NULL, 2),
  ('DZD', 'Algerian Dinar', 'دینار الجزایر', NULL, 2),
  ('EGP', 'Egyptian Pound', 'پوند مصر', NULL, 2),
  ('ERN', 'Nakfa', 'Nakfa', NULL, 2),
  ('ETB', 'Ethiopian Birr', 'Ethiopian Birr', NULL, 2),
  ('EUR', 'Euro', 'یورو', '€', 2),
  ('FJD', 'Fiji Dollar', 'Fiji Dollar', NULL, 2),
  ('FKP', 'Falkland Islands Pound', 'Falkland Islands Pound', NULL, 2),
  ('GBP', 'Pound Sterling', 'پوند انگلیس', '£', 2),
  ('GEL', 'Lari', 'لاری گرجستان', NULL, 2),
  ('GHS', 'Ghana Cedi', 'Ghana Cedi', NULL, 2),
  ('GIP', 'Gibraltar Pound', 'Gibraltar Pound', NULL, 2),
  ('GMD', 'Dalasi', 'Dalasi', NULL, 2),
  ('GNF', 'Guinean Franc', 'Guinean Franc', NULL, 0),
  ('GTQ', 'Quetzal', 'Quetzal', NULL, 2),
  ('GYD', 'Guyana Dollar', 'Guyana Dollar', NULL, 2),
  ('HKD', 'Hong Kong Dollar', 'دالر هنگ‌کنگ', '$', 2),
  ('HNL', 'Lempira', 'Lempira', NULL, 2),
  ('HTG', 'Gourde', 'Gourde', NULL, 2),
  ('HUF', 'Forint', 'فورینت مجارستان', NULL, 2),
  ('IDR', 'Rupiah', 'روپیه اندونزی', NULL, 2),
  ('ILS', 'New Israeli Sheqel', 'New Israeli Sheqel', NULL, 2),
  ('INR', 'Indian Rupee', 'روپیه هند', '₹', 2),
  ('IQD', 'Iraqi Dinar', 'دینار عراق', 'ع.د', 3),
  ('IRR', 'Iranian Rial', 'ریال ایران', '﷼', 2),
  ('IRT', 'Iranian Toman', 'تومان', 'ت', 2),
  ('ISK', 'Iceland Krona', 'Iceland Krona', NULL, 0),
  ('JMD', 'Jamaican Dollar', 'Jamaican Dollar', NULL, 2),
  ('JOD', 'Jordanian Dinar', 'دینار اردن', NULL, 3),
  ('JPY', 'Yen', 'یِن ژاپن', '¥', 0),
  ('KES', 'Kenyan Shilling', 'Kenyan Shilling', NULL, 2),
  ('KGS', 'Som', 'سوم قرقیزستان', NULL, 2),
  ('KHR', 'Riel', 'Riel', NULL, 2),
  ('KMF', 'Comorian Franc', 'Comorian Franc', NULL, 0),
  ('KPW', 'North Korean Won', 'North Korean Won', NULL, 2),
  ('KRW', 'Won', 'وون کره', '₩', 0),
  ('KWD', 'Kuwaiti Dinar', 'دینار کویت', NULL, 3),
  ('KYD', 'Cayman Islands Dollar', 'Cayman Islands Dollar', NULL, 2),
  ('KZT', 'Tenge', 'تنگه قزاقستان', NULL, 2),
  ('LAK', 'Lao Kip', 'Lao Kip', NULL, 2),
  ('LBP', 'Lebanese Pound', 'لیره لبنان', NULL, 2),
  ('LKR', 'Sri Lanka Rupee', 'Sri Lanka Rupee', NULL, 2),
  ('LRD', 'Liberian Dollar', 'Liberian Dollar', NULL, 2),
  ('LSL', 'Loti', 'Loti', NULL, 2),
  ('LYD', 'Libyan Dinar', 'دینار لیبی', NULL, 3),
  ('MAD', 'Moroccan Dirham', 'درهم مراکش', NULL, 2),
  ('MDL', 'Moldovan Leu', 'Moldovan Leu', NULL, 2),
  ('MGA', 'Malagasy Ariary', 'Malagasy Ariary', NULL, 2),
  ('MKD', 'Denar', 'Denar', NULL, 2),
  ('MMK', 'Kyat', 'Kyat', NULL, 2),
  ('MNT', 'Tugrik', 'Tugrik', NULL, 2),
  ('MOP', 'Pataca', 'Pataca', NULL, 2),
  ('MRU', 'Ouguiya', 'Ouguiya', NULL, 2),
  ('MUR', 'Mauritius Rupee', 'Mauritius Rupee', NULL, 2),
  ('MVR', 'Rufiyaa', 'Rufiyaa', NULL, 2),
  ('MWK', 'Malawi Kwacha', 'Malawi Kwacha', NULL, 2),
  ('MXN', 'Mexican Peso', 'پزو مکزیک', '$', 2),
  ('MYR', 'Malaysian Ringgit', 'رینگیت مالزی', NULL, 2),
  ('MZN', 'Mozambique Metical', 'Mozambique Metical', NULL, 2),
  ('NAD', 'Namibia Dollar', 'Namibia Dollar', NULL, 2),
  ('NGN', 'Naira', 'نایرا نیجریه', '₦', 2),
  ('NIO', 'Cordoba Oro', 'Cordoba Oro', NULL, 2),
  ('NOK', 'Norwegian Krone', 'کرون نروژ', NULL, 2),
  ('NPR', 'Nepalese Rupee', 'روپیه نپال', NULL, 2),
  ('NZD', 'New Zealand Dollar', 'دالر نیوزیلند', '$', 2),
  ('OMR', 'Rial Omani', 'ریال عمان', NULL, 3),
  ('PAB', 'Balboa', 'Balboa', NULL, 2),
  ('PEN', 'Sol', 'Sol', NULL, 2),
  ('PGK', 'Kina', 'Kina', NULL, 2),
  ('PHP', 'Philippine Peso', 'پزو فیلیپین', '₱', 2),
  ('PKR', 'Pakistan Rupee', 'روپیه پاکستان', '₨', 2),
  ('PLN', 'Zloty', 'زلوتی لهستان', NULL, 2),
  ('PYG', 'Guarani', 'Guarani', NULL, 0),
  ('QAR', 'Qatari Rial', 'ریال قطر', NULL, 2),
  ('RON', 'Romanian Leu', 'Romanian Leu', NULL, 2),
  ('RSD', 'Serbian Dinar', 'Serbian Dinar', NULL, 2),
  ('RUB', 'Russian Ruble', 'روبل روسیه', '₽', 2),
  ('RWF', 'Rwanda Franc', 'Rwanda Franc', NULL, 0),
  ('SAR', 'Saudi Riyal', 'ریال سعودی', '﷼', 2),
  ('SBD', 'Solomon Islands Dollar', 'Solomon Islands Dollar', NULL, 2),
  ('SCR', 'Seychelles Rupee', 'Seychelles Rupee', NULL, 2),
  ('SDG', 'Sudanese Pound', 'Sudanese Pound', NULL, 2),
  ('SEK', 'Swedish Krona', 'کرون سوئد', NULL, 2),
  ('SGD', 'Singapore Dollar', 'دالر سنگاپور', '$', 2),
  ('SHP', 'Saint Helena Pound', 'Saint Helena Pound', NULL, 2),
  ('SLE', 'Leone', 'Leone', NULL, 2),
  ('SOS', 'Somali Shilling', 'Somali Shilling', NULL, 2),
  ('SRD', 'Surinam Dollar', 'Surinam Dollar', NULL, 2),
  ('SSP', 'South Sudanese Pound', 'South Sudanese Pound', NULL, 2),
  ('STN', 'Dobra', 'Dobra', NULL, 2),
  ('SVC', 'El Salvador Colon', 'El Salvador Colon', NULL, 2),
  ('SYP', 'Syrian Pound', 'لیره سوریه', NULL, 2),
  ('SZL', 'Lilangeni', 'Lilangeni', NULL, 2),
  ('THB', 'Baht', 'بات تایلند', '฿', 2),
  ('TJS', 'Somoni', 'سامانی تاجیکستان', 'ЅМ', 2),
  ('TMT', 'Turkmenistan New Manat', 'منات ترکمنستان', 'm', 2),
  ('TND', 'Tunisian Dinar', 'دینار تونس', NULL, 3),
  ('TOP', 'Pa’anga', 'Pa’anga', NULL, 2),
  ('TRY', 'Turkish Lira', 'لیر ترکیه', '₺', 2),
  ('TTD', 'Trinidad and Tobago Dollar', 'Trinidad and Tobago Dollar', NULL, 2),
  ('TWD', 'New Taiwan Dollar', 'دالر تایوان', NULL, 2),
  ('TZS', 'Tanzanian Shilling', 'Tanzanian Shilling', NULL, 2),
  ('UAH', 'Hryvnia', 'گریونا اوکراین', '₴', 2),
  ('UGX', 'Uganda Shilling', 'Uganda Shilling', NULL, 0),
  ('USD', 'US Dollar', 'دالر', '$', 2),
  ('UYU', 'Peso Uruguayo', 'Peso Uruguayo', NULL, 2),
  ('UYW', 'Unidad Previsional', 'Unidad Previsional', NULL, 4),
  ('UZS', 'Uzbekistan Sum', 'سوم ازبکستان', 'so''m', 2),
  ('VES', 'Bolívar Soberano', 'Bolívar Soberano', NULL, 2),
  ('VND', 'Dong', 'دong ویتنام', '₫', 0),
  ('VUV', 'Vatu', 'Vatu', NULL, 0),
  ('WST', 'Tala', 'Tala', NULL, 2),
  ('XAF', 'CFA Franc BEAC', 'CFA Franc BEAC', NULL, 0),
  ('XAG', 'Silver (gram)', 'نقره', 'g', 3),
  ('XAU', 'Gold (gram)', 'طلا', 'g', 3),
  ('XCD', 'East Caribbean Dollar', 'East Caribbean Dollar', NULL, 2),
  ('XOF', 'CFA Franc BCEAO', 'CFA Franc BCEAO', NULL, 0),
  ('XPD', 'Palladium (gram)', 'پالادیوم', 'g', 3),
  ('XPF', 'CFP Franc', 'CFP Franc', NULL, 0),
  ('XPT', 'Platinum (gram)', 'پلاتین', 'g', 3),
  ('YER', 'Yemeni Rial', 'ریال یمن', NULL, 2),
  ('ZAR', 'Rand', 'رند آفریقای جنوبی', 'R', 2),
  ('ZMW', 'Zambian Kwacha', 'Zambian Kwacha', NULL, 2),
  ('ZWG', 'Zimbabwe Gold', 'Zimbabwe Gold', NULL, 2)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- The 25 the product supports today.
--
-- Mirrors CURRENCY_CODES in packages/validation/src/schemas/common.schema.ts.
-- Verification query 4 fails if the two ever drift.
-- ---------------------------------------------------------------------------
UPDATE currencies
   SET is_active = true
 WHERE code IN (
   'AFN','IRT','IRR','PKR','INR','TRY','AED','SAR','IQD','TJS','UZS','TMT','CNY','RUB',
   'USD','EUR','GBP','CHF','JPY','CAD','AUD',
   'XAU','XAG','XPT','XPD'
 );

CREATE INDEX IF NOT EXISTS currencies_active_idx ON currencies (code) WHERE is_active;

-- ---------------------------------------------------------------------------
-- RLS — the same shape as `units` (phase-t2), which is the only reference-data
-- pattern in this database. Read for anyone signed in; NO write policy at all,
-- so only the service role can change it. A customer who could edit a currency
-- row could change how every amount in the product is formatted.
-- ---------------------------------------------------------------------------
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS currencies_read_authenticated ON currencies;
CREATE POLICY currencies_read_authenticated
  ON currencies FOR SELECT
  TO authenticated
  USING (true);

REVOKE ALL ON currencies FROM PUBLIC;
REVOKE ALL ON currencies FROM anon;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION — PENDING HUMAN CONFIRMATION
-- ============================================================================

-- 1. Seeded.  EXPECT: 162
SELECT COUNT(*) AS currency_count FROM currencies;

-- 2. The precision groups.  EXPECT: 0 -> 16, 2 -> 133, 3 -> 11, 4 -> 2
--
--    3 = the 7 ISO dinars + the 4 metals. See the header.
--    0 = 16, not 17: UYI (Uruguay Peso en Unidades Indexadas) is a
--    zero-decimal ISO code that is deliberately NOT seeded — it is an
--    indexation unit, not a currency anyone invoices in.
SELECT decimal_places, COUNT(*) AS codes
FROM   currencies
GROUP  BY decimal_places
ORDER  BY decimal_places;

-- 3. ⚠️ RUN BEFORE ADDING ANY FOREIGN KEY.
--    Existing rows whose currency is not in the new table.  EXPECT: no rows.
--    If anything comes back, DO NOT add the FKs — report the codes instead.
SELECT 'products' AS source, p.currency AS unknown_code, COUNT(*) AS row_count
FROM   products p
WHERE  p.currency IS NOT NULL
  AND  NOT EXISTS (SELECT 1 FROM currencies c WHERE c.code = p.currency)
GROUP  BY p.currency
UNION ALL
SELECT 'invoices', i.currency, COUNT(*)
FROM   invoices i
WHERE  i.currency IS NOT NULL
  AND  NOT EXISTS (SELECT 1 FROM currencies c WHERE c.code = i.currency)
GROUP  BY i.currency
UNION ALL
SELECT 'payments', pay.currency, COUNT(*)
FROM   payments pay
WHERE  pay.currency IS NOT NULL
  AND  NOT EXISTS (SELECT 1 FROM currencies c WHERE c.code = pay.currency)
GROUP  BY pay.currency;

-- 4. ⚠️ THE ACTIVE SET MATCHES THE CODE.  EXPECT: 25, and the list identical
--    to CURRENCY_CODES in packages/validation.
SELECT COUNT(*) AS active_count FROM currencies WHERE is_active;

SELECT string_agg(code, ',' ORDER BY code) AS active_codes
FROM   currencies WHERE is_active;

-- 5. RLS on, read-only.  EXPECT: rowsecurity = true, policies = 1, cmd SELECT
SELECT c.relrowsecurity AS rowsecurity,
       (SELECT COUNT(*) FROM pg_policies p WHERE p.tablename = 'currencies') AS policies
FROM   pg_class c WHERE c.relname = 'currencies';

SELECT policyname, cmd FROM pg_policies WHERE tablename = 'currencies';

-- 6. No user-facing role can write it.  EXPECT: 0
SELECT COUNT(*) AS user_grants
FROM   information_schema.role_table_grants
WHERE  table_name = 'currencies'
  AND  grantee IN ('authenticated', 'anon', 'PUBLIC', 'public');


-- ============================================================================
-- ⚠️ FOREIGN KEYS — RUN ONLY IF VERIFICATION QUERY 3 RETURNED NO ROWS.
--
-- Commented deliberately. A FK added while unknown codes exist fails on those
-- rows, and there is no agreed repair for them (G3). If query 3 returns
-- anything, report the codes rather than running this.
-- ============================================================================

-- ALTER TABLE products ADD CONSTRAINT products_currency_fkey
--   FOREIGN KEY (currency) REFERENCES currencies(code) ON UPDATE CASCADE;
-- ALTER TABLE invoices ADD CONSTRAINT invoices_currency_fkey
--   FOREIGN KEY (currency) REFERENCES currencies(code) ON UPDATE CASCADE;
-- ALTER TABLE payments ADD CONSTRAINT payments_currency_fkey
--   FOREIGN KEY (currency) REFERENCES currencies(code) ON UPDATE CASCADE;
