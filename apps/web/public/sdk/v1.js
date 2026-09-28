/*!
 * Hisabche Storefront SDK v1
 *
 * Connects a website to its Hisabche business with a PUBLISHABLE key:
 * read the catalogue and availability, place a pending order, and show the
 * customer their order's status. Prices, totals and stock are always decided
 * by Hisabche — nothing this script sends can set an amount.
 *
 *   <script src="https://hisabche.com/sdk/v1.js"></script>
 *   <script>
 *     const shop = Hisabche.init({ key: 'hk_pub_…', apiBase: 'https://api.hisabche.com/api' })
 *     shop.mount()   // fills [data-hisabche-stock] and [data-hisabche-buy]
 *   </script>
 *
 *   Hisabche.renderInvoice(el, invoiceShareToken, { apiBase })   // one invoice
 *   Hisabche.renderPortal(el, portalToken, { apiBase })         // a customer's account
 *
 * No dependencies. Text is written with textContent only — never innerHTML —
 * so nothing from the catalogue can run as code on the shop's page.
 */
;(function (root) {
  'use strict'

  var KEY_PATTERN = /^hk_pub_[A-Za-z0-9_-]{43}$/
  var STRINGS = {
    fa: {
      inStock: 'موجود',
      outOfStock: 'ناموجود',
      buy: 'سفارش',
      name: 'نام',
      phone: 'شماره تماس',
      quantity: 'تعداد',
      submit: 'ثبت سفارش',
      placed: 'سفارش ثبت شد. شماره‌ی سفارش: ',
      failed: 'سفارش ثبت نشد: ',
    },
    en: {
      inStock: 'In stock',
      outOfStock: 'Out of stock',
      buy: 'Order',
      name: 'Name',
      phone: 'Phone',
      quantity: 'Quantity',
      submit: 'Place order',
      placed: 'Order placed. Order number: ',
      failed: 'The order was not placed: ',
    },
  }

  function newIdempotencyKey() {
    if (root.crypto && typeof root.crypto.randomUUID === 'function')
      return 'sdk-' + root.crypto.randomUUID()
    var s = 'sdk-'
    for (var i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16)
    return s
  }

  function HisabcheError(code, status) {
    this.name = 'HisabcheError'
    this.code = code
    this.status = status
    this.message = code
  }
  HisabcheError.prototype = Object.create(Error.prototype)

  function init(options) {
    if (!options || !KEY_PATTERN.test(String(options.key || ''))) {
      throw new HisabcheError('PUBLISHABLE_KEY_INVALID', 0)
    }
    var key = options.key
    var apiBase = String(options.apiBase || 'https://api.hisabche.com/api').replace(/\/+$/, '')
    var lang = options.lang === 'en' ? 'en' : 'fa'
    var text = STRINGS[lang]
    var fetchImpl = options.fetch || root.fetch.bind(root)

    function request(method, path, body, extraHeaders) {
      var headers = { 'Hisabche-Publishable-Key': key }
      if (body !== undefined) headers['Content-Type'] = 'application/json'
      if (extraHeaders) for (var h in extraHeaders) headers[h] = extraHeaders[h]
      return fetchImpl(apiBase + '/public/v1' + path, {
        method: method,
        headers: headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'omit',
      }).then(function (res) {
        return res.json().then(
          function (data) {
            if (!res.ok)
              throw new HisabcheError((data && data.code) || 'HTTP_' + res.status, res.status)
            return data
          },
          function () {
            throw new HisabcheError('HTTP_' + res.status, res.status)
          },
        )
      })
    }

    var shop = {
      catalog: function (query) {
        var q = query || {}
        var params = []
        if (q.search) params.push('search=' + encodeURIComponent(q.search))
        if (q.limit) params.push('limit=' + Number(q.limit))
        if (q.offset) params.push('offset=' + Number(q.offset))
        return request('GET', '/catalog' + (params.length ? '?' + params.join('&') : ''))
      },

      product: function (id) {
        return request('GET', '/products/' + encodeURIComponent(id))
      },

      /**
       * Places a PENDING order. One idempotency key per attempt: a network
       * failure is retried ONCE with the same key, so the retry can never
       * make a second order. Pass your own key to extend that across reloads.
       */
      createOrder: function (order, opts) {
        var idem = (opts && opts.idempotencyKey) || newIdempotencyKey()
        var body = {
          items: (order.items || []).map(function (i) {
            return { productId: String(i.productId), quantity: Number(i.quantity) }
          }),
          customer: {
            name: String((order.customer && order.customer.name) || ''),
            phone: String((order.customer && order.customer.phone) || ''),
          },
        }
        if (order.customer && order.customer.email)
          body.customer.email = String(order.customer.email)
        if (order.customer && order.customer.note) body.customer.note = String(order.customer.note)
        var send = function () {
          return request('POST', '/orders', body, { 'Idempotency-Key': idem })
        }
        return send().catch(function (err) {
          if (err instanceof HisabcheError) throw err
          return send()
        })
      },

      orderStatus: function (token) {
        return request('GET', '/orders/' + encodeURIComponent(token))
      },

      /** Fills [data-hisabche-stock] badges and [data-hisabche-buy] buttons under `container`. */
      mount: function (container) {
        var scope = container || root.document
        var stock = scope.querySelectorAll('[data-hisabche-stock]')
        var buys = scope.querySelectorAll('[data-hisabche-buy]')
        var jobs = []
        Array.prototype.forEach.call(stock, function (el) {
          jobs.push(
            shop.product(el.getAttribute('data-hisabche-stock')).then(
              function (p) {
                var label = p.availability === 'in_stock' ? text.inStock : text.outOfStock
                el.textContent =
                  typeof p.quantity === 'number' ? label + ' (' + p.quantity + ')' : label
                el.setAttribute('data-availability', p.availability)
              },
              function () {
                el.textContent = ''
              },
            ),
          )
        })
        Array.prototype.forEach.call(buys, function (el) {
          renderBuy(el, el.getAttribute('data-hisabche-buy'))
        })
        return Promise.all(jobs)
      },
    }

    function field(labelText, name, type) {
      var label = root.document.createElement('label')
      label.style.display = 'block'
      label.textContent = labelText
      var input = root.document.createElement('input')
      input.name = name
      input.type = type
      input.required = true
      input.style.display = 'block'
      label.appendChild(input)
      return { label: label, input: input }
    }

    function renderBuy(el, productId) {
      var doc = root.document
      var button = doc.createElement('button')
      button.type = 'button'
      button.textContent = el.textContent || text.buy
      el.textContent = ''
      el.appendChild(button)
      button.addEventListener('click', function () {
        if (el.querySelector('form')) return
        var form = doc.createElement('form')
        var name = field(text.name, 'name', 'text')
        var phone = field(text.phone, 'phone', 'tel')
        var qty = field(text.quantity, 'quantity', 'number')
        qty.input.min = '1'
        qty.input.value = '1'
        var submit = doc.createElement('button')
        submit.type = 'submit'
        submit.textContent = text.submit
        var result = doc.createElement('p')
        result.setAttribute('role', 'status')
        form.appendChild(name.label)
        form.appendChild(phone.label)
        form.appendChild(qty.label)
        form.appendChild(submit)
        form.appendChild(result)
        el.appendChild(form)
        var idem = newIdempotencyKey()
        form.addEventListener('submit', function (event) {
          event.preventDefault()
          submit.disabled = true
          shop
            .createOrder(
              {
                items: [{ productId: productId, quantity: Number(qty.input.value) }],
                customer: { name: name.input.value, phone: phone.input.value },
              },
              { idempotencyKey: idem },
            )
            .then(
              function (order) {
                result.textContent = text.placed + order.orderNumber
                el.dispatchEvent(
                  new root.CustomEvent('hisabche:order', { detail: order, bubbles: true }),
                )
              },
              function (err) {
                result.textContent = text.failed + (err && err.code ? err.code : '')
                submit.disabled = false
              },
            )
        })
      })
    }

    return shop
  }

  // ─── Token widgets: no key, the token IS the access ─────────────────────
  //
  // For a link the business already sent the customer (an invoice's share
  // link, a portal link), embedded in the shop's own «my account» page.

  function getJson(url, fetchImpl) {
    return fetchImpl(url, { credentials: 'omit' }).then(function (res) {
      return res.json().then(
        function (data) {
          if (!res.ok)
            throw new HisabcheError((data && data.code) || 'HTTP_' + res.status, res.status)
          return data
        },
        function () {
          throw new HisabcheError('HTTP_' + res.status, res.status)
        },
      )
    })
  }

  function row(doc, parts) {
    var li = doc.createElement('li')
    li.textContent = parts
      .filter(function (p) {
        return p !== null && p !== undefined && p !== ''
      })
      .join(' · ')
    return li
  }

  function widgetOptions(opts) {
    var o = opts || {}
    return {
      apiBase: String(o.apiBase || 'https://api.hisabche.com/api').replace(/\/+$/, ''),
      fetch: o.fetch || root.fetch.bind(root),
    }
  }

  /** One invoice, from its share token: number, date, lines, total. */
  function renderInvoice(el, token, opts) {
    var o = widgetOptions(opts)
    var doc = root.document
    return getJson(o.apiBase + '/public/invoices/' + encodeURIComponent(token), o.fetch).then(
      function (inv) {
        el.textContent = ''
        var title = doc.createElement('strong')
        title.textContent = String(inv.invoiceNumber || '') + ' · ' + String(inv.date || '')
        var list = doc.createElement('ul')
        ;(inv.items || []).forEach(function (item) {
          list.appendChild(row(doc, [item.product_name, item.quantity, item.total_price]))
        })
        var total = doc.createElement('p')
        total.textContent = String(inv.total) + ' ' + String(inv.currency || '')
        el.appendChild(title)
        el.appendChild(list)
        el.appendChild(total)
        return inv
      },
    )
  }

  /** A customer's account, from their portal token: balance, invoices, payments. */
  function renderPortal(el, token, opts) {
    var o = widgetOptions(opts)
    var doc = root.document
    return getJson(o.apiBase + '/public/portal/' + encodeURIComponent(token), o.fetch).then(
      function (p) {
        el.textContent = ''
        var name = doc.createElement('strong')
        name.textContent = String(p.customerName || '')
        var balance = doc.createElement('p')
        balance.setAttribute('data-hisabche-balance', String(p.balance))
        balance.textContent = String(Math.abs(Number(p.balance) || 0))
        var invoices = doc.createElement('ul')
        ;(p.invoices || []).forEach(function (inv) {
          invoices.appendChild(
            row(doc, [
              inv.invoiceNumber,
              inv.date,
              inv.paidAmount + ' / ' + inv.total + ' ' + (inv.currency || ''),
            ]),
          )
        })
        var payments = doc.createElement('ul')
        ;(p.payments || []).forEach(function (pay) {
          payments.appendChild(row(doc, [pay.date, pay.amount + ' ' + (pay.currency || '')]))
        })
        el.appendChild(name)
        el.appendChild(balance)
        el.appendChild(invoices)
        el.appendChild(payments)
        return p
      },
    )
  }

  root.Hisabche = {
    init: init,
    renderInvoice: renderInvoice,
    renderPortal: renderPortal,
    version: '1.1.0',
    HisabcheError: HisabcheError,
  }
})(globalThis)
