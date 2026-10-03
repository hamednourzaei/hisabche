# دری (af) — واژه‌نامه و فهرست کلیدهای اصلاح‌شده

> ساخته‌شده در ۳ اکتبر ۲۰۲۶ با `scratchpad/dari.js`. فایل `af/common.json` از قبل در ۱۱۰۴ کلید
> با فارسی فرق داشت؛ این دور، واژه‌های **همان** متن‌های دریِ موجود روی کلیدهایی اعمال شد که
> هنوز کپی عینِ فارسی بودند. متنی که کسی قبلاً به دری نوشته بود دست نخورد.

## واژه‌نامه (اندازه‌گیری‌شده روی متن‌های دری موجود)

| فارسی             | دری             | نسبت در متن‌های موجود                                          |
| ----------------- | --------------- | -------------------------------------------------------------- |
| کالا / کالاها     | جنس / جنس‌ها    | ۸۰ به ۱                                                        |
| انبار / انبارداری | گدام / گدامداری | ۷۴ به ۷                                                        |
| فاکتور            | بل              | ۹۲ به ۳۰                                                       |
| فروشگاه           | دوکان           | ۱۱ به ۰                                                        |
| فروردین … اسفند   | حمل … حوت       | کلیدهای `months.*` (آرایه‌ی `calendar.months` از قبل درست بود) |

«پیش‌فاکتور» یک اصطلاح است و دست نخورد.

## عمداً دست نخورد (دو معنی دارند — تصمیم با یک دری‌زبان)

- **حقوق**: هم «معاش» (حقوق کارمند) و هم «حقوق کاربر/قانونی». جایگزینی کور، متن‌های حقوقی را خراب می‌کند.
- **بدهی**: در متن‌های موجود گاهی «قرض»، گاهی «پرداختی»، گاهی خودِ «بدهی».
- **گزارش / مالیات / تأمین‌کننده**: در متن‌های موجود هر دو شکل دیده می‌شود.

## قاعده برای کلید تازه

هر کلید جدید در `af` با همین واژه‌نامه نوشته شود، نه کپی فارسی. تاریخ و نام ماه در UI از
`Intl` با `fa-AF` می‌آید؛ فقط جایی که نام ماه متنِ ثابت است این کلیدها خوانده می‌شوند.

## کلیدهای اصلاح‌شده در این دور: 301

### `landing` — 42

- `landing.invoicesIssued`
- `landing.stat1`
- `landing.testimonial1Role`
- `landing.solution2Title`
- `landing.feature2Title`
- `landing.pricingFreeFeature1`
- `landing.pricingProFeature1`
- `landing.pricingProFeature3`
- `landing.demoTab.invoice`
- `landing.demoInvoiceTitle`
- `landing.industry.fashion`
- `landing.industry.cosmetics`
- `landing.industry.jewelry`
- `landing.industry.electronics`
- `landing.industry.mobile`
- `landing.industry.computer`
- `landing.industry.hardware`
- `landing.industry.furniture`
- `landing.industry.warehouse`
- `landing.industry.sports`
- `landing.industry.toys`
- `landing.industry.gift`
- `landing.industry.pet`
- `landing.industry.ecommerce`
- `landing.footerLink.invoicing`
- `landing.footerLink.inventory`
- `landing.faq.related.inventory`
- `landing.pricing.group.inventory`
- `landing.pricing.row.invoices`
- `landing.pricing.row.stock`
- `landing.pricing.row.multiWarehouse`
- `landing.transformStep.invoice.label`
- `landing.transformStep.invoice.desc`
- `landing.transformStep.invoice.before`
- `landing.modules.item.invoices`
- `landing.system.step.sell.desc`
- `landing.system.step.invoice.title`
- `landing.system.trace.step4`
- `landing.chapter.ledger.desc`
- `landing.chapter.ai.example3`
- `landing.visual.ai.answer`
- `landing.industries.services.desc`

### `market` — 26

- `market.notEnabledHint`
- `market.seller.title`
- `market.seller.description`
- `market.profile.hint`
- `market.profile.name`
- `market.profile.slug`
- `market.profile.description`
- `market.profile.address`
- `market.profile.nameRequired`
- `market.profile.suspended`
- `market.listings.hint`
- `market.listings.deleteConfirm`
- `market.listing.product`
- `market.listing.description`
- `market.listing.productRequired`
- `market.errors.MARKET_SLUG_TAKEN`
- `market.errors.MARKET_PRODUCT_ALREADY_LISTED`
- `market.errors.MARKET_PRODUCT_NOT_FOUND`
- `market.public.title`
- `market.public.description`
- `market.public.intro`
- `market.public.empty`
- `market.public.sellerTitle`
- `market.public.sellerDescription`
- `market.public.sellerEmpty`
- `market.public.listingDescription`

### `warehouse` — 23

- `warehouse.title`
- `warehouse.fromWarehouse`
- `warehouse.toWarehouse`
- `warehouse.deleteHasSales`
- `warehouse.deleteHasStockHistory`
- `warehouse.deleteFailed`
- `warehouse.byWarehouse.title`
- `warehouse.byWarehouse.help`
- `warehouse.byWarehouse.loadError`
- `warehouse.byWarehouse.unassigned`
- `warehouse.byWarehouse.negativeHelp`
- `warehouse.byWarehouse.moveHelp`
- `warehouse.byWarehouse.pickWarehouse`
- `warehouse.byWarehouse.move`
- `warehouse.byWarehouse.moved`
- `warehouse.byWarehouse.pickRequired`
- `warehouse.byWarehouse.editWarehouse`
- `warehouse.byWarehouse.editOnly`
- `warehouse.byWarehouse.error.PRODUCT_WAREHOUSE_REQUIRED`
- `warehouse.byWarehouse.error.PRODUCT_WAREHOUSE_NOT_FOUND`
- `warehouse.deactivateInstead`
- `warehouse.deactivated`
- `warehouse.deactivateFailed`

### `invoices` — 18

- `invoices.title`
- `invoices.saleInvoice`
- `invoices.purchaseInvoice`
- `invoices.newInvoice`
- `invoices.invoiceNumber`
- `invoices.invoiceDate`
- `invoices.printInvoice`
- `invoices.shareInvoice`
- `invoices.invoiceList`
- `invoices.detail`
- `invoices.notFound`
- `invoices.copiedToClipboard`
- `invoices.salesInvoice`
- `invoices.invoiceInfo`
- `invoices.metadata`
- `invoices.qrHint`
- `invoices.publicFooter`
- `invoices.noInvoicesDesc`

### `developer` — 17

- `developer.keysHelp`
- `developer.keyNamePlaceholder`
- `developer.scope.read_invoices`
- `developer.scope.read_products`
- `developer.scope.write_products`
- `developer.scope.write_invoices`
- `developer.scope.read_inventory`
- `developer.event.invoice_created`
- `developer.event.invoice_updated`
- `developer.event.invoice_cancelled`
- `developer.event.invoice_deleted`
- `developer.event.invoice_posted`
- `developer.event.invoice_payment_recorded`
- `developer.event.product_created`
- `developer.event.inventory_low_stock`
- `developer.event.inventory_restocked`
- `developer.event.order_invoiced`

### `docs` — 15

- `docs.barcodes.summary`
- `docs.barcodes.seoDescription`
- `docs.barcodes.codes.heading`
- `docs.barcodes.codes.body1`
- `docs.barcodes.codes.body2`
- `docs.barcodes.scan.heading`
- `docs.barcodes.scan.body1`
- `docs.barcodes.scan.body2`
- `docs.barcodes.scan.step1`
- `docs.barcodes.scan.step3`
- `docs.barcodes.scale.body1`
- `docs.barcodes.scale.body2`
- `docs.developers.webhooks.body1`
- `docs.developers.storefront.body1`
- `docs.developers.sandbox.body1`

### `invoiceDetail` — 15

- `invoiceDetail.ledgerNothingToPost`
- `invoiceDetail.ledgerMissingAccounts`
- `invoiceDetail.ledgerNotPostable`
- `invoiceDetail.reasonInsufficientStock`
- `invoiceDetail.reasonCancelled`
- `invoiceDetail.ledgerPostedUncosted`
- `invoiceDetail.error_PAYMENT_ALLOCATION_AMOUNT_INVALID`
- `invoiceDetail.error_PAYMENT_ALLOCATION_DUPLICATE`
- `invoiceDetail.error_PAYMENT_ALLOCATION_EXCEEDS_OUTSTANDING`
- `invoiceDetail.error_PAYMENT_ALLOCATION_INVOICE_UNKNOWN`
- `invoiceDetail.error_PAYMENT_ALLOCATION_PARTY_MISMATCH`
- `invoiceDetail.error_PAYMENT_INVOICE_NOT_IN_WORKSPACE`
- `invoiceDetail.error_PAYMENT_WITHOUT_PARTY_NEEDS_ALLOCATION`
- `invoiceDetail.paymentsReadFailed`
- `invoiceDetail.paidWithoutRecord`

### `months` — 12

- `months.farvardin`
- `months.ordibehesht`
- `months.khordad`
- `months.tir`
- `months.mordad`
- `months.shahrivar`
- `months.mehr`
- `months.aban`
- `months.azar`
- `months.dey`
- `months.bahman`
- `months.esfand`

### `orders` — 10

- `orders.emptyHint`
- `orders.chooseCustomer`
- `orders.paidFollowsInvoice`
- `orders.status.invoiced`
- `orders.action.invoice`
- `orders.error.ORDER_INVOICE_REQUIRED`
- `orders.error.ORDER_INSUFFICIENT_STOCK`
- `orders.error.ORDER_PRODUCT_NOT_FOUND`
- `orders.error.ORDER_PRODUCT_NOT_PRICED`
- `orders.error.ORDER_ITEMS_REQUIRED`

### `nav` — 8

- `nav.warehouse`
- `nav.invoices`
- `nav.expiry_description`
- `nav.data_migration_description`
- `nav.product_list`
- `nav.product_list_description`
- `nav.market_seller`
- `nav.market_seller_description`

### `dashboard` — 8

- `dashboard.invoicesLine`
- `dashboard.viewAllInvoices`
- `dashboard.invoicesCount`
- `dashboard.funnel.band.invoices`
- `dashboard.openSalesInvoices`
- `dashboard.openTodayInvoices`
- `dashboard.openUnpaidInvoices`
- `dashboard.openWarehouse`

### `productImages` — 8

- `productImages.title`
- `productImages.hint`
- `productImages.empty`
- `productImages.notConfigured`
- `productImages.loadFailed`
- `productImages.full`
- `productImages.errors.PRODUCT_IMAGE_LIMIT`
- `productImages.errors.PRODUCT_IMAGES_NOT_CONFIGURED`

### `invoiceBuilder` — 7

- `invoiceBuilder.notLinkedTitle`
- `invoiceBuilder.notLinkedHint`
- `invoiceBuilder.oversoldTitle`
- `invoiceBuilder.oversoldHint`
- `invoiceBuilder.invoiceTotal`
- `invoiceBuilder.fullMismatch`
- `invoiceBuilder.partialCoversAll`

### `products` — 7

- `products.title`
- `products.subtitle`
- `products.name`
- `products.search_label`
- `products.no_match`
- `products.empty`
- `products.empty_hint`

### `customers` — 6

- `customers.selectInvoice`
- `customers.actionPayment`
- `customers.tabInvoices`
- `customers.statsCoverage`
- `customers.statsCoverageInvoices`
- `customers.noOpenDealsDesc`

### `till` — 6

- `till.settlements`
- `till.ledger_hint`
- `till.filter_invoices`
- `till.kind_settlement_in`
- `till.kind_settlement_out`
- `till.cash_flow_hint`

### `evidence` — 6

- `evidence.journeyTitle`
- `evidence.journeyHelp`
- `evidence.onHand`
- `evidence.warning.NOT_POSTED`
- `evidence.source.invoice`
- `evidence.source.transfer`

### `quickInvoice` — 4

- `quickInvoice.title`
- `quickInvoice.previewTitle`
- `quickInvoice.previewDesc`
- `quickInvoice.isPaid`

### `workflow` — 4

- `workflow.entity.invoice`
- `workflow.rejectPlaceholder`
- `workflow.templates.description`
- `workflow.templates.namePlaceholder`

### `admin` — 4

- `admin.limits.hint`
- `admin.limits.invoices`
- `admin.market.pageTitle`
- `admin.market.searchPlaceholder`

### `expiry` — 4

- `expiry.subtitle`
- `expiry.expired_value`
- `expiry.product`
- `expiry.empty_hint`

### `settings` — 3

- `settings.invoiceStartNumber`
- `settings.defaultWarehouse`
- `settings.businessStampDesc`

### `billing` — 3

- `billing.limitReached.invoices`
- `billing.plans.pro.features.unlimited_invoices`
- `billing.usage.invoices`

### `onboarding` — 3

- `onboarding.storeSize`
- `onboarding.smallStore`
- `onboarding.mediumStore`

### `preview` — 3

- `preview.title`
- `preview.chip.invoice`
- `preview.feature.invoice`

### `migration` — 3

- `migration.entity_product`
- `migration.field_name`
- `migration.field_sku`

### `dataSync` — 3

- `dataSync.import_hint`
- `dataSync.export_where`
- `dataSync.duplicate_products`

### `workQueue` — 3

- `workQueue.overdue_invoices`
- `workQueue.expiring_stock`
- `workQueue.low_stock`

### `storefront` — 3

- `storefront.help`
- `storefront.notConfigured`
- `storefront.saved`

### `portal` — 3

- `portal.panelHelp`
- `portal.invoices`
- `portal.noInvoices`

### `oauth` — 3

- `oauth.appNamePlaceholder`
- `oauth.category.inventory`
- `oauth.category.ecommerce`

### `action` — 2

- `action.confirmCreate`
- `action.previewInvoice`

### `conflicts` — 2

- `conflicts.entity_invoice`
- `conflicts.entity_product`

### `domain` — 2

- `domain.inventory`
- `domain.sales_description`

### `customerAnalysis` — 2

- `customerAnalysis.noDocuments`
- `customerAnalysis.insight.OVERDUE_SHARE_HIGH.body`

### `signup` — 1

- `signup.companyName`

### `sync` — 1

- `sync.download.hint`

### `accounting` — 1

- `accounting.postUnposted`

### `permissions` — 1

- `permissions.module.invoices`

### `pricing` — 1

- `pricing.free.feature2`

### `notifications` — 1

- `notifications.invoiceNumber`

### `search` — 1

- `search.placeholder`

### `purchasing` — 1

- `purchasing.receiveGoods`

### `activity` — 1

- `activity.filter.invoices`

### `assets` — 1

- `assets.empty_hint`

### `hardware` — 1

- `hardware.webNote`

### `sandbox` — 1

- `sandbox.help`

### `marketplace` — 1

- `marketplace.permissionsHelp`
